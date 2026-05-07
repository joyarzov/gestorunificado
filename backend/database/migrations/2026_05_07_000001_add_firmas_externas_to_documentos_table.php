<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            if (!Schema::hasColumn('documentos', 'firmas_externas')) {
                $table->json('firmas_externas')->nullable()->after('metadata_pdfa');
            }
            if (!Schema::hasColumn('documentos', 'origen_carga')) {
                // 'creado' = generado en plataforma, 'subido' = PDF subido externamente
                $table->string('origen_carga', 20)->default('creado')->after('mecanismo_incorporacion');
                $table->index('origen_carga');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            if (Schema::hasColumn('documentos', 'firmas_externas')) {
                $table->dropColumn('firmas_externas');
            }
            if (Schema::hasColumn('documentos', 'origen_carga')) {
                $table->dropIndex(['origen_carga']);
                $table->dropColumn('origen_carga');
            }
        });
    }
};
