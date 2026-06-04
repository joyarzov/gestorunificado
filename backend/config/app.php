<?php

use Illuminate\Support\Facades\Facade;
use Illuminate\Support\ServiceProvider;

return [

    'name' => env('APP_NAME', 'Correspondencia Unificada'),

    'env' => env('APP_ENV', 'production'),

    'debug' => (bool) env('APP_DEBUG', false),

    'url' => env('APP_URL', 'http://localhost'),

    // URL base del frontend, usada para los enlaces de los correos de notificación.
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost')),

    // URL base pública para los QR de verificación de documentos/providencias.
    // Permite que el QR apunte a un dominio accesible desde internet (VPS),
    // en vez de la IP/host interno. Si no se define, usa APP_URL (comportamiento previo).
    'verificacion_url' => env('VERIFICACION_BASE_URL', env('APP_URL', 'http://localhost')),

    'asset_url' => env('ASSET_URL'),

    'timezone' => 'America/Punta_Arenas',

    'locale' => 'es',

    'fallback_locale' => 'es',

    'faker_locale' => 'es_CL',

    'key' => env('APP_KEY'),

    'cipher' => 'AES-256-CBC',

    'maintenance' => [
        'driver' => 'file',
    ],

    'providers' => ServiceProvider::defaultProviders()->merge([
        App\Providers\AppServiceProvider::class,
        App\Providers\AuthServiceProvider::class,
        App\Providers\EventServiceProvider::class,
        App\Providers\MailConfigServiceProvider::class,
        App\Providers\RouteServiceProvider::class,
    ])->toArray(),

    'aliases' => Facade::defaultAliases()->merge([
        // 'Example' => App\Facades\Example::class,
    ])->toArray(),

];
