<?php

namespace App\Http\Controllers;

use App\Models\CorrespondenciaAdjunto;
use App\Models\Correspondencia;
use App\Models\Documento;
use App\Models\DocumentoAdjunto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class AdjuntoController extends Controller
{
    /** Extensiones permitidas para adjuntos de la ficha de correspondencia. */
    private const EXTENSIONES_CORRESPONDENCIA = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rar', 'jpg', 'jpeg', 'png'];

    public function subirCorrespondencia(Request $request, Correspondencia $correspondencia)
    {
        $user = Auth::user();

        // La ficha de correspondencia la administra oficina de partes / admin.
        // (Los participantes adjuntan en el hilo de conversación.)
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('No tienes permiso para adjuntar archivos a la ficha.', 403);
        }

        $request->validate([
            'archivo' => 'required|file|max:30720', // 30MB máximo
        ]);

        $file = $request->file('archivo');
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, self::EXTENSIONES_CORRESPONDENCIA, true)) {
            return $this->errorResponse(
                "Tipo de archivo no permitido: .{$ext}. Permitidos: " . implode(', ', self::EXTENSIONES_CORRESPONDENCIA) . '.',
                422
            );
        }

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
        $user = Auth::user();
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('No tienes permiso para eliminar adjuntos de la ficha.', 403);
        }

        // Eliminar archivo físico
        Storage::disk('public')->delete($adjunto->ruta_archivo);

        $adjunto->delete();

        return $this->successResponse(null, 'Archivo eliminado');
    }

    public function descargar(CorrespondenciaAdjunto $adjunto)
    {
        if (!$adjunto->correspondencia?->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        if (!Storage::disk('public')->exists($adjunto->ruta_archivo)) {
            return $this->errorResponse('Archivo no encontrado', 404);
        }

        return Storage::disk('public')->download(
            $adjunto->ruta_archivo,
            $adjunto->nombre_archivo
        );
    }

    /**
     * Adjuntar un PDF a un documento. Solo se aceptan archivos PDF.
     */
    public function subirDocumento(Request $request, Documento $documento)
    {
        if ($documento->estaFirmado()) {
            return $this->errorResponse('No se pueden modificar los adjuntos de un documento firmado', 400);
        }

        $request->validate([
            'archivo' => 'required|file|mimetypes:application/pdf|mimes:pdf|max:10240', // 10MB máximo
        ]);

        $file = $request->file('archivo');

        // Verificación adicional por magic bytes (%PDF) — el mimetype declarado puede falsificarse.
        $handle = fopen($file->getRealPath(), 'rb');
        $magic = $handle ? fread($handle, 4) : '';
        if ($handle) {
            fclose($handle);
        }
        if ($magic !== '%PDF') {
            return $this->errorResponse('El archivo no es un PDF válido', 422);
        }

        $path = $file->store('documentos/' . $documento->id . '/adjuntos', 'public');

        $adjunto = DocumentoAdjunto::create([
            'documento_id' => $documento->id,
            'nombre_archivo' => $file->getClientOriginalName(),
            'ruta_archivo' => $path,
            'tipo_mime' => $file->getMimeType(),
            'tamanio_bytes' => $file->getSize(),
            'subido_por' => Auth::id(),
        ]);

        return $this->successResponse($adjunto, 'Adjunto subido correctamente', 201);
    }

    public function eliminarDocumento(DocumentoAdjunto $adjunto)
    {
        if ($adjunto->documento && $adjunto->documento->estaFirmado()) {
            return $this->errorResponse('No se pueden modificar los adjuntos de un documento firmado', 400);
        }

        Storage::disk('public')->delete($adjunto->ruta_archivo);

        $adjunto->delete();

        return $this->successResponse(null, 'Adjunto eliminado');
    }

    public function descargarDocumento(DocumentoAdjunto $adjunto)
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
