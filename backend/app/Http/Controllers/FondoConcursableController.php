<?php

namespace App\Http\Controllers;

use App\Models\FondoConcursable;
use App\Models\Postulacion;
use App\Models\PostulacionAdjunto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FondoConcursableController extends Controller
{
    /**
     * Listar fondos concursables.
     */
    public function index()
    {
        $fondos = FondoConcursable::withCount('postulaciones')
            ->orderBy('anio', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($fondos);
    }

    /**
     * Crear fondo concursable.
     */
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:200',
            'codigo' => 'required|string|max:20|unique:fondos_concursables,codigo',
            'descripcion' => 'nullable|string',
            'monto_total' => 'required|numeric|min:0',
            'monto_maximo_por_proyecto' => 'required|numeric|min:0',
            'fecha_apertura' => 'nullable|date',
            'fecha_cierre' => 'nullable|date|after_or_equal:fecha_apertura',
            'anio' => 'required|integer|min:2020',
        ]);

        $fondo = FondoConcursable::create($request->all());

        return $this->successResponse($fondo, 'Fondo creado', 201);
    }

    /**
     * Ver detalle de un fondo.
     */
    public function show(FondoConcursable $fondoConcursable)
    {
        $fondoConcursable->loadCount('postulaciones');
        return $this->successResponse($fondoConcursable);
    }

    /**
     * Actualizar fondo.
     */
    public function update(Request $request, FondoConcursable $fondoConcursable)
    {
        $request->validate([
            'nombre' => 'sometimes|string|max:200',
            'descripcion' => 'nullable|string',
            'monto_total' => 'sometimes|numeric|min:0',
            'monto_maximo_por_proyecto' => 'sometimes|numeric|min:0',
            'estado' => 'sometimes|in:borrador,abierto,cerrado,evaluacion,finalizado',
            'fecha_apertura' => 'nullable|date',
            'fecha_cierre' => 'nullable|date',
            'anio' => 'sometimes|integer|min:2020',
        ]);

        $fondoConcursable->update($request->all());

        return $this->successResponse($fondoConcursable, 'Fondo actualizado');
    }

    /**
     * Subir PDF de bases.
     */
    public function subirBases(Request $request, FondoConcursable $fondoConcursable)
    {
        $request->validate([
            'archivo' => 'required|file|mimes:pdf|max:20480', // 20MB
        ]);

        // Eliminar archivo anterior si existe
        if ($fondoConcursable->bases_pdf_path) {
            Storage::disk('public')->delete($fondoConcursable->bases_pdf_path);
        }

        $path = $request->file('archivo')->store('fondos/bases', 'public');
        $fondoConcursable->update(['bases_pdf_path' => $path]);

        return $this->successResponse($fondoConcursable, 'Bases subidas');
    }

    /**
     * Listar postulaciones de un fondo.
     */
    public function postulaciones(Request $request, int $fondoId)
    {
        $fondo = FondoConcursable::findOrFail($fondoId);

        $query = Postulacion::where('fondo_id', $fondo->id)
            ->with('evaluador');

        // Filtros
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('nombre_postulante', 'like', "%{$search}%")
                  ->orWhere('rut_postulante', 'like', "%{$search}%")
                  ->orWhere('codigo', 'like', "%{$search}%");
            });
        }

        $postulaciones = $query->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return $this->successResponse($postulaciones);
    }

    /**
     * Estadísticas de un fondo.
     */
    public function estadisticas(int $fondoId)
    {
        $fondo = FondoConcursable::findOrFail($fondoId);

        $postulaciones = Postulacion::where('fondo_id', $fondo->id);

        $stats = [
            'fondo' => $fondo,
            'total_postulaciones' => (clone $postulaciones)->count(),
            'por_estado' => [
                'borrador' => (clone $postulaciones)->where('estado', 'borrador')->count(),
                'enviada' => (clone $postulaciones)->where('estado', 'enviada')->count(),
                'en_revision' => (clone $postulaciones)->where('estado', 'en_revision')->count(),
                'aprobada' => (clone $postulaciones)->where('estado', 'aprobada')->count(),
                'rechazada' => (clone $postulaciones)->where('estado', 'rechazada')->count(),
            ],
            'monto_total_aprobado' => (clone $postulaciones)->where('estado', 'aprobada')->sum('monto_aprobado'),
            'puntaje_promedio' => (clone $postulaciones)->whereNotNull('puntaje')->avg('puntaje'),
        ];

        return $this->successResponse($stats);
    }

    /**
     * Ver detalle de una postulación.
     */
    public function showPostulacion(int $id)
    {
        $postulacion = Postulacion::with(['fondo', 'evaluador', 'itemsFinanciamiento', 'adjuntos'])
            ->findOrFail($id);

        return $this->successResponse($postulacion);
    }

    /**
     * Evaluar postulación con rúbrica.
     */
    public function evaluar(Request $request, int $id)
    {
        $postulacion = Postulacion::findOrFail($id);

        if (!in_array($postulacion->estado, ['enviada', 'en_revision'])) {
            return $this->errorResponse('Esta postulación no puede ser evaluada en su estado actual', 400);
        }

        $request->validate([
            'puntaje_detalle' => 'required|array',
            'puntaje_detalle.claridad_coherencia' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.impacto_economico' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.innovacion' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.asociatividad' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.sustentabilidad' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.estrategia_comercial' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.proveedores_locales' => 'required|integer|in:0,25,50,75,100',
            'puntaje_detalle.participacion_charla' => 'required|integer|in:0,25,50,75,100',
            'observaciones_evaluacion' => 'nullable|string',
        ]);

        $detalle = $request->puntaje_detalle;

        // Calcular puntaje ponderado
        $pesos = [
            'claridad_coherencia' => 0.25,
            'impacto_economico' => 0.15,
            'innovacion' => 0.15,
            'asociatividad' => 0.05,
            'sustentabilidad' => 0.10,
            'estrategia_comercial' => 0.15,
            'proveedores_locales' => 0.10,
            'participacion_charla' => 0.05,
        ];

        $puntajeFinal = 0;
        foreach ($pesos as $criterio => $peso) {
            $puntajeFinal += ($detalle[$criterio] ?? 0) * $peso;
        }

        $postulacion->update([
            'puntaje_detalle' => $detalle,
            'puntaje' => round($puntajeFinal, 2),
            'observaciones_evaluacion' => $request->observaciones_evaluacion,
            'evaluado_por' => $request->user()->id,
            'fecha_evaluacion' => now(),
            'estado' => 'en_revision',
        ]);

        $postulacion->load('evaluador');

        return $this->successResponse($postulacion, 'Evaluación guardada');
    }

    /**
     * Aprobar postulación.
     */
    public function aprobar(Request $request, int $id)
    {
        $postulacion = Postulacion::findOrFail($id);

        if (!in_array($postulacion->estado, ['en_revision', 'enviada'])) {
            return $this->errorResponse('Esta postulación no puede ser aprobada en su estado actual', 400);
        }

        $request->validate([
            'monto_aprobado' => 'required|numeric|min:0',
            'observaciones_evaluacion' => 'nullable|string',
        ]);

        $postulacion->update([
            'estado' => 'aprobada',
            'monto_aprobado' => $request->monto_aprobado,
            'observaciones_evaluacion' => $request->observaciones_evaluacion ?? $postulacion->observaciones_evaluacion,
            'evaluado_por' => $request->user()->id,
            'fecha_evaluacion' => now(),
        ]);

        return $this->successResponse($postulacion, 'Postulación aprobada');
    }

    /**
     * Rechazar postulación.
     */
    public function rechazar(Request $request, int $id)
    {
        $postulacion = Postulacion::findOrFail($id);

        if (!in_array($postulacion->estado, ['en_revision', 'enviada'])) {
            return $this->errorResponse('Esta postulación no puede ser rechazada en su estado actual', 400);
        }

        $request->validate([
            'observaciones_evaluacion' => 'required|string',
        ]);

        $postulacion->update([
            'estado' => 'rechazada',
            'observaciones_evaluacion' => $request->observaciones_evaluacion,
            'evaluado_por' => $request->user()->id,
            'fecha_evaluacion' => now(),
        ]);

        return $this->successResponse($postulacion, 'Postulación rechazada');
    }

    /**
     * Activar o desactivar un fondo concursable.
     */
    public function toggleActivo(FondoConcursable $fondoConcursable)
    {
        $fondoConcursable->update(['activo' => !$fondoConcursable->activo]);

        $estado = $fondoConcursable->activo ? 'activado' : 'desactivado';

        return $this->successResponse($fondoConcursable, "Fondo {$estado} correctamente");
    }

    /**
     * Descargar ficha de postulación (JSON para ahora, PDF futuro).
     */
    public function ficha(int $id)
    {
        $postulacion = Postulacion::with(['fondo', 'evaluador', 'itemsFinanciamiento', 'adjuntos'])
            ->findOrFail($id);

        // Por ahora retornar datos completos; PDF se implementará con DomPDF
        return $this->successResponse($postulacion, 'Ficha de postulación');
    }

    /**
     * Descargar adjunto de postulación.
     */
    public function descargarAdjunto(int $adjuntoId)
    {
        $adjunto = PostulacionAdjunto::findOrFail($adjuntoId);

        if (!Storage::disk('public')->exists($adjunto->ruta_archivo)) {
            return $this->errorResponse('Archivo no encontrado', 404);
        }

        return Storage::disk('public')->download($adjunto->ruta_archivo, $adjunto->nombre_archivo);
    }
}
