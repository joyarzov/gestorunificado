<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Señal propia de presencia, separada de la marca de sesión de Sanctum.
 *
 * Hasta ahora "estar en línea" se deducía de `personal_access_tokens.last_used_at`,
 * que refresca CUALQUIER petición autenticada. Eso ataba dos cosas que deben ir
 * por separado:
 *
 *  - Para que el verde no mienta, el sondeo debe detenerse cuando la persona se
 *    va del puesto (sin mouse ni teclado).
 *  - Para que el chat pueda avisar de un mensaje, su sondeo NO puede detenerse
 *    por lo mismo: alguien que lleva unos minutos leyendo un papel en su
 *    escritorio igual tiene que oír que le escribieron.
 *
 * Con `last_used_at` no se podía tener las dos: el sondeo del chat mantenía viva
 * la marca y devolvía el verde mentiroso. Ahora la presencia la marca solo el
 * endpoint de presencia, que sí se detiene por inactividad, mientras el chat
 * consulta libremente.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('presencia_at')->nullable()->after('ultimo_acceso');
            $table->index('presencia_at', 'users_presencia_at_index');
        });

        // Arranque sin sobresaltos: se hereda la última señal de sesión conocida,
        // para que la lista no muestre a todos desconectados de golpe.
        DB::statement('
            UPDATE users u
              JOIN (
                SELECT tokenable_id, MAX(last_used_at) AS visto
                  FROM personal_access_tokens
                 WHERE tokenable_type = "App\\\\Models\\\\User" AND name = "usuario"
                 GROUP BY tokenable_id
              ) t ON t.tokenable_id = u.id
               SET u.presencia_at = t.visto
        ');
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_presencia_at_index');
            $table->dropColumn('presencia_at');
        });
    }
};
