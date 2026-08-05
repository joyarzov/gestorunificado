<?php

namespace App\Http\Controllers;

use App\Models\TipoDocumental;
use Illuminate\Http\Request;

class TipoDocumentalController extends Controller
{
    public function index(Request $request)
    {
        // documentos_count decide si el tipo se puede deshabilitar o eliminar
        $query = TipoDocumental::withCount('documentos');

        if ($request->filled('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('codigo', 'like', "%{$search}%")
                    ->orWhere('nombre', 'like', "%{$search}%");
            });
        }

        $tipos = $query->orderBy('nombre', 'asc')->get();

        return $this->successResponse($tipos);
    }

    public function store(Request $request)
    {
        $request->validate([
            'codigo' => 'required|string|max:20|unique:tipos_documentales,codigo',
            'nombre' => 'required|string|max:100',
            'descripcion' => 'nullable|string',
            'dias_retencion' => 'nullable|integer|min:0',
            'requiere_firma' => 'boolean',
            'activo' => 'boolean',
        ]);

        $tipo = TipoDocumental::create([
            'codigo' => strtoupper($request->codigo),
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'dias_retencion' => $request->dias_retencion,
            'requiere_firma' => $request->requiere_firma ?? false,
            'activo' => $request->activo ?? true,
        ]);

        return $this->successResponse($tipo, 'Tipo documental creado', 201);
    }

    public function show(TipoDocumental $tipoDocumental)
    {
        return $this->successResponse($tipoDocumental);
    }

    public function update(Request $request, TipoDocumental $tipoDocumental)
    {
        $request->validate([
            'codigo' => 'sometimes|string|max:20|unique:tipos_documentales,codigo,' . $tipoDocumental->id,
            'nombre' => 'sometimes|string|max:100',
            'descripcion' => 'nullable|string',
            'dias_retencion' => 'nullable|integer|min:0',
            'requiere_firma' => 'boolean',
            'activo' => 'boolean',
        ]);

        // Un tipo con documentos emitidos no se puede deshabilitar: los documentos
        // quedarían clasificados con un tipo que ya no existe para el resto del sistema.
        if ($request->has('activo') && !$request->boolean('activo') && $tipoDocumental->activo) {
            $enUso = $tipoDocumental->documentos()->count();
            if ($enUso > 0) {
                return $this->errorResponse(
                    "No se puede deshabilitar \"{$tipoDocumental->nombre}\": tiene {$enUso} "
                    . ($enUso === 1 ? 'documento asociado' : 'documentos asociados') . '.',
                    422
                );
            }
        }

        $tipoDocumental->update($request->only([
            'codigo',
            'nombre',
            'descripcion',
            'dias_retencion',
            'requiere_firma',
            'activo',
        ]));

        return $this->successResponse($tipoDocumental->loadCount('documentos'), 'Tipo documental actualizado');
    }

    public function destroy(TipoDocumental $tipoDocumental)
    {
        // Ojo: antes se consultaba expedientes(), una relación que el modelo no
        // tiene — cualquier intento de eliminar reventaba con un 500.
        if ($tipoDocumental->documentos()->exists()) {
            return $this->errorResponse('No se puede eliminar: tiene documentos asociados. Deshabilítalo si ya no se usa.', 422);
        }

        if ($tipoDocumental->plantillas()->exists()) {
            return $this->errorResponse('No se puede eliminar: hay plantillas que usan este tipo.', 422);
        }

        $tipoDocumental->delete();

        return $this->successResponse(null, 'Tipo documental eliminado');
    }

    public function activos()
    {
        $tipos = TipoDocumental::where('activo', true)
            ->orderBy('nombre', 'asc')
            ->get(['id', 'codigo', 'nombre']);

        return $this->successResponse($tipos);
    }
}
