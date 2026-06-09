<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Mensajes informales del hilo de conversación de una correspondencia.
        Schema::create('correspondencia_mensajes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users');
            $table->text('mensaje')->nullable();
            $table->timestamps();
            $table->index(['correspondencia_id', 'created_at']);
        });

        // Adjuntos de cada mensaje (varios archivos por mensaje).
        Schema::create('correspondencia_mensaje_adjuntos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mensaje_id')->constrained('correspondencia_mensajes')->cascadeOnDelete();
            $table->string('nombre_archivo');
            $table->string('ruta_archivo');
            $table->string('tipo_mime')->nullable();
            $table->unsignedBigInteger('tamanio_bytes')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondencia_mensaje_adjuntos');
        Schema::dropIfExists('correspondencia_mensajes');
    }
};
