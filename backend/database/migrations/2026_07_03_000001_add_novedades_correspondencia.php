<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indicador de "novedades sin leer" por correspondencia y usuario.
 * - correspondencia.ultima_actividad_at: cuándo ocurrió la última acción
 *   (mensaje, acuse, derivación, cierre/reapertura).
 * - correspondencia_lecturas: hasta cuándo cada usuario leyó una correspondencia.
 * Novedad sin leer = ultima_actividad_at > leido_at (o sin lectura registrada).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->timestamp('ultima_actividad_at')->nullable()->after('updated_at');
        });

        // Inicializar la actividad de lo existente con su última modificación.
        DB::statement('UPDATE correspondencia SET ultima_actividad_at = COALESCE(updated_at, created_at)');

        Schema::create('correspondencia_lecturas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->cascadeOnDelete();
            $table->timestamp('leido_at')->nullable();
            $table->timestamps();
            $table->unique(['usuario_id', 'correspondencia_id']);
        });

        // ARRANQUE LIMPIO: marcar TODO lo ya existente como "ya leído" para cada
        // usuario activo, así el indicador solo señala novedades a partir de ahora
        // (no muestra de golpe toda la correspondencia histórica como nueva).
        DB::statement('
            INSERT INTO correspondencia_lecturas (usuario_id, correspondencia_id, leido_at, created_at, updated_at)
            SELECT u.id, c.id, NOW(), NOW(), NOW()
            FROM users u CROSS JOIN correspondencia c
            WHERE u.activo = 1
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondencia_lecturas');
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->dropColumn('ultima_actividad_at');
        });
    }
};
