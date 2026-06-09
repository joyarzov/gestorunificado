<?php

namespace App\Http\Controllers;

use App\Models\DocumentoPlantilla;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Mantenedor de plantillas de documentos (Fase 1).
 *
 * Permite a un administrador gestionar los METADATOS de las plantillas del módulo
 * "cero papel" (nombre, descripción, tipo documental, variables, flags, orden,
 * activación) y duplicar/eliminar plantillas. NO edita el contenido_html ni el
 * diseño: eso corresponde a la Fase 2 (estructura/estilo por bloques).
 *
 * La invalidación de la cache 'plantillas_activas' se hace automáticamente en
 * los eventos saved/deleted del modelo DocumentoPlantilla.
 */
class DocumentoPlantillaAdminController extends Controller
{
    public function index()
    {
        $plantillas = DocumentoPlantilla::with(['tipoDocumental:id,nombre,codigo', 'creador:id,nombre'])
            ->withCount(['documentos', 'plantillasPersonales'])
            ->orderByDesc('activo')
            ->orderByRaw('orden IS NULL, orden')
            ->orderBy('nombre')
            ->get();

        return $this->successResponse($plantillas);
    }

    public function show(DocumentoPlantilla $documentoPlantilla)
    {
        $documentoPlantilla->load(['tipoDocumental:id,nombre,codigo', 'creador:id,nombre'])
            ->loadCount(['documentos', 'plantillasPersonales']);

        return $this->successResponse($documentoPlantilla);
    }

    public function update(Request $request, DocumentoPlantilla $documentoPlantilla)
    {
        $request->validate([
            'nombre'              => 'sometimes|string|max:100',
            'descripcion'         => 'nullable|string',
            'tipo_documental_id'  => 'nullable|exists:tipos_documentales,id',
            'variables_json'      => 'nullable|array',
            'activo'              => 'sometimes|boolean',
            'requiere_firma'      => 'sometimes|boolean',
            'requiere_aprobacion' => 'sometimes|boolean',
            'orden'               => 'nullable|integer|min:0',
            // Diseño por bloques (Fase 2)
            'render_engine'       => 'sometimes|in:html_legacy,bloques',
            'estructura_json'     => 'nullable|array',
            'estilo_json'         => 'nullable|array',
        ]);

        // No se editan codigo ni contenido_html (el contenido_html legacy queda como respaldo).
        $documentoPlantilla->update($request->only([
            'nombre', 'descripcion', 'tipo_documental_id', 'variables_json',
            'activo', 'requiere_firma', 'requiere_aprobacion', 'orden',
            'render_engine', 'estructura_json', 'estilo_json',
        ]));

        $documentoPlantilla->load(['tipoDocumental:id,nombre,codigo', 'creador:id,nombre'])
            ->loadCount(['documentos', 'plantillasPersonales']);

        return $this->successResponse($documentoPlantilla, 'Plantilla actualizada');
    }

    /**
     * Duplica una plantilla existente (copiando su contenido) como base para una nueva.
     * Es la vía para crear plantillas en F1, ya que el contenido_html no se edita aún.
     */
    public function duplicar(DocumentoPlantilla $documentoPlantilla)
    {
        $nuevoCodigo = $documentoPlantilla->codigo . '_COPIA';
        $i = 2;
        while (DocumentoPlantilla::where('codigo', $nuevoCodigo)->exists()) {
            $nuevoCodigo = $documentoPlantilla->codigo . '_COPIA' . $i++;
        }

        $copia = DocumentoPlantilla::create([
            'nombre'              => $documentoPlantilla->nombre . ' (copia)',
            'codigo'              => $nuevoCodigo,
            'descripcion'         => $documentoPlantilla->descripcion,
            'tipo_documental_id'  => $documentoPlantilla->tipo_documental_id,
            'contenido_html'      => $documentoPlantilla->contenido_html,
            'variables_json'      => $documentoPlantilla->variables_json,
            'activo'              => false,
            'requiere_firma'      => $documentoPlantilla->requiere_firma,
            'requiere_aprobacion' => $documentoPlantilla->requiere_aprobacion,
            'editable_admin'      => true,
            'origen'              => 'admin',
            'orden'               => null,
            'creado_por'          => Auth::id(),
        ]);

        $copia->load(['tipoDocumental:id,nombre,codigo', 'creador:id,nombre'])
            ->loadCount(['documentos', 'plantillasPersonales']);

        return $this->successResponse($copia, 'Plantilla duplicada', 201);
    }

    public function toggleActivo(DocumentoPlantilla $documentoPlantilla)
    {
        $documentoPlantilla->update(['activo' => !$documentoPlantilla->activo]);
        $estado = $documentoPlantilla->activo ? 'activada' : 'desactivada';

        return $this->successResponse($documentoPlantilla, "Plantilla {$estado}");
    }

    public function destroy(DocumentoPlantilla $documentoPlantilla)
    {
        // Las plantillas del sistema no se eliminan físicamente, solo se desactivan.
        if ($documentoPlantilla->origen === 'seeder') {
            return $this->errorResponse(
                'Es una plantilla del sistema: no se puede eliminar, solo desactivar.',
                422
            );
        }

        // Proteger los documentos y los presets personales que dependen de la plantilla
        // (la FK documento_plantillas_personales.plantilla_id es onDelete cascade).
        $documentos = $documentoPlantilla->documentos()->count();
        $presets    = $documentoPlantilla->plantillasPersonales()->count();
        if ($documentos > 0 || $presets > 0) {
            return $this->errorResponse(
                "No se puede eliminar: la plantilla tiene {$documentos} documento(s) y {$presets} plantilla(s) personal(es) asociada(s). Desactívala en su lugar.",
                422
            );
        }

        $documentoPlantilla->delete();

        return $this->successResponse(null, 'Plantilla eliminada');
    }

    /**
     * Previsualiza una estructura/estilo de bloques SIN guardar, para el editor
     * visual. Devuelve un documento HTML completo (igual que el motor de bloques).
     */
    public function previsualizarBloques(Request $request)
    {
        $request->validate([
            'estructura_json' => 'required|array',
            'estilo_json'     => 'nullable|array',
            'contenido_json'  => 'nullable|array',
        ]);

        $plantilla = new \App\Models\DocumentoPlantilla(['render_engine' => 'bloques']);
        $plantilla->estructura_json = $request->estructura_json;
        $plantilla->estilo_json = $request->estilo_json ?? [];

        $appUrl = rtrim(config('app.verificacion_url'), '/');
        $html = app(\App\Services\PlantillaRenderer::class)->html(
            $plantilla,
            $request->contenido_json ?? [],
            ['codigo_verificacion' => 'XXXXXXXX', 'verificar_url' => $appUrl . '/verificar/XXXXXXXX']
        );

        return response()->json(['html' => $html, 'full' => true]);
    }
}
