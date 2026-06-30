<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registra la fecha y hora del último inicio de sesión del usuario, para que el
 * administrador pueda ver el último acceso en el mantenedor de usuarios.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('ultimo_acceso')->nullable()->after('debe_cambiar_password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('ultimo_acceso');
        });
    }
};
