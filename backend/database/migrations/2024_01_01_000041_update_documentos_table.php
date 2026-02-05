<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            // Identificador único NTDEE
            if (!Schema::hasColumn('documentos', 'identificador')) {
                $table->string('identificador', 50)->unique()->nullable()->after('id');
            }

            // Nivel de acceso (1=público, 2=restringido, 3=reservado, 4=secreto)
            if (!Schema::hasColumn('documentos', 'nivel_acceso')) {
                $table->integer('nivel_acceso')->default(1)->after('estado');
            }

            // Palabras clave para búsqueda
            if (!Schema::hasColumn('documentos', 'palabras_clave')) {
                $table->text('palabras_clave')->nullable()->after('nivel_acceso');
            }

            // Formato del archivo (PDF, PDF/A-2b, etc.)
            if (!Schema::hasColumn('documentos', 'formato')) {
                $table->string('formato', 50)->default('PDF')->after('archivo_pdf');
            }

            // Metadata PDF/A (conformance, iso, etc.)
            if (!Schema::hasColumn('documentos', 'metadata_pdfa')) {
                $table->json('metadata_pdfa')->nullable()->after('formato');
            }

            // Firmante asignado principal (legacy)
            if (!Schema::hasColumn('documentos', 'firmante_asignado_id')) {
                $table->foreignId('firmante_asignado_id')->nullable()->constrained('users')->after('usuario_creador_id');
            }

            // Cantidad de firmas requeridas
            if (!Schema::hasColumn('documentos', 'firmas_requeridas')) {
                $table->integer('firmas_requeridas')->nullable()->after('firmante_asignado_id');
            }

            // Si todas las firmas están completas
            if (!Schema::hasColumn('documentos', 'completado')) {
                $table->boolean('completado')->default(false)->after('firmas_requeridas');
            }

            // Fecha de creación del documento (no de registro)
            if (!Schema::hasColumn('documentos', 'fecha_creacion')) {
                $table->timestamp('fecha_creacion')->nullable()->after('completado');
            }

            // Mecanismo de incorporación (1=físico digitalizado, 2=digital nativo)
            if (!Schema::hasColumn('documentos', 'mecanismo_incorporacion')) {
                $table->integer('mecanismo_incorporacion')->default(2)->after('fecha_creacion');
            }

            // Renombrar usuario_creador_id a creado_por si existe
            if (Schema::hasColumn('documentos', 'usuario_creador_id') && !Schema::hasColumn('documentos', 'creado_por')) {
                $table->renameColumn('usuario_creador_id', 'creado_por');
            }

            // Actualizado por
            if (!Schema::hasColumn('documentos', 'actualizado_por')) {
                $table->foreignId('actualizado_por')->nullable()->constrained('users')->after('fecha_creacion');
            }

            // Índices
            $table->index('identificador');
            $table->index('nivel_acceso');
            $table->index('fecha_creacion');
        });
    }

    public function down(): void
    {
        Schema::table('documentos', function (Blueprint $table) {
            // Revertir nombres
            if (Schema::hasColumn('documentos', 'creado_por') && !Schema::hasColumn('documentos', 'usuario_creador_id')) {
                $table->renameColumn('creado_por', 'usuario_creador_id');
            }

            // Eliminar columnas agregadas
            $columnsToRemove = [
                'identificador', 'nivel_acceso', 'palabras_clave', 'formato',
                'metadata_pdfa', 'firmante_asignado_id', 'firmas_requeridas',
                'completado', 'fecha_creacion', 'mecanismo_incorporacion', 'actualizado_por'
            ];

            foreach ($columnsToRemove as $column) {
                if (Schema::hasColumn('documentos', $column)) {
                    $table->dropColumn($column);
                }
            }

            // Eliminar índices
            $table->dropIndex(['identificador']);
            $table->dropIndex(['nivel_acceso']);
            $table->dropIndex(['fecha_creacion']);
        });
    }
};
