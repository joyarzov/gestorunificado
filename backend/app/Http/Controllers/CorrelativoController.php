<?php

namespace App\Http\Controllers;

use App\Models\Correlativo;
use Illuminate\Http\Request;

class CorrelativoController extends Controller
{
    public function index()
    {
        $correlativos = Correlativo::orderBy('tipo', 'asc')->get();

        return $this->successResponse($correlativos);
    }

    public function show(string $tipo)
    {
        $correlativo = Correlativo::where('tipo', $tipo)->first();

        if (!$correlativo) {
            return $this->errorResponse('Tipo de correlativo no encontrado', 404);
        }

        return $this->successResponse($correlativo);
    }

    public function reset(Request $request, string $tipo)
    {
        $request->validate([
            'valor' => 'required|integer|min:0',
        ]);

        $correlativo = Correlativo::where('tipo', $tipo)->first();

        if (!$correlativo) {
            return $this->errorResponse('Tipo de correlativo no encontrado', 404);
        }

        $correlativo->update([
            'valor_actual' => $request->valor,
            'ultimo_reset' => now(),
        ]);

        return $this->successResponse($correlativo, 'Correlativo reiniciado');
    }

    public function siguiente(string $tipo)
    {
        try {
            $siguiente = Correlativo::obtenerSiguiente($tipo);

            return $this->successResponse([
                'tipo' => $tipo,
                'siguiente' => $siguiente,
            ]);
        } catch (\Exception $e) {
            return $this->errorResponse($e->getMessage(), 400);
        }
    }

    public function crear(Request $request)
    {
        $request->validate([
            'tipo' => 'required|string|max:50|unique:correlativos,tipo',
            'prefijo' => 'nullable|string|max:10',
            'valor_inicial' => 'integer|min:0',
            'reinicio_anual' => 'boolean',
        ]);

        $correlativo = Correlativo::create([
            'tipo' => strtolower($request->tipo),
            'prefijo' => $request->prefijo,
            'valor_actual' => $request->valor_inicial ?? 0,
            'anio' => date('Y'),
            'reinicio_anual' => $request->reinicio_anual ?? true,
        ]);

        return $this->successResponse($correlativo, 'Correlativo creado', 201);
    }
}
