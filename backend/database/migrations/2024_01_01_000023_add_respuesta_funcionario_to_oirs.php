<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('oirs_solicitudes', function (Blueprint $table) {
            // Respuesta interna del funcionario (para revisión del admin OIRS)
            $table->text('respuesta_funcionario')->nullable()->after('respuesta');
            $table->timestamp('fecha_respuesta_funcionario')->nullable()->after('respuesta_funcionario');
        });

        // Agregar campo origen a oirs_adjuntos para distinguir adjuntos del ciudadano vs funcionario
        Schema::table('oirs_adjuntos', function (Blueprint $table) {
            $table->string('origen', 50)->default('solicitante')->after('tamanio_bytes');
            // origen: 'solicitante', 'funcionario', 'admin'
        });
    }

    public function down(): void
    {
        Schema::table('oirs_solicitudes', function (Blueprint $table) {
            $table->dropColumn(['respuesta_funcionario', 'fecha_respuesta_funcionario']);
        });

        Schema::table('oirs_adjuntos', function (Blueprint $table) {
            $table->dropColumn('origen');
        });
    }
};
