<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fondos_concursables', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 200);
            $table->string('codigo', 20)->unique();
            $table->text('descripcion')->nullable();
            $table->string('bases_pdf_path')->nullable();
            $table->decimal('monto_total', 12, 0)->default(0);
            $table->decimal('monto_maximo_por_proyecto', 12, 0)->default(0);
            $table->enum('estado', ['borrador', 'abierto', 'cerrado', 'evaluacion', 'finalizado'])->default('borrador');
            $table->date('fecha_apertura')->nullable();
            $table->date('fecha_cierre')->nullable();
            $table->integer('anio');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fondos_concursables');
    }
};
