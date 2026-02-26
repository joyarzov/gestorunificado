<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE derivaciones MODIFY COLUMN estado ENUM('pendiente', 'recibido', 'archivado', 'derivado') DEFAULT 'pendiente'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE derivaciones MODIFY COLUMN estado ENUM('pendiente', 'recibido', 'archivado') DEFAULT 'pendiente'");
    }
};
