<?php

namespace App\Http\Controllers;

use App\Exceptions\FirmaGobException;
use App\Models\Correspondencia;
use App\Models\Documento;
use App\Models\LibroCorrespondencia;
use App\Services\FirmaGobService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

/**
 * Libro de Correspondencia: documento oficial del período, con identidad
 * corporativa, firmado con FEA (FirmaGob) por el Oficial de Partes.
 * Mismo patrón preview-token → firma de las providencias. El PDF firmado
 * se conserva tal cual se emitió y es verificable por QR/código.
 */
class LibroCorrespondenciaController extends Controller
{
    private const PREVIEW_CACHE_PREFIX = 'libro_preview:';
    private const PREVIEW_TTL_MINUTES = 15;

    private const ESTADO_LABELS = [
        'pendiente' => 'Pendiente',
        'derivada_alcaldia' => 'Derivada a Alcaldía',
        'en_proceso' => 'En Proceso',
        'derivada_funcionario' => 'Derivada a Funcionario',
        'completada' => 'Completada',
        'archivado' => 'Archivada',
    ];

    /** Historial de libros generados. */
    public function index()
    {
        if ($denied = $this->soloOficialOAdmin()) {
            return $denied;
        }

        $libros = LibroCorrespondencia::with('generadoPor:id,nombre,cargo')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return $this->successResponse($libros);
    }

    /**
     * Genera el PDF del libro para el período y lo cachea con un token.
     * No persiste nada: el folio se confirma recién al firmar.
     */
    public function preview(Request $request)
    {
        if ($denied = $this->soloOficialOAdmin()) {
            return $denied;
        }

        $request->validate([
            'fecha_desde' => 'required|date',
            'fecha_hasta' => 'required|date|after_or_equal:fecha_desde',
        ]);

        $resultado = $this->generarPdf($request->fecha_desde, $request->fecha_hasta, Auth::user());

        $token = (string) Str::uuid();
        Cache::put(self::PREVIEW_CACHE_PREFIX . $token, [
            'user_id' => Auth::id(),
            'fecha_desde' => $request->fecha_desde,
            'fecha_hasta' => $request->fecha_hasta,
            'pdf_content' => base64_encode($resultado['pdf_content']),
            'folio' => $resultado['folio'],
            'codigo_verificacion' => $resultado['codigo_verificacion'],
            'total_registros' => $resultado['total_registros'],
        ], now()->addMinutes(self::PREVIEW_TTL_MINUTES));

        return response($resultado['pdf_content'], 200, [
            'Content-Type' => 'application/pdf',
            'X-Preview-Token' => $token,
            'Access-Control-Expose-Headers' => 'X-Preview-Token',
        ]);
    }

    /** Firma el libro previsualizado con FirmaGob y lo persiste. */
    public function firmar(Request $request)
    {
        if ($denied = $this->soloOficialOAdmin()) {
            return $denied;
        }

        $request->validate([
            'preview_token' => 'required|string',
            'otp'        => 'nullable|string',
            'firma_y'    => 'nullable|integer|min:10|max:712',
            'firma_page' => 'nullable|string',
            'firma_col'  => 'nullable|integer|in:0,1,2',
        ]);

        $user = Auth::user();
        $cached = Cache::get(self::PREVIEW_CACHE_PREFIX . $request->preview_token);
        if (!$cached || ($cached['user_id'] ?? null) !== $user->id) {
            return $this->errorResponse('La vista previa del libro expiró. Genera una nueva.', 422);
        }

        $pdfContent = base64_decode($cached['pdf_content']);
        $folio = $cached['folio'];

        if ($request->filled('otp') && config('firmagob.enabled')) {
            try {
                $colXCoords = [[71, 231], [233, 393], [395, 555]];
                [$llx, $urx] = $colXCoords[$request->firma_col ?? 2] ?? [395, 555];
                $firmaY = $request->firma_y ?? 20;

                $signed = app(FirmaGobService::class)->sign(
                    $pdfContent,
                    'Libro de Correspondencia ' . $folio,
                    $user->rut,
                    $request->otp,
                    $user->nombre,
                    $user->cargoFirma() ?? 'Oficial de Partes',
                    [$llx, $firmaY, $urx, $firmaY + 70],
                    $request->firma_page ?? 'LAST'
                );
                $pdfContent = $signed['content'];
                Log::info('Libro de correspondencia firmado con FirmaGob', ['folio' => $folio]);
            } catch (FirmaGobException $e) {
                return $this->errorResponse($e->getMessage(), 422);
            }
        }

        $filename = 'libro_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
        Storage::put('public/libros/' . $filename, $pdfContent);

        $libro = LibroCorrespondencia::create([
            'folio' => $folio,
            'fecha_desde' => $cached['fecha_desde'],
            'fecha_hasta' => $cached['fecha_hasta'],
            'total_registros' => $cached['total_registros'],
            'generado_por' => $user->id,
            'codigo_verificacion' => $cached['codigo_verificacion'],
            'pdf_ruta' => 'libros/' . $filename,
            'firmado' => $request->filled('otp') && config('firmagob.enabled'),
        ]);

        Cache::forget(self::PREVIEW_CACHE_PREFIX . $request->preview_token);

        $libro->load('generadoPor:id,nombre,cargo');

        return $this->successResponse($libro, "Libro {$folio} generado y firmado", 201);
    }

