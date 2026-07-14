<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Firma desatendida por usuario (FirmaGob):
 *  - firma_desatendida_habilitada: capacidad que habilita el admin. Sin ella el
 *    usuario NO puede firmar sin OTP (el backend siempre re-verifica este flag).
 *  - firma_modo_preferido: recuerda el último modo elegido ('atendido' | 'desatendido')
 *    para preseleccionarlo por defecto en el modal de firma en las próximas firmas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('firma_desatendida_habilitada')->default(false)->after('puede_ver_registro_correspondencia');
            $table->string('firma_modo_preferido', 20)->default('atendido')->after('firma_desatendida_habilitada');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['firma_desatendida_habilitada', 'firma_modo_preferido']);
        });
    }
};
