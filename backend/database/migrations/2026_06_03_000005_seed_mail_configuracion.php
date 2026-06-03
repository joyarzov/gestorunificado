<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Claves de configuración SMTP editables desde el panel de administración.
     * Se crean VACÍAS: si están vacías, el sistema usa los valores del .env como
     * fallback. Al editarlas en el panel, el valor de la BD tiene precedencia.
     * No se versionan secretos: las credenciales reales viven en el .env.
     */
    public function up(): void
    {
        $claves = [
            ['mail_host',         'Servidor SMTP (host). Vacío = usar valor del .env.'],
            ['mail_port',         'Puerto SMTP (ej. 465 SSL, 587 TLS).'],
            ['mail_username',     'Usuario / cuenta SMTP.'],
            ['mail_password',     'Contraseña SMTP.'],
            ['mail_encryption',   'Cifrado: ssl o tls.'],
            ['mail_from_address', 'Dirección remitente (From).'],
            ['mail_from_name',    'Nombre visible del remitente.'],
        ];

        foreach ($claves as [$clave, $descripcion]) {
            if (!DB::table('configuracion')->where('clave', $clave)->exists()) {
                DB::table('configuracion')->insert([
                    'clave'       => $clave,
                    'valor'       => null,
                    'descripcion' => $descripcion,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('configuracion')->whereIn('clave', [
            'mail_host', 'mail_port', 'mail_username', 'mail_password',
            'mail_encryption', 'mail_from_address', 'mail_from_name',
        ])->delete();
    }
};
