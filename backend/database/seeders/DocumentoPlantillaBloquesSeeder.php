<?php

namespace Database\Seeders;

use App\Models\DocumentoPlantilla;
use Illuminate\Database\Seeder;

/**
 * Fase 2 — porte de las plantillas activas al motor por bloques.
 *
 * Define la estructura_json de cada plantilla y cambia su render_engine a
 * 'bloques', aplicando el diseño institucional unificado (membrete, barra de
 * colores, secciones, firma y pie con QR). Idempotente: no toca el contenido_html
 * legacy, que queda como respaldo para revertir (render_engine = 'html_legacy').
 */
class DocumentoPlantillaBloquesSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->estructuras() as $codigo => $estructura) {
            DocumentoPlantilla::where('codigo', $codigo)->update([
                'render_engine'   => 'bloques',
                'estructura_json' => $estructura,
                'estilo_json'     => [],
                'version_seeder'  => 1,
            ]);
        }
    }

    /** @return array<string, array> mapa codigo => estructura de bloques */
    private function estructuras(): array
    {
        // Bloques de cierre comunes (firma + distribución + pie con QR).
        $cierre = [
            ['tipo' => 'seccion', 'props' => ['var_html' => 'firmas_html', 'margin_top' => '60px']],
            ['tipo' => 'seccion', 'props' => ['titulo' => 'DISTRIBUCIÓN', 'var_html' => 'distribucion_html', 'small' => true, 'margin_top' => '30px']],
            ['tipo' => 'qr_pie'],
        ];
        $encabezado = [
            ['tipo' => 'barra_colores'],
            ['tipo' => 'membrete'],
        ];

        return [
            'PLT_DECRETO_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'DECRETO ALCALDICIO Nº {{numero}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'Ref:', 'var' => 'referencia'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'VISTOS Y CONSIDERANDO', 'var' => 'vistos', 'indent' => true]],
                ['tipo' => 'seccion', 'props' => ['var_html' => 'articulos_html']],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'DECRETO', 'titulo_align' => 'center', 'var' => 'texto_decreto']],
                ['tipo' => 'parrafo', 'props' => ['texto' => 'De acuerdo a los VISTOS Y CONSIDERANDO, ANÓTESE, COMUNÍQUESE Y ARCHÍVESE.', 'align' => 'center', 'margin_top' => '24px']],
            ], $cierre),

            'PLT_MEMO_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'MEMORÁNDUM Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'Ref:', 'var' => 'referencia'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'de_para', 'props' => ['de_var' => 'de', 'para_var' => 'para']],
                ['tipo' => 'seccion', 'props' => ['var_html' => 'contenido', 'justify' => true]],
            ], $cierre),

            'PLT_OFICIO_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'OFICIO Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'ANT:', 'var' => 'antecedentes'],
                    ['label' => 'MAT:', 'var' => 'materia'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'destinatario', 'props' => ['nombre_var' => 'destinatario', 'cargo_var' => 'cargo_destinatario', 'institucion_var' => 'institucion', 'presente' => true]],
                ['tipo' => 'seccion', 'props' => ['var' => 'contenido', 'justify' => true]],
            ], $cierre),

            'PLT_ORDINARIO_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'ORDINARIO Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'ANT:', 'var' => 'antecedentes'],
                    ['label' => 'MAT:', 'var' => 'materia'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'de_para', 'props' => ['de_var' => 'de', 'para_var' => 'para']],
                ['tipo' => 'seccion', 'props' => ['var' => 'contenido', 'justify' => true]],
            ], $cierre),

            'PLT_CIRCULAR_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'CIRCULAR Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'MAT:', 'var' => 'materia'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'Dirigida a', 'var' => 'dirigida_a']],
                ['tipo' => 'seccion', 'props' => ['var' => 'contenido', 'justify' => true]],
            ], $cierre),

            'PLT_CARTA_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'CARTA Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'destinatario', 'props' => ['nombre_var' => 'destinatario', 'cargo_var' => 'cargo_destinatario', 'institucion_var' => 'institucion']],
                ['tipo' => 'parrafo', 'props' => ['var' => 'saludo', 'margin_top' => '12px']],
                ['tipo' => 'seccion', 'props' => ['var' => 'contenido', 'justify' => true]],
                ['tipo' => 'parrafo', 'props' => ['var' => 'despedida', 'margin_top' => '20px']],
            ], $cierre),

            'PLT_ACTA_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'ACTA Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'parrafo', 'props' => ['var' => 'tipo_reunion', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['align' => 'left', 'items' => [
                    ['label' => 'Fecha:', 'var' => 'fecha'],
                    ['label' => 'Hora:', 'var' => 'hora'],
                    ['label' => 'Lugar:', 'var' => 'lugar'],
                ]]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'Asistentes', 'var' => 'asistentes']],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'Temas tratados', 'var' => 'temas_tratados', 'justify' => true]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'Acuerdos', 'var' => 'acuerdos', 'justify' => true]],
            ], $cierre),

            'PLT_INFORME_001' => array_merge($encabezado, [
                ['tipo' => 'titulo', 'props' => ['texto' => 'INFORME TÉCNICO Nº {{numero}}/{{anio}}', 'align' => 'center']],
                ['tipo' => 'ref_fecha', 'props' => ['items' => [
                    ['label' => 'Asunto:', 'var' => 'asunto'],
                    ['label' => 'Puerto Williams,', 'var' => 'fecha'],
                ]]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'I. Antecedentes', 'var' => 'antecedentes', 'justify' => true]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'II. Desarrollo', 'var' => 'desarrollo', 'justify' => true]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'III. Conclusiones', 'var' => 'conclusiones', 'justify' => true]],
                ['tipo' => 'seccion', 'props' => ['titulo' => 'IV. Recomendaciones', 'var' => 'recomendaciones', 'justify' => true]],
            ], $cierre),
        ];
    }
}
