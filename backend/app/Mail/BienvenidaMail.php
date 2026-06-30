<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Correo de bienvenida / incorporación a la plataforma de correspondencia digital.
 * Entrega la contraseña temporal e instruye sobre el certificado SSL y la red
 * municipal. Solo recibe escalares (no el modelo User) para no arrastrar datos
 * obsoletos si el usuario cambia antes de procesarse.
 */
class BienvenidaMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public string $nombre,
        public string $rut,
        public string $passwordTemporal,
        public string $appUrl,
        public string $certUrl,
        public string $certGuiaUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Bienvenido(a) a la Plataforma de Correspondencia Digital Municipal',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.bienvenida',
        );
    }
}
