<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sello v2: contenido flexible (toggles y formato de fecha), layouts,
 * estilos de borde, tamaño de letra y asignación por rol.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            // Contenido
            $table->boolean('mostrar_cargo')->default(true);
            $table->boolean('mostrar_rut')->default(true);
            $table->boolean('mostrar_fecha')->default(true);
            $table->string('formato_fecha', 20)->default('fecha_hora'); // fecha_hora | fecha | larga
            $table->string('texto_linea3', 120)->nullable();
            // Diseño
            $table->string('layout', 20)->default('horizontal');        // horizontal | vertical | solo_texto | compacto
            $table->string('borde_estilo', 20)->default('solido');      // solido | doble | sin_borde
            $table->boolean('borde_redondeado')->default(false);
            $table->string('tamano_fuente', 2)->default('M');           // S | M | L
            // Asignación: null = sello general; con rol, se usa para firmantes de ese rol
            $table->string('rol_asignado', 30)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            $table->dropColumn([
                'mostrar_cargo', 'mostrar_rut', 'mostrar_fecha', 'formato_fecha',
                'texto_linea3', 'layout', 'borde_estilo', 'borde_redondeado',
                'tamano_fuente', 'rol_asignado',
            ]);
        });
    }
};
