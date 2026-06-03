<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notificaciones', function (Blueprint $table) {
            // Módulo de origen: cero_papel | correspondencia | oirs | ... (extensible)
            $table->string('modulo', 40)->nullable()->after('tipo')->index();
            // Trazabilidad del envío de email asociado a la notificación
            $table->timestamp('email_enviado_at')->nullable()->after('leida_at');
        });
    }

    public function down(): void
    {
        Schema::table('notificaciones', function (Blueprint $table) {
            $table->dropColumn(['modulo', 'email_enviado_at']);
        });
    }
};
