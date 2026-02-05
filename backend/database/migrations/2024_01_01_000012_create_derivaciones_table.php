<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('derivaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->onDelete('cascade');
            $table->foreignId('departamento_origen_id')->constrained('departamentos');
            $table->foreignId('departamento_destino_id')->constrained('departamentos');
            $table->foreignId('usuario_origen_id')->constrained('users');
            $table->foreignId('usuario_destino_id')->nullable()->constrained('users');
            $table->string('pdf_ruta', 500)->nullable();
            $table->text('observaciones')->nullable();
            $table->enum('estado', ['pendiente', 'recibido', 'archivado'])->default('pendiente');
            $table->timestamp('fecha_recepcion')->nullable();
            $table->timestamps();

            $table->index('correspondencia_id');
            $table->index('departamento_destino_id');
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('derivaciones');
    }
};
