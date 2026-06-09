<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            // Opacidad del fondo del sello: 0 = transparente, 100 = sólido.
            $table->unsignedTinyInteger('fondo_opacidad')->default(100)->after('color_fondo');
        });
    }

    public function down(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            $table->dropColumn('fondo_opacidad');
        });
    }
};
