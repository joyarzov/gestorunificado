<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Generaliza la derivación para que pueda mover tanto una Correspondencia como
 * un Expediente, reutilizando bandeja, providencia y trazabilidad existentes.
 *
 * Estrategia: relación polimórfica (derivable_type/derivable_id). Se conserva
 * correspondencia_id (ahora nullable) por compatibilidad con el código actual
 * de correspondencia; las filas existentes se rellenan apuntando a Correspondencia.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. correspondencia_id deja de ser obligatorio (las derivaciones de expediente no lo usan).
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropForeign('derivaciones_correspondencia_id_foreign');
        });
        DB::statement('ALTER TABLE derivaciones MODIFY correspondencia_id BIGINT UNSIGNED NULL');
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->foreign('correspondencia_id')->references('id')->on('correspondencia')->onDelete('cascade');
        });

        // 2. Columnas polimórficas.
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->string('derivable_type')->nullable()->after('id');
            $table->unsignedBigInteger('derivable_id')->nullable()->after('derivable_type');
            $table->index(['derivable_type', 'derivable_id']);
        });

        // 3. Backfill: toda derivación existente es de una Correspondencia.
        DB::table('derivaciones')->whereNotNull('correspondencia_id')->update([
            'derivable_type' => \App\Models\Correspondencia::class,
            'derivable_id' => DB::raw('correspondencia_id'),
        ]);
    }

    public function down(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropIndex(['derivable_type', 'derivable_id']);
            $table->dropColumn(['derivable_type', 'derivable_id']);
        });

        // Volver correspondencia_id a NOT NULL (asume que no quedan derivaciones de expediente).
        DB::statement('DELETE FROM derivaciones WHERE correspondencia_id IS NULL');
        DB::statement('ALTER TABLE derivaciones MODIFY correspondencia_id BIGINT UNSIGNED NOT NULL');
    }
};
