<?php

namespace App\Http\Controllers;

use App\Models\CorrespondenciaAdjunto;
use App\Models\Correspondencia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdjuntoController extends Controller
{
    public function subirCorrespondencia(Request $request, Correspondencia $correspondencia)
    {
        $request->validate([
            'archivo' => 'required|file|max:10240', // 10MB máximo
        ]);

        $file = $request->file('archivo');
        $path = $file->store('correspondencia/' . $correspondencia->id, 'public');

        $adjunto = CorrespondenciaAdjunto::create([
            'correspondencia_id' => $correspondencia->id,
            'nombre_archivo' => $file->getClientOriginalName(),
            'ruta_archivo' => $path,
            'tipo_mime' => $file->getMimeType(),
            'tamanio_bytes' => $file->getSize(),
        ]);

        return $this->successResponse($adjunto, 'Archivo subido correctamente', 201);
    }

    public function eliminar(CorrespondenciaAdjunto $adjunto)
    {
        // Eliminar archivo físico
        Storage::disk('public')->delete($adjunto->ruta_archivo);

        $adjunto->delete();

        return $this->successResponse(null, 'Archivo eliminado');
    }

    public function descargar(CorrespondenciaAdjunto $adjunto)
    {
        if (!Storage::disk('public')->exists($adjunto->ruta_archivo)) {
            return $this->errorResponse('Archivo no encontrado', 404);
        }

        return Storage::disk('public')->download(
            $adjunto->ruta_archivo,
            $adjunto->nombre_archivo
        );
    }
}
