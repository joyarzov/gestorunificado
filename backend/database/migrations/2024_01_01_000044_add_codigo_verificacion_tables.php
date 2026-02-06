<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->string('codigo_verificacion', 12)->nullable()->unique()->after('identificador');
        });

        Schema::table('derivaciones', function (Blueprint $table) {
            $table->string('codigo_verificacion', 12)->nullable()->unique()->after('folio');
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->dropColumn('codigo_verificacion');
        });

        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropColumn('codigo_verificacion');
        });
    }
};
