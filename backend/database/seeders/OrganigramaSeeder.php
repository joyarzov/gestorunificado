<?php

namespace Database\Seeders;

use App\Models\Departamento;
use Illuminate\Database\Seeder;

class OrganigramaSeeder extends Seeder
{
    /**
     * Organigrama oficial Municipalidad de Cabo de Hornos (según PDF 2016).
     *
     * Jerarquía:
     *   Alcaldía
     *   ├── COSOC, Concejo Municipal, Juzgado de Policía Local  (asesores externos)
     *   ├── Gabinete de Alcaldía
     *   ├── Asesoría Jurídica
     *   ├── Secretaría (de Alcaldía)
     *   └── Administración Municipal
     *       ├── Secretaría (de Admin Municipal)
     *       ├── SECPLA (Asesoría Urbana, PLADECO, Estudios y Proyectos, Secretaría)
     *       ├── Secretaría Municipal (Oficina de Partes)
     *       ├── Dirección de Control (Secretaría)
     *       ├── Dirección de Adm. y Finanzas — DAF
     *       ├── Dirección de Obras Municipales — DOM
     *       └── Departamento de Desarrollo Comunitario — DIDECO
     *
     * Idempotente: usa updateOrCreate por código. Desactiva códigos obsoletos
     * que fueron creados en versiones previas pero no están en el organigrama oficial.
     */
    public function run(): void
    {
        // ---------- NIVEL 1: ALCALDÍA ----------
        $alcaldia = Departamento::updateOrCreate(
            ['codigo' => 'ALC'],
            ['nombre' => 'Alcaldía', 'tipo' => 'alcaldia', 'parent_id' => null, 'orden' => 0, 'activo' => true]
        );

        // ---------- NIVEL 2: asesores externos del Alcalde (línea punteada) ----------
        $externos = [
            ['codigo' => 'COSOC', 'nombre' => 'COSOC', 'orden' => 1],
            ['codigo' => 'CM',    'nombre' => 'Concejo Municipal', 'orden' => 2],
            ['codigo' => 'JPL',   'nombre' => 'Juzgado de Policía Local', 'orden' => 3],
        ];
        foreach ($externos as $e) {
            Departamento::updateOrCreate(
                ['codigo' => $e['codigo']],
                ['nombre' => $e['nombre'], 'tipo' => 'asesor', 'parent_id' => $alcaldia->id, 'orden' => $e['orden'], 'activo' => true]
            );
        }

        // ---------- NIVEL 2: asesores directos del Alcalde ----------
        Departamento::updateOrCreate(
            ['codigo' => 'GAB'],
            ['nombre' => 'Gabinete de Alcaldía', 'tipo' => 'asesor', 'parent_id' => $alcaldia->id, 'orden' => 10, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'ASJUR'],
            ['nombre' => 'Asesoría Jurídica', 'tipo' => 'asesor', 'parent_id' => $alcaldia->id, 'orden' => 11, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'SECALC'],
            ['nombre' => 'Secretaría de Alcaldía', 'tipo' => 'seccion', 'parent_id' => $alcaldia->id, 'orden' => 12, 'activo' => true]
        );

        // ---------- NIVEL 2: Administración Municipal ----------
        $adminMunicipal = Departamento::updateOrCreate(
            ['codigo' => 'ADM'],
            ['nombre' => 'Administración Municipal', 'tipo' => 'administracion', 'parent_id' => $alcaldia->id, 'orden' => 20, 'activo' => true]
        );

        // Secretaría de Administración Municipal
        Departamento::updateOrCreate(
            ['codigo' => 'SECAM'],
            ['nombre' => 'Secretaría de Administración Municipal', 'tipo' => 'seccion', 'parent_id' => $adminMunicipal->id, 'orden' => 1, 'activo' => true]
        );

        // ---------- NIVEL 3: Direcciones y Secretarías bajo Admin Municipal ----------

        // SECPLA
        $secpla = Departamento::updateOrCreate(
            ['codigo' => 'SECPLA'],
            ['nombre' => 'Secretaría de Planificación Municipal', 'tipo' => 'direccion', 'parent_id' => $adminMunicipal->id, 'orden' => 10, 'activo' => true]
        );
        Departamento::updateOrCreate(['codigo' => 'SPASE'],  ['nombre' => 'Asesoría Urbana', 'tipo' => 'seccion', 'parent_id' => $secpla->id, 'orden' => 1, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'SPPLA'],  ['nombre' => 'PLADECO y Presupuesto', 'tipo' => 'seccion', 'parent_id' => $secpla->id, 'orden' => 2, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'SPEST'],  ['nombre' => 'Estudios y Proyectos', 'tipo' => 'seccion', 'parent_id' => $secpla->id, 'orden' => 3, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'SPSEC'],  ['nombre' => 'Secretaría SECPLA', 'tipo' => 'seccion', 'parent_id' => $secpla->id, 'orden' => 4, 'activo' => true]);

        // Secretaría Municipal
        $secmu = Departamento::updateOrCreate(
            ['codigo' => 'SECMU'],
            ['nombre' => 'Secretaría Municipal', 'tipo' => 'direccion', 'parent_id' => $adminMunicipal->id, 'orden' => 20, 'activo' => true]
        );
        $oficinaPartes = Departamento::updateOrCreate(
            ['codigo' => 'OFPART'],
            ['nombre' => 'Oficina de Partes y Secretaría', 'tipo' => 'departamento', 'parent_id' => $secmu->id, 'orden' => 1, 'activo' => true]
        );

        // Dirección de Control
        $control = Departamento::updateOrCreate(
            ['codigo' => 'CTRL'],
            ['nombre' => 'Dirección de Control', 'tipo' => 'direccion', 'parent_id' => $adminMunicipal->id, 'orden' => 30, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'SECCTRL'],
            ['nombre' => 'Secretaría de Control', 'tipo' => 'seccion', 'parent_id' => $control->id, 'orden' => 1, 'activo' => true]
        );

        // Dirección de Administración y Finanzas (DAF)
        $daf = Departamento::updateOrCreate(
            ['codigo' => 'FIN'],
            ['nombre' => 'Dirección de Administración y Finanzas', 'tipo' => 'direccion', 'parent_id' => $adminMunicipal->id, 'orden' => 40, 'activo' => true]
        );
        $seccionesDAF = [
            ['codigo' => 'TESO',   'nombre' => 'Sección de Tesorería Municipal',        'orden' => 1],
            ['codigo' => 'RENTAS', 'nombre' => 'Sección de Rentas y Patentes',          'orden' => 2],
            ['codigo' => 'CONT',   'nombre' => 'Sección de Contabilidad y Presupuesto', 'orden' => 3],
            ['codigo' => 'RRHH',   'nombre' => 'Sección de Personal',                    'orden' => 4],
            ['codigo' => 'ADQ',    'nombre' => 'Sección de Adquisiciones',               'orden' => 5],
            ['codigo' => 'INV',    'nombre' => 'Sección de Inventario',                  'orden' => 6],
            ['codigo' => 'SECDAF', 'nombre' => 'Secretaría DAF',                          'orden' => 7],
        ];
        foreach ($seccionesDAF as $s) {
            Departamento::updateOrCreate(
                ['codigo' => $s['codigo']],
                ['nombre' => $s['nombre'], 'tipo' => 'seccion', 'parent_id' => $daf->id, 'orden' => $s['orden'], 'activo' => true]
            );
        }

        // Dirección de Obras Municipales (DOM)
        $dom = Departamento::updateOrCreate(
            ['codigo' => 'DOM'],
            ['nombre' => 'Dirección de Obras Municipales', 'tipo' => 'direccion', 'parent_id' => $adminMunicipal->id, 'orden' => 50, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'TRANS'],
            ['nombre' => 'Departamento de Tránsito y Transporte Público', 'tipo' => 'departamento', 'parent_id' => $dom->id, 'orden' => 1, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'INSP'],
            ['nombre' => 'Inspectoría', 'tipo' => 'seccion', 'parent_id' => $dom->id, 'orden' => 2, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'SECDOM'],
            ['nombre' => 'Secretaría DOM', 'tipo' => 'seccion', 'parent_id' => $dom->id, 'orden' => 3, 'activo' => true]
        );

        // Departamento de Desarrollo Comunitario (DIDECO)
        $dideco = Departamento::updateOrCreate(
            ['codigo' => 'DIDECO'],
            ['nombre' => 'Departamento de Desarrollo Comunitario', 'tipo' => 'departamento', 'parent_id' => $adminMunicipal->id, 'orden' => 60, 'activo' => true]
        );
        Departamento::updateOrCreate(['codigo' => 'DIFUS'],  ['nombre' => 'Oficina de Difusión',              'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 1, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'TURISMO'],['nombre' => 'Oficina de Turismo',               'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 2, 'activo' => true]);
        $salud = Departamento::updateOrCreate(
            ['codigo' => 'SALUD'],
            ['nombre' => 'Oficina de Salud', 'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 3, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'SOCIAL'],
            ['nombre' => 'Sección Social', 'tipo' => 'seccion', 'parent_id' => $salud->id, 'orden' => 1, 'activo' => true]
        );
        Departamento::updateOrCreate(
            ['codigo' => 'DISCAP'],
            ['nombre' => 'Oficina de Discapacidad', 'tipo' => 'seccion', 'parent_id' => $salud->id, 'orden' => 2, 'activo' => true]
        );
        Departamento::updateOrCreate(['codigo' => 'VECINO'], ['nombre' => 'Oficina del Vecino',               'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 4, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'EDUC'],   ['nombre' => 'Oficina de Administración de Educación', 'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 5, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'CEMENT'], ['nombre' => 'Oficina de Cementerio',            'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 6, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'DRURAL'], ['nombre' => 'Oficina de Desarrollo Rural',      'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 7, 'activo' => true]);
        Departamento::updateOrCreate(['codigo' => 'SECDID'], ['nombre' => 'Secretaría DIDECO',                'tipo' => 'seccion', 'parent_id' => $dideco->id, 'orden' => 8, 'activo' => true]);

        // OIRS: bajo Oficina de Partes (no está explícito en el PDF pero es parte del sistema)
        Departamento::updateOrCreate(
            ['codigo' => 'OIRS'],
            ['nombre' => 'Oficina OIRS', 'tipo' => 'seccion', 'parent_id' => $oficinaPartes->id, 'orden' => 1, 'activo' => true]
        );

        // ---------- Desactivar códigos obsoletos (creados en seeder previo, no en el PDF oficial) ----------
        $obsoletos = ['ASEO', 'CULTURA', 'DEPO', 'FOMENTO', 'EDIF', 'JUR'];
        Departamento::whereIn('codigo', $obsoletos)->update(['activo' => false, 'parent_id' => null]);
    }
}
