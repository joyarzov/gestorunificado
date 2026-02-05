<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expedientes', function (Blueprint $table) {
            $table->id();

            // Identificación
            $table->string('identificador', 50)->unique();
            $table->string('estado', 50)->default('borrador');
            $table->string('titulo');

            // Descripción
            $table->text('asunto')->nullable();
            $table->text('resumen')->nullable();

            // Seguridad
            $table->integer('nivel_acceso')->default(1); // 1=Público, 2=Restringido, 3=Reservado, 4=Secreto
            $table->boolean('informacion_sensible')->default(false);

            // Procedimiento administrativo (CPAT)
            $table->string('cpat_codigo', 50)->nullable();
            $table->string('cpat_nombre')->nullable();

            // Departamento (opcional)
            $table->foreignId('departamento_id')->nullable()->constrained('departamentos');

            // Fechas
            $table->dateTime('fecha_creacion');
            $table->dateTime('fecha_cierre')->nullable();

            // Control
            $table->foreignId('creado_por')->constrained('users');
            $table->foreignId('actualizado_por')->nullable()->constrained('users');

            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('identificador');
            $table->index('estado');
            $table->index('nivel_acceso');
            $table->index('creado_por');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expedientes');
    }
};
