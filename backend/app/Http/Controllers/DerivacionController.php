<?php

namespace App\Http\Controllers;

use App\Models\Derivacion;
use App\Models\Correspondencia;
use App\Models\Documento;
use App\Models\Notificacion;
use App\Models\User;
use App\Services\FirmaGobService;
use App\Exceptions\FirmaGobException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class DerivacionController extends Controller
{
    public function index(Request $request)
    {
        $query = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino',
        ]);

        if ($request->filled('correspondencia_id')) {
            $query->where('correspondencia_id', $request->correspondencia_id);
        }

        $derivaciones = $query->orderBy('created_at', 'desc')->get();

        return $this->successResponse($derivaciones);
    }

    public function store(Request $request)
    {
        $request->validate([
            'correspondencia_id' => 'required|exists:correspondencia,id',
            'departamento_destino_id' => 'required|exists:departamentos,id',
            'usuario_destino_id' => 'nullable|exists:users,id',
            'observaciones' => 'nullable|string',
            'acciones_para' => 'nullable|array',
            'acciones_para.*' => 'string',
            'otp'        => 'nullable|string',
            'firma_y'    => 'nullable|integer|min:10|max:712',
            'firma_page' => 'nullable|string',
            'firma_col'  => 'nullable|integer|in:0,1,2',
        ]);

        $user = Auth::user();
        $correspondencia = Correspondencia::find($request->correspondencia_id);
        $esAlcaldeDerivando = $user->isAlcalde() && $correspondencia->estado === 'derivada_alcaldia';

        $derivacionData = [
            'correspondencia_id' => $request->correspondencia_id,
            'departamento_origen_id' => $user->departamento_id,
            'departamento_destino_id' => $request->departamento_destino_id,
            'usuario_origen_id' => $user->id,
            'usuario_destino_id' => $request->usuario_destino_id,
            'observaciones' => $request->observaciones,
            'acciones_para' => $request->acciones_para,
            'estado' => 'pendiente',
        ];

        // Si es alcalde derivando a funcionario, generar providencia PDF
        if ($esAlcaldeDerivando) {
            $folio = $this->generarFolioProvidencia();
            $derivacionData['folio'] = $folio;

            // Generar código de verificación
            $codigoVerificacion = Documento::generarCodigoVerificacion();
            $derivacionData['codigo_verificacion'] = $codigoVerificacion;

            // Cargar relaciones necesarias para el PDF
            $correspondencia->load(['departamento']);
            $deptoDestino = \App\Models\Departamento::find($request->departamento_destino_id);
            $usuarioDestino = $request->usuario_destino_id ? User::find($request->usuario_destino_id) : null;

            // Embeber logo en base64 para dompdf
            $logoPath = storage_path('app/public/logo.png');
            $logoBase64 = '';
            if (file_exists($logoPath)) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            }

            // Generar QR SVG
            $appUrl = rtrim(config('app.url'), '/');
            $verificarUrl = "{$appUrl}/verificar/{$codigoVerificacion}";
            $qrSvg = '';
            try {
                $qrSvg = (string) QrCode::format('svg')->size(80)->margin(0)->generate($verificarUrl);
            } catch (\Exception $e) {
                Log::warning('No se pudo generar QR para providencia: ' . $e->getMessage());
            }

            $pdfData = [
                'folio' => $folio,
                'fecha' => now()->format('d \d\e ') . $this->mesEnEspanol(now()->month) . now()->format(' \d\e Y'),
                'remitente' => $correspondencia->remitente,
                'numero_documento' => $correspondencia->numero_documento,
                'fecha_recepcion' => $correspondencia->fecha_recibo ? $correspondencia->fecha_recibo->format('d/m/Y') : 'No especificada',
                'descripcion' => $correspondencia->descripcion,
                'usuario_origen' => $user->nombre,
                'departamento_origen' => $user->departamento?->nombre ?? 'Alcaldía',
                'departamento_destino' => $deptoDestino?->nombre ?? '',
                'usuario_destino' => $usuarioDestino?->nombre ?? '',
                'acciones_para' => $request->acciones_para ?? [],
                'observaciones' => $request->observaciones,
                'logo_base64' => $logoBase64,
                'codigo_verificacion' => $codigoVerificacion,
                'qr_svg' => $qrSvg,
                'verificar_url' => $verificarUrl,
            ];

            $pdf = Pdf::loadView('pdf.providencia', $pdfData);
            $pdf->setPaper('letter');

            $filename = 'providencia_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            $pdfContent = $pdf->output();
            Storage::put($path, $pdfContent);

            // Firmar con FirmaGob si viene OTP
            if ($request->filled('otp') && config('firmagob.enabled')) {
                try {
                    $firmaService = app(FirmaGobService::class);
                    $coords = $this->calcularCoordenadas(
                        $request->firma_y   ?? 20,
                        $request->firma_col ?? 2
                    );
                    $firmaPage = $request->firma_page ?? 'LAST';
                    $signed = $firmaService->sign(
                        $pdfContent,
                        'Providencia ' . $folio,
                        $user->rut,
                        $request->otp,
                        $user->nombre,
                        $user->cargo ?? 'Alcalde',
                        $coords,
                        $firmaPage
                    );
                    Storage::put($path, $signed['content']);
                    Log::info('Providencia firmada con FirmaGob', ['folio' => $folio]);
                } catch (FirmaGobException $e) {
                    Storage::delete($path);
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            $derivacionData['pdf_ruta'] = 'providencias/' . $filename;
        }

        $derivacion = Derivacion::create($derivacionData);

        // Actualizar estado de la correspondencia
        if ($esAlcaldeDerivando) {
            $correspondencia->update([
                'estado' => 'derivada_funcionario',
                'providencia_pdf' => $derivacionData['pdf_ruta'],
                'providencia_generada' => true,
            ]);

            // Marcar la derivación original del alcalde como "derivado"
            Derivacion::where('correspondencia_id', $correspondencia->id)
                ->where('departamento_destino_id', $user->departamento_id)
                ->whereIn('estado', ['pendiente', 'recibido'])
                ->where('id', '!=', $derivacion->id)
                ->update(['estado' => 'derivado']);
        } else {
            $nuevoEstado = 'en_proceso';

            // Check if derivation is to the alcalde (by user or department)
            $esDerivacionAAlcalde = false;

            if ($request->usuario_destino_id) {
                $destinatario = User::find($request->usuario_destino_id);
                if ($destinatario && $destinatario->isAlcalde()) {
                    $esDerivacionAAlcalde = true;
                }
            }

            // Also check if destination department has an alcalde user
            if (!$esDerivacionAAlcalde) {
                $alcaldeEnDestino = User::where('departamento_id', $request->departamento_destino_id)
                    ->whereJsonContains('roles', 'alcalde')
                    ->exists();
                if ($alcaldeEnDestino) {
                    $esDerivacionAAlcalde = true;
                }
            }

            if ($esDerivacionAAlcalde) {
                $nuevoEstado = 'derivada_alcaldia';
            }

            $correspondencia->update(['estado' => $nuevoEstado]);
        }

        $derivacion->load([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
        ]);

        // Notificar a usuarios del departamento destino
        $deptoDestinoNombre = $derivacion->departamentoDestino->nombre ?? 'Destino';
        $usuariosDestino = User::where('departamento_id', $request->departamento_destino_id)->get();
        foreach ($usuariosDestino as $usuarioDestino) {
            Notificacion::create([
                'user_id' => $usuarioDestino->id,
                'tipo' => 'correspondencia_recibida',
                'titulo' => 'Nueva correspondencia en tu bandeja',
                'mensaje' => "Se ha derivado la correspondencia de \"{$correspondencia->remitente}\" a {$deptoDestinoNombre}.",
                'data' => ['correspondencia_id' => $correspondencia->id, 'derivacion_id' => $derivacion->id, 'url' => '/correspondencia/' . $correspondencia->id],
            ]);
        }

        $message = $esAlcaldeDerivando
            ? 'Derivación creada con providencia generada'
            : 'Derivación creada correctamente';

        return $this->successResponse($derivacion, $message, 201);
    }

    /**
     * Descarga el PDF asociado a una derivación (providencia o acuse de recibo).
     */
    public function pdf(Derivacion $derivacion)
    {
        $user = Auth::user();

        // Verificar acceso: origen, destino o admin
        $tieneAcceso = $user->isAdmin()
            || $derivacion->usuario_origen_id === $user->id
            || $derivacion->usuario_destino_id === $user->id
            || $derivacion->departamento_origen_id === $user->departamento_id
            || $derivacion->departamento_destino_id === $user->departamento_id
            || $user->isAlcalde();

        if (!$tieneAcceso) {
            return $this->errorResponse('Sin acceso a este documento', 403);
        }

        if (!$derivacion->pdf_ruta) {
            return $this->errorResponse('Esta derivación no tiene PDF generado', 404);
        }

        $fullPath = storage_path('app/public/' . $derivacion->pdf_ruta);
        if (!file_exists($fullPath)) {
            return $this->errorResponse('Archivo no encontrado', 404);
        }

        return response()->file($fullPath, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . basename($fullPath) . '"',
        ]);
    }

    /**
     * Calcula las coordenadas del sello [llx, lly, urx, ury] a partir de Y y columna.
     */
    private function calcularCoordenadas(int $firmaY, int $firmaCol): array
    {
        $colXCoords = [[71, 231], [233, 393], [395, 555]];
        [$llx, $urx] = $colXCoords[$firmaCol] ?? $colXCoords[2];
        return [$llx, $firmaY, $urx, $firmaY + 70];
    }

    private function generarFolioAcuse(): string
    {
        $anio = now()->year;
        $ultimo = Derivacion::where('folio', 'like', "ACUSE-{$anio}-%")
            ->orderByRaw('CAST(SUBSTRING_INDEX(folio, "-", -1) AS UNSIGNED) DESC')
            ->first();

        $siguiente = $ultimo
            ? (int) substr($ultimo->folio, strrpos($ultimo->folio, '-') + 1) + 1
            : 1;

        return sprintf('ACUSE-%d-%05d', $anio, $siguiente);
    }

    private function generarFolioProvidencia(): string
    {
        $anio = now()->year;
        $ultimaDerivacion = Derivacion::where('folio', 'like', "PROV-{$anio}-%")
            ->orderByRaw('CAST(SUBSTRING_INDEX(folio, "-", -1) AS UNSIGNED) DESC')
            ->first();

        if ($ultimaDerivacion) {
            $ultimoNumero = (int) substr($ultimaDerivacion->folio, strrpos($ultimaDerivacion->folio, '-') + 1);
            $siguiente = $ultimoNumero + 1;
        } else {
            $siguiente = 1;
        }

        return sprintf('PROV-%d-%05d', $anio, $siguiente);
    }

    private function mesEnEspanol(int $mes): string
    {
        $meses = [
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
            5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
            9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
        ];
        return $meses[$mes] ?? '';
    }

    public function show(Derivacion $derivacion)
    {
        $derivacion->load([
            'correspondencia.adjuntos',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino',
        ]);

        return $this->successResponse($derivacion);
    }

    public function pendientes()
    {
        $user = Auth::user();

        $derivaciones = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'usuarioOrigen',
        ])
            ->where('departamento_destino_id', $user->departamento_id)
            ->whereIn('estado', ['pendiente', 'recibido', 'derivado'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($derivaciones);
    }

    public function recibir(Request $request, Derivacion $derivacion)
    {
        $user = Auth::user();

        if ($derivacion->departamento_destino_id !== $user->departamento_id) {
            return $this->errorResponse('No tienes permiso para recibir esta derivación', 403);
        }

        // Si es Alcalde, generar y firmar un Acuse de Recibo con FirmaGob
        if ($user->isAlcalde()) {
            $request->validate([
                'otp'        => 'required|string',
                'firma_y'    => 'nullable|integer|min:10|max:712',
                'firma_page' => 'nullable|string',
                'firma_col'  => 'nullable|integer|in:0,1,2',
            ]);

            $correspondencia = $derivacion->correspondencia;
            $correspondencia->load(['departamento']);

            $folio = $this->generarFolioAcuse();
            $codigoVerificacion = Documento::generarCodigoVerificacion();

            $logoPath = storage_path('app/public/logo.png');
            $logoBase64 = '';
            if (file_exists($logoPath)) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            }

            $appUrl = rtrim(config('app.url'), '/');
            $verificarUrl = "{$appUrl}/verificar/{$codigoVerificacion}";
            $qrSvg = '';
            try {
                $qrSvg = (string) QrCode::format('svg')->size(80)->margin(0)->generate($verificarUrl);
            } catch (\Exception $e) {
                Log::warning('QR no generado para acuse de recibo: ' . $e->getMessage());
            }

            $pdfData = [
                'folio'            => $folio,
                'fecha'            => now()->format('d \d\e ') . $this->mesEnEspanol(now()->month) . now()->format(' \d\e Y'),
                'remitente'        => $correspondencia->remitente,
                'numero_documento' => $correspondencia->numero_documento,
                'fecha_recepcion'  => $correspondencia->fecha_recibo
                    ? $correspondencia->fecha_recibo->format('d/m/Y')
                    : 'No especificada',
                'descripcion'      => $correspondencia->descripcion,
                'receptor'         => $user->nombre,
                'logo_base64'      => $logoBase64,
                'codigo_verificacion' => $codigoVerificacion,
                'qr_svg'           => $qrSvg,
                'verificar_url'    => $verificarUrl,
            ];

            $pdf = Pdf::loadView('pdf.acuse_recibo', $pdfData);
            $pdf->setPaper('letter');

            $filename = 'acuse_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            $pdfContent = $pdf->output();
            Storage::put($path, $pdfContent);

            // Firmar con FirmaGob
            if (config('firmagob.enabled')) {
                try {
                    $firmaService = app(FirmaGobService::class);
                    $coords = $this->calcularCoordenadas(
                        $request->firma_y   ?? 20,
                        $request->firma_col ?? 2
                    );
                    $firmaPage = $request->firma_page ?? 'LAST';
                    $signed = $firmaService->sign(
                        $pdfContent,
                        'Acuse de Recibo ' . $folio,
                        $user->rut,
                        $request->otp,
                        $user->nombre,
                        $user->cargo ?? 'Alcalde',
                        $coords,
                        $firmaPage
                    );
                    Storage::put($path, $signed['content']);
                    Log::info('Acuse de recibo firmado con FirmaGob', ['folio' => $folio]);
                } catch (FirmaGobException $e) {
                    Storage::delete($path);
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            $derivacion->update([
                'folio'              => $folio,
                'codigo_verificacion' => $codigoVerificacion,
                'pdf_ruta'           => 'providencias/' . $filename,
            ]);
        }

        $derivacion->update([
            'estado' => 'recibido',
            'usuario_destino_id' => $user->id,
            'fecha_recepcion' => now(),
        ]);

        // Actualizar correspondencia a completada
        $correspondencia = $derivacion->correspondencia;
        if ($correspondencia && in_array($correspondencia->estado, ['derivada_funcionario', 'derivada_alcaldia'])) {
            $correspondencia->update(['estado' => 'completada']);

            // Marcar la derivación del alcalde como completada
            Derivacion::where('correspondencia_id', $correspondencia->id)
                ->where('estado', 'derivado')
                ->update(['estado' => 'recibido']);

            // Notificar al usuario que derivó originalmente
            if ($derivacion->usuario_origen_id) {
                Notificacion::create([
                    'user_id' => $derivacion->usuario_origen_id,
                    'tipo' => 'correspondencia_completada',
                    'titulo' => 'Correspondencia completada',
                    'mensaje' => "La correspondencia de \"{$correspondencia->remitente}\" fue recibida y completada por {$user->nombre}.",
                    'data' => ['correspondencia_id' => $correspondencia->id, 'url' => '/correspondencia/' . $correspondencia->id],
                ]);
            }
        }

        return $this->successResponse($derivacion, 'Derivación recibida');
    }

    public function archivar(Derivacion $derivacion)
    {
        $user = Auth::user();

        if ($derivacion->departamento_destino_id !== $user->departamento_id) {
            return $this->errorResponse('No tienes permiso para archivar esta derivación', 403);
        }

        $derivacion->update(['estado' => 'archivado']);

        // Verificar si todas las derivaciones están archivadas
        $pendientes = Derivacion::where('correspondencia_id', $derivacion->correspondencia_id)
            ->where('estado', '!=', 'archivado')
            ->count();

        if ($pendientes === 0) {
            $derivacion->correspondencia->update(['estado' => 'archivado']);
        }

        return $this->successResponse($derivacion, 'Derivación archivada');
    }
}
