<?php

namespace App\Http\Controllers;

use App\Models\Departamento;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class OrganigramaController extends Controller
{
    /**
     * Devuelve el organigrama completo: árbol de departamentos con jefe, subrogante e integrantes.
     */
    public function index()
    {
        $departamentos = Departamento::with([
            'jefe:id,nombre,cargo,email,subrogante_id',
            'jefe.subrogante:id,nombre,cargo',
            'usuarios:id,nombre,cargo,email,departamento_id,subrogante_id,activo',
        ])
            ->where('activo', true)
            ->orderBy('orden')
            ->orderBy('nombre')
            ->get();

        $data = $departamentos->map(function (Departamento $d) {
            return [
                'id' => $d->id,
                'nombre' => $d->nombre,
                'codigo' => $d->codigo,
                'tipo' => $d->tipo,
                'parent_id' => $d->parent_id,
                'orden' => $d->orden,
                'jefe' => $d->jefe ? [
                    'id' => $d->jefe->id,
                    'nombre' => $d->jefe->nombre,
                    'cargo' => $d->jefe->cargo,
                    'email' => $d->jefe->email,
                    'subrogante' => $d->jefe->subrogante ? [
                        'id' => $d->jefe->subrogante->id,
                        'nombre' => $d->jefe->subrogante->nombre,
                        'cargo' => $d->jefe->subrogante->cargo,
                    ] : null,
                ] : null,
                'integrantes' => $d->usuarios
                    ->where('activo', true)
                    ->values()
                    ->map(fn($u) => [
                        'id' => $u->id,
                        'nombre' => $u->nombre,
                        'cargo' => $u->cargo,
                        'email' => $u->email,
                        'es_jefe' => $d->jefe_id === $u->id,
                    ]),
            ];
        });

        return $this->successResponse($data);
    }

    /**
     * Mueve un departamento bajo otro padre (reasignar jerarquía).
     */
    public function actualizarParent(Request $request, Departamento $departamento)
    {
        $data = $request->validate([
            'parent_id' => 'nullable|integer|exists:departamentos,id',
        ]);

        $nuevoParent = $data['parent_id'] ?? null;

        // Evitar ciclos: no puedes mover un depto dentro de sí mismo ni de uno de sus descendientes
        if ($nuevoParent !== null) {
            if ((int)$nuevoParent === $departamento->id) {
                return $this->errorResponse('Un departamento no puede ser su propio padre', 422);
            }
            if ($this->esDescendiente($nuevoParent, $departamento->id)) {
                return $this->errorResponse('No se puede mover un departamento dentro de uno de sus descendientes', 422);
            }
        }

        $departamento->update(['parent_id' => $nuevoParent]);

        return $this->successResponse($departamento, 'Jerarquía actualizada');
    }

    /**
     * Asigna o remueve el jefe de un departamento.
     */
    public function actualizarJefe(Request $request, Departamento $departamento)
    {
        $data = $request->validate([
            'jefe_id' => 'nullable|integer|exists:users,id',
        ]);

        $departamento->update(['jefe_id' => $data['jefe_id'] ?? null]);

        return $this->successResponse($departamento->load('jefe'), 'Jefatura actualizada');
    }

    /**
     * Actualiza datos básicos de un departamento (nombre, código, tipo, activo).
     */
    public function actualizarDepartamento(Request $request, Departamento $departamento)
    {
        $data = $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'codigo' => 'sometimes|nullable|string|max:20|unique:departamentos,codigo,' . $departamento->id,
            'tipo' => 'sometimes|nullable|string|max:30',
            'activo' => 'sometimes|boolean',
            'orden' => 'sometimes|integer',
        ]);

        $departamento->update($data);

        return $this->successResponse($departamento, 'Unidad actualizada');
    }

    /**
     * Crea un nuevo departamento (opcionalmente bajo un padre).
     */
    public function crearDepartamento(Request $request)
    {
        $data = $request->validate([
            'nombre' => 'required|string|max:100',
            'codigo' => 'nullable|string|max:20|unique:departamentos,codigo',
            'parent_id' => 'nullable|integer|exists:departamentos,id',
            'tipo' => 'nullable|string|max:30',
            'jefe_id' => 'nullable|integer|exists:users,id',
            'orden' => 'nullable|integer',
        ]);

        $data['activo'] = true;
        $data['orden'] = $data['orden'] ?? 0;

        $departamento = Departamento::create($data);

        return $this->successResponse($departamento, 'Departamento creado', 201);
    }

    /**
     * Mueve un funcionario a otro departamento. Solo administradores.
     */
    public function moverUsuarioDepartamento(Request $request, User $user)
    {
        $actor = Auth::user();
        if (!$actor || !$actor->hasRole('admin')) {
            return $this->errorResponse('Solo un administrador puede mover funcionarios', Response::HTTP_FORBIDDEN);
        }

        $data = $request->validate([
            'departamento_id' => 'nullable|integer|exists:departamentos,id',
        ]);

        $user->update(['departamento_id' => $data['departamento_id'] ?? null]);

        return $this->successResponse(
            [
                'id' => $user->id,
                'nombre' => $user->nombre,
                'departamento_id' => $user->departamento_id,
            ],
            'Funcionario movido'
        );
    }

    /**
     * El usuario autenticado actualiza su propio subrogante.
     */
    public function actualizarMiSubrogante(Request $request)
    {
        $data = $request->validate([
            'subrogante_id' => 'nullable|integer|exists:users,id',
        ]);

        $user = Auth::user();

        if (!empty($data['subrogante_id']) && (int)$data['subrogante_id'] === $user->id) {
            return $this->errorResponse('No puedes ser tu propio subrogante', 422);
        }

        $user->update(['subrogante_id' => $data['subrogante_id'] ?? null]);

        $user->load('subrogante:id,nombre,cargo');

        return $this->successResponse($user, 'Subrogante actualizado');
    }

    /**
     * Activa la subrogancia del usuario autenticado: a partir de ahora (o desde la
     * fecha indicada), su subrogante verá la bandeja y podrá actuar en su nombre.
     */
    public function activarMiSubrogancia(Request $request)
    {
        $data = $request->validate([
            'desde' => 'nullable|date',
            'hasta' => 'nullable|date|after_or_equal:desde',
        ]);

        $user = Auth::user();

        if (!$user->subrogante_id) {
            return $this->errorResponse('Debes asignar primero un subrogante antes de activar la subrogancia', 422);
        }

        $user->update([
            'subrogancia_activa' => true,
            'subrogancia_desde'  => $data['desde'] ?? now(),
            'subrogancia_hasta'  => $data['hasta'] ?? null,
        ]);

        $user->load('subrogante:id,nombre,cargo');

        return $this->successResponse($user, 'Subrogancia activada');
    }

    /**
     * Desactiva la subrogancia del usuario autenticado.
     */
    public function desactivarMiSubrogancia()
    {
        $user = Auth::user();

        $user->update([
            'subrogancia_activa' => false,
            'subrogancia_desde'  => null,
            'subrogancia_hasta'  => null,
        ]);

        return $this->successResponse($user, 'Subrogancia desactivada');
    }

    /**
     * Admin: activa la subrogancia de cualquier usuario (caso uso: ausencia
     * imprevista en que el subrogado no alcanzó a activarla).
     */
    /**
     * Admin: asigna (o quita) el subrogante de cualquier usuario. Espeja la
     * lógica de actualizarMiSubrogante, pero sobre un usuario objetivo.
     */
    public function asignarSubroganteDeUsuario(Request $request, User $user)
    {
        $data = $request->validate([
            'subrogante_id' => 'nullable|integer|exists:users,id',
        ]);

        if (!empty($data['subrogante_id']) && (int) $data['subrogante_id'] === $user->id) {
            return $this->errorResponse('Un usuario no puede ser su propio subrogante', 422);
        }

        $user->update(['subrogante_id' => $data['subrogante_id'] ?? null]);
        $user->load('subrogante:id,nombre,cargo');

        return $this->successResponse($user, 'Subrogante actualizado');
    }

    public function activarSubroganciaDeUsuario(Request $request, User $user)
    {
        $data = $request->validate([
            'desde' => 'nullable|date',
            'hasta' => 'nullable|date|after_or_equal:desde',
        ]);

        if (!$user->subrogante_id) {
            return $this->errorResponse('El usuario no tiene subrogante asignado', 422);
        }

        $user->update([
            'subrogancia_activa' => true,
            'subrogancia_desde'  => $data['desde'] ?? now(),
            'subrogancia_hasta'  => $data['hasta'] ?? null,
        ]);

        $user->load('subrogante:id,nombre,cargo');

        return $this->successResponse($user, "Subrogancia de {$user->nombre} activada");
    }

    /**
     * Admin: desactiva la subrogancia de cualquier usuario.
     */
    public function desactivarSubroganciaDeUsuario(User $user)
    {
        $user->update([
            'subrogancia_activa' => false,
            'subrogancia_desde'  => null,
            'subrogancia_hasta'  => null,
        ]);

        return $this->successResponse($user, "Subrogancia de {$user->nombre} desactivada");
    }

    /**
     * Verifica si $posibleDescendienteId está dentro del subárbol de $ancestroId.
     */
    private function esDescendiente(int $posibleDescendienteId, int $ancestroId): bool
    {
        $actual = Departamento::find($posibleDescendienteId);
        $visitados = [];

        while ($actual && $actual->parent_id !== null) {
            if (in_array($actual->parent_id, $visitados, true)) {
                return false; // ciclo defensivo
            }
            if ($actual->parent_id === $ancestroId) {
                return true;
            }
            $visitados[] = $actual->parent_id;
            $actual = Departamento::find($actual->parent_id);
        }

        return false;
    }
}
