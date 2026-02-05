<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAplicacionPermitida
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $aplicacion): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No autenticado',
            ], 401);
        }

        // Verificar si el usuario tiene acceso a la aplicación
        if (!$user->hasAplicacion($aplicacion)) {
            return response()->json([
                'success' => false,
                'message' => 'No tienes acceso a esta aplicación',
            ], 403);
        }

        return $next($request);
    }
}
