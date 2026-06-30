<?php

namespace App\Console\Commands;

use App\Mail\BienvenidaMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

/**
 * Onboarding: entrega una contraseña temporal a usuarios ya creados y les envía
 * el correo de bienvenida con instrucciones (certificado SSL + red municipal).
 * Marca `debe_cambiar_password` para forzar el cambio en el primer login.
 *
 * Por seguridad NO actúa sobre todos los usuarios salvo que se pase --todos.
 * Ejemplos:
 *   php artisan usuarios:onboarding --rut=17033946-0
 *   php artisan usuarios:onboarding --todos --dry-run
 */
class EnviarOnboardingUsuarios extends Command
{
    protected $signature = 'usuarios:onboarding
        {--rut= : Enviar solo a este RUT (formato 12345678-9)}
        {--todos : Enviar a TODOS los usuarios activos con correo}
        {--url=https://docmunicipal.local : URL base de la plataforma en la red municipal}
        {--password= : Contraseña temporal fija (si se omite, se genera una por usuario)}
        {--dry-run : No cambia contraseñas ni envía correos; solo muestra a quién se enviaría}';

    protected $description = 'Envía el correo de bienvenida con contraseña temporal e instrucciones de acceso a usuarios incorporados.';

    public function handle(): int
    {
        $rut = $this->option('rut');
        $todos = (bool) $this->option('todos');
        $dryRun = (bool) $this->option('dry-run');

        if (!$rut && !$todos) {
            $this->error('Debes indicar --rut=<RUT> o --todos. (Se evita el envío masivo accidental.)');
            return self::FAILURE;
        }

        $urlBase = rtrim($this->option('url'), '/');
        $certUrl = $urlBase . '/certificado-municipal.crt';
        $certGuiaUrl = $urlBase . '/certificados';

        $query = User::where('activo', true);
        if ($rut) {
            $query->where('rut', User::formatRut($rut));
        }
        $usuarios = $query->orderBy('nombre')->get();

        if ($usuarios->isEmpty()) {
            $this->warn('No se encontraron usuarios activos para los criterios indicados.');
            return self::SUCCESS;
        }

        if ($dryRun) {
            $this->warn('DRY-RUN: no se cambiarán contraseñas ni se enviarán correos.');
        }

        $enviados = 0;
        $omitidos = 0;
        $resumen = [];

        foreach ($usuarios as $user) {
            $email = trim((string) $user->email);
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $omitidos++;
                $resumen[] = [$user->rut, $user->nombre, $email ?: '—', 'OMITIDO: sin correo válido'];
                continue;
            }

            $passwordTemporal = $this->option('password') ?: $this->generarPassword();

            if ($dryRun) {
                $resumen[] = [$user->rut, $user->nombre, $email, 'Se enviaría'];
                continue;
            }

            $user->update([
                'password' => Hash::make($passwordTemporal),
                'debe_cambiar_password' => true,
            ]);

            try {
                Mail::to($email)->send(new BienvenidaMail(
                    nombre: (string) $user->nombre,
                    rut: (string) $user->rut,
                    passwordTemporal: $passwordTemporal,
                    appUrl: $urlBase,
                    certUrl: $certUrl,
                    certGuiaUrl: $certGuiaUrl,
                ));
                $enviados++;
                $resumen[] = [$user->rut, $user->nombre, $email, 'ENVIADO'];
            } catch (\Throwable $e) {
                $omitidos++;
                $resumen[] = [$user->rut, $user->nombre, $email, 'ERROR: ' . $e->getMessage()];
            }
        }

        $this->table(['RUT', 'Nombre', 'Correo', 'Resultado'], $resumen);
        $this->info("Enviados: {$enviados} · Omitidos/errores: {$omitidos}");

        return self::SUCCESS;
    }

    /**
     * Contraseña temporal legible: prefijo "CdH" + 6 caracteres de un alfabeto
     * sin caracteres ambiguos (sin 0/O/1/I/l). Cumple el mínimo de 6 al cambiar.
     */
    private function generarPassword(): string
    {
        $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $sufijo = '';
        for ($i = 0; $i < 6; $i++) {
            $sufijo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }
        return 'CdH' . $sufijo;
    }
}