    /** Descarga el PDF firmado tal cual se emitió. */
    public function descargar(LibroCorrespondencia $libro)
    {
        if ($denied = $this->soloOficialOAdmin()) {
            return $denied;
        }

        if (!Storage::disk('public')->exists($libro->pdf_ruta)) {
            return $this->errorResponse('El archivo del libro no se encuentra en el servidor.', 404);
        }

        return Storage::disk('public')->download($libro->pdf_ruta, $libro->folio . '.pdf');
    }

    // =====================================================================

    private function soloOficialOAdmin()
    {
        $user = Auth::user();
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('Solo la Oficina de Partes o un administrador pueden gestionar el libro', 403);
        }
        return null;
    }

    /**
     * @return array{pdf_content: string, folio: string, codigo_verificacion: string, total_registros: int}
     */
    private function generarPdf(string $desde, string $hasta, $user): array
    {
        $correspondencias = Correspondencia::with([
            'departamento:id,nombre',
            'derivaciones.usuarioDestino:id,nombre',
            'derivaciones.departamentoDestino:id,nombre',
        ])
            ->entradas()
            ->whereDate('fecha_recibo', '>=', $desde)
            ->whereDate('fecha_recibo', '<=', $hasta)
            ->orderBy('fecha_recibo')
            ->orderBy('id')
            ->get();

        $registros = $correspondencias->map(fn ($c) => [
            'folio' => $c->folio,
            'numero_documento' => $c->numero_documento,
            'fecha_recibo' => $c->fecha_recibo?->format('d-m-Y'),
            'remitente' => $c->remitente,
            'materia' => Str::limit($c->descripcion, 90),
            'departamento' => $c->departamento?->nombre,
            'estado' => self::ESTADO_LABELS[$c->estado] ?? $c->estado,
            'derivada_a' => $c->derivaciones
                ->map(fn ($d) => $d->usuarioDestino?->nombre ?? $d->departamentoDestino?->nombre)
                ->filter()->unique()->implode(', '),
            'folios' => $c->derivaciones->pluck('folio')->filter()->implode(', '),
        ])->values()->all();

        $resumen = $correspondencias->groupBy('estado')
            ->map->count()
            ->mapWithKeys(fn ($n, $estado) => [self::ESTADO_LABELS[$estado] ?? $estado => $n])
            ->all();

        $folio = $this->generarFolio();
        $codigoVerificacion = Documento::generarCodigoVerificacion();

        $logoPath = storage_path('app/public/logo.png');
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
            : '';

        $appUrl = rtrim(config('app.verificacion_url'), '/');
        $verificarUrl = "{$appUrl}/verificar/{$codigoVerificacion}";
        $qrDataUri = '';
        try {
            $svg = (string) QrCode::format('svg')->size(160)->margin(0)->generate($verificarUrl);
            $qrDataUri = 'data:image/svg+xml;base64,' . base64_encode($svg);
        } catch (\Exception $e) {
            Log::warning('No se pudo generar QR para libro de correspondencia: ' . $e->getMessage());
        }

        $pdf = Pdf::loadView('pdf.libro-correspondencia', [
            'folio' => $folio,
            'fecha_emision' => now()->format('d/m/Y H:i'),
            'fecha_desde' => \Carbon\Carbon::parse($desde)->format('d/m/Y'),
            'fecha_hasta' => \Carbon\Carbon::parse($hasta)->format('d/m/Y'),
            'total' => count($registros),
            'registros' => $registros,
            'resumen' => $resumen,
            'firmante_nombre' => $user->nombre,
            'firmante_cargo' => $user->cargo ?? 'Oficial de Partes',
            'logo_base64' => $logoBase64,
            'codigo_verificacion' => $codigoVerificacion,
            'qr_data_uri' => $qrDataUri,
            'verificar_url' => $verificarUrl,
        ]);
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        return [
            'pdf_content' => $pdf->output(),
            'folio' => $folio,
            'codigo_verificacion' => $codigoVerificacion,
            'total_registros' => count($registros),
        ];
    }

    private function generarFolio(): string
    {
        $anio = now()->year;
        $ultimo = LibroCorrespondencia::where('folio', 'like', "LIBRO-{$anio}-%")
            ->orderByRaw('CAST(SUBSTRING_INDEX(folio, "-", -1) AS UNSIGNED) DESC')
            ->first();

        $siguiente = $ultimo
            ? (int) substr($ultimo->folio, strrpos($ultimo->folio, '-') + 1) + 1
            : 1;

        return sprintf('LIBRO-%d-%03d', $anio, $siguiente);
    }
}
