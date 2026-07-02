<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\DocumentoEnvio;
use App\Models\DocumentoTrazabilidad;
use App\Models\User;
use App\Services\NotificacionService;
use Illuminate\Http\Request;

class DocumentoEnvioController extends Controller
{
    /**
     * Quién puede distribuir un documento firmado: el creador, el titular en cuyo
     * nombre se emitió (ej: secretaria crea en nombre del Alcalde → el Alcalde
     * también puede enviarlo) o cualquier firmante del documento.
     * Las comparaciones institucionales usan contexto() (subrogancia); la
     * de creador usa el id real porque creado_por guarda al actor real.
     */
    private function puedeDistribuir(Documento $documento, User $user): bool
    {
        if ($documento->creado_por === $user->id) {
            return true;
        }

        $ctxId = $user->contexto()->id;

        if ($documento->emitido_en_nombre_de_id === $ctxId) {
            return true;
        }

        if ($documento->firmante_asignado_id === $ctxId) {
            return true;
        }

        return $documento->firmantesAsignados()->where('users.id', $ctxId)->exists();
    }

    /**
     * Enviar documento firmado a destinatario(s)
     * Soporta envío directo (memo con _destinatario_id/para) y envío con selección manual (decretos)
     */
    public function enviar(Request $request, Documento $documento)
    {
        // Verificar que el documento esté firmado
        if ($documento->estado !== Documento::ESTADO_FIRMADO) {
            return $this->errorResponse('El documento debe estar firmado para ser enviado', 422);
        }

        // Autorización: creador, titular de emisión o firmante pueden distribuir
        if (!$this->puedeDistribuir($documento, $request->user())) {
            return $this->errorResponse('Solo el creador, el titular de emisión o un firmante pueden enviar el documento.', 403);
        }

        // Si se envían destinatario_ids desde el request (envío manual, ej: decretos)
        if ($request->filled('destinatario_ids')) {
            $request->validate([
                'destinatario_ids' => 'required|array|min:1',
                'destinatario_ids.*' => 'integer|exists:users,id',
            ]);

            $destinatarioIds = $request->input('destinatario_ids');
            $enviosCreados = [];
            $yaEnviados = [];

            foreach ($destinatarioIds as $destId) {
                // Verificar que no se haya enviado ya a este destinatario
                $envioExistente = DocumentoEnvio::where('documento_id', $documento->id)
                    ->where('destinatario_id', $destId)
                    ->first();

                if ($envioExistente) {
                    $user = User::find($destId);
                    $yaEnviados[] = $user ? $user->nombre : "ID $destId";
                    continue;
                }

                $envio = DocumentoEnvio::create([
                    'documento_id' => $documento->id,
                    'remitente_id' => $request->user()->id,
                    'destinatario_id' => $destId,
                    'estado' => 'enviado',
                    'fecha_envio' => now(),
                ]);

                $envio->load(['remitente', 'destinatario']);
                $enviosCreados[] = $envio;
            }

            if (empty($enviosCreados)) {
                return $this->errorResponse('El documento ya fue enviado a todos los destinatarios seleccionados', 422);
            }

            $nombresDestinatarios = collect($enviosCreados)->map(fn($e) => $e->destinatario->nombre ?? '')->filter()->implode(', ');
            DocumentoTrazabilidad::registrar($documento->id, 'enviado', "Documento enviado a: {$nombresDestinatarios}", [
                'destinatario_ids' => collect($enviosCreados)->pluck('destinatario_id')->toArray(),
            ]);

            // Notificar a cada destinatario que recibió un documento
            NotificacionService::enviar(
                collect($enviosCreados)->pluck('destinatario_id')->all(),
                'cero_papel',
                'documento_recibido',
                'Recibiste un documento',
                "{$request->user()->nombre} te envió el documento \"{$documento->titulo}\" ({$documento->numero}).",
                ['documento_id' => $documento->id, 'url' => '/documentos/' . $documento->id]
            );

            $msg = count($enviosCreados) === 1
                ? 'Documento enviado correctamente'
                : 'Documento enviado a ' . count($enviosCreados) . ' destinatarios';

            return $this->successResponse($enviosCreados, $msg);
        }

        // Envío automático (memo): obtener destinatario desde contenido_json
        $contenidoJson = $documento->contenido_json;
        $destinatarioId = $contenidoJson['_destinatario_id'] ?? null;

        // Fallback: buscar por nombre en campo "para"
        if (!$destinatarioId && !empty($contenidoJson['para'])) {
            $nombrePara = explode("\n", $contenidoJson['para'])[0];
            $destinatario = User::where('nombre', $nombrePara)->where('activo', true)->first();
            if ($destinatario) {
                $destinatarioId = $destinatario->id;
            }
        }

        if (!$destinatarioId) {
            return $this->errorResponse('No se encontró un destinatario para este documento', 422);
        }

        $destinatario = User::find($destinatarioId);
        if (!$destinatario) {
            return $this->errorResponse('El destinatario no existe', 422);
        }

        // Verificar que no se haya enviado ya
        $envioExistente = DocumentoEnvio::where('documento_id', $documento->id)
            ->where('destinatario_id', $destinatarioId)
            ->first();

        if ($envioExistente) {
            return $this->errorResponse('El documento ya fue enviado a este destinatario', 422);
        }

        $envio = DocumentoEnvio::create([
            'documento_id' => $documento->id,
            'remitente_id' => $request->user()->id,
            'destinatario_id' => $destinatarioId,
            'estado' => 'enviado',
            'fecha_envio' => now(),
        ]);

        $envio->load(['remitente', 'destinatario']);

        DocumentoTrazabilidad::registrar($documento->id, 'enviado', "Documento enviado a: {$destinatario->nombre}", [
            'destinatario_ids' => [$destinatarioId],
        ]);

        // Notificar al destinatario que recibió un documento
        NotificacionService::enviar(
            $destinatarioId,
            'cero_papel',
            'documento_recibido',
            'Recibiste un documento',
            "{$request->user()->nombre} te envió el documento \"{$documento->titulo}\" ({$documento->numero}).",
            ['documento_id' => $documento->id, 'url' => '/documentos/' . $documento->id]
        );

        return $this->successResponse($envio, 'Documento enviado correctamente');
    }

