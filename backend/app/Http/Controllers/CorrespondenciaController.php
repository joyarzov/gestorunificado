<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class CorrespondenciaController extends Controller
{
    public function index(Request $request)
    {
        // Visibilidad: admin/oficial ven todo; el resto solo donde participa.
        $query = Correspondencia::visiblesPara(Auth::user())
            ->with(['departamento', 'usuario', 'adjuntos']);

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
        if (!$correspondencia->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        $correspondencia->load([
            'departamento',
            'usuario',
            'adjuntos',
            'derivaciones.departamentoOrigen',
            'derivaciones.departamentoDestino',
            'derivaciones.usuarioOrigen',
            'derivaciones.usuarioDestino',
            'derivaciones.actuandoComo',
        ]);

        return $this->successResponse($correspondencia);
    }

    public function update(Request $request, Correspondencia $correspondencia)
    {
        // Solo oficial de partes o admin pueden editar, y solo mientras siga pendiente.
        $user = Auth::user();
        $roles = is_array($user->roles ?? null) ? $user->roles : [];
        $puedeEditar = in_array('admin', $roles, true) || in_array('oficial', $roles, true);
        if (!$puedeEditar) {
            return $this->errorResponse('Solo la Oficina de Partes o un administrador pueden editar la correspondencia', 403);
        }

        if ($correspondencia->estado !== 'pendiente') {
            return $this->errorResponse('Solo se puede editar correspondencia en estado pendiente', 400);
        }

        $request->validate([
            'remitente' => 'sometimes|required|string|max:200',
            'fecha_recibo' => 'sometimes|required|date',
            'numero_documento' => 'nullable|string|max:50',
            'fecha_documento' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'departamento_id' => 'nullable|exists:departamentos,id',
            'estado' => 'sometimes|in:pendiente,derivada_alcaldia,en_proceso,derivada_funcionario,completada,archivado',
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
        $ctx  = $user->contexto();

        $query = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino:id,nombre,cargo',
            'actuandoComo:id,nombre,cargo',
        ])->whereIn('estado', ['pendiente', 'recibido']);

        // Admin y oficina de partes (oficial) ven TODO (supervisión, solo lectura).
        // El resto ve lo dirigido a su persona, o a su departamento (cuando la
        // derivación no apunta a un usuario específico).
        if (!$user->isAdmin() && !$user->isOficial()) {
            $query->where(function ($q) use ($ctx) {
                $q->where('usuario_destino_id', $ctx->id)
                  ->orWhere(function ($q2) use ($ctx) {
                      $q2->whereNull('usuario_destino_id')
                         ->where('departamento_destino_id', $ctx->departamento_id);
                  });
            });
        }

        $derivaciones = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        // Marca por ítem si el usuario puede ACTUAR (recibir/archivar) o solo ver.
        $derivaciones->getCollection()->transform(function (Derivacion $d) use ($user) {
            $d->puede_actuar = $d->esDestinatario($user);
            return $d;
        });

        return $this->successResponse($derivaciones);
    }

    public function estadisticas()
    {
        $stats = [
            'total' => Correspondencia::count(),
            'pendientes' => Correspondencia::where('estado', 'pendiente')->count(),
            'derivada_alcaldia' => Correspondencia::where('estado', 'derivada_alcaldia')->count(),
            'en_proceso' => Correspondencia::where('estado', 'en_proceso')->count(),
            'derivada_funcionario' => Correspondencia::where('estado', 'derivada_funcionario')->count(),
            'completada' => Correspondencia::where('estado', 'completada')->count(),
            'archivadas' => Correspondencia::where('estado', 'archivado')->count(),
        ];

        return $this->successResponse($stats);
    }

    public function search(Request $request)
    {
        return $this->index($request);
    }

    public function getAlcaldeInfo()
    {
        $alcalde = User::where('activo', true)
            ->whereJsonContains('roles', 'alcalde')
            ->with('departamento')
            ->first();

        if (!$alcalde) {
            return $this->errorResponse('No se encontró un usuario con rol Alcalde activo', 404);
        }

        return $this->successResponse([
            'user_id' => $alcalde->id,
            'nombre' => $alcalde->nombre,
            'departamento_id' => $alcalde->departamento_id,
            'departamento_nombre' => $alcalde->departamento?->nombre,
        ]);
    }

    public function descargarProvidencia(Correspondencia $correspondencia)
    {
        if (!$correspondencia->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        if (!$correspondencia->providencia_generada || !$correspondencia->providencia_pdf) {
            return $this->errorResponse('Esta correspondencia no tiene providencia generada', 404);
        }

        $path = 'public/' . $correspondencia->providencia_pdf;

        if (!Storage::exists($path)) {
            return $this->errorResponse('Archivo de providencia no encontrado', 404);
        }

        return Storage::download($path, 'providencia_' . $correspondencia->id . '.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
