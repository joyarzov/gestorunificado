<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Tipo de libro: entradas o salidas (registros institucionales separados). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('libros_correspondencia', function (Blueprint $table) {
            $table->string('tipo', 10)->default('entradas')->after('folio');
        });
    }

    public function down(): void
    {
        Schema::table('libros_correspondencia', function (Blueprint $table) {
            $table->dropColumn('tipo');
        });
    }
};
