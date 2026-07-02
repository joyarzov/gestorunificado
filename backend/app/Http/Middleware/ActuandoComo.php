<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Activa el "actuando como" si el request trae el header X-Actuando-Como
 * con un id de usuario al que el usuario autenticado subroga.
 *
 * Valida que:
 * - El header apunta a un usuario existente y activo.
 * - Ese usuario tiene subrogancia activa.
 * - Su subrogante_id es el usuario autenticado.
 *
 * Si todo cuadra, marca el atributo runtime en Auth::user() para que
 * User::getRolesEfectivos() incluya los roles del subrogado.
 *
 * Si el header es inválido, lo ignora silenciosamente (el usuario sigue
 * autenticado como sí mismo, sin permisos heredados).
 */
class ActuandoComo
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $targetId = $request->header('X-Actuando-Como');
        $auditarId = $request->header('X-Auditar-Como');

        // Modo auditoría (solo admin): "ver como" CUALQUIER usuario activo, sin
        // requerir subrogancia. Se marca como auditoría → SOLO LECTURA (el
        // middleware SoloLecturaAuditoria bloquea toda escritura). Tiene
        // prioridad sobre la subrogancia si ambos headers vinieran.
        if ($user && $auditarId && $user->hasRole('admin')) {
            $target = User::where('id', $auditarId)->where('activo', true)->first();
            if ($target && $target->id !== $user->id) {
                $user->setActuandoComo($target);
                $user->setAuditando(true);
                return $next($request);
            }
        }

        if ($user && $targetId) {
            $target = User::where('id', $targetId)
                ->where('activo', true)
                ->where('subrogante_id', $user->id)
                ->first();

            if ($target && $target->tieneSubroganciaActiva()) {
                $user->setActuandoComo($target);
            }
        }

        return $next($request);
    }
}
