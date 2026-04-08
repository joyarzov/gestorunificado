<?php

namespace App\Services;

use App\Exceptions\FirmaGobException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\ConnectionException;

class FirmaGobService
{
    public function isEnabled(): bool
    {
        return (bool) config('firmagob.enabled');
    }

    /**
     * Firma un PDF con FirmaGob y devuelve el contenido firmado.
     *
     * @param string $pdfContent  Contenido binario del PDF
     * @param string $description Descripción del documento
     * @param string $signerRun   RUT del firmante (formato: "12345678-9")
     * @param string|null $otp    Código OTP de Google Authenticator (solo ATENDIDO)
     * @param string|null $signerName Nombre completo del firmante para el sello visual
     * @param string|null $signerCargo Cargo del firmante para el sello visual
     * @return array ['content' => string, 'session_token' => string, 'metadata' => array, 'checksum_signed' => string]
     * @throws FirmaGobException
     */
    /**
     * Posiciones disponibles para el sello de firma.
     * Coordenadas en puntos PDF para página Letter (612x792).
     * Formato: [llx, lly, urx, ury]
     */
    public static function positions(): array
    {
        // Aligned with document margins: left=2.5cm≈71pt, right=2cm≈57pt, 3 cols of 160pt
        return [
            'bottom-left'   => [71,  20,  231, 90],
            'bottom-center' => [233, 20,  393, 90],
            'bottom-right'  => [395, 20,  555, 90],
            'top-left'      => [71,  702, 231, 772],
            'top-center'    => [233, 702, 393, 772],
            'top-right'     => [395, 702, 555, 772],
        ];
    }

    public function sign(
        string $pdfContent,
        string $description,
        string $signerRun,
        ?string $otp = null,
        ?string $signerName = null,
        ?string $signerCargo = null,
        array $coords = [30, 20, 210, 90],
        string $page = 'LAST'
    ): array {
        // En modo sandbox usamos el run fijo; en producción el RUT real del firmante
        $run = config('firmagob.sandbox_mode')
            ? config('firmagob.sandbox_run', '11111111')
            : $this->formatRun($signerRun);

        $checksum = hash('sha256', $pdfContent);
        $base64   = base64_encode($pdfContent);
        $jwt      = $this->buildJwt($run);

        $fileEntry = [
            'description'  => $description,
            'checksum'     => $checksum,
            'content'      => $base64,
            'content-type' => 'application/pdf',
            'layout'       => $this->buildLayout($signerName, $signerCargo, $signerRun, $coords, $page),
        ];

        $payload = [
            'token'         => $jwt,
            'api_token_key' => config('firmagob.api_token_key'),
            'files'         => [$fileEntry],
        ];

        $headers = [];
        if ($otp) {
            $headers['OTP'] = $otp;
        }

        try {
            $response = Http::asJson()
                ->withHeaders($headers)
                ->timeout(config('firmagob.timeout', 30))
                ->post(config('firmagob.url'), $payload);
        } catch (ConnectionException $e) {
            throw new FirmaGobException(
                'No se pudo conectar al servicio de firma electrónica. Intente nuevamente.',
                [],
                true,
                0,
                $e
            );
        }

        $body = $response->json() ?? [];

        if (!$response->successful()) {
            $this->handleApiError($response->status(), $body);
        }

        $files = $body['files'] ?? [];
        if (empty($files) || ($files[0]['status'] ?? '') !== 'OK') {
            throw new FirmaGobException(
                'FirmaGob no pudo firmar el documento.',
                $body
            );
        }

        Log::info('FirmaGob: documento firmado correctamente', [
            'session_token' => $body['session_token'] ?? null,
            'metadata'      => $body['metadata'] ?? [],
        ]);

        return [
            'content'         => base64_decode($files[0]['content']),
            'session_token'   => $body['session_token'] ?? null,
            'metadata'        => $body['metadata'] ?? [],
            'checksum_signed' => $files[0]['checksum_signed'] ?? null,
        ];
    }

    /**
     * Genera el XML de layout para incrustar el sello visual en el PDF.
     * Coordenadas en puntos PDF (72 pts = 1 pulgada).
     * Posición: esquina inferior izquierda de la última página.
     */
    private function buildLayout(
        ?string $signerName,
        ?string $signerCargo,
        ?string $signerRun,
        array $coords = [30, 20, 210, 90],
        string $page = 'LAST'
    ): string {
        $stampBase64 = $this->generateStampImage($signerName, $signerCargo, $signerRun);

        return '<AgileSignerConfig>'
            . '<Application id="THIS-CONFIG">'
            . '<pdfPassword/>'
            . '<Signature>'
            . '<Visible active="true" layer2="false" label="true" pos="1">'
            . '<llx>' . $coords[0] . '</llx>'
            . '<lly>' . $coords[1] . '</lly>'
            . '<urx>' . $coords[2] . '</urx>'
            . '<ury>' . $coords[3] . '</ury>'
            . '<page>' . $page . '</page>'
            . '<image>BASE64</image>'
            . '<BASE64VALUE>' . $stampBase64 . '</BASE64VALUE>'
            . '</Visible>'
            . '</Signature>'
            . '</Application>'
            . '</AgileSignerConfig>';
    }

