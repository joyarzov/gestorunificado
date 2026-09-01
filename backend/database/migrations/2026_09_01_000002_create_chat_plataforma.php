<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chat interno de la plataforma: conversaciones uno a uno entre funcionarios.
 *
 * Es deliberadamente INFORMAL: sirve para coordinar, no para dejar constancia.
 * Lo que deba quedar registrado sigue yendo a la Conversación del expediente o
 * de la correspondencia, que es la que tiene trazabilidad.
 *
 * (Queda pendiente, para más adelante, poder incorporar parte de una
 * conversación como ANTECEDENTE a un expediente; será un acto exclusivo del
 * Alcalde y sobre conversaciones en las que él participe.)
 *
 * Sin grupos a propósito: con veinte funcionarios, el uno a uno cubre el caso
 * real y evita la moderación que exigiría un canal colectivo.
 *
 * ⚠️ Los índices van con nombre EXPLÍCITO y corto: el que Laravel genera por
 * convención para estas tablas supera los 64 caracteres de MySQL (error 1059).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_conversaciones', function (Blueprint $table) {
            $table->id();
            // El par se guarda ORDENADO (menor, mayor) para que la conversación
            // entre A y B sea siempre la misma fila, la abra quien la abra.
            $table->foreignId('usuario_menor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('usuario_mayor_id')->constrained('users')->cascadeOnDelete();
            // Para ordenar la lista sin tocar la tabla de mensajes.
            $table->timestamp('ultimo_mensaje_at')->nullable();
            $table->timestamps();

            $table->unique(['usuario_menor_id', 'usuario_mayor_id'], 'chat_conv_par_unique');
            $table->index('ultimo_mensaje_at', 'chat_conv_ultimo_index');
        });

        Schema::create('chat_mensajes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversacion_id')->constrained('chat_conversaciones')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->text('cuerpo');
            $table->timestamps();

            $table->index(['conversacion_id', 'created_at'], 'chat_msg_conv_fecha_index');
        });

        // Hasta cuándo leyó cada participante: mismo patrón last-read que
        // correspondencia_lecturas, ya probado para el indicador de novedades.
        Schema::create('chat_lecturas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('conversacion_id')->constrained('chat_conversaciones')->cascadeOnDelete();
            $table->timestamp('leido_at')->nullable();
            $table->timestamps();

            $table->unique(['usuario_id', 'conversacion_id'], 'chat_lect_usuario_conv_unique');
        });

    }

    public function down(): void
    {
        Schema::dropIfExists('chat_lecturas');
        Schema::dropIfExists('chat_mensajes');
        Schema::dropIfExists('chat_conversaciones');
    }
};
