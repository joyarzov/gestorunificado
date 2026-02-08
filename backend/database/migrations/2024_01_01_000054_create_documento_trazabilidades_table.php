<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_trazabilidades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('documentos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('accion', 50);
            $table->text('descripcion');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['documento_id', 'created_at']);
        });

        // Backfill: reconstruir historial desde tablas existentes
        $this->backfill();
    }

    private function backfill(): void
    {
        // 1. Evento "creado" desde documentos
        DB::statement("
            INSERT INTO documento_trazabilidades (documento_id, usuario_id, accion, descripcion, created_at, updated_at)
            SELECT id, creado_por, 'creado', 'Documento creado', created_at, created_at
            FROM documentos
            WHERE deleted_at IS NULL
        ");

        // 2. Evento "enviado_a_firma" para documentos que pasaron de borrador
        DB::statement("
            INSERT INTO documento_trazabilidades (documento_id, usuario_id, accion, descripcion, created_at, updated_at)
            SELECT id, actualizado_por, 'enviado_a_firma', 'Documento enviado a firma', updated_at, updated_at
            FROM documentos
            WHERE estado IN ('pendiente_firma', 'firmado', 'rechazado')
              AND deleted_at IS NULL
        ");

        // 3. Eventos "firmado" y "firma_rechazada" desde documento_firmas
        if (Schema::hasTable('documento_firmas')) {
            DB::statement("
                INSERT INTO documento_trazabilidades (documento_id, usuario_id, accion, descripcion, metadata, created_at, updated_at)
                SELECT
                    df.documento_id,
                    df.usuario_id,
                    CASE WHEN df.estado = 'firmado' THEN 'firmado' ELSE 'firma_rechazada' END,
                    CASE WHEN df.estado = 'firmado' THEN 'Documento firmado' ELSE 'Firma rechazada' END,
                    CASE WHEN df.observacion IS NOT NULL THEN JSON_OBJECT('observacion', df.observacion) ELSE NULL END,
                    COALESCE(df.fecha_firma, df.created_at),
                    COALESCE(df.fecha_firma, df.created_at)
                FROM documento_firmas df
                INNER JOIN documentos d ON d.id = df.documento_id AND d.deleted_at IS NULL
                WHERE df.estado IN ('firmado', 'rechazado')
            ");
        }

        // 4. Eventos "enviado" y "recibido" desde documento_envios
        if (Schema::hasTable('documento_envios')) {
            DB::statement("
                INSERT INTO documento_trazabilidades (documento_id, usuario_id, accion, descripcion, metadata, created_at, updated_at)
                SELECT
                    de.documento_id,
                    de.remitente_id,
                    'enviado',
                    'Documento enviado',
                    JSON_OBJECT('destinatario_id', de.destinatario_id),
                    de.fecha_envio,
                    de.fecha_envio
                FROM documento_envios de
                INNER JOIN documentos d ON d.id = de.documento_id AND d.deleted_at IS NULL
            ");

            DB::statement("
                INSERT INTO documento_trazabilidades (documento_id, usuario_id, accion, descripcion, metadata, created_at, updated_at)
                SELECT
                    de.documento_id,
                    de.destinatario_id,
                    'recibido',
                    'Acuse de recibo registrado',
                    JSON_OBJECT('remitente_id', de.remitente_id),
                    de.fecha_recepcion,
                    de.fecha_recepcion
                FROM documento_envios de
                INNER JOIN documentos d ON d.id = de.documento_id AND d.deleted_at IS NULL
                WHERE de.fecha_recepcion IS NOT NULL
            ");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_trazabilidades');
    }
};