    /**
     * Genera un PNG visible con los datos del firmante.
     * En sandbox FirmaGob usa solo esta imagen.
     * En producción FirmaGob superpone el sello circular oficial encima.
     */
    private function generateStampImage(?string $signerName, ?string $signerCargo, ?string $signerRun): string
    {
        $w = 520;
        $h = 140;

        $img = imagecreatetruecolor($w, $h);

        // Colores
        $white   = imagecolorallocate($img, 255, 255, 255);
        $blue    = imagecolorallocate($img, 0, 113, 188);    // #0071BC
        $blueDark= imagecolorallocate($img, 0,  70, 130);
        $gray    = imagecolorallocate($img, 80,  80,  80);
        $lightBg = imagecolorallocate($img, 235, 245, 255);  // azul muy claro

        // Fondo
        imagefilledrectangle($img, 0, 0, $w - 1, $h - 1, $lightBg);

        // Borde exterior azul (2px)
        imagerectangle($img, 0, 0, $w - 1, $h - 1, $blue);
        imagerectangle($img, 1, 1, $w - 2, $h - 2, $blue);

        // Línea de separación izquierda (reserva espacio para el sello circular)
        imageline($img, 110, 4, 110, $h - 5, $blue);

        // Círculo simulado (sello) en el lado izquierdo
        imagearc($img, 56, 70, 90, 90, 0, 360, $blue);
        imagearc($img, 56, 70, 78, 78, 0, 360, $blue);
        // Texto "FEA" dentro del círculo
        imagestring($img, 4, 30, 60, 'FEA', $blue);

        // Textos en el lado derecho (con imagettftext si hay fuente, si no imagestring)
        $fontPath = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
        $fontPathNormal = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

        $x = 120;
        if (function_exists('imagettftext') && file_exists($fontPath)) {
            // Con FreeType: texto de calidad
            imagettftext($img, 8,  0, $x, 22,  $blueDark, $fontPath,   'FIRMA ELECTRÓNICA AVANZADA');
            imagettftext($img, 7,  0, $x, 38,  $blue,     $fontPath,   'GOBIERNO DE CHILE');
            imagettftext($img, 9,  0, $x, 62,  $gray,     $fontPath,   $signerName  ?? '');
            imagettftext($img, 7,  0, $x, 78,  $gray,     $fontPathNormal, $signerCargo ?? '');
            imagettftext($img, 7,  0, $x, 95,  $gray,     $fontPathNormal, 'RUT: ' . ($signerRun ?? ''));
            imagettftext($img, 7,  0, $x, 112, $gray,     $fontPathNormal, now()->timezone('America/Santiago')->format('d/m/Y H:i'));
        } else {
            // Sin FreeType: fuentes bitmap básicas
            imagestring($img, 3, $x, 8,  'FIRMA ELECTRONICA AVANZADA',  $blueDark);
            imagestring($img, 2, $x, 28, 'GOBIERNO DE CHILE',           $blue);
            imagestring($img, 4, $x, 52, $signerName  ?? '',            $gray);
            imagestring($img, 2, $x, 72, $signerCargo ?? '',            $gray);
            imagestring($img, 2, $x, 88, 'RUT: ' . ($signerRun ?? ''), $gray);
            imagestring($img, 2, $x, 104, now()->timezone('America/Santiago')->format('d/m/Y H:i'), $gray);
        }

        ob_start();
        imagepng($img);
        $pngData = ob_get_clean();
        imagedestroy($img);

        return base64_encode($pngData);
    }

    /**
     * Construye el JWT firmado con HMAC-SHA256 según especificación FirmaGob v.17.
     */
    private function buildJwt(string $run): string
    {
        $header  = $this->base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = $this->base64UrlEncode(json_encode([
            'entity'     => config('firmagob.entity'),
            'run'        => $run,
            'expiration' => now()->timezone('America/Santiago')->addMinutes(28)->format('Y-m-d\TH:i:s'),
            'purpose'    => config('firmagob.purpose'),
        ]));

        $signature = $this->base64UrlEncode(
            hash_hmac('sha256', "{$header}.{$payload}", config('firmagob.secret'), true)
        );

        return "{$header}.{$payload}.{$signature}";
    }

    /**
     * Formatea el RUT al formato que espera FirmaGob: solo dígitos del cuerpo, sin DV.
     * Ej: "12.345.678-9" → "12345678"
     *     "12345678-9"   → "12345678"
     */
    private function formatRun(string $rut): string
    {
        $clean = str_replace('.', '', $rut);
        $parts = explode('-', $clean);
        return $parts[0];
    }

    /**
     * Convierte datos binarios a base64url (sin padding).
     */
    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Lanza FirmaGobException con mensaje apropiado según el código HTTP de la respuesta.
     */
    private function handleApiError(int $status, array $body): void
    {
        $retryable = in_array($status, [502, 503, 504]);

        $message = match ($status) {
            400 => 'Error en la configuración de firma electrónica. Verifique los datos.',
            401 => 'Código OTP incorrecto o sin permisos para firmar.',
            404 => 'El firmante no tiene certificado FirmaGob registrado o está inactivo.',
            429 => 'Demasiados intentos de OTP incorrectos. Intente más tarde.',
            500 => 'Error interno en el servicio de firma electrónica.',
            502, 503, 504 => 'Servicio de firma electrónica no disponible. Intente nuevamente.',
            default => "Error en el servicio de firma electrónica (HTTP {$status}).",
        };

        throw new FirmaGobException($message, $body, $retryable);
    }
}
