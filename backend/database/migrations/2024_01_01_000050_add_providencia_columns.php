<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Agregar columnas a derivaciones
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->json('acciones_para')->nullable()->after('observaciones');
            $table->string('folio', 50)->nullable()->after('acciones_para');
            $table->unique('folio');
        });

        // Agregar columnas a correspondencia
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->string('providencia_pdf', 500)->nullable()->after('estado');
            $table->boolean('providencia_generada')->default(false)->after('providencia_pdf');
        });

        // Agregar 'derivada_alcaldia' al enum de estado si no existe
        DB::statement("ALTER TABLE correspondencia MODIFY COLUMN estado ENUM('pendiente', 'derivada_alcaldia', 'en_proceso', 'archivado') DEFAULT 'pendiente'");
    }

    public function down(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropUnique(['folio']);
            $table->dropColumn(['acciones_para', 'folio']);
        });

        Schema::table('correspondencia', function (Blueprint $table) {
            $table->dropColumn(['providencia_pdf', 'providencia_generada']);
        });

        DB::statement("ALTER TABLE correspondencia MODIFY COLUMN estado ENUM('pendiente', 'en_proceso', 'archivado') DEFAULT 'pendiente'");
    }
};
