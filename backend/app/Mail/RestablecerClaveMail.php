<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Aviso de restablecimiento de contraseña por parte del administrador: entrega
 * la nueva contraseña temporal e indica que debe cambiarse al iniciar sesión.
 * Para usuarios ya operativos (no incluye las instrucciones de primer acceso).
 */
class RestablecerClaveMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public string $nombre,
        public string $rut,
        public string $passwordTemporal,
        public string $appUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Su contraseña de la Plataforma de Correspondencia fue restablecida',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.clave-temporal',
        );
    }
}
