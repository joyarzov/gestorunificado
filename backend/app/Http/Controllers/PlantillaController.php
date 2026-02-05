<?php

namespace App\Http\Controllers;

use App\Models\Plantilla;
use Illuminate\Http\Request;

class PlantillaController extends Controller
{
    public function index()
    {
        $plantillas = Plantilla::activas()->orderBy('nombre')->get();

        return $this->successResponse($plantillas);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:100',
            'codigo' => 'required|string|max:50|unique:plantillas,codigo',
            'contenido_html' => 'required|string',
            'variables' => 'nullable|array',
        ]);

        $plantilla = Plantilla::create($request->only([
            'nombre',
            'codigo',
            'contenido_html',
            'variables',
        ]));

        return $this->successResponse($plantilla, 'Plantilla creada', 201);
    }

    public function show(Plantilla $plantilla)
    {
        return $this->successResponse($plantilla);
    }

    public function update(Request $request, Plantilla $plantilla)
    {
        $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'codigo' => 'sometimes|required|string|max:50|unique:plantillas,codigo,' . $plantilla->id,
            'contenido_html' => 'sometimes|required|string',
            'variables' => 'nullable|array',
            'activo' => 'sometimes|boolean',
        ]);

        $plantilla->update($request->only([
            'nombre',
            'codigo',
            'contenido_html',
            'variables',
            'activo',
        ]));

        return $this->successResponse($plantilla, 'Plantilla actualizada');
    }

    public function destroy(Plantilla $plantilla)
    {
        $plantilla->update(['activo' => false]);

        return $this->successResponse(null, 'Plantilla desactivada');
    }
}
