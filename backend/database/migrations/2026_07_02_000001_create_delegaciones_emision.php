<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Delegación de emisión: un usuario (delegado, ej. la secretaria) puede crear
 * documentos de Cero Papel EN NOMBRE de otro (titular, ej. el Alcalde). El "DE:"
 * y el firmante quedan a nombre del titular; la autoría real (creado_por) sigue
 * siendo el delegado. Relación N:N: un delegado puede representar a varios
 * titulares y un titular puede tener varios delegados.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delegaciones_emision', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delegado_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('titular_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['delegado_id', 'titular_id']);
        });

        Schema::table('documentos', function (Blueprint $table) {
            $table->foreignId('emitido_en_nombre_de_id')->nullable()->after('creado_por')
                ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('emitido_en_nombre_de_id');
        });
        Schema::dropIfExists('delegaciones_emision');
    }
};
