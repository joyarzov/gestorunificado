<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tipografía seleccionable del sello (familias TTF en resources/fonts).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            // dejavu | reddit_sans | reddit_sans_light | reddit_sans_medium
            $table->string('fuente', 30)->default('dejavu')->after('tamano_fuente');
        });
    }

    public function down(): void
    {
        Schema::table('firma_sellos', function (Blueprint $table) {
            $table->dropColumn('fuente');
        });
    }
};
