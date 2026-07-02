<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cuando el admin está en "modo auditoría" (viendo como otro usuario), esta
 * sesión es de SOLO LECTURA: se bloquea cualquier método que modifique datos.
 * Es la garantía real del solo-lectura — no depender de que el frontend oculte
 * botones. Debe ejecutarse DESPUÉS de ActuandoComo (que marca setAuditando).
 */
class SoloLecturaAuditoria
{
    // Métodos que no alteran estado. Todo lo demás se rechaza en modo auditoría.
    private const METODOS_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->estaAuditando()
            && !in_array($request->method(), self::METODOS_LECTURA, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Estás en modo auditoría (solo lectura): no puedes modificar datos mientras ves como otro usuario.',
            ], 403);
        }

        return $next($request);
    }
}
