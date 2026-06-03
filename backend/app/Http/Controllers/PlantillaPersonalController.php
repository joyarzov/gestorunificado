<?php

namespace App\Http\Controllers;

use App\Models\DocumentoPlantillaPersonal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PlantillaPersonalController extends Controller
{
    /**
     * Listar las plantillas personales (presets) del usuario autenticado.
     * Estrictamente filtradas por dueño.
     */
    public function index()
    {
        $plantillas = DocumentoPlantillaPersonal::where('user_id', Auth::id())
            ->with('plantillaBase.tipoDocumental:id,nombre,codigo')
            ->orderBy('nombre')
            ->get();

        return response()->json($plantillas);
    }

    /**
     * Guardar el estado actual del formulario como plantilla personal.
     */
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:150',
            'plantilla_id' => 'required|exists:documento_plantillas,id',
            'contenido_json' => 'required|array',
        ]);

        $plantilla = DocumentoPlantillaPersonal::create([
            'user_id' => Auth::id(),
            'nombre' => $request->nombre,
            'plantilla_id' => $request->plantilla_id,
            'contenido_json' => $request->contenido_json,
        ]);

        return $this->successResponse(
            $plantilla->load('plantillaBase.tipoDocumental:id,nombre,codigo'),
            'Plantilla guardada correctamente',
            201
        );
    }

    /**
     * Eliminar una plantilla personal. Solo el dueño puede borrarla.
     */
    public function destroy($id)
    {
        $plantilla = DocumentoPlantillaPersonal::where('id', $id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $plantilla->delete();

        return $this->successResponse(null, 'Plantilla eliminada');
    }
}
