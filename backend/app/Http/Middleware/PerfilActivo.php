<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Aplica el perfil elegido por el usuario (header X-Perfil-Activo) acotando
 * sus roles efectivos a ese único rol. Así el backend respeta el selector de
 * perfil del frontend: un oficial de partes que entra como "usuario" deja de
 * ver/poder lo que solo corresponde al perfil oficial.
 *
 * Debe correr DESPUÉS de ActuandoComo: con subrogancia activa el perfil
 * elegido puede ser un rol del subrogado (ej. "alcalde"), y la validación
 * se hace contra los roles efectivos (propios ∪ subrogado).
 *
 * Header inválido o ausente → se ignora y el usuario opera con todos sus roles.
 */
class PerfilActivo
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $rol = $request->header('X-Perfil-Activo');

        if ($user && $rol && in_array($rol, $user->getRolesEfectivos(), true)) {
            $user->setPerfilActivo($rol);
        }

        return $next($request);
    }
}
