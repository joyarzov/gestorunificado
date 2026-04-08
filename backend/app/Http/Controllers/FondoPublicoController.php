<?php

namespace App\Http\Controllers;

use App\Models\FondoConcursable;
use App\Models\Postulacion;
use App\Models\PostulacionAdjunto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class FondoPublicoController extends Controller
{
    /**
     * Obtener el fondo concursable activo (abierto).
     */
    public function activo()
    {
        $fondo = FondoConcursable::where('estado', 'abierto')
            ->where('activo', true)
            ->orderBy('fecha_cierre', 'desc')
            ->first();

        if (!$fondo) {
            return $this->errorResponse('No hay fondos concursables abiertos actualmente', 404);
        }

        return $this->successResponse($fondo);
    }

    /**
     * Descargar PDF de bases del fondo.
     */
    public function descargarBases(FondoConcursable $fondo)
    {
        if (!$fondo->bases_pdf_path || !Storage::disk('public')->exists($fondo->bases_pdf_path)) {
            return $this->errorResponse('Bases no disponibles', 404);
        }

        return Storage::disk('public')->download($fondo->bases_pdf_path, 'Bases_' . $fondo->codigo . '.pdf');
    }

    /**
     * Crear una nueva postulación (borrador).
     */
    public function postular(Request $request)
    {
        $request->validate([
            'fondo_id' => 'required|exists:fondos_concursables,id',
            'nombre_postulante' => 'required|string|max:200',
            'rut_postulante' => 'required|string|max:12',
            'email_postulante' => 'nullable|email|max:150',
            'telefono_postulante' => 'nullable|string|max:20',
        ]);

        $fondo = FondoConcursable::findOrFail($request->fondo_id);

        if ($fondo->estado !== 'abierto') {
            return $this->errorResponse('Este fondo no está abierto para postulaciones', 400);
        }

        $postulacion = Postulacion::create([
            'fondo_id' => $fondo->id,
            'nombre_postulante' => $request->nombre_postulante,
            'rut_postulante' => $request->rut_postulante,
            'email_postulante' => $request->email_postulante,
            'telefono_postulante' => $request->telefono_postulante,
            'contenido_json' => $request->contenido_json ?? [],
            'estado' => 'borrador',
            'paso_actual' => 1,
        ]);

        return $this->successResponse([
            'codigo' => $postulacion->codigo,
            'id' => $postulacion->id,
        ], 'Postulación creada como borrador', 201);
    }

    /**
     * Guardar borrador de postulación (actualizar paso a paso).
     */
    public function guardarBorrador(Request $request, string $codigo)
    {
        $request->validate([
            'rut_postulante' => 'required|string|max:12',
        ]);

        $postulacion = Postulacion::where('codigo', $codigo)
            ->where('rut_postulante', $request->rut_postulante)
            ->first();

        if (!$postulacion) {
            return $this->errorResponse('Postulación no encontrada o RUT incorrecto', 404);
        }

        if ($postulacion->estado !== 'borrador') {
            return $this->errorResponse('Esta postulación ya fue enviada', 400);
        }

        DB::transaction(function () use ($request, $postulacion) {
            // Actualizar datos planos si vienen
            if ($request->has('nombre_postulante')) {
                $postulacion->nombre_postulante = $request->nombre_postulante;
            }
            if ($request->has('email_postulante')) {
                $postulacion->email_postulante = $request->email_postulante;
            }
            if ($request->has('telefono_postulante')) {
                $postulacion->telefono_postulante = $request->telefono_postulante;
            }
            if ($request->has('contenido_json')) {
                $postulacion->contenido_json = $request->contenido_json;
            }
            if ($request->has('paso_actual')) {
                $postulacion->paso_actual = $request->paso_actual;
            }

            $postulacion->save();

            // Sincronizar items de financiamiento si vienen
            if ($request->has('items_financiamiento')) {
                $postulacion->itemsFinanciamiento()->delete();
                foreach ($request->items_financiamiento as $item) {
                    $postulacion->itemsFinanciamiento()->create($item);
                }
            }
        });

        $postulacion->load('itemsFinanciamiento', 'adjuntos');

        return $this->successResponse($postulacion, 'Borrador guardado');
    }

    /**
     * Enviar postulación (cambiar de borrador a enviada).
     */
    public function enviar(Request $request, string $codigo)
    {
        $request->validate([
            'rut_postulante' => 'required|string|max:12',
        ]);

        $postulacion = Postulacion::where('codigo', $codigo)
            ->where('rut_postulante', $request->rut_postulante)
            ->first();

        if (!$postulacion) {
            return $this->errorResponse('Postulación no encontrada o RUT incorrecto', 404);
        }

        if ($postulacion->estado !== 'borrador') {
            return $this->errorResponse('Esta postulación ya fue enviada', 400);
        }

        // Validar que tiene datos mínimos
        if (empty($postulacion->contenido_json)) {
            return $this->errorResponse('La postulación no tiene datos del formulario', 400);
        }

        $postulacion->estado = 'enviada';
        $postulacion->save();

        return $this->successResponse([
            'codigo' => $postulacion->codigo,
            'estado' => $postulacion->estado,
        ], 'Postulación enviada exitosamente');
    }

    /**
     * Subir adjunto a una postulación.
     */
    public function subirAdjunto(Request $request, string $codigo)
    {
        $request->validate([
            'rut_postulante' => 'required|string|max:12',
            'archivo' => 'required|file|max:10240', // 10MB
            'tipo_documento' => 'required|in:cedula_identidad,registro_social_hogares,cotizaciones,resolucion_sanitaria,patente_comercial,carpeta_tributaria,otro',
        ]);

        $postulacion = Postulacion::where('codigo', $codigo)
            ->where('rut_postulante', $request->rut_postulante)
            ->first();

        if (!$postulacion) {
            return $this->errorResponse('Postulación no encontrada o RUT incorrecto', 404);
        }

        if ($postulacion->estado !== 'borrador') {
            return $this->errorResponse('No se pueden agregar adjuntos a una postulación enviada', 400);
        }

        $archivo = $request->file('archivo');
        $path = $archivo->store('postulaciones/' . $postulacion->id, 'public');

        $adjunto = PostulacionAdjunto::create([
            'postulacion_id' => $postulacion->id,
            'tipo_documento' => $request->tipo_documento,
            'nombre_archivo' => $archivo->getClientOriginalName(),
            'ruta_archivo' => $path,
            'tipo_mime' => $archivo->getMimeType(),
            'tamanio_bytes' => $archivo->getSize(),
        ]);

        return $this->successResponse($adjunto, 'Archivo adjuntado', 201);
    }

    /**
     * Eliminar adjunto de una postulación.
     */
    public function eliminarAdjunto(Request $request, string $codigo, int $adjuntoId)
    {
        $request->validate([
            'rut_postulante' => 'required|string|max:12',
        ]);

        $postulacion = Postulacion::where('codigo', $codigo)
            ->where('rut_postulante', $request->rut_postulante)
            ->first();

        if (!$postulacion) {
            return $this->errorResponse('Postulación no encontrada o RUT incorrecto', 404);
        }

        if ($postulacion->estado !== 'borrador') {
            return $this->errorResponse('No se pueden eliminar adjuntos de una postulación enviada', 400);
        }

        $adjunto = PostulacionAdjunto::where('id', $adjuntoId)
            ->where('postulacion_id', $postulacion->id)
            ->first();

        if (!$adjunto) {
            return $this->errorResponse('Adjunto no encontrado', 404);
        }

        Storage::disk('public')->delete($adjunto->ruta_archivo);
        $adjunto->delete();

        return $this->successResponse(null, 'Adjunto eliminado');
    }

    /**
     * Consultar estado de postulación (público).
     */
    public function consultar(Request $request)
    {
        $request->validate([
            'codigo' => 'required|string',
            'rut' => 'required|string',
        ]);

        $postulacion = Postulacion::where('codigo', $request->codigo)
            ->where('rut_postulante', $request->rut)
            ->first();

        if (!$postulacion) {
            return $this->errorResponse('Postulación no encontrada. Verifique el código y RUT ingresados.', 404);
        }

        $datos = [
            'codigo' => $postulacion->codigo,
            'nombre_postulante' => $postulacion->nombre_postulante,
            'estado' => $postulacion->estado,
            'puntaje' => $postulacion->puntaje,
            'monto_aprobado' => $postulacion->monto_aprobado,
            'observaciones_evaluacion' => $postulacion->estado === 'rechazada' ? $postulacion->observaciones_evaluacion : null,
            'created_at' => $postulacion->created_at,
            'updated_at' => $postulacion->updated_at,
        ];

        // Si está en borrador, incluir datos para retomar
        if ($postulacion->estado === 'borrador') {
            $postulacion->load('itemsFinanciamiento', 'adjuntos');
            $datos['contenido_json'] = $postulacion->contenido_json;
            $datos['items_financiamiento'] = $postulacion->itemsFinanciamiento;
            $datos['adjuntos'] = $postulacion->adjuntos;
            $datos['paso_actual'] = $postulacion->paso_actual;
            $datos['fondo_id'] = $postulacion->fondo_id;
            $datos['email_postulante'] = $postulacion->email_postulante;
            $datos['telefono_postulante'] = $postulacion->telefono_postulante;
        }

        return $this->successResponse($datos);
    }
}
