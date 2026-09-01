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

        // Consultar la lista ES la señal de presencia: el frontend solo llama
        // aquí mientras hay alguien frente a la pantalla (deja de hacerlo con la
        // pestaña oculta o sin actividad). En modo auditoría NO se marca: el
        // admin mira con los ojos de otro y no debe aparecer como ese otro.
        if (!$user->estaAuditando()) {
            $this->presencia->registrar($user);
        }

        // La presencia es un hecho físico: se responde siempre respecto del
        // usuario REAL, no del contexto de subrogancia.
        return $this->successResponse([
            'usuarios' => $this->presencia->listado($user),
            'umbrales' => [
                'en_linea' => PresenciaService::MINUTOS_EN_LINEA,
            ],
        ]);
    }
}
