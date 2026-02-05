<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondencia_adjuntos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->onDelete('cascade');
            $table->string('nombre_archivo', 255);
            $table->string('ruta_archivo', 500);
            $table->string('tipo_mime', 100)->nullable();
            $table->integer('tamanio_bytes')->nullable();
            $table->timestamps();

            $table->index('correspondencia_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondencia_adjuntos');
    }
};
