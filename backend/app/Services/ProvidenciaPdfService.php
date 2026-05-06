<?php

namespace App\Services;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use App\Models\Documento;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class ProvidenciaPdfService
{
    /**
     * Genera el binario PDF de una providencia (no persiste nada).
     *
     * Datos esperados en $params:
     *  - usuario_origen (string)
     *  - departamento_origen (string)
     *  - departamento_destino (string)
     *  - usuario_destino (?string)
     *  - acciones_para (?array)
     *  - observaciones (?string)
     *
     * @return array{pdf_content: string, folio: string, codigo_verificacion: string}
     */
    public function generar(Correspondencia $correspondencia, array $params): array
    {
        $folio = $this->generarFolioProvidencia();
        $codigoVerificacion = Documento::generarCodigoVerificacion();

        $logoPath = storage_path('app/public/logo.png');
        $logoBase64 = '';
        if (file_exists($logoPath)) {
            $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
        }

        $appUrl = rtrim(config('app.url'), '/');
        $verificarUrl = "{$appUrl}/verificar/{$codigoVerificacion}";
        $qrSvg = '';
        try {
            $qrSvg = (string) QrCode::format('svg')->size(80)->margin(0)->generate($verificarUrl);
        } catch (\Exception $e) {
            Log::warning('No se pudo generar QR para providencia: ' . $e->getMessage());
        }

        $pdfData = [
            'folio'                => $folio,
            'fecha'                => now()->format('d \d\e ') . $this->mesEnEspanol(now()->month) . now()->format(' \d\e Y'),
            'remitente'            => $correspondencia->remitente,
            'numero_documento'     => $correspondencia->numero_documento,
            'fecha_recepcion'      => $correspondencia->fecha_recibo
                ? $correspondencia->fecha_recibo->format('d/m/Y')
                : 'No especificada',
            'descripcion'          => $correspondencia->descripcion,
            'usuario_origen'       => $params['usuario_origen'] ?? '',
            'departamento_origen'  => $params['departamento_origen'] ?? 'Alcaldía',
            'departamento_destino' => $params['departamento_destino'] ?? 'Alcaldía',
            'usuario_destino'      => $params['usuario_destino'] ?? '',
            'acciones_para'        => $params['acciones_para'] ?? [],
            'observaciones'        => $params['observaciones'] ?? null,
            'logo_base64'          => $logoBase64,
            'codigo_verificacion'  => $codigoVerificacion,
            'qr_svg'               => $qrSvg,
            'verificar_url'        => $verificarUrl,
        ];

        $pdf = Pdf::loadView('pdf.providencia', $pdfData);
        $pdf->setPaper('letter');

        return [
            'pdf_content'         => $pdf->output(),
            'folio'               => $folio,
            'codigo_verificacion' => $codigoVerificacion,
        ];
    }

    private function generarFolioProvidencia(): string
    {
        $anio = now()->year;
        $ultima = Derivacion::where('folio', 'like', "PROV-{$anio}-%")
            ->orderByRaw('CAST(SUBSTRING_INDEX(folio, "-", -1) AS UNSIGNED) DESC')
            ->first();

        $siguiente = $ultima
            ? (int) substr($ultima->folio, strrpos($ultima->folio, '-') + 1) + 1
            : 1;

        return sprintf('PROV-%d-%05d', $anio, $siguiente);
    }

    private function mesEnEspanol(int $mes): string
    {
        $meses = [
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
            5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
            9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
        ];
        return $meses[$mes] ?? '';
    }
}
