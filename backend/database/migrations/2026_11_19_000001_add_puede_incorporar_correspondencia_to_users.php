<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Facultad para INCORPORAR funcionarios a una correspondencia en circulación:
 * sumar a alguien a la bandeja sin quitársela a quien la gestiona (ver
 * DerivacionController::agregarDestinatarios). Es exclusiva del módulo de
 * correspondencia.
 *
 * El permiso lo tienen, por regla, el alcalde, los administradores y las
 * jefaturas (quien encabeza algún departamento) — eso lo resuelve en vivo
 * User::puedeIncorporarCorrespondencia(), para que un director recién nombrado
 * quede cubierto sin tocar banderas. Esta columna cubre al resto: "algunas
 * personas" que el alcalde designe y que el admin habilita una por una.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('puede_incorporar_correspondencia')
                ->default(false)
                ->after('puede_ver_repositorio');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('puede_incorporar_correspondencia');
        });
    }
};
