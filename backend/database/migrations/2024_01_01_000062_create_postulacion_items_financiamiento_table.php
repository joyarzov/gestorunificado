<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('postulacion_items_financiamiento', function (Blueprint $table) {
            $table->id();
            $table->foreignId('postulacion_id')->constrained('postulaciones')->onDelete('cascade');
            $table->enum('sub_item', [
                'activo_fijo',
                'activo_intangible',
                'materia_prima',
                'mercaderia',
                'promocion',
                'transporte',
            ]);
            $table->string('producto_servicio', 200);
            $table->text('justificacion')->nullable();
            $table->string('plazo_ejecucion', 100)->nullable();
            $table->string('numero_cotizacion', 50)->nullable();
            $table->string('proveedor', 200)->nullable();
            $table->integer('cantidad')->default(1);
            $table->decimal('valor_unitario', 12, 0)->default(0);
            $table->decimal('valor_total', 12, 0)->default(0);
            $table->decimal('monto_municipio', 12, 0)->default(0);
            $table->decimal('monto_cofinanciamiento', 12, 0)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('postulacion_items_financiamiento');
    }
};
