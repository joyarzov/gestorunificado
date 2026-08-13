<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Departamento;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Resolución de los destinos de una derivación, compartida por correspondencia
 * (DerivacionController) y expedientes (ExpedienteController): las dos cosas que
 * circulan usan el mismo motor `Derivacion`, así que deben entender "a quién va"
 * exactamente igual. Nació en correspondencia; se extrajo aquí al dar
 * multi-destino a los expedientes.
 */
trait ResuelveDestinosDerivacion
{
    /**
     * Resuelve los destinos definitivos de una derivación, ya normalizados:
     * funcionarios con derivación nominal y departamentos derivados completos.
     *
     * Un funcionario elegido en persona cuyo departamento TAMBIÉN se deriva
     * completo ya está incluido en la derivación del departamento: su fila
     * nominal se descarta. Si no, se le crearían dos derivaciones y tendría que
     * acusar recibo de las dos para que la correspondencia pasara a "En gestión"
     * (recibir() exige que no quede ninguna pendiente) — un doble acuse que nadie
     * espera y que traba el proceso.
     *
     * Es el ÚNICO punto donde se decide qué destinos existen: lo usan tanto la
     * creación de las derivaciones como el cuerpo de la providencia, para que el
     * PDF firmado y las filas creadas nunca se contradigan.
     *
     * @return array{0: \Illuminate\Support\Collection<User>, 1: \Illuminate\Support\Collection<Departamento>}
     */
    private function resolverDestinos(Request $request): array
    {
        $destinatarios = $this->resolverDestinatarios($request);
        $departamentos = $this->resolverDepartamentosDestino($request, $destinatarios);

        if ($destinatarios->isNotEmpty() && $departamentos->isNotEmpty()) {
            $idsDeptos = $departamentos->pluck('id')->map(fn ($id) => (int) $id)->all();
            $destinatarios = $destinatarios
                ->reject(fn ($u) => in_array((int) $u->departamento_id, $idsDeptos, true))
                ->values();
        }

        return [$destinatarios, $departamentos];
    }

    /**
     * Resuelve los destinatarios específicos de una derivación:
     * - derivar_a_todos → todos los usuarios activos (menos el actor y su contexto);
     * - usuario_destino_ids (y/o usuario_destino_id legado) → esos usuarios.
     * Vacío = derivación a nivel de departamento.
     *
     * En cualquier caso se excluye al propio actor (y a su contexto institucional
     * cuando subroga): nadie puede auto-derivarse — ya tiene la correspondencia, y
     * una derivación a sí mismo queda pendiente y bloquea el cierre del proceso.
     *
     * @return \Illuminate\Support\Collection<User>
     */
    private function resolverDestinatarios(Request $request)
    {
        $user = Auth::user();
        $propios = array_filter([$user->id, $user->contexto()->id]);

        if ($request->boolean('derivar_a_todos')) {
            return User::where('activo', true)
                ->whereNotIn('id', $propios)
                ->orderBy('nombre')
                ->get();
        }

        $ids = collect($request->usuario_destino_ids ?? []);
        if ($request->usuario_destino_id) {
            $ids->push($request->usuario_destino_id);
        }
        $ids = $ids->map(fn ($i) => (int) $i)
            ->reject(fn ($i) => in_array($i, $propios, true)) // sin auto-derivación
            ->unique()->values();

        // SIEMPRE una colección de Eloquent, incluso vacía: `collect()` a secas
        // es una Support\Collection y no tiene ->load(), así que quien reciba
        // esto no puede cargar relaciones sin reventar (pasó al derivar solo a
        // departamento, que deja esta lista vacía). Con $ids vacío la consulta
        // es trivial: Laravel la compila a "0 = 1".
        return User::whereIn('id', $ids->all())->get();
    }

    /**
     * Resuelve los departamentos que reciben la derivación completa (todos sus
     * funcionarios). Se combinan libremente con los destinatarios individuales.
     *
     * `departamento_destino_ids` es la lista nueva. El `departamento_destino_id`
     * singular es el contrato legado y tiene DOS sentidos según el caso, que se
     * respetan aquí para no romper a los clientes antiguos:
     *  - sin funcionarios destinatarios → es el departamento destino;
     *  - con funcionarios destinatarios → es solo el departamento de respaldo de
     *    esos funcionarios (ver store()), NO un destino adicional.
     *
     * @param  \Illuminate\Support\Collection<User>  $destinatarios
     * @return \Illuminate\Support\Collection<Departamento>
     */
    private function resolverDepartamentosDestino(Request $request, $destinatarios)
    {
        $ids = collect();

        if (!$request->boolean('derivar_a_todos')) {
            $ids = collect($request->departamento_destino_ids ?? []);
            if ($request->departamento_destino_id && $destinatarios->isEmpty()) {
                $ids->push($request->departamento_destino_id);
            }
            $ids = $ids->map(fn ($i) => (int) $i)->unique()->values();
        }

        // Siempre Eloquent, aunque venga vacía (mismo motivo que en
        // resolverDestinatarios: una Support\Collection no soporta ->load()).
        return Departamento::whereIn('id', $ids->all())->orderBy('nombre')->get();
    }
}
