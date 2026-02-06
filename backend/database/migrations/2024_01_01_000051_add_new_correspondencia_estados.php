<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE correspondencia MODIFY COLUMN estado ENUM('pendiente', 'derivada_alcaldia', 'en_proceso', 'derivada_funcionario', 'completada', 'archivado') DEFAULT 'pendiente'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE correspondencia MODIFY COLUMN estado ENUM('pendiente', 'derivada_alcaldia', 'en_proceso', 'archivado') DEFAULT 'pendiente'");
    }
};
