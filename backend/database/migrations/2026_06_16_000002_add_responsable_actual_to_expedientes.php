<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El expediente pasa a ser la unidad que circula. "Responsable actual" indica en
 * poder de quién está ahora (un usuario específico, no todo el departamento) y
 * cambia en cada derivación. El departamento es dato derivado del responsable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->foreignId('responsable_actual_usuario_id')->nullable()->after('departamento_id')
                ->constrained('users')->nullOnDelete();
            $table->foreignId('responsable_actual_departamento_id')->nullable()->after('responsable_actual_usuario_id')
                ->constrained('departamentos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('expedientes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('responsable_actual_usuario_id');
            $table->dropConstrainedForeignId('responsable_actual_departamento_id');
        });
    }
};
