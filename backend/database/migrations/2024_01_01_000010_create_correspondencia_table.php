<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondencia', function (Blueprint $table) {
            $table->id();
            $table->string('numero_documento', 50)->nullable();
            $table->string('remitente', 200);
            $table->date('fecha_documento')->nullable();
            $table->date('fecha_recibo');
            $table->text('descripcion')->nullable();
            $table->foreignId('departamento_id')->nullable()->constrained('departamentos');
            $table->date('fecha_revision')->nullable();
            $table->date('fecha_envio')->nullable();
            $table->foreignId('usuario_id')->nullable()->constrained('users');
            $table->enum('estado', ['pendiente', 'en_proceso', 'archivado'])->default('pendiente');
            $table->timestamps();

            $table->index('numero_documento');
            $table->index('fecha_recibo');
            $table->index('estado');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondencia');
    }
};
