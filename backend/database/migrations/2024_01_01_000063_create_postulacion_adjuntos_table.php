<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postulacion_adjuntos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->onDelete('cascade');
            $table->enum('tipo_documento', [
                'cedula_identidad',
                'registro_social_hogares',
                'cotizaciones',
                'resolucion_sanitaria',
                'patente_comercial',
                'carpeta_tributaria',
                'otro',
            ]);
            $table->string('nombre_archivo', 255);
            $table->string('ruta_archivo', 500);
            $table->string('tipo_mime', 100)->nullable();
            $table->unsignedInteger('tamanio_bytes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postulacion_adjuntos');
    }
};
