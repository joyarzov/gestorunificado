<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_firmas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('documentos')->onDelete('cascade');
            $table->foreignId('usuario_id')->constrained('users');
            $table->enum('tipo_firma', ['autor', 'visador', 'aprobador'])->default('autor');
            $table->integer('orden')->default(1);
            $table->enum('estado', ['pendiente', 'firmado', 'rechazado'])->default('pendiente');
            $table->timestamp('fecha_firma')->nullable();
            $table->text('observacion')->nullable();

            // Datos de FirmaGOB
            $table->string('firma_gob_id', 100)->nullable();
            $table->json('firma_gob_data')->nullable();

            $table->timestamps();

            $table->index(['documento_id', 'orden']);
            $table->index(['usuario_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_firmas');
    }
};
