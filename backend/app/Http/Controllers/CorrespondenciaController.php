<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CorrespondenciaController extends Controller
{
    public function index(Request $request)
    {
        $query = Correspondencia::with(['departamento', 'usuario', 'adjuntos']);

        // Filtros
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_recibo', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_recibo', '<=', $request->fecha_hasta);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('remitente', 'like', "%{$search}%")
                    ->orWhere('numero_documento', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%");
            });
        }

        $correspondencias = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($correspondencias);
    }

    public function store(Request $request)
    {
        $request->validate([
            'remitente' => 'required|string|max:200',
            'fecha_recibo' => 'required|date',
            'numero_documento' => 'nullable|string|max:50',
            'fecha_documento' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'departamento_id' => 'nullable|exists:departamentos,id',
        ]);

        $correspondencia = Correspondencia::create([
            ...$request->only([
                'numero_documento',
                'remitente',
                'fecha_documento',
                'fecha_recibo',
                'descripcion',
                'departamento_id',
            ]),
            'usuario_id' => Auth::id(),
            'estado' => 'pendiente',
        ]);

        $correspondencia->load(['departamento', 'usuario']);

        return $this->successResponse($correspondencia, 'Correspondencia creada correctamente', 201);
    }

    public function show(Correspondencia $correspondencia)
    {
        $correspondencia->load([
            'departamento',
            'usuario',
            'adjuntos',
            'derivaciones.departamentoOrigen',
            'derivaciones.departamentoDestino',
            'derivaciones.usuarioOrigen',
        ]);

        return $this->successResponse($correspondencia);
    }

    public function update(Request $request, Correspondencia $correspondencia)
    {
        $request->validate([
            'remitente' => 'sometimes|required|string|max:200',
            'fecha_recibo' => 'sometimes|required|date',
            'numero_documento' => 'nullable|string|max:50',
            'fecha_documento' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'departamento_id' => 'nullable|exists:departamentos,id',
            'estado' => 'sometimes|in:pendiente,en_proceso,archivado',
        ]);

        $correspondencia->update($request->only([
            'numero_documento',
            'remitente',
            'fecha_documento',
            'fecha_recibo',
            'descripcion',
            'departamento_id',
            'estado',
        ]));

        $correspondencia->load(['departamento', 'usuario']);

        return $this->successResponse($correspondencia, 'Correspondencia actualizada');
    }

    public function destroy(Correspondencia $correspondencia)
    {
        $correspondencia->delete();

        return $this->successResponse(null, 'Correspondencia eliminada');
    }

    public function bandeja(Request $request)
    {
        $user = Auth::user();

        $query = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
        ])
            ->where('departamento_destino_id', $user->departamento_id)
            ->whereIn('estado', ['pendiente', 'recibido']);

        $derivaciones = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($derivaciones);
    }

    public function estadisticas()
    {
        $stats = [
            'total' => Correspondencia::count(),
            'pendientes' => Correspondencia::where('estado', 'pendiente')->count(),
            'en_proceso' => Correspondencia::where('estado', 'en_proceso')->count(),
            'archivadas' => Correspondencia::where('estado', 'archivado')->count(),
        ];

        return $this->successResponse($stats);
    }

    public function search(Request $request)
    {
        return $this->index($request);
    }
}
