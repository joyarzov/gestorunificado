<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('subrogancia_activa')
                ->default(false)
                ->after('subrogante_id');

            $table->dateTime('subrogancia_desde')
                ->nullable()
                ->after('subrogancia_activa');

            $table->dateTime('subrogancia_hasta')
                ->nullable()
                ->after('subrogancia_desde');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'subrogancia_activa',
                'subrogancia_desde',
                'subrogancia_hasta',
            ]);
        });
    }
};
