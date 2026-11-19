<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Correo del módulo de reservas. Reusa la plantilla de notificaciones y, cuando
 * corresponde (confirmación de la reserva), adjunta un archivo .ics para que la
 * cita entre directo en el calendario (Outlook/Gmail) del asistente.
 *
 * Solo recibe escalares (no modelos) para no serializar datos que podrían quedar
 * obsoletos antes de que el job procese el correo.
 */
class ReservaMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $moduloLabel;
    public string $moduloColor;
    public ?string $url;

    public function __construct(
        public string $nombre,
        public string $titulo,
        public string $cuerpo,
        public array $data = [],
        public ?string $icsContent = null,
        public string $icsFilename = 'reserva.ics'
    ) {
        $cfg = config('notificaciones.modulos.reservas', config('notificaciones.default'));
        $this->moduloLabel = $cfg['label'];
        $this->moduloColor = $cfg['color'];

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
        // Reusa la plantilla de notificaciones (mismas variables).
        return new Content(view: 'emails.notificacion');
    }

    public function attachments(): array
    {
        if (!$this->icsContent) {
            return [];
        }

        return [
            Attachment::fromData(fn () => $this->icsContent, $this->icsFilename)
                ->withMime('text/calendar'),
        ];
    }
}
