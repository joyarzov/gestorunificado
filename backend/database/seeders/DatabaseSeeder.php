<?php

namespace Database\Seeders;

use App\Models\Correlativo;
use App\Models\Departamento;
use App\Models\TipoDocumental;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Departamentos
        $departamentos = [
            ['nombre' => 'Alcaldía', 'codigo' => 'ALC'],
            ['nombre' => 'Secretaría Municipal', 'codigo' => 'SECMU'],
            ['nombre' => 'Dirección de Obras', 'codigo' => 'DOM'],
            ['nombre' => 'Dirección de Finanzas', 'codigo' => 'FIN'],
            ['nombre' => 'Dirección de Desarrollo Comunitario', 'codigo' => 'DIDECO'],
            ['nombre' => 'Dirección de Tránsito', 'codigo' => 'TRANS'],
            ['nombre' => 'Dirección de Aseo y Ornato', 'codigo' => 'ASEO'],
            ['nombre' => 'Dirección Jurídica', 'codigo' => 'JUR'],
            ['nombre' => 'OIRS', 'codigo' => 'OIRS'],
        ];

        foreach ($departamentos as $depto) {
            Departamento::create($depto);
        }

        // Usuario administrador (password: 152015)
        User::create([
            'rut' => '17033946-0',
            'password' => Hash::make('152015'),
            'nombre' => 'Administrador Sistema',
            'email' => 'admin@municipalidad.cl',
            'roles' => ['admin', 'alcalde'],
            'departamento_id' => 1,
            'activo' => true,
            'visador' => true,
        ]);

        // Usuario oficial de partes (password: oficial123)
        User::create([
            'rut' => '12345678-9',
            'password' => Hash::make('oficial123'),
            'nombre' => 'Oficial de Partes',
            'email' => 'oficial@municipalidad.cl',
            'roles' => ['oficial'],
            'departamento_id' => 2,
            'activo' => true,
            'visador' => false,
        ]);

        // Usuario funcionario (password: funcionario123)
        User::create([
            'rut' => '11111111-1',
            'password' => Hash::make('funcionario123'),
            'nombre' => 'Usuario Demo',
            'email' => 'usuario@municipalidad.cl',
            'roles' => ['usuario'],
            'departamento_id' => 3,
            'activo' => true,
            'visador' => false,
        ]);

        // Tipos documentales
        $tipos = [
            [
                'codigo' => 'DEC',
                'nombre' => 'Decreto',
                'descripcion' => 'Decreto alcaldicio',
                'requiere_firma' => true,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'DEC',
            ],
            [
                'codigo' => 'RES',
                'nombre' => 'Resolución',
                'descripcion' => 'Resolución exenta',
                'requiere_firma' => true,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'RES',
            ],
            [
                'codigo' => 'OFI',
                'nombre' => 'Oficio',
                'descripcion' => 'Oficio ordinario',
                'requiere_firma' => true,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'OFI',
            ],
            [
                'codigo' => 'MEM',
                'nombre' => 'Memorándum',
                'descripcion' => 'Comunicación interna',
                'requiere_firma' => false,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'MEM',
            ],
            [
                'codigo' => 'CER',
                'nombre' => 'Certificado',
                'descripcion' => 'Certificado municipal',
                'requiere_firma' => true,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'CER',
            ],
            [
                'codigo' => 'CON',
                'nombre' => 'Contrato',
                'descripcion' => 'Contrato o convenio',
                'requiere_firma' => true,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'CON',
            ],
            [
                'codigo' => 'INF',
                'nombre' => 'Informe',
                'descripcion' => 'Informe técnico',
                'requiere_firma' => false,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'INF',
            ],
            [
                'codigo' => 'ACT',
                'nombre' => 'Acta',
                'descripcion' => 'Acta de reunión',
                'requiere_firma' => false,
                'genera_correlativo' => true,
                'prefijo_correlativo' => 'ACT',
            ],
        ];

        foreach ($tipos as $tipo) {
            TipoDocumental::create($tipo);
        }

        // Correlativos iniciales
        $correlativos = [
            ['tipo' => 'correspondencia', 'prefijo' => 'CORR', 'valor_actual' => 0, 'anio' => date('Y'), 'reinicio_anual' => true],
            ['tipo' => 'expediente', 'prefijo' => 'EXP', 'valor_actual' => 0, 'anio' => date('Y'), 'reinicio_anual' => true],
            ['tipo' => 'documento', 'prefijo' => 'DOC', 'valor_actual' => 0, 'anio' => date('Y'), 'reinicio_anual' => true],
            ['tipo' => 'oirs', 'prefijo' => 'OIRS', 'valor_actual' => 0, 'anio' => date('Y'), 'reinicio_anual' => true],
        ];

        foreach ($correlativos as $corr) {
            Correlativo::create($corr);
        }

        // Plantillas de documentos
        $this->call(DocumentoPlantillaSeeder::class);

        // Fondos concursables
        $this->call(FondoConcursableSeeder::class);
    }
}
