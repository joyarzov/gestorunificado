<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permiso por usuario para ver el "Registro de correspondencia": listado de solo
 * lectura de TODAS las correspondencias del municipio (cualquier estado y nivel).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('puede_ver_registro_correspondencia')->default(false)->after('visador');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('puede_ver_registro_correspondencia');
        });
    }
};
