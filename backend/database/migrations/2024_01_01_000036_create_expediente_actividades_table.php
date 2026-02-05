<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expediente_actividades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expediente_id')->constrained('expedientes')->onDelete('cascade');
            $table->foreignId('usuario_id')->constrained('users');
            $table->string('tipo', 50);
            $table->text('descripcion');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index('expediente_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expediente_actividades');
    }
};
