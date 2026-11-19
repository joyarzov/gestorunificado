<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca de "cumplido" INDIVIDUAL por funcionario sobre una derivación con plazo.
 *
 * Muchas correspondencias no se responden por oficina de partes: solo se derivan
 * para que el funcionario entregue información. En esos casos, el plazo de
 * respuesta no se cierra con un documento de salida, sino cuando CADA funcionario
 * marca "cumplida" su propia entrega (tras acusar recibo). Su semáforo se apaga
 * de forma independiente; el alcalde ve un ✅ cuando todos cumplieron.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->timestamp('cumplida_at')
                ->nullable()
                ->after('fecha_limite_respuesta');
        });
    }

    public function down(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropColumn('cumplida_at');
        });
    }
};
