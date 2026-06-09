<?php

namespace App\Services;

use App\Models\DocumentoPlantilla;
use Illuminate\Support\Facades\Log;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

/**
 * Motor de render por BLOQUES (Fase 2).
 *
 * Toma la estructura_json (lista de bloques tipados) y el estilo_json de una
 * plantilla y produce el HTML final para DomPDF a través de un único Blade
 * paramétrico (pdf.plantilla_base), unificando el diseño de la providencia
 * (membrete, barra de colores, secciones, firma y pie con QR anclados) para
 * cualquier documento del módulo cero papel.
 *
 * El motor 'html_legacy' sigue viviendo en DocumentoController/Documento; este
 * servicio sólo se invoca cuando la plantilla tiene render_engine = 'bloques'.
 */
class PlantillaRenderer
{
    /** Estilo por defecto (look base, equivalente al de la providencia). */
    public function estiloPorDefecto(): array
    {
        return [
            'papel'         => 'letter',
            'orientacion'   => 'portrait',
            'fuente_familia' => "'Times New Roman', Georgia, serif",
            'fuente_tamano' => '12pt',
            'color_texto'   => '#1a1a1a',
            'line_height'   => 1.5,
            'margenes'      => ['top' => '1cm', 'right' => '2cm', 'bottom' => '3.2cm', 'left' => '2.5cm'],
            'logo'          => ['mostrar' => true, 'max_ancho' => '110px'],
            'membrete'      => [
                'mostrar'    => true,
                'institucion' => 'Ilustre Municipalidad de Cabo de Hornos',
                'subtitulo'  => 'Puerto Williams · Provincia Antártica Chilena · Región de Magallanes',
                'color'      => '#0071BC',
            ],
            'barra_colores' => ['mostrar' => true, 'colores' => ['#2DC700', '#8AC53E', '#EB1B78', '#28A9E3', '#EE5825']],
            'regla_azul'    => true,
            'pie'           => ['bottom' => '1.2cm'],
        ];
    }

    /** Logo institucional como data URI (DomPDF no resuelve rutas relativas). */
    public function logoBase64(): ?string
    {
        $path = storage_path('app/public/logo.png');
        if (is_file($path)) {
            return 'data:image/png;base64,' . base64_encode(file_get_contents($path));
        }
        return null;
    }

    /** QR de verificación como data URI SVG. */
    public function qrDataUri(string $verificarUrl): ?string
    {
        try {
            $svg = QrCode::format('svg')->size(160)->margin(0)->generate($verificarUrl);
            return 'data:image/svg+xml;base64,' . base64_encode($svg);
        } catch (\Throwable $e) {
            Log::warning('PlantillaRenderer: no se pudo generar QR: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Datos que recibe el Blade base.
     *
     * @param array $meta ['codigo_verificacion' => ?, 'verificar_url' => ?]
     */
    public function viewData(DocumentoPlantilla $plantilla, array $datos, array $meta = []): array
    {
        $estilo = array_replace_recursive($this->estiloPorDefecto(), $plantilla->estilo_json ?? []);

        $codigo = $meta['codigo_verificacion'] ?? null;
        $verificarUrl = $meta['verificar_url'] ?? null;

        // Closures de resolución de datos para los parciales (evita lógica en Blade).
        $val = fn (string $k, string $def = '') => e($datos[$k] ?? $def);
        $raw = fn (string $k) => (string) ($datos[$k] ?? '');
        $interp = fn (?string $s) => preg_replace_callback(
            '/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/',
            fn ($m) => e($datos[$m[1]] ?? '[' . $m[1] . ']'),
            $s ?? ''
        );

        return [
            'estilo'              => $estilo,
            'bloques'             => $plantilla->estructura_json ?? [],
            'datos'               => $datos,
            'logo_base64'         => $this->logoBase64(),
            'codigo_verificacion' => $codigo,
            'verificar_url'       => $verificarUrl,
            'qr_data_uri'         => $codigo && $verificarUrl ? $this->qrDataUri($verificarUrl) : null,
            'val'                 => $val,
            'raw'                 => $raw,
            'interp'              => $interp,
        ];
    }

    /** HTML final listo para DomPDF. */
    public function html(DocumentoPlantilla $plantilla, array $datos, array $meta = []): string
    {
        return view('pdf.plantilla_base', $this->viewData($plantilla, $datos, $meta))->render();
    }
}
