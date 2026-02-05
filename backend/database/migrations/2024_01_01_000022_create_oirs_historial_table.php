<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oirs_historial', function (Blueprint $table) {
            $table->id();
            $table->foreignId('oirs_solicitud_id')->constrained('oirs_solicitudes')->onDelete('cascade');
            $table->foreignId('usuario_id')->constrained('users');
            $table->string('accion', 100);
            $table->string('estado_anterior', 50)->nullable();
            $table->string('estado_nuevo', 50)->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();

            $table->index('oirs_solicitud_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oirs_historial');
    }
};