    /**
     * Listar documentos recibidos por el usuario actual
     */
    public function recibidos(Request $request)
    {
        $query = DocumentoEnvio::with([
            'documento.tipoDocumental',
            'documento.creador',
            'remitente',
        ])
        ->where('destinatario_id', $request->user()->id)
        ->orderByRaw("CASE WHEN estado = 'enviado' THEN 0 ELSE 1 END")
        ->orderBy('created_at', 'desc');

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        $envios = $query->paginate($request->input('per_page', 20));

        return $this->successResponse($envios);
    }

    /**
     * Listar envíos realizados por el usuario actual
     */
    public function enviados(Request $request)
    {
        $query = DocumentoEnvio::with([
            'documento.tipoDocumental',
            'destinatario',
        ])
        ->where('remitente_id', $request->user()->id)
        ->orderBy('created_at', 'desc');

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        $envios = $query->paginate($request->input('per_page', 20));

        return $this->successResponse($envios);
    }

    /**
     * Acusar recibo de un documento
     */
    public function acusarRecibo(Request $request, DocumentoEnvio $envio)
    {
        // Verificar que el usuario sea el destinatario
        if ($envio->destinatario_id !== $request->user()->id) {
            return $this->errorResponse('Solo el destinatario puede acusar recibo', 403);
        }

        if ($envio->estado === 'completado') {
            return $this->errorResponse('Ya se acusó recibo de este documento', 422);
        }

        $envio->update([
            'estado' => 'completado',
            'fecha_recepcion' => now(),
        ]);

        $envio->load(['documento.tipoDocumental', 'remitente', 'destinatario']);

        DocumentoTrazabilidad::registrar($envio->documento_id, 'recibido', 'Acuse de recibo registrado', [
            'remitente_id' => $envio->remitente_id,
        ]);

        // Notificar al remitente que se acusó recibo
        NotificacionService::enviar(
            $envio->remitente_id,
            'cero_papel',
            'documento_acuse_recibo',
            'Acuse de recibo de tu documento',
            "{$request->user()->nombre} acusó recibo del documento \"" . ($envio->documento->titulo ?? '') . "\".",
            ['documento_id' => $envio->documento_id, 'url' => '/documentos/' . $envio->documento_id]
        );

        return $this->successResponse($envio, 'Acuse de recibo registrado');
    }

    /**
     * Obtener el estado de envío de un documento
     */
    public function estadoEnvio(Documento $documento)
    {
        $envios = DocumentoEnvio::with(['remitente', 'destinatario'])
            ->where('documento_id', $documento->id)
            ->get();

        return $this->successResponse($envios);
    }
}
