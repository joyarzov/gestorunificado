<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\DocumentoFirma;
use App\Models\DocumentoPlantilla;
use App\Models\DocumentoTrazabilidad;
use App\Models\Expediente;
use App\Models\ExpedienteActividad;
use App\Models\Correlativo;
use App\Models\Notificacion;
use App\Models\TipoDocumental;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use App\Services\FirmaGobService;
use App\Services\PdfSignatureDetector;
use App\Exceptions\FirmaGobException;

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

        if ($request->input('creado_por') === 'me') {
            $query->where('creado_por', $request->user()->id);
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

            $tipoDocumentalId = $request->tipo_documental_id ?? $plantilla->tipo_documental_id;

            // Número de documento: el usuario lo ingresa y se combina con el año
            $contenidoJson = $request->contenido_json;
            $numeroIngresado = $contenidoJson['numero'] ?? null;
            $anio = date('Y');
            $numeroCompleto = $numeroIngresado ? "{$numeroIngresado}/{$anio}" : null;

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
                'numero' => $numeroCompleto,
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

            DocumentoTrazabilidad::registrar($documento->id, 'creado', 'Documento creado');

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

            // Actualizar número si el usuario cambió el campo numero
            $numeroIngresado = $request->contenido_json['numero'] ?? null;
            if ($numeroIngresado) {
                $anio = date('Y');
                $request->merge(['numero' => "{$numeroIngresado}/{$anio}"]);
            }
        }

        $camposModificados = array_keys($request->only([
            'titulo', 'contenido_json', 'palabras_clave', 'nivel_acceso',
        ]));

        $documento->update($request->only([
            'titulo',
            'contenido_json',
            'contenido_html',
            'numero',
            'palabras_clave',
            'nivel_acceso',
        ]) + ['actualizado_por' => Auth::id()]);

        DocumentoTrazabilidad::registrar($documento->id, 'editado', 'Documento editado', [
            'campos_modificados' => $camposModificados,
        ]);

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

            DocumentoTrazabilidad::registrar($documento->id, 'eliminado', 'Documento eliminado');

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
        $placeholder = function (string $nombre): string {
            return '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:3px;font-style:italic;font-size:0.9em;">[ falta: ' . e($nombre) . ' ]</span>';
        };

        // Reemplazar variables con valor; si el valor está vacío, dejar marcador visible
        foreach ($variables as $key => $value) {
            $valor = is_scalar($value) ? (string) $value : '';
            $reemplazo = trim($valor) === '' ? $placeholder((string) $key) : $valor;
            $html = str_replace('{{' . $key . '}}', $reemplazo, $html);
        }

        // Variables declaradas en la plantilla pero nunca enviadas también deben marcarse
        $html = preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function ($m) use ($placeholder) {
            return $placeholder($m[1]);
        }, $html);

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

        DocumentoTrazabilidad::registrar($documento->id, 'enviado_a_firma', 'Documento enviado a firma');

        // Notificar a cada firmante asignado
        $firmantes = $documento->firmantesAsignados;
        if ($firmantes->isEmpty() && $documento->firmante_asignado_id) {
            $firmantes = collect([\App\Models\User::find($documento->firmante_asignado_id)]);
        }
        foreach ($firmantes as $firmante) {
            Notificacion::create([
                'user_id' => $firmante->id,
                'tipo' => 'documento_pendiente_firma',
                'titulo' => 'Documento pendiente de tu firma',
                'mensaje' => "El documento \"{$documento->titulo}\" ({$documento->numero}) requiere tu firma.",
                'data' => ['documento_id' => $documento->id],
            ]);
        }

        return $this->successResponse($documento->load('firmantesAsignados'), 'Documento enviado a firma');
    }

    /**
     * Firmar documento
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
            'otp'           => 'nullable|string|max:10',
            'firma_y'       => 'nullable|integer|min:10|max:712',
            'firma_page'    => 'nullable|string',
            'firma_col'     => 'nullable|integer|in:0,1,2',
        ]);

        // Columna: usar la elegida por el usuario o auto-calcular según firmas existentes
        $existingCount = $documento->firmas()->where('estado', 'firmado')->count();
        $col  = $request->has('firma_col') ? (int)$request->firma_col : $existingCount % 3;
        $row  = (int)floor($existingCount / 3);
        $lly  = ($request->firma_y ?? 20) + $row * 80;
        $ury  = $lly + 70;
        $colXCoords = [[71, 231], [233, 393], [395, 555]]; // alineado con márgenes del doc (2.5cm izq, 2cm der)
        [$llx, $urx] = $colXCoords[$col];
        $coords = [$llx, $lly, $urx, $ury];

        // Integración FirmaGob: llamar ANTES de abrir la transacción (llamada de red)
        $firmaGobService     = app(FirmaGobService::class);
        $firmaGobData        = null;
        $firmaGobSignedContent = null;

        if ($firmaGobService->isEnabled()) {
            try {
                $pdfContent = $this->obtenerPdfContent($documento);
                $result = $firmaGobService->sign(
                    $pdfContent,
                    "Documento {$documento->numero}",
                    $user->rut,
                    $request->otp,
                    $user->nombre,
                    $user->cargo ?? null,
                    $coords,
                    $request->firma_page ?? 'LAST'
                );
                $firmaGobSignedContent = $result['content'];
                $firmaGobData = [
                    'firma_gob_id'   => $result['session_token'],
                    'firma_gob_data' => [
                        'session_token'   => $result['session_token'],
                        'metadata'        => $result['metadata'],
                        'checksum_signed' => $result['checksum_signed'],
                        'firma_y'         => $lly,
                        'firma_col'       => $col,
                        'firma_page'      => $request->firma_page ?? 'LAST',
                    ],
                ];
            } catch (FirmaGobException $e) {
                $statusCode = $e->isRetryable() ? 503 : 502;
                return $this->errorResponse($e->getMessage(), $statusCode);
            }
        }

        DB::beginTransaction();
        try {
            $firma = $documento->registrarFirma($user, $request->observaciones, $firmaGobData);

            // Guardar PDF firmado por FirmaGob (sobrescribe el generado por marcarComoFirmado si aplica)
            if ($firmaGobSignedContent) {
                $path = 'documentos/' . $documento->identificador . '_firmado_' . time() . '.pdf';
                Storage::disk('public')->put($path, $firmaGobSignedContent);
                $documento->update(['archivo_pdf' => $path]);
            }

            DocumentoTrazabilidad::registrar($documento->id, 'firmado', "Documento firmado por {$user->nombre}", [
                'observaciones'     => $request->observaciones,
                'firma_electronica' => $firmaGobService->isEnabled(),
            ]);

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

            // Notificar al creador que alguien firmó
            if ($documento->creado_por && $documento->creado_por !== $user->id) {
                Notificacion::create([
                    'user_id' => $documento->creado_por,
                    'tipo' => 'documento_firma_registrada',
                    'titulo' => 'Firma registrada en documento',
                    'mensaje' => "{$user->nombre} firmó el documento \"{$documento->titulo}\" ({$documento->numero}).",
                    'data' => ['documento_id' => $documento->id],
                ]);
            }

            // Si el documento quedó completamente firmado, notificar al creador
            $documento->refresh();
            if ($documento->estado === Documento::ESTADO_FIRMADO && $documento->creado_por) {
                Notificacion::create([
                    'user_id' => $documento->creado_por,
                    'tipo' => 'documento_firmado_completo',
                    'titulo' => 'Documento completamente firmado',
                    'mensaje' => "El documento \"{$documento->titulo}\" ({$documento->numero}) ha sido firmado por todos los firmantes. El PDF ha sido generado.",
                    'data' => ['documento_id' => $documento->id],
                ]);
            }

            DB::commit();

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

            DocumentoTrazabilidad::registrar($documento->id, 'firma_rechazada', "Firma rechazada por {$user->nombre}", [
                'motivo' => $request->motivo,
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

            // Notificar al creador del rechazo
            if ($documento->creado_por && $documento->creado_por !== $user->id) {
                Notificacion::create([
                    'user_id' => $documento->creado_por,
                    'tipo' => 'documento_firma_rechazada',
                    'titulo' => 'Firma rechazada en documento',
                    'mensaje' => "{$user->nombre} rechazó la firma del documento \"{$documento->titulo}\" ({$documento->numero}). Motivo: {$request->motivo}",
                    'data' => ['documento_id' => $documento->id],
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
     * Obtiene el contenido binario del PDF del documento.
     * Si no existe, lo genera primero.
     */
    private function obtenerPdfContent(Documento $documento): string
    {
        if ($documento->archivo_pdf && Storage::disk('public')->exists($documento->archivo_pdf)) {
            return Storage::disk('public')->get($documento->archivo_pdf);
        }

        $documento->generarPdfFinal();
        $documento->refresh();

        return Storage::disk('public')->get($documento->archivo_pdf);
    }

    /**
     * Retorna la configuración de FirmaGob al frontend.
     */
    public function firmaConfig()
    {
        return $this->successResponse([
            'firma_gob_enabled' => config('firmagob.enabled'),
            'firma_gob_purpose' => config('firmagob.purpose'),
        ]);
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

        $firmante = \App\Models\User::find($request->usuario_id);
        DocumentoTrazabilidad::registrar($documento->id, 'firmante_agregado', "Firmante agregado: {$firmante->nombre}", [
            'firmante_id' => $request->usuario_id,
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
        // Si tiene archivo PDF ya generado, descargarlo
        if ($documento->archivo_pdf && Storage::disk('public')->exists($documento->archivo_pdf)) {
            $nombre = str_replace('/', '_', $documento->numero ?? $documento->identificador);
            return Storage::disk('public')->download(
                $documento->archivo_pdf,
                $nombre . '.pdf'
            );
        }

        // Generar PDF on-demand para cualquier documento con contenido HTML
        if (!empty($documento->contenido_html)) {
            $documento->generarPdfFinal();
            $documento->refresh();

            if ($documento->archivo_pdf && Storage::disk('public')->exists($documento->archivo_pdf)) {
                $nombre = str_replace('/', '_', $documento->numero ?? $documento->identificador);
                return Storage::disk('public')->download(
                    $documento->archivo_pdf,
                    $nombre . '.pdf'
                );
            }
        }

        return response()->json(['message' => 'Documento sin contenido'], 404);
    }

    /**
     * Analiza un PDF recién subido (antes de crear el documento) y devuelve si contiene firmas
     * electrónicas embebidas. Guarda el archivo en storage temporal y retorna un token para
     * referenciarlo en el siguiente paso (subirDocumento).
     */
    public function analizarUpload(Request $request, PdfSignatureDetector $detector)
    {
        $request->validate([
            'archivo' => 'required|file|mimetypes:application/pdf|max:20480', // 20 MB
        ]);

        $file = $request->file('archivo');
        $token = bin2hex(random_bytes(16));
        $relativePath = "uploads/temp/{$token}.pdf";

        Storage::disk('public')->putFileAs('uploads/temp', $file, "{$token}.pdf");

        $absolutePath = Storage::disk('public')->path($relativePath);
        $deteccion = $detector->detect($absolutePath);

        return $this->successResponse([
            'token' => $token,
            'nombre_original' => $file->getClientOriginalName(),
            'tamanio_bytes' => $file->getSize(),
            'has_signatures' => $deteccion['has_signatures'],
            'signatures' => $deteccion['signatures'],
            'detector_error' => $deteccion['error'],
        ]);
    }

    /**
     * Crea un Documento a partir de un PDF previamente subido (analizarUpload).
     * Soporta cuatro acciones:
     *  - guardar_borrador: deja el documento en borrador
     *  - cerrar_firmado:    marca como firmado, registra firmas externas detectadas
     *  - firmar_propio:     asigna al usuario como firmante y deja en pendiente_firma
     *  - enviar_firma:      asigna firmantes_asignados[] y deja en pendiente_firma
     */
    public function subirDocumento(Request $request)
    {
        $request->validate([
            'token' => 'required|string|size:32',
            'titulo' => 'required|string|max:500',
            'tipo_documental_id' => 'required|exists:tipos_documentales,id',
            'descripcion' => 'nullable|string|max:1000',
            'palabras_clave' => 'nullable|string|max:500',
            'nivel_acceso' => 'required|integer|in:1,2,3,4',
            'expediente_id' => 'nullable|exists:expedientes,id',
            'firmas_externas' => 'nullable|array',
            'accion' => 'required|in:guardar_borrador,cerrar_firmado,firmar_propio,enviar_firma',
            'firmantes_asignados' => 'nullable|array',
            'firmantes_asignados.*' => 'exists:users,id',
        ]);

        $token = $request->token;
        $tempRelative = "uploads/temp/{$token}.pdf";

        if (!Storage::disk('public')->exists($tempRelative)) {
            return $this->errorResponse('El archivo subido ya no está disponible. Vuelve a subirlo.', 404);
        }

        // Validar coherencia de la acción
        if ($request->accion === 'enviar_firma' && empty($request->firmantes_asignados)) {
            return $this->errorResponse('Debes seleccionar al menos un firmante para enviar a firma', 422);
        }
        if ($request->accion === 'cerrar_firmado' && empty($request->firmas_externas)) {
            return $this->errorResponse('Solo puedes cerrar como firmado si el PDF contiene firmas detectadas', 422);
        }

        DB::beginTransaction();
        try {
            $identificador = Documento::generarIdentificador();
            $finalRelative = 'documentos/' . $identificador . '_' . time() . '.pdf';

            Storage::disk('public')->move($tempRelative, $finalRelative);

            $estado = match ($request->accion) {
                'cerrar_firmado' => Documento::ESTADO_FIRMADO,
                'firmar_propio', 'enviar_firma' => Documento::ESTADO_PENDIENTE_FIRMA,
                default => Documento::ESTADO_BORRADOR,
            };

            $documento = Documento::create([
                'identificador' => $identificador,
                'titulo' => $request->titulo,
                'descripcion' => $request->descripcion,
                'tipo_documental_id' => $request->tipo_documental_id,
                'nivel_acceso' => $request->nivel_acceso,
                'palabras_clave' => $request->palabras_clave,
                'archivo_pdf' => $finalRelative,
                'archivo_original' => $finalRelative,
                'formato' => 'PDF',
                'firmas_externas' => $request->firmas_externas ?: null,
                'estado' => $estado,
                'firmado' => $estado === Documento::ESTADO_FIRMADO,
                'fecha_firma' => $estado === Documento::ESTADO_FIRMADO ? now() : null,
                'completado' => $estado === Documento::ESTADO_FIRMADO,
                'fecha_creacion' => now(),
                'mecanismo_incorporacion' => Documento::MECANISMO_FISICO,
                'origen_carga' => Documento::ORIGEN_SUBIDO,
                'creado_por' => Auth::id(),
                'actualizado_por' => Auth::id(),
                'anio' => date('Y'),
            ]);

            // Asociar expediente si viene
            if ($request->expediente_id) {
                $documento->expedientes()->attach($request->expediente_id);
                ExpedienteActividad::create([
                    'expediente_id' => $request->expediente_id,
                    'usuario_id' => Auth::id(),
                    'tipo' => 'documento_creado',
                    'descripcion' => "Documento subido: {$documento->titulo}",
                    'metadata' => ['documento_id' => $documento->id],
                ]);
            }

            // Acción específica
            switch ($request->accion) {
                case 'cerrar_firmado':
                    // Las firmas externas se preservan en documentos.firmas_externas (JSON).
                    // No se registran en documento_firmas porque ese es para usuarios internos.
                    DocumentoTrazabilidad::registrar(
                        $documento->id,
                        'documento_subido',
                        'PDF subido y registrado como firmado externamente',
                        [
                            'firmas_detectadas' => count($request->firmas_externas),
                            'firmantes' => array_map(fn($f) => $f['signer'] ?? 'desconocido', $request->firmas_externas),
                        ]
                    );
                    break;

                case 'firmar_propio':
                    // Asignar al usuario actual como único firmante
                    $documento->firmantesAsignados()->attach(Auth::id(), [
                        'orden' => 1,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    DocumentoTrazabilidad::registrar(
                        $documento->id,
                        'documento_subido',
                        'PDF subido para firma propia'
                    );
                    break;

                case 'enviar_firma':
                    foreach ($request->firmantes_asignados as $idx => $userId) {
                        $documento->firmantesAsignados()->attach($userId, [
                            'orden' => $idx + 1,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                        Notificacion::create([
                            'user_id' => $userId,
                            'tipo' => 'documento_pendiente_firma',
                            'titulo' => 'Documento pendiente de tu firma',
                            'mensaje' => "El documento \"{$documento->titulo}\" requiere tu firma.",
                            'data' => ['documento_id' => $documento->id],
                        ]);
                    }
                    DocumentoTrazabilidad::registrar(
                        $documento->id,
                        'documento_subido',
                        'PDF subido y enviado a firma',
                        ['firmantes' => count($request->firmantes_asignados)]
                    );
                    break;

                default:
                    DocumentoTrazabilidad::registrar(
                        $documento->id,
                        'documento_subido',
                        'PDF subido como borrador'
                    );
            }

            DB::commit();

            $documento->load('tipoDocumental', 'expedientes', 'firmantesAsignados', 'firmas');

            return $this->successResponse($documento, 'Documento subido exitosamente', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            // Si algo falló después de mover el archivo, restaurarlo a temp para reintentar
            if (isset($finalRelative) && Storage::disk('public')->exists($finalRelative)) {
                Storage::disk('public')->move($finalRelative, $tempRelative);
            }
            Log::error('Error al subir documento PDF: ' . $e->getMessage());
            return $this->errorResponse('Error al subir documento: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Obtener trazabilidad del documento
     */
    public function trazabilidad(Documento $documento)
    {
        $trazabilidad = $documento->trazabilidades()
            ->with('usuario:id,nombre,rut,cargo')
            ->orderBy('created_at', 'asc')
            ->get();

        return $this->successResponse($trazabilidad);
    }
}
