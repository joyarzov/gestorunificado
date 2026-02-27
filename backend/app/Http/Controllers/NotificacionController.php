<?php

namespace App\Http\Controllers;

use App\Models\Notificacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificacionController extends Controller
{
    public function index()
    {
        $notificaciones = Notificacion::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return $this->successResponse($notificaciones);
    }

    public function noLeidas()
    {
        $notificaciones = Notificacion::where('user_id', Auth::id())
            ->where('leida', false)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return $this->successResponse($notificaciones);
    }

    public function marcarLeida(Notificacion $notificacion)
    {
        if ($notificacion->user_id !== Auth::id()) {
            return $this->errorResponse('No autorizado', 403);
        }

        $notificacion->marcarComoLeida();

        return $this->successResponse(null, 'Notificación marcada como leída');
    }

    public function marcarTodasLeidas()
    {
        Notificacion::where('user_id', Auth::id())
            ->where('leida', false)
            ->update([
                'leida' => true,
                'leida_at' => now(),
            ]);

        return $this->successResponse(null, 'Todas las notificaciones marcadas como leídas');
    }
}
