<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\Documento;
use App\Models\User;
use App\Services\NotificacionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Correspondencia de SALIDA (fase sin cero papel).
 *
 * El documento se redacta y firma FUERA del sistema; aquí se reserva el
 * número (folio por serie según tipo de documento), se sube el PDF firmado,
 * y Oficina de Partes lo revisa y despacha (o devuelve con motivo).
 *
 * Ciclo: reservada → por_despachar → despachada
 *        con desvíos: devuelta (corregible) y anulada (folio queda en acta).
 */
class CorrespondenciaSalidaController extends Controller
{
    private const MEDIOS_DESPACHO = ['email', 'carta_certificada', 'en_mano', 'libro', 'otro'];

    /** Listado de salidas — módulo exclusivo de Oficina de Partes/admin. */
    public function index(Request $request)
    {
        if ($denied = $this->soloPartes()) {
            return $denied;
        }

        $query = Correspondencia::salidas()
            ->with(['usuario:id,nombre,cargo', 'respuestaA:id,folio,remitente', 'despachadaPor:id,nombre']);

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        $salidas = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 30));

        // Contadores por estado para las pestañas
        $counts = Correspondencia::salidas()
            ->selectRaw('estado, COUNT(*) as n')->groupBy('estado')->pluck('n', 'estado');

        return $this->successResponse([
            'items' => $salidas->items(),
            'total' => $salidas->total(),
            'page' => $salidas->currentPage(),
            'last_page' => $salidas->lastPage(),
            'counts' => [
                'reservada' => (int) ($counts['reservada'] ?? 0),
                'por_despachar' => (int) ($counts['por_despachar'] ?? 0),
                'devuelta' => (int) ($counts['devuelta'] ?? 0),
                'despachada' => (int) ($counts['despachada'] ?? 0),
                'anulada' => (int) ($counts['anulada'] ?? 0),
            ],
        ]);
    }

    /**
     * Reserva el número de la serie correspondiente. El folio existe ANTES
     * de imprimir y firmar el documento — formaliza el "dame un número".
     */
    public function reservar(Request $request)
    {
        $request->validate([
            'tipo_documento' => 'required|in:' . implode(',', array_keys(Correspondencia::TIPOS_SALIDA)),
            'materia' => 'required|string|max:1000',
            'destinatario' => 'nullable|string|max:200',
            'respuesta_a_id' => 'nullable|exists:correspondencia,id',
        ]);

        // Partes/admin reservan libremente; el Alcalde solo como RESPUESTA a
        // una entrada (su solicitud llega a la cola de Partes para despacho).
        $user = Auth::user();
        $esPartes = $user->isAdmin() || $user->isOficial();
        if (!$esPartes && !($user->isAlcalde() && $request->respuesta_a_id)) {
            return $this->errorResponse(
                'Solo la Oficina de Partes puede reservar números de salida (el Alcalde puede hacerlo como respuesta a una entrada).',
                403
            );
        }

        // Si responde a una entrada, debe ser una ENTRADA visible para el usuario
        if ($request->respuesta_a_id) {
            $entrada = Correspondencia::find($request->respuesta_a_id);
            if ($entrada->direccion !== 'entrada' || !$entrada->esVisiblePara($user)) {
                return $this->errorResponse('La correspondencia a responder no es válida.', 422);
            }
            if ($entrada->estaArchivada()) {
                return $this->errorResponse('El proceso está cerrado (archivada por el Alcalde): desarchívala para responder.', 422);
            }
            // El Alcalde solo puede responder cuando ya existe la providencia
            // (la generó al derivar a funcionario o al marcar como recibida).
            if (!$esPartes && !$entrada->providencia_generada) {
                return $this->errorResponse(
                    'No se puede preparar una respuesta sin haber generado la providencia correspondiente.',
                    422
                );
            }
            // Evitar reservar más de un folio para la misma entrada mientras
            // haya una respuesta en curso (sin despachar / sin anular).
            $enCurso = Correspondencia::salidas()
                ->where('respuesta_a_id', $entrada->id)
                ->whereIn('estado', ['reservada', 'devuelta', 'por_despachar'])
                ->first();
            if ($enCurso) {
                return $this->errorResponse(
                    "Ya hay una respuesta en curso para esta correspondencia ({$enCurso->folio}). Súbele el documento o anúlala antes de reservar otro número.",
                    422
                );
            }
        }

        $prefijo = Correspondencia::TIPOS_SALIDA[$request->tipo_documento];

        $salida = Correspondencia::create([
            'folio' => Correspondencia::siguienteFolio($prefijo),
            'direccion' => 'salida',
            'tipo_documento_salida' => $request->tipo_documento,
            'remitente' => $request->destinatario ?: 'Por definir', // en salidas este campo es el DESTINATARIO externo
            'descripcion' => $request->materia,
            'respuesta_a_id' => $request->respuesta_a_id,
            'fecha_recibo' => now(),
            // Dueño institucional de la salida = contexto (el Alcalde cuando se
            // reserva por subrogancia), no el actor real. Así coincide con
            // validarSalida(creadorOPartes) y el alcalde/subrogante puede subir
            // o anular el folio que reservó.
            'usuario_id' => $user->contexto()->id,
            'estado' => 'reservada',
        ]);

        return $this->successResponse($salida, "Número reservado: {$salida->folio}", 201);
    }

    /**
     * Sube el PDF firmado (fuera del sistema) y deja la salida en la cola
     * de Oficina de Partes. Válido desde reservada o devuelta.
     */
    public function subirDocumento(Request $request, Correspondencia $salida)
    {
        if ($denied = $this->validarSalida($salida, ['reservada', 'devuelta'], creadorOPartes: true)) {
            return $denied;
        }

        $request->validate([
            'documento' => 'required|file|mimes:pdf|max:20480',
            'destinatario' => 'required|string|max:200',
            'firmante_nombre' => 'required|string|max:200',
            'fecha_documento' => 'nullable|date',
        ]);

        // Reemplaza el documento anterior si venía de una devolución
        if ($salida->documento_ruta) {
            Storage::disk('public')->delete($salida->documento_ruta);
        }
        $path = $request->file('documento')->store('correspondencia/salidas/' . $salida->id, 'public');

        $this->dejarEnColaDespacho(
            $salida,
            $path,
            $request->file('documento')->getClientOriginalName(),
            $request->destinatario,
            $request->firmante_nombre,
            $request->fecha_documento ?: now(),
        );

        return $this->successResponse($salida->fresh(), 'Documento recibido: la salida quedó en la cola de despacho');
    }

    /**
     * Asocia un documento de CERO PAPEL ya creado (y firmado) como el documento
     * de respuesta de la salida. Copia el PDF del documento a la salida y la deja
     * en la cola de despacho de Oficina de Partes. Válido desde reservada/devuelta.
     */
    public function asociarDocumento(Request $request, Correspondencia $salida)
    {
        if ($denied = $this->validarSalida($salida, ['reservada', 'devuelta'], creadorOPartes: true)) {
            return $denied;
        }

        $request->validate([
            'documento_id' => 'required|exists:documentos,id',
            'destinatario' => 'required|string|max:200',
            'firmante_nombre' => 'nullable|string|max:200',
            'fecha_documento' => 'nullable|date',
        ]);

        $documento = Documento::find($request->documento_id);

        // Solo documentos cerrados/firmados y con PDF disponible sirven como respuesta.
        if (!in_array($documento->estado, [Documento::ESTADO_FIRMADO, Documento::ESTADO_INCORPORADO], true)) {
            return $this->errorResponse('Solo se puede asociar un documento firmado de Cero Papel.', 422);
        }
        if (!$documento->archivo_pdf || !Storage::disk('public')->exists($documento->archivo_pdf)) {
            return $this->errorResponse('El documento seleccionado no tiene un PDF disponible.', 422);
        }

        // Copiar el PDF del documento a la carpeta de la salida (mismo patrón que subir).
        if ($salida->documento_ruta) {
            Storage::disk('public')->delete($salida->documento_ruta);
        }
        $nombre = ($documento->numero ?: $documento->identificador) . '.pdf';
        $destino = 'correspondencia/salidas/' . $salida->id . '/' . basename($documento->archivo_pdf);
        Storage::disk('public')->put($destino, Storage::disk('public')->get($documento->archivo_pdf));

        $this->dejarEnColaDespacho(
            $salida,
            $destino,
            $nombre,
            $request->destinatario,
            $request->firmante_nombre ?: ($documento->creador?->nombre ?? 'Cero Papel'),
            $request->fecha_documento ?: ($documento->fecha_firma ?: now()),
        );

        return $this->successResponse($salida->fresh(), 'Documento de Cero Papel asociado: la salida quedó en la cola de despacho');
    }

    /**
     * Marca la salida como "por_despachar" con el documento dado y notifica a
     * Oficina de Partes. Compartido por subirDocumento (PDF externo) y
     * asociarDocumento (documento de Cero Papel).
     */
    private function dejarEnColaDespacho(
        Correspondencia $salida,
        string $documentoRuta,
        string $documentoNombre,
        string $destinatario,
        string $firmanteNombre,
        $fechaDocumento
    ): void {
        $salida->update([
            'documento_ruta' => $documentoRuta,
            'documento_nombre' => $documentoNombre,
            'remitente' => $destinatario, // en salidas este campo es el destinatario externo
            'firmante_nombre' => $firmanteNombre,
            'fecha_documento' => $fechaDocumento,
            'estado' => 'por_despachar',
            'motivo_devolucion' => null,
        ]);

        // Avisar a Oficina de Partes (todos los oficiales activos)
        $oficiales = User::where('activo', true)->whereJsonContains('roles', 'oficial')->get();
        if ($oficiales->isNotEmpty()) {
            NotificacionService::enviar(
                $oficiales,
                'correspondencia',
                'salida_por_despachar',
                'Salida lista para despachar',
                "{$salida->folio} ({$salida->firmante_nombre}) para \"{$salida->remitente}\" espera despacho.",
                ['correspondencia_id' => $salida->id, 'url' => '/salidas']
            );
        }
    }

    /** Despacha la salida (solo Oficina de Partes / admin). */
    public function despachar(Request $request, Correspondencia $salida)
    {
        if ($denied = $this->validarSalida($salida, ['por_despachar'], soloPartes: true)) {
            return $denied;
        }

        $request->validate([
            'medio_despacho' => 'required|in:' . implode(',', self::MEDIOS_DESPACHO),
            'fecha_despacho' => 'nullable|date',
            'referencia_despacho' => 'nullable|string|max:200',
        ]);

        $salida->update([
            'medio_despacho' => $request->medio_despacho,
            'fecha_despacho' => $request->fecha_despacho ?: now(),
            'referencia_despacho' => $request->referencia_despacho,
            'despachada_por' => Auth::id(),
            'estado' => 'despachada',
        ]);

        // Chip "Respondida" en la entrada vinculada (sin tocar su estado)
        if ($salida->respuesta_a_id) {
            $salida->respuestaA?->update(['respondida_at' => now()]);
        }

        // Avisar a quien la solicitó
        if ($salida->usuario_id && $salida->usuario_id !== Auth::id()) {
            NotificacionService::enviar(
                $salida->usuario_id,
                'correspondencia',
                'salida_despachada',
                'Salida despachada',
                "Tu {$salida->tipo_documento_salida} {$salida->folio} para \"{$salida->remitente}\" fue despachado.",
                ['correspondencia_id' => $salida->id, 'url' => '/salidas']
            );
        }

        return $this->successResponse($salida->fresh(), "Salida {$salida->folio} despachada");
    }

    /** Devuelve la salida al solicitante con motivo (control de calidad de Partes). */
    public function devolver(Request $request, Correspondencia $salida)
    {
        if ($denied = $this->validarSalida($salida, ['por_despachar'], soloPartes: true)) {
            return $denied;
        }

        $request->validate(['motivo' => 'required|string|max:1000']);

        $salida->update([
            'estado' => 'devuelta',
            'motivo_devolucion' => $request->motivo,
        ]);

        if ($salida->usuario_id) {
            NotificacionService::enviar(
                $salida->usuario_id,
                'correspondencia',
                'salida_devuelta',
                'Salida devuelta por Oficina de Partes',
                "{$salida->folio}: {$request->motivo}. Corrige el documento y vuelve a subirlo.",
                ['correspondencia_id' => $salida->id, 'url' => '/salidas']
            );
        }

        return $this->successResponse($salida->fresh(), 'Salida devuelta al solicitante');
    }

    /** Anula la reserva: el folio queda en acta con su motivo, nunca se reutiliza. */
    public function anular(Request $request, Correspondencia $salida)
    {
        if ($denied = $this->validarSalida($salida, ['reservada', 'devuelta'], creadorOPartes: true)) {
            return $denied;
        }

        $request->validate(['motivo' => 'required|string|max:1000']);

        $salida->update([
            'estado' => 'anulada',
            'motivo_devolucion' => $request->motivo,
        ]);

        return $this->successResponse($salida->fresh(), "Folio {$salida->folio} anulado");
    }

    /** Descarga el documento de la salida. */
    public function descargarDocumento(Correspondencia $salida)
    {
        $user = Auth::user();
        $esPartes = $user->isAdmin() || $user->isOficial();
        // Los participantes de la entrada vinculada pueden VER la respuesta
        // despachada desde el detalle; la gestión sigue siendo de Partes.
        $participaEnEntrada = $salida->respuesta_a_id
            && $salida->respuestaA?->esVisiblePara($user);

        if ($salida->direccion !== 'salida' || (!$esPartes && !$participaEnEntrada)) {
            return $this->errorResponse('No autorizado.', 403);
        }
        if (!$salida->documento_ruta || !Storage::disk('public')->exists($salida->documento_ruta)) {
            return $this->errorResponse('La salida no tiene documento adjunto.', 404);
        }

        return Storage::disk('public')->download($salida->documento_ruta, $salida->folio . '.pdf');
    }

    // =====================================================================

    private function soloPartes()
    {
        $user = Auth::user();
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('La correspondencia de salida es exclusiva de la Oficina de Partes.', 403);
        }
        return null;
    }

    /**
     * Valida que sea una salida, en un estado permitido, y con el permiso
     * correspondiente. Devuelve la respuesta de error o null si todo bien.
     */
    private function validarSalida(
        Correspondencia $salida,
        array $estados,
        bool $soloPartes = false,
        bool $creadorOPartes = false
    ) {
        if ($salida->direccion !== 'salida') {
            return $this->errorResponse('Esta correspondencia no es una salida.', 422);
        }

        if ($soloPartes && ($denied = $this->soloPartes())) {
            return $denied;
        }

        if ($creadorOPartes) {
            $user = Auth::user();
            $esPartes = $user->isAdmin() || $user->isOficial();
            if (!$esPartes && $salida->usuario_id !== $user->contexto()->id) {
                return $this->errorResponse('Solo quien reservó el número (o la Oficina de Partes) puede hacer esto.', 403);
            }
        }

        if (!in_array($salida->estado, $estados, true)) {
            return $this->errorResponse(
                'La salida no está en un estado válido para esta acción (estado actual: ' . $salida->estado . ').',
                422
            );
        }

        return null;
    }
}
