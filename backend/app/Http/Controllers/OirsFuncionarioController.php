<?php

namespace App\Http\Controllers;

use App\Models\OirsSolicitud;
use App\Models\OirsAdjunto;
use App\Models\OirsHistorial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class OirsFuncionarioController extends Controller
{
    /**
     * Listar solicitudes OIRS asignadas al funcionario actual
     */
    public function misAsignadas(Request $request)
    {
        $user = Auth::user();

        $query = OirsSolicitud::with(['unidadResponsable', 'adjuntos'])
            ->where('funcionario_asignado_id', $user->id);

        // Filtro por estado
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        } else {
            // Por defecto mostrar las que requieren respuesta
            $query->whereIn('estado', ['asignada', 'en_analisis']);
        }

        // Filtro por prioridad
        if ($request->filled('prioridad')) {
            $query->where('prioridad', $request->prioridad);
        }

        $solicitudes = $query->orderByRaw("FIELD(prioridad, 'alta', 'media', 'baja')")
            ->orderBy('fecha_limite_respuesta', 'asc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($solicitudes);
    }

    /**
     * Ver detalle de una solicitud asignada
     */
    public function show(OirsSolicitud $oir)
    {
        $user = Auth::user();

        // Verificar que la solicitud esté asignada a este funcionario
        if ($oir->funcionario_asignado_id !== $user->id) {
            return $this->errorResponse('No tiene permiso para ver esta solicitud', 403);
        }

        $oir->load([
            'unidadResponsable',
            'adjuntos',
            'historial.usuario',
        ]);

        return $this->successResponse($oir);
    }

    /**
     * Enviar respuesta interna (para revisión del admin OIRS)
     */
    public function responderInterno(Request $request, OirsSolicitud $oir)
    {
        $user = Auth::user();

        // Verificar que la solicitud esté asignada a este funcionario
        if ($oir->funcionario_asignado_id !== $user->id) {
            return $this->errorResponse('No tiene permiso para responder esta solicitud', 403);
        }

        // Verificar que la solicitud esté en estado que permita respuesta
        if (!in_array($oir->estado, ['asignada', 'en_analisis'])) {
            return $this->errorResponse('Esta solicitud no está en estado de poder recibir respuesta', 400);
        }

        $request->validate([
            'respuesta' => 'required|string|min:10',
            'archivo' => 'nullable|file|max:10240', // 10MB máximo
        ]);

        $estadoAnterior = $oir->estado;

        // Guardar respuesta del funcionario
        $oir->update([
            'respuesta_funcionario' => $request->respuesta,
            'fecha_respuesta_funcionario' => now(),
            'estado' => 'en_analisis', // Cambia a en_analisis para que admin revise
        ]);

        // Si hay archivo adjunto, guardarlo
        if ($request->hasFile('archivo')) {
            $archivo = $request->file('archivo');
            $path = $archivo->store('oirs-adjuntos/' . $oir->id, 'public');

            OirsAdjunto::create([
                'oirs_solicitud_id' => $oir->id,
                'nombre_archivo' => $archivo->getClientOriginalName(),
                'ruta_archivo' => $path,
                'tipo_mime' => $archivo->getMimeType(),
                'tamanio_bytes' => $archivo->getSize(),
                'origen' => 'funcionario',
            ]);
        }

        // Registrar en historial
        OirsHistorial::create([
            'oirs_solicitud_id' => $oir->id,
            'usuario_id' => $user->id,
            'accion' => 'Respuesta interna',
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => 'en_analisis',
            'observaciones' => 'Funcionario envió respuesta para revisión',
        ]);

        $oir->load(['adjuntos', 'historial.usuario']);

        return $this->successResponse($oir, 'Respuesta enviada para revisión');
    }

    /**
     * Estadísticas de solicitudes asignadas al funcionario
     */
    public function estadisticas()
    {
        $user = Auth::user();

        $stats = [
            'total_asignadas' => OirsSolicitud::where('funcionario_asignado_id', $user->id)->count(),
            'pendientes_respuesta' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->whereIn('estado', ['asignada'])
                ->count(),
            'en_analisis' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->where('estado', 'en_analisis')
                ->count(),
            'respondidas' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->whereIn('estado', ['respondido', 'cerrado'])
                ->count(),
            'proximas_vencer' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->whereIn('estado', ['asignada', 'en_analisis'])
                ->where('fecha_limite_respuesta', '<=', now()->addDays(3))
                ->count(),
        ];

        return $this->successResponse($stats);
    }
}
