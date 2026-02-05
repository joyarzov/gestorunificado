<?php

namespace App\Http\Controllers;

use App\Models\Departamento;
use Illuminate\Http\Request;

class DepartamentoController extends Controller
{
    public function index()
    {
        $departamentos = Departamento::orderBy('nombre')->get();

        return $this->successResponse($departamentos);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:100',
            'codigo' => 'nullable|string|max:20|unique:departamentos,codigo',
        ]);

        $departamento = Departamento::create($request->only(['nombre', 'codigo']));

        return $this->successResponse($departamento, 'Departamento creado', 201);
    }

    public function show(Departamento $departamento)
    {
        return $this->successResponse($departamento);
    }

    public function update(Request $request, Departamento $departamento)
    {
        $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'codigo' => 'nullable|string|max:20|unique:departamentos,codigo,' . $departamento->id,
            'activo' => 'sometimes|boolean',
        ]);

        $departamento->update($request->only(['nombre', 'codigo', 'activo']));

        return $this->successResponse($departamento, 'Departamento actualizado');
    }

    public function destroy(Departamento $departamento)
    {
        $departamento->update(['activo' => false]);

        return $this->successResponse(null, 'Departamento desactivado');
    }
}
