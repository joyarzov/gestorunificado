<?php

namespace App\Providers;

use App\Models\Configuracion;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

/**
 * Aplica la configuración SMTP almacenada en la tabla `configuracion` por encima
 * de la del .env. Permite cambiar el correo desde el panel de administración sin
 * redeploy. Si una clave está vacía/ausente, se mantiene el valor del .env.
 * Corre tanto en el contexto web como en el worker de colas.
 */
class MailConfigServiceProvider extends ServiceProvider
{
    private const MAP = [
        'mail_host'         => 'mail.mailers.smtp.host',
        'mail_port'         => 'mail.mailers.smtp.port',
        'mail_username'     => 'mail.mailers.smtp.username',
        'mail_password'     => 'mail.mailers.smtp.password',
        'mail_encryption'   => 'mail.mailers.smtp.encryption',
        'mail_from_address' => 'mail.from.address',
        'mail_from_name'    => 'mail.from.name',
    ];

    public function boot(): void
    {
        try {
            if (!Schema::hasTable('configuracion')) {
                return;
            }

            // Cacheado para no consultar la BD en cada request/boot. Se invalida en Configuracion::set().
            $valores = Cache::remember('mail_config_override', 600, function () {
                return Configuracion::whereIn('clave', array_keys(self::MAP))
                    ->pluck('valor', 'clave')
                    ->toArray();
            });

            $override = [];
            foreach (self::MAP as $clave => $cfgKey) {
                $val = $valores[$clave] ?? null;
                if ($val !== null && $val !== '') {
                    $override[$cfgKey] = $val;
                }
            }
            if ($override) {
                config($override);
            }
        } catch (\Throwable $e) {
            // BD no disponible (ej. durante migraciones/instalación): se usa el .env.
        }
    }
}
