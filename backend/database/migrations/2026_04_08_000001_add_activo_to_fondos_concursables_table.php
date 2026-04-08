<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fondos_concursables', function (Blueprint $table) {
            $table->boolean('activo')->default(true)->after('anio');
        });
    }

    public function down(): void
    {
        Schema::table('fondos_concursables', function (Blueprint $table) {
            $table->dropColumn('activo');
        });
    }
};
