<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rectificación de documentos firmes.
 *
 * Un documento firmado o incorporado es inmutable: tiene folio, código de
 * verificación y firma electrónica, y editarlo dejaría mintiendo al QR público.
 * Cuando su contenido está equivocado, el acto administrativo correcto es emitir
 * OTRO documento que lo rectifique y que ambos queden vinculados y visibles.
 *
 * El vínculo vive en el documento rectificatorio (apunta al original) para que un
 * documento pueda ser rectificado más de una vez sin perder la cadena.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->unsignedBigInteger('rectifica_a_id')->nullable()->after('expediente_id');
            $table->enum('tipo_rectificacion', ['rectifica', 'deja_sin_efecto'])->nullable()->after('rectifica_a_id');
            $table->text('motivo_rectificacion')->nullable()->after('tipo_rectificacion');
            // Marca de que el efecto sobre el original ya se aplicó: el rectificatorio
            // solo surte efecto cuando queda firme, y solo una vez.
            $table->timestamp('rectificacion_aplicada_at')->nullable()->after('motivo_rectificacion');

            $table->foreign('rectifica_a_id')->references('id')->on('documentos')->nullOnDelete();
            $table->index('rectifica_a_id');
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            $table->dropForeign(['rectifica_a_id']);
            $table->dropIndex(['rectifica_a_id']);
            $table->dropColumn([
                'rectifica_a_id',
                'tipo_rectificacion',
                'motivo_rectificacion',
                'rectificacion_aplicada_at',
            ]);
        });
    }
};
