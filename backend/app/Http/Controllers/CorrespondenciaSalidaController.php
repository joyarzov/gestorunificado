<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
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

    /**
     * Listado de salidas. Oficina de Partes/admin ven todas; el resto,
     * solo las que creó (sus reservas y solicitudes).
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $ctx = $user->contexto();

        $query = Correspondencia::salidas()
            ->with(['usuario:id,nombre,cargo', 'respuestaA:id,folio,remitente', 'despachadaPor:id,nombre']);

        if (!$user->isAdmin() && !$user->isOficial()) {
            $query->where('usuario_id', $ctx->id);
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        $salidas = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 30));

        // Contadores por estado para las pestañas (mismo alcance de visibilidad)
        $base = Correspondencia::salidas();
        if (!$user->isAdmin() && !$user->isOficial()) {
            $base->where('usuario_id', $ctx->id);
        }
        $counts = $base->selectRaw('estado, COUNT(*) as n')->groupBy('estado')->pluck('n', 'estado');

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

        // Si responde a una entrada, debe ser una ENTRADA visible para el usuario
        if ($request->respuesta_a_id) {
            $entrada = Correspondencia::find($request->respuesta_a_id);
            if ($entrada->direccion !== 'entrada' || !$entrada->esVisiblePara(Auth::user())) {
                return $this->errorResponse('La correspondencia a responder no es válida.', 422);
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
            'usuario_id' => Auth::id(),
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
        if ($denied = $this->validarSalida($salida, ['reservada', 'devuelta'], soloCreadorOPartes: true)) {
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

        $salida->update([
            'documento_ruta' => $path,
            'documento_nombre' => $request->file('documento')->getClientOriginalName(),
            'remitente' => $request->destinatario,
            'firmante_nombre' => $request->firmante_nombre,
            'fecha_documento' => $request->fecha_documento ?: now(),
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

        return $this->successResponse($salida->fresh(), 'Documento recibido: la salida quedó en la cola de despacho');
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
        if ($denied = $this->validarSalida($salida, ['reservada', 'devuelta'], soloCreadorOPartes: true)) {
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
        $esCreador = $salida->usuario_id === $user->contexto()->id;
        $participaEnEntrada = $salida->respuesta_a_id
            && $salida->respuestaA?->esVisiblePara($user);

        if ($salida->direccion !== 'salida' || (!$esPartes && !$esCreador && !$participaEnEntrada)) {
            return $this->errorResponse('No autorizado.', 403);
        }
        if (!$salida->documento_ruta || !Storage::disk('public')->exists($salida->documento_ruta)) {
            return $this->errorResponse('La salida no tiene documento adjunto.', 404);
        }

        return Storage::disk('public')->download($salida->documento_ruta, $salida->folio . '.pdf');
    }

    // =====================================================================

    /**
     * Valida que sea una salida, en un estado permitido, y con el permiso
     * correspondiente. Devuelve la respuesta de error o null si todo bien.
     */
    private function validarSalida(
        Correspondencia $salida,
        array $estados,
        bool $soloPartes = false,
        bool $soloCreadorOPartes = false
    ) {
        if ($salida->direccion !== 'salida') {
            return $this->errorResponse('Esta correspondencia no es una salida.', 422);
        }

        $user = Auth::user();
        $esPartes = $user->isAdmin() || $user->isOficial();

        if ($soloPartes && !$esPartes) {
            return $this->errorResponse('Solo la Oficina de Partes o un administrador pueden hacer esto.', 403);
        }
        if ($soloCreadorOPartes && !$esPartes && $salida->usuario_id !== $user->contexto()->id) {
            return $this->errorResponse('Solo quien reservó el número (o la Oficina de Partes) puede hacer esto.', 403);
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
