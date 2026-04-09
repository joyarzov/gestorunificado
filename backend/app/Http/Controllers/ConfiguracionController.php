<?php

namespace App\Http\Controllers;

use App\Models\Configuracion;
use Illuminate\Http\Request;

class ConfiguracionController extends Controller
{
    // Claves expuestas al panel de administración
    private const ADMIN_CLAVES = ['firmagob_simulate'];

    public function index()
    {
        $config = Configuracion::whereIn('clave', self::ADMIN_CLAVES)->get()
            ->keyBy('clave')
            ->map(fn($c) => [
                'clave'       => $c->clave,
                'valor'       => $c->valor,
                'descripcion' => $c->descripcion,
            ]);

        return $this->successResponse($config);
    }

    public function update(Request $request, string $clave)
    {
        if (!in_array($clave, self::ADMIN_CLAVES)) {
            return $this->errorResponse('Clave de configuración no válida', 422);
        }

        $request->validate(['valor' => 'required|string']);

        Configuracion::set($clave, $request->valor);

        return $this->successResponse(
            Configuracion::find($clave),
            'Configuración actualizada'
        );
    }

    /**
     * Estado de FirmaGob — accesible por cualquier usuario autenticado
     * para que el modal de firma pueda mostrar el aviso de simulación.
     */
    public function firmagobEstado()
    {
        $simulate = filter_var(
            Configuracion::get('firmagob_simulate', config('firmagob.simulate', false)),
            FILTER_VALIDATE_BOOLEAN
        );

        return $this->successResponse([
            'simulate' => $simulate,
            'enabled'  => (bool) config('firmagob.enabled'),
        ]);
    }
}
