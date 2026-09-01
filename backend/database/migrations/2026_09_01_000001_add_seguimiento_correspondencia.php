<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seguimiento personal de correspondencia ("estrella").
 *
 * Es POR USUARIO, no un flag global en `correspondencia`: el Alcalde arma su
 * propia lista corta de lo que no quiere perder de vista, y mañana el
 * administrador municipal o un director pueden armar la suya sin pisarse.
 * Nadie ve a quién más le interesa una correspondencia.
 *
 * Mismo patrón que `correspondencia_lecturas` (ver 2026_07_03_000001).
 *
 * Además indexa `ultima_actividad_at`, que hasta ahora solo se leía por fila
 * pero pasa a filtrarse en el detector de correspondencia estancada
 * (en gestión y sin movimiento hace N días).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('correspondencia_seguimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('correspondencia_id')->constrained('correspondencia')->cascadeOnDelete();
            // Por qué la marcó: se olvida a las dos semanas ("es del concejal X",
            // "prometí respuesta para el viernes"). Privada de quien la escribió.
            $table->string('nota', 300)->nullable();
            $table->timestamps();
            // Nombres de índice EXPLÍCITOS y cortos: el que genera Laravel por
            // convención ("correspondencia_seguimientos_usuario_id_correspondencia_id_unique")
            // tiene 65 caracteres y MySQL corta en 64 → error 1059 al migrar.
            $table->unique(['usuario_id', 'correspondencia_id'], 'corresp_seg_usuario_corresp_unique');
            // Listar "lo que sigo", ordenado por lo más reciente marcado.
            $table->index(['usuario_id', 'created_at'], 'corresp_seg_usuario_created_index');
        });

        Schema::table('correspondencia', function (Blueprint $table) {
            $table->index('ultima_actividad_at');
        });

        // ------------------------------------------------------------------
        // Siembra de la bitácora con lo que YA ocurrió.
        //
        // `correspondencia_eventos` existía desde junio pero solo guardaba
        // cierres y reaperturas. Ahora recibe todo movimiento y alimenta el
        // feed de "últimos movimientos"; sin esta siembra el panel arrancaría
        // vacío y solo se poblaría con lo que pase de aquí en adelante.
        //
        // Los tres INSERT reconstruyen los hitos desde su fuente real,
        // conservando la fecha original para que el feed ordene bien. Los
        // textos se arman igual que los que escribe registrarActividad: en
        // tercera persona y sin el nombre del actor (el feed lo antepone).
        // ------------------------------------------------------------------

        // Derivaciones: el destinatario puede ser una persona o un departamento.
        //
        // Se agrupan por lote igual que el hilo del detalle (mismo origen dentro
        // del mismo minuto): derivar a cinco funcionarios de una vez es UN
        // movimiento, no cinco. Si no, el feed histórico se vería como una
        // ráfaga de líneas repetidas donde en realidad hubo una sola acción.
        // LEFT(...,300) porque la columna es varchar(300) y MySQL en modo
        // estricto aborta el INSERT en vez de truncar.
        DB::statement("
            INSERT INTO correspondencia_eventos
                (correspondencia_id, usuario_id, tipo, texto, created_at, updated_at)
            SELECT d.correspondencia_id,
                   d.usuario_origen_id,
                   'derivacion',
                   LEFT(CONCAT('derivó a ', GROUP_CONCAT(
                       COALESCE(u.nombre, dep.nombre, 'su destinatario')
                       ORDER BY d.id SEPARATOR ', '
                   )), 300),
                   MIN(d.created_at),
                   MIN(d.created_at)
            FROM derivaciones d
            LEFT JOIN users u ON u.id = d.usuario_destino_id
            LEFT JOIN departamentos dep ON dep.id = d.departamento_destino_id
            GROUP BY d.correspondencia_id,
                     d.usuario_origen_id,
                     DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i')
        ");

        // Acuses de recibo: quedan fechados con fecha_recepcion, no con created_at.
        DB::statement("
            INSERT INTO correspondencia_eventos
                (correspondencia_id, usuario_id, tipo, texto, created_at, updated_at)
            SELECT d.correspondencia_id,
                   d.usuario_destino_id,
                   'acuse',
                   'acusó recibo',
                   d.fecha_recepcion,
                   d.fecha_recepcion
            FROM derivaciones d
            WHERE d.fecha_recepcion IS NOT NULL
        ");

        // Mensajes del hilo.
        DB::statement("
            INSERT INTO correspondencia_eventos
                (correspondencia_id, usuario_id, tipo, texto, created_at, updated_at)
            SELECT m.correspondencia_id,
                   m.usuario_id,
                   'mensaje',
                   'escribió en el hilo',
                   m.created_at,
                   m.created_at
            FROM correspondencia_mensajes m
        ");
    }

    public function down(): void
    {
        // Solo los tipos que esta migración introdujo: los hitos de cierre y
        // reapertura son anteriores y deben sobrevivir al rollback.
        DB::table('correspondencia_eventos')
            ->whereIn('tipo', ['derivacion', 'acuse', 'mensaje'])
            ->delete();

        Schema::table('correspondencia', function (Blueprint $table) {
            $table->dropIndex(['ultima_actividad_at']);
        });
        Schema::dropIfExists('correspondencia_seguimientos');
    }
};
