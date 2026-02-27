<?php

namespace Database\Seeders;

use App\Models\FondoConcursable;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FondoConcursableSeeder extends Seeder
{
    public function run(): void
    {
        // Crear departamento Fomento Productivo si no existe
        $depto = \App\Models\Departamento::firstOrCreate(
            ['codigo' => 'FOMENTO'],
            ['nombre' => 'Fomento Productivo']
        );

        // Usuario fomento productivo (password: fomento123)
        User::firstOrCreate(
            ['rut' => '22222222-2'],
            [
                'password' => Hash::make('152015'),
                'nombre' => 'Encargado Fomento Productivo',
                'email' => 'fomento@municipalidad.cl',
                'roles' => ['fomento_productivo'],
                'departamento_id' => $depto->id,
                'activo' => true,
                'visador' => false,
            ]
        );

        // Agregar rol fomento_productivo al admin existente
        $admin = User::where('rut', '17033946-0')->first();
        if ($admin) {
            $roles = $admin->roles ?? [];
            if (!in_array('fomento_productivo', $roles)) {
                $roles[] = 'fomento_productivo';
                $admin->roles = $roles;
                $admin->save();
            }
        }

        // Fondo concursable de prueba
        FondoConcursable::firstOrCreate(
            ['codigo' => 'TNC-2025'],
            [
                'nombre' => 'Tu Negocio Crece 2025',
                'descripcion' => 'Programa de apoyo a emprendedores y microempresarios de la comuna de Cabo de Hornos. Fondo concursable para financiar proyectos productivos que fomenten el desarrollo económico local.',
                'monto_total' => 40000000,
                'monto_maximo_por_proyecto' => 2000000,
                'estado' => 'abierto',
                'fecha_apertura' => '2025-03-01',
                'fecha_cierre' => '2025-06-30',
                'anio' => 2025,
            ]
        );
    }
}
