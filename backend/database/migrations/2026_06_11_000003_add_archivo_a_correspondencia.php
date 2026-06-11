<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cierre formal del proceso por el Alcalde: quién y cuándo archivó.
 * Una correspondencia archivada queda de solo lectura hasta que el
 * Alcalde la desarchive.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->foreignId('archivada_por')->nullable()->constrained('users');
            $table->timestamp('archivada_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->dropConstrainedForeignId('archivada_por');
            $table->dropColumn('archivada_at');
        });
    }
};
