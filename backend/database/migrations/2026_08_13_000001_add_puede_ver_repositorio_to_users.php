<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Permiso para los Repositorios (documental y de expedientes): consulta de SOLO
 * LECTURA de todo lo creado en el municipio, esté o no relacionado con quien mira.
 *
 * Hasta ahora esas dos pantallas estaban en el menú de todos y sus consultas no
 * filtraban nada, así que cualquier funcionario veía documentos y expedientes
 * ajenos. Pasa a ser un permiso explícito por usuario, igual que
 * `puede_ver_registro_correspondencia` en el módulo de correspondencia.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('puede_ver_repositorio')
                ->default(false)
                ->after('puede_ver_registro_correspondencia');
        });

        // Habilitación inicial acordada con la municipalidad: alcalde, jefaturas
        // (quien encabeza algún departamento en el organigrama) y Eva Galleguillos.
        // Los administradores no se marcan: ya acceden por su rol.
        DB::table('users')
            ->where('activo', true)
            ->where(function ($q) {
                $q->whereIn('id', function ($sub) {
                    $sub->select('jefe_id')->from('departamentos')->whereNotNull('jefe_id');
                })
                    ->orWhere('roles', 'like', '%alcalde%')
                    ->orWhere('rut', '9356379-4'); // Eva Galleguillos Valdés
            })
            ->update(['puede_ver_repositorio' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('puede_ver_repositorio');
        });
    }
};
