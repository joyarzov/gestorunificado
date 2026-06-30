<?php

namespace App\Services;

use App\Mail\BienvenidaMail;
use App\Mail\RestablecerClaveMail;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Entrega de acceso a un usuario: genera una contraseña temporal, marca el
 * cambio obligatorio (debe_cambiar_password) y envía el correo correspondiente.
 * Compartido por el comando usuarios:onboarding y el mantenedor de usuarios (admin).
 */
class OnboardingService
{
    public const URL_BASE_DEFAULT = 'https://docmunicipal.local';

    /**
     * @param  string  $tipo  'bienvenida' (correo completo de incorporación) o 'reset' (solo nueva clave).
     * @return string  La contraseña temporal generada (para registro/auditoría; no se debe mostrar al admin).
     *
     * @throws \RuntimeException si el usuario no tiene correo válido.
     */
    public function enviar(
        User $user,
        string $tipo = 'bienvenida',
        ?string $urlBase = null,
        ?string $passwordFijo = null
    ): string {
        $email = trim((string) $user->email);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException('El usuario no tiene un correo electrónico válido registrado.');
        }

        $urlBase = rtrim($urlBase ?: self::URL_BASE_DEFAULT, '/');
        $password = $passwordFijo ?: $this->generarPassword();

        $user->update([
            'password' => Hash::make($password),
            'debe_cambiar_password' => true,
        ]);

        if ($tipo === 'reset') {
            Mail::to($email)->send(new RestablecerClaveMail(
                nombre: (string) $user->nombre,
                rut: (string) $user->rut,
                passwordTemporal: $password,
                appUrl: $urlBase,
            ));
        } else {
            Mail::to($email)->send(new BienvenidaMail(
                nombre: (string) $user->nombre,
                rut: (string) $user->rut,
                passwordTemporal: $password,
                appUrl: $urlBase,
                certUrl: $urlBase . '/certificado-municipal.crt',
                certGuiaUrl: $urlBase . '/certificados',
            ));
        }

        return $password;
    }

    /**
     * Contraseña temporal legible: prefijo "CdH" + 6 caracteres de un alfabeto
     * sin caracteres ambiguos (sin 0/O/1/I/l). Cumple el mínimo de 6 al cambiar.
     */
    public function generarPassword(): string
    {
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $sufijo = '';
        for ($i = 0; $i < 6; $i++) {
            $sufijo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }
        return 'CdH' . $sufijo;
    }
}
