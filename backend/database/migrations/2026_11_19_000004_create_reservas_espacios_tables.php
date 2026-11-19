<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo "Reserva de Espacios": agenda tipo calendario de los espacios
 * municipales (sala de concejo, etc.).
 *
 * - espacios: cada lugar reservable, con su color para el calendario.
 * - espacio_administradores: uno o más administradores por espacio; crean
 *   reservas directas y aprueban/rechazan solicitudes de ESE espacio.
 * - reservas: cada bloque de uso (periodo inicio–fin) con su estado.
 * - reserva_asistentes: funcionarios convocados (reciben aviso + .ics).
 *
 * Índices con nombre EXPLÍCITO y corto: el autogenerado puede pasar los 64
 * caracteres de MySQL (error 1059).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('espacios', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->text('descripcion')->nullable();
            $table->string('ubicacion')->nullable();
            $table->unsignedInteger('capacidad')->nullable();
            // Color para pintarlo en el calendario (hex). Azul corporativo por defecto.
            $table->string('color', 9)->default('#0071BC');
            $table->boolean('activo')->default(true);
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('espacio_administradores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('espacio_id')->constrained('espacios')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['espacio_id', 'user_id'], 'esp_admin_unique');
        });

        Schema::create('reservas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('espacio_id')->constrained('espacios')->cascadeOnDelete();
            $table->string('titulo'); // motivo del uso
            $table->text('descripcion')->nullable();
            $table->dateTime('inicio');
            $table->dateTime('fin');
            // solicitada: pediente de aprobación · aprobada · rechazada · cancelada
            $table->string('estado', 20)->default('solicitada');
            $table->foreignId('solicitante_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('aprobada_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('aprobada_at')->nullable();
            $table->string('motivo_rechazo', 500)->nullable();
            $table->timestamps();

            $table->index(['espacio_id', 'inicio'], 'reservas_espacio_inicio_idx');
            $table->index(['espacio_id', 'estado'], 'reservas_espacio_estado_idx');
        });

        Schema::create('reserva_asistentes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reserva_id')->constrained('reservas')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['reserva_id', 'user_id'], 'reserva_asist_unique');
        });

        // Espacio inicial para arrancar el módulo. El admin de plataforma le
        // asigna administradores desde la pantalla de gestión.
        DB::table('espacios')->insert([
            'nombre' => 'Sala de Concejo',
            'descripcion' => 'Sala del Concejo Municipal.',
            'ubicacion' => 'Edificio Municipal',
            'color' => '#6A1B9A',
            'activo' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('reserva_asistentes');
        Schema::dropIfExists('reservas');
        Schema::dropIfExists('espacio_administradores');
        Schema::dropIfExists('espacios');
    }
};
