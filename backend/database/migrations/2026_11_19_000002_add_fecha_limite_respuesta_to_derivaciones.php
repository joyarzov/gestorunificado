<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fecha límite de respuesta OPCIONAL que el alcalde fija al derivar una
 * correspondencia a un funcionario. Alimenta el semáforo (verde/amarillo/rojo)
 * que ve el funcionario en su bandeja y el alcalde en su lista de seguimiento.
 *
 * Vive en la derivación (no en la correspondencia): el plazo es de ESA entrega a
 * ESE destinatario; una derivación posterior puede tener otro plazo o ninguno.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->date('fecha_limite_respuesta')
                ->nullable()
                ->after('acciones_para');
        });
    }

    public function down(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropColumn('fecha_limite_respuesta');
        });
    }
};
