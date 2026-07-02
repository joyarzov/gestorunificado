<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Gestión (solo admin) de las delegaciones de emisión: define qué usuarios
 * (delegados) pueden crear documentos de Cero Papel en nombre de qué titulares.
 * Ver migración create_delegaciones_emision y User::emisoresDelegados().
 */
class DelegacionEmisionController extends Controller
{
    /** Lista las delegaciones de un delegado (o de todos si no se filtra). */
    public function index(Request $request)
    {
        $query = User::query()
            ->whereHas('emisoresDelegados')
            ->with(['emisoresDelegados:id,nombre,cargo']);

        if ($request->filled('delegado_id')) {
            $query->where('id', $request->delegado_id);
        }

        $delegados = $query->get(['id', 'nombre', 'cargo'])->map(fn ($u) => [
            'delegado' => ['id' => $u->id, 'nombre' => $u->nombre, 'cargo' => $u->cargo],
            'titulares' => $u->emisoresDelegados->map(fn ($t) => [
                'id' => $t->id, 'nombre' => $t->nombre, 'cargo' => $t->cargo,
            ])->values(),
        ]);

        return $this->successResponse($delegados);
    }

    /** Reemplaza el conjunto de titulares que un delegado puede representar. */
    public function actualizar(Request $request, User $delegado)
    {
        $request->validate([
            'titular_ids' => 'present|array',
            'titular_ids.*' => 'exists:users,id',
        ]);

        // Un usuario no puede ser delegado de sí mismo.
        $titulares = collect($request->titular_ids)
            ->reject(fn ($id) => (int) $id === $delegado->id)
            ->unique()
            ->values()
            ->all();

        $delegado->emisoresDelegados()->sync($titulares);
        $delegado->load('emisoresDelegados:id,nombre,cargo');

        return $this->successResponse(
            $delegado->emisoresDelegados,
            'Delegación de emisión actualizada'
        );
    }
}
