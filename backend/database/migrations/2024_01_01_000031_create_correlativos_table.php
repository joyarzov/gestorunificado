<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correlativos', function (Blueprint $table) {
            $table->id();
            $table->string('tipo', 50)->unique(); // expediente, documento, correspondencia, oirs
            $table->string('prefijo', 10)->nullable();
            $table->integer('valor_actual')->default(0);
            $table->year('anio');
            $table->boolean('reinicio_anual')->default(true);
            $table->timestamp('ultimo_reset')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('correlativos');
    }
};
