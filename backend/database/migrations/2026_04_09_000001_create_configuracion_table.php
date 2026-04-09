<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuracion', function (Blueprint $table) {
            $table->string('clave')->primary();
            $table->text('valor')->nullable();
            $table->string('descripcion')->nullable();
            $table->timestamps();
        });

        // Valores por defecto
        DB::table('configuracion')->insert([
            [
                'clave'       => 'firmagob_simulate',
                'valor'       => 'false',
                'descripcion' => 'Modo simulación de firma electrónica FirmaGob. Cuando está activo, las firmas no son legales.',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('configuracion');
    }
};
