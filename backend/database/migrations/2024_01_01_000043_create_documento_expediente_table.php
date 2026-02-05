<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_expediente', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('documentos')->onDelete('cascade');
            $table->foreignId('expediente_id')->constrained('expedientes')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['documento_id', 'expediente_id']);
            $table->index('documento_id');
            $table->index('expediente_id');
        });

        // Migrar datos existentes: copiar expediente_id a la tabla pivot
        DB::statement('
            INSERT INTO documento_expediente (documento_id, expediente_id, created_at, updated_at)
            SELECT id, expediente_id, NOW(), NOW()
            FROM documentos
            WHERE expediente_id IS NOT NULL
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_expediente');
    }
};
