<?php

namespace App\Http\Controllers;

use App\Models\OirsSolicitud;
use App\Models\OirsAdjunto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OirsPublicoController extends Controller
{
    public function crear(Request $request)
    {
        $request->validate([
            'tipo_solicitud' => 'required|in:consulta,reclamo,sugerencia,felicitacion,solicitud_informacion',
            'categoria' => 'required|string',
            'asunto' => 'required|string|max:255',
            'descripcion' => 'required|string',
            'anonimo' => 'nullable|in:true,false,1,0,on,off',
            'nombre_solicitante' => 'required_if:anonimo,false|nullable|string|max:255',
            'rut_solicitante' => 'nullable|string|max:12',
            'email_solicitante' => 'required_if:anonimo,false|nullable|email',
            'telefono_solicitante' => 'nullable|string|max:20',
            'direccion_solicitante' => 'nullable|string|max:255',
            'comuna_solicitante' => 'nullable|string|max:100',
            'medio_respuesta' => 'nullable|in:email,telefono,carta_certificada,presencial',
        ]);

        $esAnonimo = $request->boolean('anonimo', false);

        // Código de seguimiento único (para consultas posteriores sin RUT).
        do {
            $codigoSeguimiento = strtoupper(Str::random(4) . '-' . Str::random(4));
        } while (OirsSolicitud::where('codigo_seguimiento', $codigoSeguimiento)->exists());

        $solicitud = OirsSolicitud::create([
            'codigo_seguimiento' => $codigoSeguimiento,
            'tipo_solicitud' => $request->tipo_solicitud,
            'categoria' => $request->categoria,
            'asunto' => $request->asunto,
            'descripcion' => $request->descripcion,
            'anonimo' => $esAnonimo,
            'nombre_solicitante' => $esAnonimo ? null : $request->nombre_solicitante,
            'rut_solicitante' => $esAnonimo ? null : $request->rut_solicitante,
            'email_solicitante' => $esAnonimo ? null : $request->email_solicitante,
            'telefono_solicitante' => $esAnonimo ? null : $request->telefono_solicitante,
            'direccion_solicitante' => $request->direccion_solicitante,
            'comuna_solicitante' => $request->comuna_solicitante ?? 'Cabo de Hornos',
            'medio_respuesta' => $request->medio_respuesta ?? 'email',
            'estado' => 'recibido',
            'prioridad' => 'media',
            'fecha_limite_respuesta' => now()->addDays(20),
        ]);

        return $this->successResponse([
            'folio' => $solicitud->folio,
            'codigo_seguimiento' => $codigoSeguimiento,
            'mensaje' => 'Su solicitud ha sido recibida exitosamente',
        ], 'Solicitud creada', 201);
    }

    public function consultar(Request $request)
    {
        $request->validate([
            'folio' => 'required|string',
            'rut' => 'nullable|string',
            'codigo_seguimiento' => 'nullable|string',
        ]);

        $solicitud = OirsSolicitud::where('folio', $request->folio)->first();

        if (!$solicitud) {
            return $this->errorResponse('Solicitud no encontrada', 404);
        }

        $rutCoincide = $request->filled('rut') && $solicitud->rut_solicitante === $request->rut;
        $codigoCoincide = $request->filled('codigo_seguimiento')
            && $solicitud->codigo_seguimiento
            && hash_equals($solicitud->codigo_seguimiento, strtoupper(trim($request->codigo_seguimiento)));

        $propietarioAcreditado = $rutCoincide || $codigoCoincide;

        // Datos públicos limitados
        $datosPublicos = [
            'folio' => $solicitud->folio,
            'tipo_solicitud' => $solicitud->tipo_solicitud,
            'categoria' => $solicitud->categoria,
            'asunto' => $solicitud->asunto,
            'estado' => $solicitud->estado,
            'created_at' => $solicitud->created_at,
            'fecha_limite_respuesta' => $solicitud->fecha_limite_respuesta,
        ];

        if ($propietarioAcreditado) {
            $datosPublicos['descripcion'] = $solicitud->descripcion;
            $datosPublicos['respuesta'] = $solicitud->respuesta;
            $datosPublicos['fecha_respuesta'] = $solicitud->fecha_respuesta;
            $datosPublicos['unidad_responsable'] = $solicitud->unidadResponsable;
        } elseif ($solicitud->respuesta) {
            // Sin acreditación, solo mostrar respuesta si ya existe
            $datosPublicos['respuesta'] = $solicitud->respuesta;
            $datosPublicos['fecha_respuesta'] = $solicitud->fecha_respuesta;
        }

        return $this->successResponse($datosPublicos);
    }

    public function adjuntar(Request $request)
    {
        $request->validate([
            'folio' => 'required|string',
            'rut' => 'nullable|string',
            'codigo_seguimiento' => 'nullable|string',
            'archivo' => 'required|file|max:10240', // 10MB máximo
        ]);

        if (!$request->filled('rut') && !$request->filled('codigo_seguimiento')) {
            return $this->errorResponse('Debe proporcionar RUT o código de seguimiento', 422);
        }

        $solicitud = OirsSolicitud::where('folio', $request->folio)->first();
        $acreditado = $solicitud && (
            ($request->filled('rut') && $solicitud->rut_solicitante === $request->rut)
            || ($request->filled('codigo_seguimiento')
                && $solicitud->codigo_seguimiento
                && hash_equals($solicitud->codigo_seguimiento, strtoupper(trim($request->codigo_seguimiento))))
        );

        if (!$solicitud || !$acreditado) {
            return $this->errorResponse('Solicitud no encontrada o credenciales incorrectas', 404);
        }

        if ($solicitud->estado !== 'recibido') {
            return $this->errorResponse('No se pueden agregar adjuntos en este estado', 400);
        }

        $archivo = $request->file('archivo');
        $path = $archivo->store('oirs-adjuntos/' . $solicitud->id, 'public');

        $adjunto = OirsAdjunto::create([
            'oirs_solicitud_id' => $solicitud->id,
            'nombre_archivo' => $archivo->getClientOriginalName(),
            'ruta_archivo' => $path,
            'mime_type' => $archivo->getMimeType(),
            'tamano' => $archivo->getSize(),
            'origen' => 'solicitante',
        ]);

        return $this->successResponse($adjunto, 'Archivo adjuntado');
    }
}
