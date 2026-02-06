<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_expediente', function (Blueprint $table) {
            $table->unsignedInteger('orden')->default(0)->after('expediente_id');
        });

        // Popular registros existentes con orden secuencial basado en created_at
        DB::statement('
            UPDATE documento_expediente de
            JOIN (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY expediente_id ORDER BY created_at ASC) as rn
                FROM documento_expediente
            ) ranked ON de.id = ranked.id
            SET de.orden = ranked.rn
        ');
    }

    public function down(): void
    {
        Schema::table('documento_expediente', function (Blueprint $table) {
            $table->dropColumn('orden');
        });
    }
};
