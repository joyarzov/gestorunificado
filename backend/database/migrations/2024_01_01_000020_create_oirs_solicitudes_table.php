<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oirs_solicitudes', function (Blueprint $table) {
            $table->id();
            $table->string('folio', 50)->unique();
            $table->enum('tipo_solicitud', ['consulta', 'reclamo', 'sugerencia', 'felicitacion', 'solicitud_informacion']);

            // Datos del solicitante (nullable para solicitudes anónimas)
            $table->string('nombre_solicitante', 200)->nullable();
            $table->string('rut_solicitante', 12)->nullable();
            $table->string('email_solicitante', 150)->nullable();
            $table->string('telefono_solicitante', 20)->nullable();
            $table->string('direccion_solicitante', 300)->nullable();
            $table->string('comuna_solicitante', 100)->default('Cabo de Hornos');
            $table->boolean('anonimo')->default(false);

            // Detalle de la solicitud
            $table->enum('categoria', [
                'obras_municipales', 'aseo_ornato', 'transito', 'educacion',
                'salud', 'seguridad', 'medio_ambiente', 'otro'
            ]);
            $table->string('unidad_municipal', 150)->nullable();
            $table->string('asunto', 200);
            $table->text('descripcion');
            $table->date('fecha_hecho')->nullable();
            $table->string('lugar_hecho', 300)->nullable();

            // Medio de respuesta
            $table->enum('medio_respuesta', ['email', 'telefono', 'carta_certificada', 'presencial'])->default('email');

            // Campos de gestión
            $table->enum('estado', ['recibido', 'asignada', 'pendiente', 'en_analisis', 'derivado', 'respondido', 'cerrado'])->default('recibido');
            $table->foreignId('unidad_responsable_id')->nullable()->constrained('departamentos');
            $table->foreignId('funcionario_asignado_id')->nullable()->constrained('users');
            $table->enum('prioridad', ['baja', 'media', 'alta'])->default('media');

            // Fechas
            $table->date('fecha_limite_respuesta')->nullable();
            $table->date('fecha_respuesta')->nullable();

            // Respuesta
            $table->text('respuesta')->nullable();

            // Metadatos
            $table->enum('canal_ingreso', ['web', 'presencial', 'telefonico'])->default('web');
            $table->string('ip_address', 45)->nullable();

            $table->timestamps();

            $table->index('folio');
            $table->index('estado');
            $table->index('tipo_solicitud');
            $table->index('categoria');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oirs_solicitudes');
    }
};
