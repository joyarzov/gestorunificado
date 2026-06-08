<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Fase 1 del mantenedor de plantillas: agrega metadatos editables desde el panel
 * de administración, sin tocar el motor de render (contenido_html / variables_json).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            if (!Schema::hasColumn('documento_plantillas', 'editable_admin')) {
                $table->boolean('editable_admin')->default(false)->after('requiere_aprobacion')
                    ->comment('Editable desde el mantenedor de plantillas (admin)');
            }
            if (!Schema::hasColumn('documento_plantillas', 'orden')) {
                $table->unsignedSmallInteger('orden')->nullable()->after('editable_admin')
                    ->comment('Orden de aparición en el selector de plantillas');
            }
            if (!Schema::hasColumn('documento_plantillas', 'origen')) {
                $table->enum('origen', ['seeder', 'admin'])->default('seeder')->after('orden')
                    ->comment('seeder = creada por el sistema; admin = creada desde el mantenedor');
            }
        });

        // Backfill: las plantillas existentes pasan a ser editables y reciben un orden por id.
        $orden = 1;
        foreach (DB::table('documento_plantillas')->orderBy('id')->pluck('id') as $id) {
            DB::table('documento_plantillas')->where('id', $id)->update([
                'editable_admin' => true,
                'orden' => $orden++,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('documento_plantillas', function (Blueprint $table) {
            $table->dropColumn(['editable_admin', 'orden', 'origen']);
        });
    }
};
