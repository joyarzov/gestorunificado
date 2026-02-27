<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postulaciones', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 12)->unique();
            $table->foreignId('fondo_id')->constrained('fondos_concursables')->onDelete('cascade');
            $table->string('nombre_postulante', 200);
            $table->string('rut_postulante', 12)->index();
            $table->string('email_postulante', 150)->nullable();
            $table->string('telefono_postulante', 20)->nullable();
            $table->json('contenido_json')->nullable();
            $table->enum('estado', ['borrador', 'enviada', 'en_revision', 'aprobada', 'rechazada'])->default('borrador');
            $table->decimal('puntaje', 5, 2)->nullable();
            $table->json('puntaje_detalle')->nullable();
            $table->text('observaciones_evaluacion')->nullable();
            $table->foreignId('evaluado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->datetime('fecha_evaluacion')->nullable();
            $table->decimal('monto_aprobado', 12, 0)->nullable();
            $table->integer('paso_actual')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postulaciones');
    }
};
