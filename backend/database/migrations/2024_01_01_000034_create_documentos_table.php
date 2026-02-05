<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documentos', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 50)->nullable();
            $table->string('titulo', 255);
            $table->text('descripcion')->nullable();
            $table->foreignId('tipo_documental_id')->constrained('tipos_documentales');
            $table->foreignId('plantilla_id')->nullable()->constrained('documento_plantillas');
            $table->foreignId('expediente_id')->nullable()->constrained('expedientes');
            $table->foreignId('usuario_creador_id')->constrained('users');
            $table->foreignId('departamento_id')->nullable()->constrained('departamentos');

            // Contenido
            $table->json('contenido_json')->nullable()->comment('Datos del formulario');
            $table->longText('contenido_html')->nullable()->comment('HTML renderizado');
            $table->string('archivo_pdf', 500)->nullable();
            $table->string('archivo_original', 500)->nullable();

            // Estado y firma
            $table->enum('estado', ['borrador', 'pendiente_firma', 'firmado', 'rechazado', 'anulado'])->default('borrador');
            $table->boolean('firmado')->default(false);
            $table->timestamp('fecha_firma')->nullable();

            // Índice electrónico
            $table->integer('orden_expediente')->nullable();
            $table->integer('folio_inicio')->nullable();
            $table->integer('folio_fin')->nullable();

            // Metadatos
            $table->year('anio');
            $table->timestamps();
            $table->softDeletes();

            $table->index('numero');
            $table->index('estado');
            $table->index(['expediente_id', 'orden_expediente']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documentos');
    }
};
