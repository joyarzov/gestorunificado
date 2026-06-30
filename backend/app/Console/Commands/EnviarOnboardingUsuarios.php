<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\OnboardingService;
use Illuminate\Console\Command;

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

    public function handle(OnboardingService $onboarding): int
    {
        $rut = $this->option('rut');
        $todos = (bool) $this->option('todos');
        $dryRun = (bool) $this->option('dry-run');

        if (!$rut && !$todos) {
            $this->error('Debes indicar --rut=<RUT> o --todos. (Se evita el envío masivo accidental.)');
            return self::FAILURE;
        }

        $urlBase = rtrim($this->option('url'), '/');

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

            if ($dryRun) {
                $resumen[] = [$user->rut, $user->nombre, $email, 'Se enviaría'];
                continue;
            }

            try {
                $onboarding->enviar($user, 'bienvenida', $urlBase, $this->option('password') ?: null);
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
}
