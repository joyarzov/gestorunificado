<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\DocumentoFirma;
use App\Models\DocumentoPlantilla;
use App\Models\Expediente;
use App\Models\ExpedienteActividad;
use App\Models\Correlativo;
use App\Models\TipoDocumental;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class DocumentoController extends Controller
{
    public function index(Request $request)
    {
        $query = Documento::with([
            'expedientes:id,identificador,titulo,estado',
            'tipoDocumental:id,nombre,codigo',
            'plantilla:id,nombre,codigo',
            'creador:id,nombre,rut',
            'firmas',
            'firmanteAsignado:id,nombre',
            'firmantesAsignados:id,nombre'
        ]);

        // Filtros
        if ($request->filled('expediente_id')) {
            $query->whereHas('expedientes', function ($q) use ($request) {
                $q->where('expedientes.id', $request->expediente_id);
            });
        }

        if ($request->filled('tipo_documental_id')) {
            $query->where('tipo_documental_id', $request->tipo_documental_id);
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('created_at', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('created_at', '<=', $request->fecha_hasta);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('numero', 'like', "%{$search}%")
                    ->orWhere('titulo', 'like', "%{$search}%")
                    ->orWhere('identificador', 'like', "%{$search}%");
            });
        }

        $documentos = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($documentos);
    }

    /**
     * Crear documento desde plantilla
     */
    public function store(Request $request)
    {
        $request->validate([
            'titulo' => 'required|string|max:500',
            'plantilla_id' => 'required|exists:documento_plantillas,id',
            'expediente_id' => 'nullable|exists:expedientes,id',
            'expedientes_ids' => 'nullable|array',
            'expedientes_ids.*' => 'exists:expedientes,id',
            'tipo_documental_id' => 'nullable|exists:tipos_documentales,id',
            'nivel_acceso' => 'required|integer|in:1,2,3,4',
            'contenido_json' => 'required|array',
            'palabras_clave' => 'nullable|string',
            'firmante_asignado_id' => 'nullable|exists:users,id',
            'firmantes_asignados' => 'nullable|array',
            'firmantes_asignados.*' => 'exists:users,id',
            'firmas_requeridas' => 'nullable|integer|min:1'
        ]);

        DB::beginTransaction();

        try {
            $plantilla = DocumentoPlantilla::findOrFail($request->plantilla_id);

            // Generar correlativo si hay tipo documental
            $datosCorrelativo = null;
            $tipoDocumentalId = $request->tipo_documental_id ?? $plantilla->tipo_documental_id;

            if ($tipoDocumentalId) {
                $datosCorrelativo = Documento::generarCorrelativo($tipoDocumentalId);
            }

            // Procesar contenido HTML
            $contenidoHtml = $this->procesarPlantilla($plantilla, $request->contenido_json);

            // Generar código de verificación e inyectar footer QR
            $codigoVerificacion = Documento::generarCodigoVerificacion();
            $contenidoHtml = $this->inyectarFooterVerificacion($contenidoHtml, $codigoVerificacion);

            $documento = Documento::create([
                'identificador' => Documento::generarIdentificador(),
                'codigo_verificacion' => $codigoVerificacion,
                'titulo' => $request->titulo,
                'expediente_id' => $request->expediente_id,
                'plantilla_id' => $plantilla->id,
                'tipo_documental_id' => $tipoDocumentalId,
                'numero' => $datosCorrelativo['completo'] ?? null,
                'estado' => Documento::ESTADO_BORRADOR,
                'nivel_acceso' => $request->nivel_acceso,
                'contenido_json' => $request->contenido_json,
                'contenido_html' => $contenidoHtml,
                'palabras_clave' => $request->palabras_clave,
                'formato' => 'HTML',
                'fecha_creacion' => now(),
                'mecanismo_incorporacion' => Documento::MECANISNO_DIGITAL,
                'creado_por' => Auth::id(),
                'actualizado_por' => Auth::id(),
                'firmante_asignado_id' => $request->firmante_asignado_id,
                'firmas_requeridas' => $request->firmas_requeridas,
                'anio' => date('Y'),
            ]);

            // Asignar múltiples firmantes si se proporcionaron
            if ($request->has('firmantes_asignados') && !empty($request->firmantes_asignados)) {
                foreach ($request->firmantes_asignados as $index => $userId) {
                    $documento->firmantesAsignados()->attach($userId, [
                        'orden' => $index + 1,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }

            // Asociar expedientes (many-to-many)
            $expedientesIds = $request->expedientes_ids ?? [];
            // Compatibilidad: si viene expediente_id singular, agregarlo
            if ($request->expediente_id && !in_array($request->expediente_id, $expedientesIds)) {
                $expedientesIds[] = $request->expediente_id;
            }

            if (!empty($expedientesIds)) {
                $documento->expedientes()->attach($expedientesIds);

                // Registrar actividad en cada expediente
                foreach ($expedientesIds as $expId) {
                    ExpedienteActividad::create([
                        'expediente_id' => $expId,
                        'usuario_id' => Auth::id(),
                        'tipo' => 'documento_creado',
                        'descripcion' => "Documento creado: {$documento->titulo}",
                        'metadata' => ['documento_id' => $documento->id],
                    ]);
                }
            }

            DB::commit();

            return $this->successResponse(
                $documento->load('plantilla', 'tipoDocumental', 'firmanteAsignado', 'firmantesAsignados', 'expedientes'),
                'Documento creado exitosamente',
                201
            );

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error al crear documento: ' . $e->getMessage());
            return $this->errorResponse('Error al crear documento: ' . $e->getMessage(), 500);
        }
    }

    public function show(Documento $documento)
    {
        $documento->load([
            'expedientes',
            'tipoDocumental',
            'plantilla',
            'creador:id,nombre,rut',
            'firmas.usuario',
            'firmanteAsignado',
            'firmantesAsignados',
        ]);

        return $this->successResponse($documento);
    }

    public function update(Request $request, Documento $documento)
    {
        if ($documento->estaFirmado()) {
            return $this->errorResponse('No se puede modificar un documento firmado', 400);
        }

        $request->validate([
            'titulo' => 'sometimes|string|max:500',
            'contenido_json' => 'sometimes|array',
            'palabras_clave' => 'nullable|string',
            'nivel_acceso' => 'sometimes|integer|in:1,2,3,4',
        ]);

        if ($request->has('contenido_json')) {
            $plantilla = $documento->plantilla;
            $contenidoHtml = $this->procesarPlantilla($plantilla, $request->contenido_json);
            $contenidoHtml = $this->inyectarFooterVerificacion($contenidoHtml, $documento->codigo_verificacion);
            $request->merge(['contenido_html' => $contenidoHtml]);
        }

        $documento->update($request->only([
            'titulo',
            'contenido_json',
            'contenido_html',
            'palabras_clave',
            'nivel_acceso',
        ]) + ['actualizado_por' => Auth::id()]);

        $documento->load(['plantilla', 'tipoDocumental', 'firmantesAsignados']);

        return $this->successResponse($documento, 'Documento actualizado');
    }

    public function destroy(Documento $documento)
    {
        if ($documento->estaFirmado()) {
            return $this->errorResponse('No se puede eliminar un documento firmado', 400);
        }

        DB::beginTransaction();
        try {
            // Eliminar archivo si existe
            if ($documento->archivo_pdf) {
                Storage::disk('public')->delete($documento->archivo_pdf);
            }

            // Registrar actividad si hay expediente
            if ($documento->expediente_id) {
                ExpedienteActividad::create([
                    'expediente_id' => $documento->expediente_id,
                    'usuario_id' => Auth::id(),
                    'tipo' => 'documento_eliminado',
                    'descripcion' => "Documento eliminado: {$documento->titulo}",
                ]);
            }

            $documento->delete();

            DB::commit();

            return $this->successResponse(null, 'Documento eliminado');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al eliminar documento: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Obtener plantillas activas
     */
    public function getPlantillas()
    {
        $plantillas = Cache::remember('plantillas_activas', 3600, function () {
            return DocumentoPlantilla::activas()
                ->with('tipoDocumental:id,nombre,codigo')
                ->get();
        });

        return response()->json($plantillas);
    }

    /**
     * Previsualizar plantilla con variables
     */
    public function previsualizarPlantilla(Request $request)
    {
        $request->validate([
            'plantilla_id' => 'required|exists:documento_plantillas,id',
            'contenido_json' => 'required|array'
        ]);

        $plantilla = DocumentoPlantilla::findOrFail($request->plantilla_id);
        $contenidoHtml = $this->procesarPlantilla($plantilla, $request->contenido_json);
        $contenidoHtml = $this->inyectarFooterVerificacion($contenidoHtml, 'XXXXXXXX');

        return response()->json([
            'html' => $contenidoHtml
        ]);
    }

    /**
     * Inyectar footer de verificación con QR al HTML del documento
     */
    private function inyectarFooterVerificacion(string $html, string $codigo): string
    {
        $appUrl = rtrim(config('app.url'), '/');
        $verificarUrl = "{$appUrl}/verificar/{$codigo}";

        $qrSvg = '';
        try {
            $qrSvg = QrCode::format('svg')->size(80)->margin(0)->generate($verificarUrl);
        } catch (\Exception $e) {
            Log::warning('No se pudo generar QR: ' . $e->getMessage());
        }

        // Bloque QR flotado a la derecha (se posiciona al nivel de la última sección)
        $qrBlock = '<div style="float:right;text-align:center;margin:0 0 10px 15px;">';
        if ($qrSvg) {
            $qrBlock .= '<div style="width:70px;height:70px;">' . $qrSvg . '</div>';
        }
        $qrBlock .= '<div style="font-size:6px;color:#888;margin-top:2px;">Verifique este documento</div>';
        $qrBlock .= '<div style="font-size:6px;color:#888;">C&oacute;d: <strong>' . htmlspecialchars($codigo) . '</strong></div>';
        $qrBlock .= '</div>';

        // Inyectar QR antes de la última sección principal (distribución, firma, fecha, etc.)
        // para que quede al mismo nivel visual (float:right)
        $lastSectionPos = strrpos($html, '<div style="margin-top:');
        if ($lastSectionPos !== false) {
            $html = substr($html, 0, $lastSectionPos) . $qrBlock . substr($html, $lastSectionPos);
        } elseif (stripos($html, '</body>') !== false) {
            $html = str_ireplace('</body>', $qrBlock . '</body>', $html);
        } else {
            $html .= $qrBlock;
        }

        return $html;
    }

    /**
     * Procesar plantilla reemplazando variables
     */
    private function procesarPlantilla(DocumentoPlantilla $plantilla, array $variables): string
    {
        $html = $plantilla->contenido_html;

        foreach ($variables as $key => $value) {
            $html = str_replace('{{' . $key . '}}', $value ?? '', $html);
        }

        return $html;
    }

    /**
     * Obtener próximo correlativo
     */
    public function obtenerProximoCorrelativo(Request $request)
    {
        $request->validate([
            'tipo_documental_id' => 'required|exists:tipos_documentales,id'
        ]);

        $tipoDocumental = TipoDocumental::find($request->tipo_documental_id);
        $numero = Correlativo::obtenerSiguiente($tipoDocumental->codigo);
        $anio = date('Y');

        return response()->json([
            'proximo_numero' => $numero,
            'proximo_formateado' => "{$numero}/{$anio}",
            'tipo_documental' => $tipoDocumental
        ]);
    }

    /**
     * Documentos pendientes de firma del usuario actual
     */
    public function pendientesFirma(Request $request)
    {
        $user = Auth::user();

        $documentos = Documento::where('estado', Documento::ESTADO_PENDIENTE_FIRMA)
            ->where(function ($query) use ($user) {
                $query->where('firmante_asignado_id', $user->id)
                    ->orWhereHas('firmantesAsignados', function ($q) use ($user) {
                        $q->where('user_id', $user->id);
                    });
            })
            ->whereDoesntHave('firmas', function ($q) use ($user) {
                $q->where('usuario_id', $user->id)
                    ->where('estado', 'firmado');
            })
            ->with(['expediente', 'creador', 'tipoDocumental'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($documentos);
    }

    /**
     * Enviar documento a firma
     */
    public function enviarAFirma(Documento $documento)
    {
        if ($documento->estado !== Documento::ESTADO_BORRADOR) {
            return $this->errorResponse('El documento debe estar en borrador para enviar a firma', 400);
        }

        // Verificar que tenga firmantes asignados
        $tieneFirmantes = $documento->firmantesAsignados()->count() > 0 || $documento->firmante_asignado_id;
        if (!$tieneFirmantes) {
            return $this->errorResponse('El documento debe tener al menos un firmante asignado', 400);
        }

        $documento->update([
            'estado' => Documento::ESTADO_PENDIENTE_FIRMA,
            'actualizado_por' => Auth::id()
        ]);

        return $this->successResponse($documento->load('firmantesAsignados'), 'Documento enviado a firma');
    }

    /**
     * Firmar documento (simulado)
     */
    public function firmar(Request $request, Documento $documento)
    {
        $user = Auth::user();

        if ($documento->estado !== Documento::ESTADO_PENDIENTE_FIRMA) {
            return $this->errorResponse('El documento debe estar en estado pendiente de firma', 400);
        }

        if (!$documento->puedeSerFirmadoPor($user)) {
            return $this->errorResponse('No tiene permisos para firmar este documento', 400);
        }

        $request->validate([
            'observaciones' => 'nullable|string|max:500',
        ]);

        DB::beginTransaction();
        try {
            $firma = $documento->registrarFirma($user, $request->observaciones);

            // Registrar actividad si hay expediente
            if ($documento->expediente_id) {
                ExpedienteActividad::create([
                    'expediente_id' => $documento->expediente_id,
                    'usuario_id' => $user->id,
                    'tipo' => 'documento_firmado',
                    'descripcion' => "Documento firmado por {$user->nombre}",
                    'metadata' => ['documento_id' => $documento->id],
                ]);
            }

            DB::commit();

            $documento->refresh();
            $documento->load(['firmas.usuario', 'firmantesAsignados']);

            return $this->successResponse($documento, 'Documento firmado exitosamente');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al firmar documento: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Rechazar firma
     */
    public function rechazarFirma(Request $request, Documento $documento)
    {
        $user = Auth::user();

        if (!$documento->puedeSerFirmadoPor($user)) {
            return $this->errorResponse('No tiene permisos para rechazar este documento', 400);
        }

        $request->validate([
            'motivo' => 'required|string|max:500',
        ]);

        DB::beginTransaction();
        try {
            DocumentoFirma::create([
                'documento_id' => $documento->id,
                'usuario_id' => $user->id,
                'fecha_firma' => now(),
                'observacion' => $request->motivo,
                'estado' => 'rechazado',
            ]);

            $documento->update([
                'estado' => Documento::ESTADO_RECHAZADO,
                'actualizado_por' => $user->id
            ]);

            // Registrar actividad
            if ($documento->expediente_id) {
                ExpedienteActividad::create([
                    'expediente_id' => $documento->expediente_id,
                    'usuario_id' => $user->id,
                    'tipo' => 'firma_rechazada',
                    'descripcion' => "Firma rechazada por {$user->nombre}: {$request->motivo}",
                    'metadata' => ['documento_id' => $documento->id],
                ]);
            }

            DB::commit();

            $documento->load(['firmas.usuario']);

            return $this->successResponse($documento, 'Firma rechazada');
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al rechazar firma: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Agregar firmante a documento
     */
    public function agregarFirmante(Request $request, Documento $documento)
    {
        if ($documento->estaFirmado()) {
            return $this->errorResponse('No se pueden agregar firmantes a un documento firmado', 400);
        }

        $request->validate([
            'usuario_id' => 'required|exists:users,id',
        ]);

        $existeFirmante = $documento->firmantesAsignados()
            ->where('user_id', $request->usuario_id)
            ->exists();

        if ($existeFirmante) {
            return $this->errorResponse('El usuario ya es firmante de este documento', 400);
        }

        $ultimoOrden = $documento->firmantesAsignados()->max('orden') ?? 0;

        $documento->firmantesAsignados()->attach($request->usuario_id, [
            'orden' => $ultimoOrden + 1,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $documento->load('firmantesAsignados');

        return $this->successResponse($documento, 'Firmante agregado');
    }

    /**
     * Estadísticas de documentos
     */
    public function estadisticas()
    {
        $stats = [
            'total' => Documento::count(),
            'por_estado' => [
                'borrador' => Documento::where('estado', Documento::ESTADO_BORRADOR)->count(),
                'pendiente_firma' => Documento::where('estado', Documento::ESTADO_PENDIENTE_FIRMA)->count(),
                'firmado' => Documento::where('estado', Documento::ESTADO_FIRMADO)->count(),
                'rechazado' => Documento::where('estado', Documento::ESTADO_RECHAZADO)->count(),
            ],
            'por_tipo' => Documento::selectRaw('tipo_documental_id, count(*) as total')
                ->groupBy('tipo_documental_id')
                ->with('tipoDocumental:id,nombre')
                ->get()
                ->pluck('total', 'tipoDocumental.nombre'),
            'creados_este_mes' => Documento::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
        ];

        return $this->successResponse($stats);
    }

    /**
     * Descargar documento (HTML como PDF o archivo original)
     */
    public function descargar(Documento $documento)
    {
        // Si tiene archivo PDF, descargarlo
        if ($documento->archivo_pdf && Storage::disk('public')->exists($documento->archivo_pdf)) {
            return Storage::disk('public')->download(
                $documento->archivo_pdf,
                $documento->identificador . '.pdf'
            );
        }

        // Si no, generar HTML como respuesta
        return response($documento->contenido_html)
            ->header('Content-Type', 'text/html')
            ->header('Content-Disposition', 'inline; filename="' . $documento->identificador . '.html"');
    }
}
