<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Folio de ingreso (ING-) para entradas + correspondencia de SALIDA.
 *
 * - folio: correlativo institucional propio de cada correspondencia
 *   (ING- para entradas; OF-/ORD-/CIRC-/CARTA- para salidas, por serie).
 * - direccion: entrada | salida.
 * - Salidas: tipo de documento, vínculo respuesta_a, PDF firmado fuera
 *   del sistema, datos de despacho y devolución/anulación.
 * - respondida_at: chip "Respondida" de la entrada cuando su respuesta
 *   vinculada se despacha (no altera el estado del ciclo de acuses).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->string('folio', 30)->nullable()->unique()->after('id');
            $table->string('direccion', 10)->default('entrada')->index()->after('folio');
            // Salidas
            $table->string('tipo_documento_salida', 20)->nullable()->after('numero_documento');
            $table->foreignId('respuesta_a_id')->nullable()->after('departamento_id')
                ->constrained('correspondencia')->nullOnDelete();
            $table->string('documento_ruta', 500)->nullable();
            $table->string('documento_nombre', 255)->nullable();
            $table->string('firmante_nombre', 200)->nullable();
            $table->string('medio_despacho', 30)->nullable();
            $table->date('fecha_despacho')->nullable();
            $table->string('referencia_despacho', 200)->nullable();
            $table->foreignId('despachada_por')->nullable()->constrained('users');
            $table->text('motivo_devolucion')->nullable();
            // Entradas
            $table->timestamp('respondida_at')->nullable();
        });

        // Estados nuevos del ciclo de salida
        DB::statement("ALTER TABLE correspondencia MODIFY estado ENUM(
            'pendiente','derivada_alcaldia','en_proceso','derivada_funcionario','completada','archivado',
            'reservada','por_despachar','despachada','devuelta','anulada'
        ) DEFAULT 'pendiente'");

        // Backfill: folio ING- para las entradas existentes, por año de
        // recepción y en orden de llegada.
        $entradas = DB::table('correspondencia')
            ->whereNull('folio')
            ->orderBy('fecha_recibo')
            ->orderBy('id')
            ->get(['id', 'fecha_recibo']);

        $porAnio = [];
        foreach ($entradas as $e) {
            $anio = $e->fecha_recibo ? substr($e->fecha_recibo, 0, 4) : date('Y');
            $porAnio[$anio] = ($porAnio[$anio] ?? 0) + 1;
            DB::table('correspondencia')->where('id', $e->id)->update([
                'folio' => sprintf('ING-%s-%05d', $anio, $porAnio[$anio]),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('correspondencia', function (Blueprint $table) {
            $table->dropConstrainedForeignId('respuesta_a_id');
            $table->dropConstrainedForeignId('despachada_por');
            $table->dropColumn([
                'folio', 'direccion', 'tipo_documento_salida', 'documento_ruta',
                'documento_nombre', 'firmante_nombre', 'medio_despacho',
                'fecha_despacho', 'referencia_despacho', 'motivo_devolucion',
                'respondida_at',
            ]);
        });

        DB::statement("ALTER TABLE correspondencia MODIFY estado ENUM(
            'pendiente','derivada_alcaldia','en_proceso','derivada_funcionario','completada','archivado'
        ) DEFAULT 'pendiente'");
    }
};
