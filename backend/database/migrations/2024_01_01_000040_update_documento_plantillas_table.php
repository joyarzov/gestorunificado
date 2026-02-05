<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            // Renombrar 'campos' a 'variables_json' si existe
            if (Schema::hasColumn('documento_plantillas', 'campos')) {
                $table->renameColumn('campos', 'variables_json');
            }

            // Agregar nuevos campos si no existen
            if (!Schema::hasColumn('documento_plantillas', 'descripcion')) {
                $table->text('descripcion')->nullable()->after('nombre');
            }
            if (!Schema::hasColumn('documento_plantillas', 'requiere_firma')) {
                $table->boolean('requiere_firma')->default(true)->after('activo');
            }
            if (!Schema::hasColumn('documento_plantillas', 'requiere_aprobacion')) {
                $table->boolean('requiere_aprobacion')->default(false)->after('requiere_firma');
            }
            if (!Schema::hasColumn('documento_plantillas', 'creado_por')) {
                $table->foreignId('creado_por')->nullable()->constrained('users')->after('requiere_aprobacion');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            // Revertir cambios
            if (Schema::hasColumn('documento_plantillas', 'variables_json')) {
                $table->renameColumn('variables_json', 'campos');
            }
            $table->dropColumn(['descripcion', 'requiere_firma', 'requiere_aprobacion']);
            $table->dropForeign(['creado_por']);
            $table->dropColumn('creado_por');
        });
    }
};
