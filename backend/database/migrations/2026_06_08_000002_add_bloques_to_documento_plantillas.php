<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 2 del mantenedor de plantillas: render por bloques.
 *
 * Agrega el motor de render configurable y la definición de estructura/estilo.
 * Todo es aditivo y con defaults seguros: las plantillas existentes siguen en
 * 'html_legacy' (contenido_html + str_replace), sin cambios de comportamiento
 * hasta que una plantilla se cambie a 'bloques'.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            if (!Schema::hasColumn('documento_plantillas', 'render_engine')) {
                $table->string('render_engine', 20)->default('html_legacy')->after('contenido_html')
                    ->comment("html_legacy = contenido_html; bloques = estructura_json + renderer");
            }
            if (!Schema::hasColumn('documento_plantillas', 'estructura_json')) {
                $table->json('estructura_json')->nullable()->after('render_engine')
                    ->comment('Lista ordenada de bloques tipados (render por bloques)');
            }
            if (!Schema::hasColumn('documento_plantillas', 'estilo_json')) {
                $table->json('estilo_json')->nullable()->after('estructura_json')
                    ->comment('Estilo del documento: márgenes, fuente, papel, logo, barra de colores');
            }
            if (!Schema::hasColumn('documento_plantillas', 'version_seeder')) {
                $table->unsignedInteger('version_seeder')->nullable()->after('origen')
                    ->comment('Versión escrita por el seeder; protege ediciones del admin al re-sembrar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            $table->dropColumn(['render_engine', 'estructura_json', 'estilo_json', 'version_seeder']);
        });
    }
};
