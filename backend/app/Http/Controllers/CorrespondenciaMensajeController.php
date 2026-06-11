<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\CorrespondenciaMensaje;
use App\Models\CorrespondenciaMensajeAdjunto;
use App\Models\User;
use App\Services\NotificacionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CorrespondenciaMensajeController extends Controller
{
    /** Extensiones permitidas en los adjuntos del hilo. */
    private const EXTENSIONES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rar', 'jpg', 'jpeg', 'png'];

    /**
     * Hilo unificado de una correspondencia: derivaciones (formales, firmadas)
     * + mensajes (informales) mezclados cronológicamente.
     */
    public function hilo(Correspondencia $correspondencia)
    {
        if (!$correspondencia->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        $correspondencia->load([
            'derivaciones.usuarioOrigen', 'derivaciones.usuarioDestino',
            'derivaciones.departamentoOrigen', 'derivaciones.departamentoDestino',
            'derivaciones.actuandoComo',
            'mensajes.usuario', 'mensajes.adjuntos',
        ]);

        $items = [];

        foreach ($correspondencia->derivaciones as $d) {
            $items[] = [
                'tipo'          => 'derivacion',
                'id'            => $d->id,
                'fecha'         => $d->created_at,
                'estado'        => $d->estado,
                'de'            => [
                    'usuario'      => $d->usuarioOrigen?->nombre,
                    'cargo'        => $d->usuarioOrigen?->cargo,
                    'departamento' => $d->departamentoOrigen?->nombre,
                ],
                'para'          => [
                    'usuario'      => $d->usuarioDestino?->nombre,
                    'cargo'        => $d->usuarioDestino?->cargo,
                    'departamento' => $d->departamentoDestino?->nombre,
                ],
                // Subrogado en cuyo nombre se derivó (si el origen actuó como subrogante).
                'actuando_como' => $d->actuandoComo
                    ? ['nombre' => $d->actuandoComo->nombre, 'cargo' => $d->actuandoComo->cargo]
                    : null,
                'observaciones' => $d->observaciones,
                'acciones_para' => $d->acciones_para,
                'tiene_pdf'     => !empty($d->pdf_ruta),
            ];

            // El acuse de recibo es parte de la trazabilidad: evento propio
            // en el hilo, con la fecha/hora real de la recepción.
            if ($d->fecha_recepcion) {
                $items[] = [
                    'tipo'  => 'evento',
                    'id'    => $d->id,
                    'fecha' => $d->fecha_recepcion,
                    'texto' => ($d->usuarioDestino?->nombre ?? $d->departamentoDestino?->nombre ?? 'El destinatario')
                        . ($d->usuarioDestino?->cargo ? " ({$d->usuarioDestino->cargo})" : '')
                        . ' acusó recibo',
                ];
            }
        }

        foreach ($correspondencia->mensajes as $m) {
            $items[] = [
                'tipo'     => 'mensaje',
                'id'       => $m->id,
                'fecha'    => $m->created_at,
                'autor'    => ['id' => $m->usuario?->id, 'nombre' => $m->usuario?->nombre, 'cargo' => $m->usuario?->cargo],
                'es_mio'   => $m->usuario_id === Auth::id(),
                'mensaje'  => $m->mensaje,
                'adjuntos' => $m->adjuntos->map(fn ($a) => [
                    'id'            => $a->id,
                    'nombre'        => $a->nombre_archivo,
                    'tipo_mime'     => $a->tipo_mime,
                    'tamanio_bytes' => $a->tamanio_bytes,
                ])->values(),
            ];
        }

        usort($items, fn ($a, $b) => $a['fecha']->getTimestamp() <=> $b['fecha']->getTimestamp());

        $participantes = User::whereIn('id', $this->participantesIds($correspondencia))->get(['id', 'nombre']);

        return $this->successResponse([
            'items'           => $items,
            'participantes'   => $participantes,
            'puede_responder' => $this->esParticipante($correspondencia, Auth::user()),
        ]);
    }

    /** Postear un mensaje (texto y/o adjuntos) en el hilo. */
    public function store(Request $request, Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if (!$this->esParticipante($correspondencia, $user)) {
            return $this->errorResponse('No participas en esta correspondencia.', 403);
        }

        $request->validate([
            'mensaje'      => 'nullable|string|max:5000',
            'adjuntos'     => 'nullable|array|max:10',
            'adjuntos.*'   => 'file|max:20480', // 20 MB por archivo
        ]);

        $archivos = $request->file('adjuntos', []);
        if (!$request->filled('mensaje') && empty($archivos)) {
            return $this->errorResponse('Escribe un mensaje o adjunta al menos un archivo.', 422);
        }

        // Validación por extensión (más confiable que mime para RAR / Office).
        foreach ($archivos as $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            if (!in_array($ext, self::EXTENSIONES, true)) {
                return $this->errorResponse(
                    "Tipo de archivo no permitido: .{$ext}. Permitidos: " . implode(', ', self::EXTENSIONES) . '.',
                    422
                );
            }
        }

        $mensaje = DB::transaction(function () use ($correspondencia, $user, $request, $archivos) {
            $m = CorrespondenciaMensaje::create([
                'correspondencia_id' => $correspondencia->id,
                'usuario_id'         => $user->id,
                'mensaje'            => $request->mensaje,
            ]);
            foreach ($archivos as $file) {
                $path = $file->store('correspondencia/' . $correspondencia->id . '/mensajes', 'public');
                $m->adjuntos()->create([
                    'nombre_archivo' => $file->getClientOriginalName(),
                    'ruta_archivo'   => $path,
                    'tipo_mime'      => $file->getClientMimeType(),
                    'tamanio_bytes'  => $file->getSize(),
                ]);
            }
            return $m;
        });

        // Avisar a los demás participantes (no crítico).
        try {
            $otros = $this->participantesIds($correspondencia)
                ->reject(fn ($id) => $id === $user->id)
                ->values()->all();
            if (!empty($otros)) {
                NotificacionService::enviar(
                    $otros,
                    'correspondencia',
                    'correspondencia_mensaje',
                    'Nuevo mensaje en una correspondencia',
                    "{$user->nombre} escribió en la correspondencia {$correspondencia->folio} de \"{$correspondencia->remitente}\".",
                    ['correspondencia_id' => $correspondencia->id, 'url' => '/correspondencia/' . $correspondencia->id]
                );
            }
        } catch (\Throwable $e) {
            // notificación best-effort
        }

        $mensaje->load(['usuario', 'adjuntos']);
        return $this->successResponse($mensaje, 'Mensaje enviado', 201);
    }

    /** Descargar un adjunto de un mensaje del hilo. */
    public function descargarAdjunto(CorrespondenciaMensajeAdjunto $adjunto)
    {
        $correspondencia = $adjunto->mensaje?->correspondencia;
        if (!$correspondencia || !$this->esParticipante($correspondencia, Auth::user())) {
            return $this->errorResponse('No autorizado.', 403);
        }
        if (!Storage::disk('public')->exists($adjunto->ruta_archivo)) {
            return $this->errorResponse('Archivo no encontrado.', 404);
        }
        return Storage::disk('public')->download($adjunto->ruta_archivo, $adjunto->nombre_archivo);
    }

    /** IDs de los participantes: creador + toda la cadena de derivaciones. */
    private function participantesIds(Correspondencia $correspondencia)
    {
        $correspondencia->loadMissing('derivaciones');
        return collect([$correspondencia->usuario_id])
            ->merge($correspondencia->derivaciones->pluck('usuario_origen_id'))
            ->merge($correspondencia->derivaciones->pluck('usuario_destino_id'))
            ->filter()
            ->unique()
            ->values();
    }

    private function esParticipante(Correspondencia $correspondencia, ?User $user): bool
    {
        if (!$user) return false;
        return $this->participantesIds($correspondencia)->contains($user->id)
            || $user->isAdmin()
            || $user->isAlcalde();
    }
}
