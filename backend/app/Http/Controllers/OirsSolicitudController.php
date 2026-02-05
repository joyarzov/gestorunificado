<?php

namespace App\Http\Controllers;

use App\Models\OirsSolicitud;
use App\Models\OirsHistorial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OirsSolicitudController extends Controller
{
    public function index(Request $request)
    {
        $query = OirsSolicitud::with(['unidadResponsable', 'funcionarioAsignado']);

        // Filtros
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('tipo_solicitud')) {
            $query->where('tipo_solicitud', $request->tipo_solicitud);
        }

        if ($request->filled('categoria')) {
            $query->where('categoria', $request->categoria);
        }

        if ($request->filled('prioridad')) {
            $query->where('prioridad', $request->prioridad);
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
                $q->where('folio', 'like', "%{$search}%")
                    ->orWhere('nombre_solicitante', 'like', "%{$search}%")
                    ->orWhere('asunto', 'like', "%{$search}%");
            });
        }

        $solicitudes = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($solicitudes);
    }

    public function show(OirsSolicitud $oir)
    {
        $oir->load([
            'unidadResponsable',
            'funcionarioAsignado',
            'adjuntos',
            'historial.usuario',
        ]);

        return $this->successResponse($oir);
    }

    public function misAsignadas(Request $request)
    {
        $user = Auth::user();

        $query = OirsSolicitud::with(['unidadResponsable'])
            ->where('funcionario_asignado_id', $user->id)
            ->whereNotIn('estado', ['cerrado']);

        $solicitudes = $query->orderBy('prioridad', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($solicitudes);
    }

    public function estadisticas()
    {
        $stats = [
            'total' => OirsSolicitud::count(),
            'pendientes' => OirsSolicitud::pendientes()->count(),
            'en_proceso' => OirsSolicitud::whereIn('estado', ['asignada', 'en_analisis', 'derivado'])->count(),
            'respondidas' => OirsSolicitud::respondidas()->count(),
            'por_tipo' => OirsSolicitud::selectRaw('tipo_solicitud, count(*) as total')
                ->groupBy('tipo_solicitud')
                ->pluck('total', 'tipo_solicitud'),
            'por_categoria' => OirsSolicitud::selectRaw('categoria, count(*) as total')
                ->groupBy('categoria')
                ->pluck('total', 'categoria'),
        ];

        return $this->successResponse($stats);
    }

    public function asignar(Request $request, OirsSolicitud $oir)
    {
        $request->validate([
            'funcionario_asignado_id' => 'required|exists:users,id',
            'unidad_responsable_id' => 'nullable|exists:departamentos,id',
        ]);

        $estadoAnterior = $oir->estado;

        $oir->update([
            'funcionario_asignado_id' => $request->funcionario_asignado_id,
            'unidad_responsable_id' => $request->unidad_responsable_id,
            'estado' => 'asignada',
        ]);

        // Registrar historial
        OirsHistorial::create([
            'oirs_solicitud_id' => $oir->id,
            'usuario_id' => Auth::id(),
            'accion' => 'Asignación',
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => 'asignada',
        ]);

        $oir->load(['unidadResponsable', 'funcionarioAsignado']);

        return $this->successResponse($oir, 'Solicitud asignada');
    }

    public function responder(Request $request, OirsSolicitud $oir)
    {
        $request->validate([
            'respuesta' => 'required|string',
        ]);

        $estadoAnterior = $oir->estado;

        $oir->update([
            'respuesta' => $request->respuesta,
            'fecha_respuesta' => now(),
            'estado' => 'respondido',
        ]);

        // Registrar historial
        OirsHistorial::create([
            'oirs_solicitud_id' => $oir->id,
            'usuario_id' => Auth::id(),
            'accion' => 'Respuesta',
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => 'respondido',
            'observaciones' => 'Respuesta enviada al ciudadano',
        ]);

        return $this->successResponse($oir, 'Respuesta enviada');
    }

    public function derivar(Request $request, OirsSolicitud $oir)
    {
        $request->validate([
            'unidad_responsable_id' => 'required|exists:departamentos,id',
            'observaciones' => 'nullable|string',
        ]);

        $estadoAnterior = $oir->estado;

        $oir->update([
            'unidad_responsable_id' => $request->unidad_responsable_id,
            'estado' => 'derivado',
        ]);

        // Registrar historial
        OirsHistorial::create([
            'oirs_solicitud_id' => $oir->id,
            'usuario_id' => Auth::id(),
            'accion' => 'Derivación',
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => 'derivado',
            'observaciones' => $request->observaciones,
        ]);

        $oir->load('unidadResponsable');

        return $this->successResponse($oir, 'Solicitud derivada');
    }

    public function cerrar(OirsSolicitud $oir)
    {
        $estadoAnterior = $oir->estado;

        $oir->update(['estado' => 'cerrado']);

        // Registrar historial
        OirsHistorial::create([
            'oirs_solicitud_id' => $oir->id,
            'usuario_id' => Auth::id(),
            'accion' => 'Cierre',
            'estado_anterior' => $estadoAnterior,
            'estado_nuevo' => 'cerrado',
        ]);

        return $this->successResponse($oir, 'Solicitud cerrada');
    }
}
