<?php

namespace Database\Seeders;

use App\Models\DocumentoPlantilla;
use App\Models\TipoDocumental;
use Illuminate\Database\Seeder;

/**
 * Fase 2 — porte incremental de plantillas al motor por bloques.
 *
 * Crea una versión "bloques" del Decreto Alcaldicio (render_engine = 'bloques')
 * que produce el diseño institucional unificado (membrete, barra de colores,
 * secciones, firma y pie con QR anclado). Se crea INACTIVA para no alterar la
 * creación de documentos mientras se valida; es visible sólo en el mantenedor.
 */
class DocumentoPlantillaBloquesSeeder extends Seeder
{
    public function run(): void
    {
        $tipoDecreto = TipoDocumental::where('codigo', 'DEC')->first();

        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_DECRETO_BLOQUES'],
            [
                'nombre'              => 'Decreto Alcaldicio (bloques)',
                'descripcion'         => 'Versión por bloques del decreto, con diseño institucional unificado (Fase 2).',
                'tipo_documental_id'  => $tipoDecreto?->id,
                'contenido_html'      => '',
                'render_engine'       => 'bloques',
                'estructura_json'     => $this->estructuraDecreto(),
                'estilo_json'         => [],
                'variables_json'      => [
                    'numero'            => 'Número del decreto',
                    'fecha'             => 'Fecha de emisión (ej: 15 de enero de 2026)',
                    'referencia'        => 'Referencia o materia del decreto',
                    'vistos'            => 'VISTOS Y CONSIDERANDO (texto completo)',
                    'texto_decreto'     => 'Texto del decreto',
                    'articulos_html'    => 'Artículos dinámicos (generado)',
                    'firmas_html'       => 'Firmas (generado)',
                    'distribucion_html' => 'Distribución (generado)',
                ],
                'activo'              => false,
                'requiere_firma'      => true,
                'requiere_aprobacion' => true,
                'editable_admin'      => true,
                'origen'              => 'seeder',
                'creado_por'          => 1,
            ]
        );
    }

    private function estructuraDecreto(): array
    {
        return [
            ['tipo' => 'barra_colores'],
            ['tipo' => 'membrete'],
            ['tipo' => 'titulo', 'props' => ['texto' => 'DECRETO ALCALDICIO Nº {{numero}}', 'align' => 'center']],
            ['tipo' => 'ref_fecha', 'props' => ['items' => [
                ['label' => 'Ref:', 'var' => 'referencia'],
                ['label' => 'Puerto Williams,', 'var' => 'fecha'],
            ]]],
            ['tipo' => 'seccion', 'props' => ['titulo' => 'VISTOS Y CONSIDERANDO', 'var' => 'vistos', 'indent' => true]],
            ['tipo' => 'seccion', 'props' => ['var_html' => 'articulos_html']],
            ['tipo' => 'seccion', 'props' => ['titulo' => 'DECRETO', 'titulo_align' => 'center', 'var' => 'texto_decreto']],
            ['tipo' => 'parrafo', 'props' => ['texto' => 'De acuerdo a los VISTOS Y CONSIDERANDO, ANÓTESE, COMUNÍQUESE Y ARCHÍVESE.', 'align' => 'center', 'margin_top' => '24px']],
            ['tipo' => 'seccion', 'props' => ['var_html' => 'firmas_html', 'margin_top' => '60px']],
            ['tipo' => 'seccion', 'props' => ['titulo' => 'DISTRIBUCIÓN', 'var_html' => 'distribucion_html', 'small' => true, 'margin_top' => '30px']],
            ['tipo' => 'qr_pie'],
        ];
    }
}
