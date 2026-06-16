<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Un documento subido como PDF (escaneado / externo) puede no encajar en un tipo
 * documental del sistema. La carga directa (ExpedienteController::subirDocumento)
 * no asigna tipo_documental_id, así que la columna debe aceptar null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->dropForeign('documentos_tipo_documental_id_foreign');
        });
        DB::statement('ALTER TABLE documentos MODIFY tipo_documental_id BIGINT UNSIGNED NULL');
        Schema::table('documentos', function (Blueprint $table) {
            $table->foreign('tipo_documental_id')->references('id')->on('tipos_documentales');
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->dropForeign('documentos_tipo_documental_id_foreign');
        });
        DB::statement('ALTER TABLE documentos MODIFY tipo_documental_id BIGINT UNSIGNED NOT NULL');
        Schema::table('documentos', function (Blueprint $table) {
            $table->foreign('tipo_documental_id')->references('id')->on('tipos_documentales');
        });
    }
};
