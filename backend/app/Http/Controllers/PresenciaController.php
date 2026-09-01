<?php

namespace App\Http\Controllers;

use App\Services\PresenciaService;
use Illuminate\Support\Facades\Auth;

class PresenciaController extends Controller
{
    public function __construct(private PresenciaService $presencia)
    {
    }

    /**
     * Quién está conectado a la plataforma.
     *
     * Lo consulta el globo flotante, que vive en el layout: se pide una vez por
     * minuto mientras el panel está abierto y no requiere que el usuario tenga
     * permiso alguno — saber quién está disponible es información de trabajo,
     * no un dato sensible.
     */
    public function index()
    {
        $user = Auth::user();

        // En modo auditoría el admin mira la plataforma con los ojos de otro,
        // pero la presencia es un hecho físico: se responde siempre respecto
        // del usuario REAL. Así el auditor no aparece ni desaparece a nadie.
        return $this->successResponse([
            'usuarios' => $this->presencia->listado($user),
            'umbrales' => [
                'en_linea' => PresenciaService::MINUTOS_EN_LINEA,
            ],
        ]);
    }
}
