<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Amplía los campos de la correspondencia que quedaban cortos al ingresar
 * (remitentes institucionales largos y números/referencias de documento extensos).
 * Se usa SQL directo para no depender de doctrine/dbal en los ->change().
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE correspondencia MODIFY remitente VARCHAR(255) NOT NULL");
        DB::statement("ALTER TABLE correspondencia MODIFY numero_documento VARCHAR(100) NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE correspondencia MODIFY remitente VARCHAR(200) NOT NULL");
        DB::statement("ALTER TABLE correspondencia MODIFY numero_documento VARCHAR(50) NULL");
    }
};
