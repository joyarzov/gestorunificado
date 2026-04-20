<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departamentos', function (Blueprint $table) {
            $table->foreignId('parent_id')
                ->nullable()
                ->after('codigo')
                ->constrained('departamentos')
                ->nullOnDelete();

            $table->foreignId('jefe_id')
                ->nullable()
                ->after('parent_id')
                ->constrained('users')
                ->nullOnDelete();

            $table->string('tipo', 30)
                ->nullable()
                ->after('jefe_id')
                ->comment('alcaldia, administracion, direccion, departamento, seccion, asesor');

            $table->integer('orden')
                ->default(0)
                ->after('tipo');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('subrogante_id')
                ->nullable()
                ->after('departamento_id')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['subrogante_id']);
            $table->dropColumn('subrogante_id');
        });

        Schema::table('departamentos', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropForeign(['jefe_id']);
            $table->dropColumn(['parent_id', 'jefe_id', 'tipo', 'orden']);
        });
    }
};
