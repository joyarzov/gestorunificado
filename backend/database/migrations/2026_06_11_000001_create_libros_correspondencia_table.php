<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Libros de correspondencia generados: documento oficial del período,
 * firmado con FEA por el Oficial de Partes. El PDF firmado se conserva
 * tal cual se emitió (no se regenera) y es verificable por QR/código.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('libros_correspondencia', function (Blueprint $table) {
            $table->id();
            $table->string('folio', 30)->unique();          // LIBRO-2026-001
            $table->date('fecha_desde');
            $table->date('fecha_hasta');
            $table->unsignedInteger('total_registros');
            $table->foreignId('generado_por')->constrained('users');
            $table->string('codigo_verificacion', 64)->unique();
            $table->string('pdf_ruta', 500);
            $table->boolean('firmado')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('libros_correspondencia');
    }
};
