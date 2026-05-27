<?php

namespace App\Http\Controllers;

use App\Models\Derivacion;
use App\Models\Correspondencia;
use App\Models\Notificacion;
use App\Models\User;
use App\Services\FirmaGobService;
use App\Services\ProvidenciaPdfService;
use App\Exceptions\FirmaGobException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DerivacionController extends Controller
{
    private const PREVIEW_CACHE_PREFIX = 'derivacion_preview:';
    private const PREVIEW_TTL_MINUTES = 15;

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
            'preview_token' => 'nullable|string',
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
            'actuando_como_user_id' => $user->getActuandoComo()?->id,
            'observaciones' => $request->observaciones,
            'acciones_para' => $request->acciones_para,
            'estado' => 'pendiente',
        ];

        // Si es alcalde derivando a funcionario, obtener providencia (de cache si vino preview_token)
        if ($esAlcaldeDerivando) {
            $correspondencia->load(['departamento']);

            $resolved = $this->resolverProvidencia(
                $request->preview_token,
                $user,
                $correspondencia,
                fn () => $this->paramsProvidenciaDerivar($request, $user)
            );

            if ($resolved === null) {
                return $this->errorResponse(
                    'La vista previa de la providencia expiró. Vuelve a derivar para regenerarla.',
                    422
                );
            }

            $pdfContent = $resolved['pdf_content'];
            $folio = $resolved['folio'];
            $codigoVerificacion = $resolved['codigo_verificacion'];

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
                    $pdfContent = $signed['content'];
                    Log::info('Providencia firmada con FirmaGob', ['folio' => $folio]);
                } catch (FirmaGobException $e) {
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            // Persistir PDF (firmado o no) sólo después de que la firma haya tenido éxito
            $filename = 'providencia_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            Storage::put($path, $pdfContent);

            $derivacionData['folio'] = $folio;
            $derivacionData['codigo_verificacion'] = $codigoVerificacion;
            $derivacionData['pdf_ruta'] = 'providencias/' . $filename;

            $this->descartarPreview($request->preview_token);
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

    /**
     * Si viene preview_token y es válido, retorna el PDF cacheado.
     * Si no viene token, genera un PDF fresco usando el callback de parámetros.
     * Retorna null si el token vino pero no es válido (expirado o de otro usuario/correspondencia).
     *
     * @return array{pdf_content: string, folio: string, codigo_verificacion: string}|null
     */
    private function resolverProvidencia(
        ?string $token,
        User $user,
        Correspondencia $correspondencia,
        callable $paramsBuilder
    ): ?array {
        if (!empty($token)) {
            $cached = Cache::get(self::PREVIEW_CACHE_PREFIX . $token);
            if (!$cached
                || ($cached['user_id'] ?? null) !== $user->id
                || ($cached['correspondencia_id'] ?? null) !== $correspondencia->id) {
                return null;
            }
            return [
                'pdf_content'         => base64_decode($cached['pdf_content']),
                'folio'               => $cached['folio'],
                'codigo_verificacion' => $cached['codigo_verificacion'],
            ];
        }

        return app(ProvidenciaPdfService::class)->generar($correspondencia, $paramsBuilder());
    }

    private function descartarPreview(?string $token): void
    {
        if (!empty($token)) {
            Cache::forget(self::PREVIEW_CACHE_PREFIX . $token);
        }
    }

    /**
     * Construye los parámetros para una providencia generada al derivar (alcalde → funcionario).
     */
    private function paramsProvidenciaDerivar(Request $request, User $user): array
    {
        $deptoDestino = \App\Models\Departamento::find($request->departamento_destino_id);
        $usuarioDestino = $request->usuario_destino_id ? User::find($request->usuario_destino_id) : null;

        return array_merge(
            $this->paramsTitularYSubrogante($user),
            [
                'departamento_destino' => $deptoDestino?->nombre ?? '',
                'usuario_destino'      => $usuarioDestino?->nombre ?? '',
                'acciones_para'        => $request->acciones_para ?? [],
                'observaciones'        => $request->observaciones,
            ]
        );
    }

    /**
     * Construye los parámetros para una providencia generada al marcar como recibida.
     * Por defecto la providencia queda dirigida a Alcaldía.
     */
    private function paramsProvidenciaRecibir(User $user): array
    {
        $base = $this->paramsTitularYSubrogante($user);
        $deptoNombre = $base['departamento_origen'];

        return array_merge($base, [
            'departamento_destino' => $deptoNombre,
            'usuario_destino'      => '',
            'acciones_para'        => [],
            'observaciones'        => null,
        ]);
    }

    /**
     * Bloque común: si el actor está actuando como subrogado, el "titular" del
     * cargo (lo que aparece en el cuerpo de la providencia) es el subrogado;
     * el "subrogante" es el actor real que firma. Si no hay subrogancia,
     * titular = actor y no se pasa subrogante.
     */
    private function paramsTitularYSubrogante(User $user): array
    {
        $titular = $user->getActuandoComo();

        if ($titular) {
            $titular->loadMissing('departamento');
            return [
                'usuario_origen'      => $titular->nombre,
                'cargo_titular'       => $titular->cargo ?? 'Alcalde',
                'departamento_origen' => $titular->departamento?->nombre ?? 'Alcaldía',
                'subrogante_nombre'   => $user->nombre,
                'subrogante_cargo'    => $user->cargo,
            ];
        }

        return [
            'usuario_origen'      => $user->nombre,
            'cargo_titular'       => $user->cargo ?? 'Alcalde',
            'departamento_origen' => $user->departamento?->nombre ?? 'Alcaldía',
            'subrogante_nombre'   => null,
            'subrogante_cargo'    => null,
        ];
    }

    /**
     * Genera la providencia, la cachea con un token UUID y la retorna como blob.
     * No persiste nada en disco ni base de datos.
     */
    public function previewDerivar(Request $request)
    {
        $request->validate([
            'correspondencia_id'      => 'required|exists:correspondencia,id',
            'departamento_destino_id' => 'required|exists:departamentos,id',
            'usuario_destino_id'      => 'nullable|exists:users,id',
            'observaciones'           => 'nullable|string',
            'acciones_para'           => 'nullable|array',
            'acciones_para.*'         => 'string',
        ]);

        $user = Auth::user();
        $correspondencia = Correspondencia::find($request->correspondencia_id);

        if (!$user->isAlcalde() || $correspondencia->estado !== 'derivada_alcaldia') {
            return $this->errorResponse('Sólo el Alcalde puede generar una providencia desde una correspondencia derivada a Alcaldía', 403);
        }

        $correspondencia->load(['departamento']);

        $generated = app(ProvidenciaPdfService::class)->generar(
            $correspondencia,
            $this->paramsProvidenciaDerivar($request, $user)
        );

        return $this->cachearYDevolverPreview($generated, $user, $correspondencia);
    }

    /**
     * Genera la providencia de "marcar como recibida" (dirigida a Alcaldía por defecto),
     * la cachea y retorna el blob.
     */
    public function previewRecibir(Derivacion $derivacion)
    {
        $user = Auth::user();

        if (!$user->isAlcalde()) {
            return $this->errorResponse('Sólo el Alcalde puede previsualizar la providencia de recepción', 403);
        }

        if ($derivacion->departamento_destino_id !== $user->contexto()->departamento_id) {
            return $this->errorResponse('No tienes permiso para esta derivación', 403);
        }

        $correspondencia = $derivacion->correspondencia;
        $correspondencia->load(['departamento']);

        $generated = app(ProvidenciaPdfService::class)->generar(
            $correspondencia,
            $this->paramsProvidenciaRecibir($user)
        );

        return $this->cachearYDevolverPreview($generated, $user, $correspondencia);
    }

    private function cachearYDevolverPreview(array $generated, User $user, Correspondencia $correspondencia)
    {
        $token = (string) Str::uuid();
        Cache::put(
            self::PREVIEW_CACHE_PREFIX . $token,
            [
                'pdf_content'         => base64_encode($generated['pdf_content']),
                'folio'               => $generated['folio'],
                'codigo_verificacion' => $generated['codigo_verificacion'],
                'user_id'             => $user->id,
                'correspondencia_id'  => $correspondencia->id,
            ],
            now()->addMinutes(self::PREVIEW_TTL_MINUTES)
        );

        return response($generated['pdf_content'], 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="providencia-preview.pdf"',
            'X-Preview-Token'     => $token,
            'Access-Control-Expose-Headers' => 'X-Preview-Token',
        ]);
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
        // Switch limpio: si hay subrogancia activa (X-Actuando-Como), la bandeja
        // es la del subrogado. Sin toggle, es la propia. El usuario real
        // (Auth::user()) solo importa para trazabilidad y firma, no aquí.
        $ctx = Auth::user()->contexto();

        $derivaciones = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'usuarioOrigen',
            'usuarioDestino:id,nombre,cargo',
            'actuandoComo:id,nombre,cargo',
        ])
            ->where('departamento_destino_id', $ctx->departamento_id)
            ->whereIn('estado', ['pendiente', 'recibido', 'derivado'])
            ->where(function ($q) use ($ctx) {
                $q->whereNull('usuario_destino_id')
                    ->orWhere('usuario_destino_id', $ctx->id);
            })
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($derivaciones);
    }

    public function recibir(Request $request, Derivacion $derivacion)
    {
        $user = Auth::user();

        if ($derivacion->departamento_destino_id !== $user->contexto()->departamento_id) {
            return $this->errorResponse('No tienes permiso para recibir esta derivación', 403);
        }

        // Si es Alcalde, generar y firmar una Providencia (dirigida a Alcaldía por defecto) con FirmaGob
        if ($user->isAlcalde()) {
            $request->validate([
                'otp'        => 'required|string',
                'firma_y'    => 'nullable|integer|min:10|max:712',
                'firma_page' => 'nullable|string',
                'firma_col'  => 'nullable|integer|in:0,1,2',
                'preview_token' => 'nullable|string',
            ]);

            $correspondencia = $derivacion->correspondencia;
            $correspondencia->load(['departamento']);

            $resolved = $this->resolverProvidencia(
                $request->preview_token,
                $user,
                $correspondencia,
                fn () => $this->paramsProvidenciaRecibir($user)
            );

            if ($resolved === null) {
                return $this->errorResponse(
                    'La vista previa de la providencia expiró. Vuelve a marcar como recibida para regenerarla.',
                    422
                );
            }

            $pdfContent = $resolved['pdf_content'];
            $folio = $resolved['folio'];
            $codigoVerificacion = $resolved['codigo_verificacion'];

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
                        'Providencia ' . $folio,
                        $user->rut,
                        $request->otp,
                        $user->nombre,
                        $user->cargo ?? 'Alcalde',
                        $coords,
                        $firmaPage
                    );
                    $pdfContent = $signed['content'];
                    Log::info('Providencia (recepción) firmada con FirmaGob', ['folio' => $folio]);
                } catch (FirmaGobException $e) {
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            // Persistir PDF en disco sólo después de firma exitosa
            $filename = 'providencia_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            Storage::put($path, $pdfContent);

            $derivacion->update([
                'folio'              => $folio,
                'codigo_verificacion' => $codigoVerificacion,
                'pdf_ruta'           => 'providencias/' . $filename,
            ]);

            // Reflejar en la correspondencia que ya hay providencia generada
            $correspondencia->update([
                'providencia_pdf'      => 'providencias/' . $filename,
                'providencia_generada' => true,
            ]);

            $this->descartarPreview($request->preview_token);
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

        if ($derivacion->departamento_destino_id !== $user->contexto()->departamento_id) {
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
