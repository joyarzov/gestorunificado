<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NotificacionMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $moduloLabel;
    public string $moduloColor;
    public ?string $url;

    /**
     * Solo se reciben escalares (no el modelo User) para evitar serializar/usar datos
     * obsoletos del usuario si cambia o se elimina antes de procesar el job.
     *
     * @param  array  $data  payload de la notificación (puede incluir 'url' relativa al frontend)
     */
    public function __construct(
        public string $nombre,
        public string $modulo,
        public string $titulo,
        public string $cuerpo,
        public array $data = []
    ) {
        $cfg = config("notificaciones.modulos.$modulo", config('notificaciones.default'));
        $this->moduloLabel = $cfg['label'];
        $this->moduloColor = $cfg['color'];

        // Solo se aceptan rutas relativas internas: se descarta cualquier URL absoluta
        // o protocol-relative para evitar enlaces de phishing/redirección externa.
        $rel = $data['url'] ?? null;
        if (!is_string($rel) || str_contains($rel, '://') || str_starts_with($rel, '//')) {
            $rel = null;
        }
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $this->url = $rel ? $base . (str_starts_with($rel, '/') ? $rel : '/' . $rel) : null;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[{$this->moduloLabel}] {$this->titulo}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.notificacion',
        );
    }
}
