<?php

namespace Database\Seeders;

use App\Models\DocumentoPlantilla;
use Illuminate\Database\Seeder;

/**
 * Fase 2 — porte incremental de plantillas al motor por bloques.
 *
 * Cutover del Decreto Alcaldicio (PLT_DECRETO_001) al motor por bloques, con el
 * diseño institucional unificado (membrete, barra de colores, secciones, firma y
 * pie con QR anclado). Idempotente: sólo define estructura_json/estilo_json y
 * cambia render_engine; no toca el contenido_html legacy (queda como respaldo
 * para revertir con render_engine = 'html_legacy').
 */
class DocumentoPlantillaBloquesSeeder extends Seeder
{
    public function run(): void
    {
        $decreto = DocumentoPlantilla::where('codigo', 'PLT_DECRETO_001')->first();
        if ($decreto) {
            $decreto->update([
                'render_engine'   => 'bloques',
                'estructura_json' => $this->estructuraDecreto(),
                'estilo_json'     => [],
                'version_seeder'  => 1,
            ]);
        }
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
