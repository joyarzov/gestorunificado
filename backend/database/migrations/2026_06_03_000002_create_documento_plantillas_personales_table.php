<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_plantillas_personales', function (Blueprint $table) {
            $table->id();
            // Dueño de la plantilla personal (preset). Estrictamente privada por usuario.
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('nombre', 150);
            // Plantilla base del sistema sobre la que se construye el preset.
            $table->foreignId('plantilla_id')->constrained('documento_plantillas')->onDelete('cascade');
            // Estado guardado del formulario: { variables, articulos, distribucion, firmantes_ids }
            $table->json('contenido_json')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_plantillas_personales');
    }
};
