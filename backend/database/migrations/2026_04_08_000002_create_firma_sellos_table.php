<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('firma_sellos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('logo_path')->nullable();
            $table->string('color_primario', 7)->default('#0071BC');
            $table->string('color_secundario', 7)->default('#00467E');
            $table->string('color_fondo', 7)->default('#EBF5FF');
            $table->boolean('mostrar_logo')->default(true);
            $table->string('nombre_institucion')->default('Ilustre Municipalidad de Cabo de Hornos');
            $table->string('texto_linea1')->default('FIRMA ELECTRÓNICA AVANZADA');
            $table->string('texto_linea2')->default('GOBIERNO DE CHILE');
            $table->boolean('activo')->default(false);
            $table->string('preview_path')->nullable();
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('firma_sellos');
    }
};
