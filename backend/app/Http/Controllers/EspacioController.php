<?php

namespace App\Http\Controllers;

use App\Models\Espacio;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Gestión de espacios municipales reservables. Crear/editar espacios y nombrar
 * administradores lo puede hacer el admin de plataforma o cualquier
 * administrador de un espacio existente (ver User::puedeGestionarEspacios).
 * El listado es visible para todos (el calendario es de solo lectura).
 */
class EspacioController extends Controller
{
    /** Listado de espacios (todos los funcionarios lo ven para el calendario). */
    public function index(Request $request)
    {
        $user = Auth::user();
        $espacios = Espacio::with('administradores:id,nombre,cargo')
            ->when(!$request->boolean('incluir_inactivos'), fn ($q) => $q->where('activo', true))
            ->orderBy('nombre')
            ->get()
            ->map(function (Espacio $e) use ($user) {
                $e->es_administrador = $e->esAdministrador($user);
                return $e;
            });

        return $this->successResponse([
            'espacios' => $espacios,
            // Para que el frontend sepa si mostrar el botón "Nuevo espacio".
            'puede_gestionar' => $user->puedeGestionarEspacios(),
        ]);
    }

    public function show(Espacio $espacio)
    {
        $espacio->load('administradores:id,nombre,cargo');
        $espacio->es_administrador = $espacio->esAdministrador(Auth::user());

        return $this->successResponse($espacio);
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user->puedeGestionarEspacios()) {
            return $this->errorResponse('No tienes permiso para crear espacios.', 403);
        }

        $data = $this->validar($request);

        $espacio = Espacio::create($data + ['creado_por' => $user->id]);
        $this->sincronizarAdministradores($espacio, $request, $user);

        $espacio->load('administradores:id,nombre,cargo');

        return $this->successResponse($espacio, 'Espacio creado', 201);
    }

    public function update(Request $request, Espacio $espacio)
    {
        $user = Auth::user();
        // Solo el admin de plataforma o un administrador de ESTE espacio.
        if (!$espacio->esAdministrador($user)) {
            return $this->errorResponse('No administras este espacio.', 403);
        }

        $espacio->update($this->validar($request));
        $this->sincronizarAdministradores($espacio, $request, $user);

        $espacio->load('administradores:id,nombre,cargo');

        return $this->successResponse($espacio, 'Espacio actualizado');
    }

    public function destroy(Espacio $espacio)
    {
        $user = Auth::user();
        if (!$espacio->esAdministrador($user)) {
            return $this->errorResponse('No administras este espacio.', 403);
        }
        // Baja lógica: no se borran reservas históricas.
        $espacio->update(['activo' => false]);

        return $this->successResponse(null, 'Espacio desactivado');
    }

    private function validar(Request $request): array
    {
        return $request->validate([
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'ubicacion' => 'nullable|string|max:255',
            'capacidad' => 'nullable|integer|min:0',
            'color' => 'nullable|string|max:9',
            'activo' => 'sometimes|boolean',
        ]);
    }

    /**
     * Sincroniza los administradores del espacio desde administrador_ids. Quien
     * crea/edita queda SIEMPRE como administrador, para no perder el control del
     * espacio (y para que el que lo creó pueda seguir gestionándolo).
     */
    private function sincronizarAdministradores(Espacio $espacio, Request $request, User $actor): void
    {
        if (!$request->has('administrador_ids')) {
            // Al crear sin lista explícita, el creador queda como administrador.
            if ($espacio->administradores()->count() === 0) {
                $espacio->administradores()->syncWithoutDetaching([$actor->id]);
            }
            return;
        }

        $request->validate([
            'administrador_ids' => 'array',
            'administrador_ids.*' => 'integer|exists:users,id',
        ]);

        $ids = collect($request->input('administrador_ids', []))
            ->map(fn ($i) => (int) $i)
            ->push($actor->id) // el actor nunca se saca a sí mismo
            ->unique()
            ->values()
            ->all();

        $espacio->administradores()->sync($ids);
    }
}
