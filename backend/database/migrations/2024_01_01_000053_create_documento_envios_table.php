<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_envios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('documentos')->cascadeOnDelete();
            $table->foreignId('remitente_id')->constrained('users');
            $table->foreignId('destinatario_id')->constrained('users');
            $table->enum('estado', ['enviado', 'completado'])->default('enviado');
            $table->timestamp('fecha_envio')->useCurrent();
            $table->timestamp('fecha_recepcion')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index(['destinatario_id', 'estado']);
            $table->index(['remitente_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_envios');
    }
};
