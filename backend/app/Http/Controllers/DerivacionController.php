<?php

namespace App\Http\Controllers;

use App\Models\Derivacion;
use App\Models\Correspondencia;
use App\Models\Notificacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
        ]);

        $user = Auth::user();

        $derivacion = Derivacion::create([
            'correspondencia_id' => $request->correspondencia_id,
            'departamento_origen_id' => $user->departamento_id,
            'departamento_destino_id' => $request->departamento_destino_id,
            'usuario_origen_id' => $user->id,
            'usuario_destino_id' => $request->usuario_destino_id,
            'observaciones' => $request->observaciones,
            'estado' => 'pendiente',
        ]);

        // Actualizar estado de la correspondencia
        $correspondencia = Correspondencia::find($request->correspondencia_id);
        $correspondencia->update(['estado' => 'en_proceso']);

        // Crear notificación para el departamento destino
        // TODO: Implementar notificaciones

        $derivacion->load([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
        ]);

        return $this->successResponse($derivacion, 'Derivación creada correctamente', 201);
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
            ->whereIn('estado', ['pendiente', 'recibido'])
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($derivaciones);
    }

    public function recibir(Derivacion $derivacion)
    {
        $user = Auth::user();

        if ($derivacion->departamento_destino_id !== $user->departamento_id) {
            return $this->errorResponse('No tienes permiso para recibir esta derivación', 403);
        }

        $derivacion->update([
            'estado' => 'recibido',
            'usuario_destino_id' => $user->id,
            'fecha_recepcion' => now(),
        ]);

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
