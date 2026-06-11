<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Eventos de trazabilidad de una correspondencia (cierres, reaperturas y
 * futuros hitos). Persisten para siempre en el hilo, aunque el estado
 * vuelva atrás (a diferencia de archivada_at, que refleja solo el cierre
 * vigente).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondencia_eventos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->cascadeOnDelete();
            $table->foreignId('usuario_id')->nullable()->constrained('users');
            $table->string('tipo', 30);          // archivada | desarchivada | ...
            $table->string('texto', 300);        // descripción legible del hito
            $table->timestamps();
            $table->index(['correspondencia_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correspondencia_eventos');
    }
};
