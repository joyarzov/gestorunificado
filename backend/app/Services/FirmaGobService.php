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

    public function isSimulate(): bool
    {
        // La BD tiene prioridad sobre el .env
        $dbValue = \App\Models\Configuracion::get('firmagob_simulate');
        if ($dbValue !== null) {
            return filter_var($dbValue, FILTER_VALIDATE_BOOLEAN);
        }
        return (bool) config('firmagob.simulate');
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
        // Modo simulación: no llama al API, devuelve respuesta ficticia
        if ($this->isSimulate()) {
            Log::info('FirmaGob SIMULATE: firma simulada localmente', ['signer' => $signerRun]);
            return [
                'content'         => $pdfContent, // PDF sin modificar
                'session_token'   => 'SIM-' . strtoupper(substr(md5(uniqid()), 0, 12)),
                'metadata'        => ['simulated' => true, 'signer' => $signerRun],
                'checksum_signed' => hash('sha256', $pdfContent . $signerRun . time()),
            ];
        }

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
            Log::error('FirmaGob API error', [
                'status' => $response->status(),
                'body'   => $body,
                'raw'    => $response->body(),
            ]);
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

        // Ajustamos la caja para que calce con el aspecto real del sello (su ancho
        // depende del nombre/textos). Conservamos el ancho —alineado a los márgenes
        // del documento— y derivamos la altura; así FirmaGob no deforma la imagen al
        // estirarla a la caja. Anclamos al borde inferior o superior según la posición.
        [$llx, $lly, $urx, $ury] = [$coords[0], $coords[1], $coords[2], $coords[3]];
        $im = @imagecreatefromstring(base64_decode($stampBase64));
        if ($im) {
            $aspect = imagesx($im) / max(1, imagesy($im));
            imagedestroy($im);
            $newH = ($urx - $llx) / max(0.1, $aspect);
            if ($lly < 396) {              // posición inferior → anclar abajo
                $ury = (int) round($lly + $newH);
            } else {                        // posición superior → anclar arriba
                $lly = (int) round($ury - $newH);
            }
        }

        return '<AgileSignerConfig>'
            . '<Application id="THIS-CONFIG">'
            . '<pdfPassword/>'
            . '<Signature>'
            . '<Visible active="true" layer2="false" label="true" pos="1">'
            . '<llx>' . $llx . '</llx>'
            . '<lly>' . $lly . '</lly>'
            . '<urx>' . $urx . '</urx>'
            . '<ury>' . $ury . '</ury>'
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
    public function generarStampPreview(array $config, ?string $signerName, ?string $signerCargo, ?string $signerRun): string
    {
        return $this->generateStampImage($signerName, $signerCargo, $signerRun, $config);
    }

    private function generateStampImage(?string $signerName, ?string $signerCargo, ?string $signerRun, array $config = []): string
    {
        // Sin config explícita: el sello asignado al ROL del firmante (por su
        // RUT), o el sello general activo.
        if (empty($config)) {
            $sello = \App\Models\FirmaSello::obtenerParaRut($signerRun);
            if ($sello) {
                $config = $sello->toArray();
            }
        }

        $colorPrimario      = $config['color_primario']      ?? '#0071BC';
        $colorSecundario    = $config['color_secundario']    ?? '#00467E';
        $colorFondo         = $config['color_fondo']         ?? '#EBF5FF';
        $mostrarLogo        = (bool)($config['mostrar_logo'] ?? true);  // por defecto: mostrar el logo municipal
        $logoPathCfg        = $config['logo_path']            ?? null;
        $textoLinea1        = trim((string)($config['texto_linea1']       ?? 'FIRMA ELECTRÓNICA AVANZADA'));
        $textoLinea2        = trim((string)($config['texto_linea2']       ?? 'GOBIERNO DE CHILE'));
        $textoLinea3        = trim((string)($config['texto_linea3']       ?? ''));
        $nombreInstitucion  = trim((string)($config['nombre_institucion'] ?? ''));

        // --- Sello v2: contenido y diseño configurables ---
        $mostrarCargo  = (bool)($config['mostrar_cargo'] ?? true);
        $mostrarRut    = (bool)($config['mostrar_rut'] ?? true);
        $mostrarFecha  = (bool)($config['mostrar_fecha'] ?? true);
        $formatoFecha  = (string)($config['formato_fecha'] ?? 'fecha_hora'); // fecha_hora | fecha | larga
        $layout        = (string)($config['layout'] ?? 'horizontal');        // horizontal | vertical | solo_texto | compacto
        $bordeEstilo   = (string)($config['borde_estilo'] ?? 'solido');      // solido | doble | sin_borde
        $bordeRedondo  = (bool)($config['borde_redondeado'] ?? false);
        $tamanoFuente  = (string)($config['tamano_fuente'] ?? 'M');          // S | M | L
        $F = match ($tamanoFuente) { 'S' => 0.85, 'L' => 1.15, default => 1.0 };

        if ($layout === 'solo_texto') {
            $mostrarLogo = false;
        }

        // Resolver el archivo de logo: el configurado en el sello, o el logo municipal
        // por defecto (el mismo que usan el membrete y las providencias: logo.png).
        $logoFile = null;
        if ($mostrarLogo) {
            if ($logoPathCfg && file_exists(storage_path('app/public/' . $logoPathCfg))) {
                $logoFile = storage_path('app/public/' . $logoPathCfg);
            } elseif (file_exists(storage_path('app/public/logo.png'))) {
                $logoFile = storage_path('app/public/logo.png');
            }
        }
        $hasLogo = $logoFile !== null;
        // Con logo, el nombre de la institución es redundante (ya va en el logo).
        if ($hasLogo) {
            $nombreInstitucion = '';
        }

        [$rP, $gP, $bP] = $this->hexToRgb($colorPrimario);
        [$rS, $gS, $bS] = $this->hexToRgb($colorSecundario);
        [$rF, $gF, $bF] = $this->hexToRgb($colorFondo);

        [$fontPathNormal, $fontPath] = $this->resolverFuente((string)($config['fuente'] ?? 'dejavu'));
        $hasTtf = function_exists('imagettftext') && file_exists($fontPath) && file_exists($fontPathNormal);

        // Factor de supersampling: rasterizamos a ~3x el tamaño lógico para que el
        // sello quede NÍTIDO al hacer zoom en el PDF. La caja física la define
        // FirmaGob por coordenadas (positions()); más píxeles = más resolución,
        // NO más tamaño en la hoja.
        $S = 3;

        // Fecha según formato configurado
        $ahora = now()->timezone('America/Santiago');
        $fecha = match ($formatoFecha) {
            'fecha' => $ahora->format('d/m/Y'),
            'larga' => 'Puerto Williams, ' . $ahora->day . ' de '
                . ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                   'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][$ahora->month]
                . ' de ' . $ahora->year,
            default => $ahora->format('d/m/Y H:i'),
        };

        // Escalador de tamaño de letra (S/M/L) preservando proporciones
        $fz = fn (int $pt) => max(8, (int) round($pt * $F));

        // Líneas a dibujar (tamaño de fuente en pt LÓGICOS; se escalan por $S).
        // 'c' = color (p=primario, s=secundario, g=gris); 'adv' = avance vertical
        // (baseline-a-baseline) lógico antes de dibujar esta línea.
        $headerLines = array_values(array_filter([
            ['t' => $textoLinea1,       'pt' => $fz(15), 'f' => $fontPath,       'c' => 'p', 'adv' => $fz(20)],
            ['t' => $nombreInstitucion, 'pt' => $fz(12), 'f' => $fontPathNormal, 'c' => 's', 'adv' => $fz(18)],
            ['t' => $textoLinea2,       'pt' => $fz(12), 'f' => $fontPathNormal, 'c' => 's', 'adv' => $fz(18)],
            ['t' => $textoLinea3,       'pt' => $fz(12), 'f' => $fontPathNormal, 'c' => 's', 'adv' => $fz(18)],
        ], fn ($l) => $l['t'] !== ''));

        $signerLines = array_values(array_filter([
            ['t' => trim((string)($signerName  ?? '')),                          'pt' => $fz(20), 'f' => $fontPath,       'c' => 'g', 'adv' => $fz(30)],
            ['t' => $mostrarCargo ? trim((string)($signerCargo ?? '')) : '',     'pt' => $fz(15), 'f' => $fontPathNormal, 'c' => 'g', 'adv' => $fz(23)],
            ['t' => ($mostrarRut && $signerRun) ? 'RUT: ' . $signerRun : '',     'pt' => $fz(14), 'f' => $fontPathNormal, 'c' => 'g', 'adv' => $fz(21)],
            ['t' => $mostrarFecha ? $fecha : '',                                  'pt' => $fz(14), 'f' => $fontPathNormal, 'c' => 'g', 'adv' => $fz(21)],
        ], fn ($l) => $l['t'] !== ''));

        // Mide el ancho de un texto en PÍXELES FINALES (ya escalado por $S).
        $measureW = function (string $text, int $pt, string $font) use ($S, $hasTtf): int {
            if ($text === '') return 0;
            if ($hasTtf) {
                $b = imagettfbbox($pt * $S, 0, $font, $text);
                return (int) abs($b[2] - $b[0]);
            }
            return (int) (strlen($text) * $pt * $S * 0.6);
        };

        // ===== Layout VERTICAL: logo arriba centrado, textos centrados debajo =====
        if ($layout === 'vertical') {
            return $this->renderStampVertical(
                $headerLines, $signerLines, $measureW, $S, $hasTtf,
                $hasLogo ? $logoFile : null,
                [$rP, $gP, $bP], [$rS, $gS, $bS], [$rF, $gF, $bF],
                (int)($config['fondo_opacidad'] ?? 100),
                $bordeEstilo, $bordeRedondo
            );
        }

        // --- Layout horizontal/compacto (cursor en px lógicos) + ancho máximo (px finales) ---
        $compacto = ($layout === 'compacto');
        $padTop = $compacto ? 9 : 16; $padBottom = $compacto ? 9 : 16; $groupGap = $compacto ? 6 : 12;
        $cursor = $padTop;
        $maxTextW = 0;          // px finales
        $items = [];
        foreach ($headerLines as $l) {
            $cursor += $l['adv'];
            $maxTextW = max($maxTextW, $measureW($l['t'], $l['pt'], $l['f']));
            $items[] = ['l' => $l, 'y' => $cursor];
        }
        $cursor += $groupGap;
        foreach ($signerLines as $l) {
            $cursor += $l['adv'];
            $maxTextW = max($maxTextW, $measureW($l['t'], $l['pt'], $l['f']));
            $items[] = ['l' => $l, 'y' => $cursor];
        }
        $contentHLogical = $cursor + $padBottom;

        // --- Altura del sello ---
        $textPadL  = 16;
        $textPadR  = 22;
        $hLogical  = max($contentHLogical, $compacto ? 105 : 150);
        $h = (int) ($hLogical * $S);

        // En "solo_texto" no hay zona izquierda (ni logo ni emblema FEA)
        $sinZonaIzq = ($layout === 'solo_texto');

        // --- Zona izquierda: logo municipal (ajustado a la altura, con tope de ancho)
        //     o, si no hay logo, el emblema "FEA". El ancho de la zona es dinámico. ---
        $logoImg = null; $logoDrawWlog = 0.0; $logoDrawHlog = 0.0;
        if ($hasLogo) {
            $ext = strtolower(pathinfo($logoFile, PATHINFO_EXTENSION));
            $logoImg = match ($ext) {
                'png'         => @imagecreatefrompng($logoFile),
                'jpg', 'jpeg' => @imagecreatefromjpeg($logoFile),
                default       => null,
            };
            if ($logoImg) {
                $lw = imagesx($logoImg); $lh = imagesy($logoImg);
                $logoDrawHlog = $hLogical - 24;
                $logoDrawWlog = $logoDrawHlog * ($lw / max(1, $lh));
                if ($logoDrawWlog > 260) {           // tope de ancho para logos muy apaisados
                    $logoDrawWlog = 260;
                    $logoDrawHlog = $logoDrawWlog * ($lh / max(1, $lw));
                }
            } else {
                $hasLogo = false;
            }
        }
        $logoZoneW = $sinZonaIzq ? 0 : ($hasLogo ? (int) ceil($logoDrawWlog + 24) : 116);

        $textXFinal = (int) (($logoZoneW + $textPadL) * $S);
        $w = max($textXFinal + $maxTextW + (int) ($textPadR * $S), (int) (($sinZonaIzq ? 240 : 300) * $S));

        $img = imagecreatetruecolor($w, $h);
        imagesavealpha($img, true);

        // Opacidad del fondo (0 = transparente, 100 = sólido; default sólido).
        // Permite un sello con fondo translúcido para ver el documento detrás.
        $fondoOpacidad = max(0, min(100, (int)($config['fondo_opacidad'] ?? config('firmagob.fondo_opacidad', 100))));
        $bgAlpha = (int) round(127 * (1 - $fondoOpacidad / 100));
        imagealphablending($img, false);
        $cFondo = imagecolorallocatealpha($img, $rF, $gF, $bF, $bgAlpha);
        imagefilledrectangle($img, 0, 0, $w - 1, $h - 1, $cFondo);
        imagealphablending($img, true);

        $cPrimario = imagecolorallocate($img, $rP, $gP, $bP);
        $cSecund   = imagecolorallocate($img, $rS, $gS, $bS);
        $cGray     = imagecolorallocate($img, 70, 70, 70);
        $palette   = ['p' => $cPrimario, 's' => $cSecund, 'g' => $cGray];

        // Borde (estilo configurable)
        $this->drawStampBorder($img, $w, $h, $S, $cPrimario, $bordeEstilo, $bordeRedondo);

        // Divisor vertical entre logo y texto (solo si hay zona izquierda)
        $divX = (int) ($logoZoneW * $S);
        if (!$sinZonaIzq) {
            imagesetthickness($img, max(1, (int) round($S * 0.6)));
            imageline($img, $divX, 6 * $S, $divX, $h - 6 * $S, $cPrimario);
            imagesetthickness($img, 1);
        }

        // --- Dibujar zona izquierda: logo municipal o emblema FEA ---
        $logoMostrado = $sinZonaIzq; // sin zona: no dibujar nada
        if (!$sinZonaIzq && $hasLogo && $logoImg) {
            $dw = (int) ($logoDrawWlog * $S);
            $dh = (int) ($logoDrawHlog * $S);
            $dx = (int) (($divX - $dw) / 2);
            $dy = (int) (($h - $dh) / 2);
            imagealphablending($img, true);
            imagecopyresampled($img, $logoImg, $dx, $dy, 0, 0, $dw, $dh, imagesx($logoImg), imagesy($logoImg));
            imagedestroy($logoImg);
            $logoMostrado = true;
        }
        if (!$logoMostrado) {
            $cx = (int) ($divX / 2);
            $cy = (int) ($h / 2);
            $d1 = (int) (min($logoZoneW, $hLogical) * $S * 0.62);
            $d2 = (int) ($d1 * 0.82);
            imagesetthickness($img, max(1, (int) round($S * 0.8)));
            imageellipse($img, $cx, $cy, $d1, $d1, $cPrimario);
            imageellipse($img, $cx, $cy, $d2, $d2, $cPrimario);
            imagesetthickness($img, 1);
            if ($hasTtf) {
                $feaPt = 16 * $S;
                $bb = imagettfbbox($feaPt, 0, $fontPath, 'FEA');
                $fw = abs($bb[2] - $bb[0]);
                $fh = abs($bb[7] - $bb[1]);
                imagettftext($img, $feaPt, 0, (int) ($cx - $fw / 2), (int) ($cy + $fh / 2), $cPrimario, $fontPath, 'FEA');
            } else {
                imagestring($img, 5, (int) ($cx - 14), (int) ($cy - 8), 'FEA', $cPrimario);
            }
        }

        // --- Texto (derecha) ---
        if ($hasTtf) {
            foreach ($items as $it) {
                $l = $it['l'];
                imagettftext($img, $l['pt'] * $S, 0, $textXFinal, (int) ($it['y'] * $S), $palette[$l['c']], $l['f'], $l['t']);
            }
        } else {
            foreach ($items as $it) {
                $l = $it['l'];
                imagestring($img, 4, $textXFinal, (int) ($it['y'] * $S) - 12, $l['t'], $palette[$l['c']]);
            }
        }

        ob_start();
        imagepng($img);
        $pngData = ob_get_clean();
        imagedestroy($img);

        return base64_encode($pngData);
    }

    /** Dibuja el borde del sello según estilo: solido | doble | sin_borde, con esquinas redondeadas opcionales. */
    private function drawStampBorder(\GdImage $img, int $w, int $h, int $S, int $color, string $estilo, bool $redondeado): void
    {
        if ($estilo === 'sin_borde') {
            return;
        }

        $trazo = function (int $inset) use ($img, $w, $h, $S, $color, $redondeado): void {
            imagesetthickness($img, $S);
            $x1 = $inset + (int) ($S / 2);
            $y1 = $x1;
            $x2 = $w - 1 - $x1;
            $y2 = $h - 1 - $x1;
            if ($redondeado) {
                $r = 10 * $S;
                imageline($img, $x1 + $r, $y1, $x2 - $r, $y1, $color);
                imageline($img, $x1 + $r, $y2, $x2 - $r, $y2, $color);
                imageline($img, $x1, $y1 + $r, $x1, $y2 - $r, $color);
                imageline($img, $x2, $y1 + $r, $x2, $y2 - $r, $color);
                imagearc($img, $x1 + $r, $y1 + $r, 2 * $r, 2 * $r, 180, 270, $color);
                imagearc($img, $x2 - $r, $y1 + $r, 2 * $r, 2 * $r, 270, 360, $color);
                imagearc($img, $x2 - $r, $y2 - $r, 2 * $r, 2 * $r, 0, 90, $color);
                imagearc($img, $x1 + $r, $y2 - $r, 2 * $r, 2 * $r, 90, 180, $color);
            } else {
                imagerectangle($img, $x1, $y1, $x2, $y2, $color);
            }
            imagesetthickness($img, 1);
        };

        $trazo(0);
        if ($estilo === 'doble') {
            $trazo(4 * $S);
        }
    }

    /** Layout vertical: logo centrado arriba y todas las líneas centradas debajo. */
    private function renderStampVertical(
        array $headerLines,
        array $signerLines,
        \Closure $measureW,
        int $S,
        bool $hasTtf,
        ?string $logoFile,
        array $rgbP,
        array $rgbS,
        array $rgbF,
        int $fondoOpacidad,
        string $bordeEstilo,
        bool $bordeRedondo
    ): string {
        $padTop = 14; $padSide = 22; $padBottom = 14; $groupGap = 10;

        // Logo (alto fijo lógico, ancho por aspecto con tope)
        $logoImg = null; $logoWlog = 0.0; $logoHlog = 0.0;
        if ($logoFile) {
            $ext = strtolower(pathinfo($logoFile, PATHINFO_EXTENSION));
            $logoImg = match ($ext) {
                'png'         => @imagecreatefrompng($logoFile),
                'jpg', 'jpeg' => @imagecreatefromjpeg($logoFile),
                default       => null,
            };
            if ($logoImg) {
                $lw = imagesx($logoImg); $lh = imagesy($logoImg);
                $logoHlog = 58;
                $logoWlog = $logoHlog * ($lw / max(1, $lh));
                if ($logoWlog > 240) {
                    $logoWlog = 240;
                    $logoHlog = $logoWlog * ($lh / max(1, $lw));
                }
            }
        }

        // Layout vertical de líneas + ancho máximo
        $maxTextW = 0; $items = [];
        $cursor = $padTop + ($logoImg ? ($logoHlog + 12) : 0);
        foreach ($headerLines as $l) {
            $cursor += $l['adv'];
            $maxTextW = max($maxTextW, $measureW($l['t'], $l['pt'], $l['f']));
            $items[] = ['l' => $l, 'y' => $cursor];
        }
        $cursor += $groupGap;
        foreach ($signerLines as $l) {
            $cursor += $l['adv'];
            $maxTextW = max($maxTextW, $measureW($l['t'], $l['pt'], $l['f']));
            $items[] = ['l' => $l, 'y' => $cursor];
        }

        $h = (int) (($cursor + $padBottom) * $S);
        $w = (int) max($maxTextW + 2 * $padSide * $S, ($logoWlog + 2 * $padSide) * $S, 240 * $S);

        $img = imagecreatetruecolor($w, $h);
        imagesavealpha($img, true);
        $bgAlpha = (int) round(127 * (1 - max(0, min(100, $fondoOpacidad)) / 100));
        imagealphablending($img, false);
        $cFondo = imagecolorallocatealpha($img, $rgbF[0], $rgbF[1], $rgbF[2], $bgAlpha);
        imagefilledrectangle($img, 0, 0, $w - 1, $h - 1, $cFondo);
        imagealphablending($img, true);

        $cP = imagecolorallocate($img, $rgbP[0], $rgbP[1], $rgbP[2]);
        $cS = imagecolorallocate($img, $rgbS[0], $rgbS[1], $rgbS[2]);
        $cG = imagecolorallocate($img, 70, 70, 70);
        $palette = ['p' => $cP, 's' => $cS, 'g' => $cG];

        $this->drawStampBorder($img, $w, $h, $S, $cP, $bordeEstilo, $bordeRedondo);

        if ($logoImg) {
            $dw = (int) ($logoWlog * $S);
            $dh = (int) ($logoHlog * $S);
            imagecopyresampled($img, $logoImg, (int) (($w - $dw) / 2), (int) ($padTop * $S), 0, 0, $dw, $dh, imagesx($logoImg), imagesy($logoImg));
            imagedestroy($logoImg);
        }

        foreach ($items as $it) {
            $l = $it['l'];
            $lw = $measureW($l['t'], $l['pt'], $l['f']);
            $x = (int) (($w - $lw) / 2);
            if ($hasTtf) {
                imagettftext($img, $l['pt'] * $S, 0, $x, (int) ($it['y'] * $S), $palette[$l['c']], $l['f'], $l['t']);
            } else {
                imagestring($img, 4, $x, (int) ($it['y'] * $S) - 12, $l['t'], $palette[$l['c']]);
            }
        }

        ob_start();
        imagepng($img);
        $pngData = ob_get_clean();
        imagedestroy($img);

        return base64_encode($pngData);
    }

    /**
     * Tipografías disponibles para el sello: cada familia define el par
     * [normal, destacada]. Las Reddit Sans viven en resources/fonts (versionadas);
     * si falta algún archivo se cae a DejaVu (siempre presente en el contenedor).
     */
    public const FUENTES_SELLO = [
        'dejavu'             => ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'],
        'reddit_sans'        => ['RedditSans-Regular.ttf', 'RedditSans-Bold.ttf'],
        'reddit_sans_light'  => ['RedditSans-Light.ttf', 'RedditSans-SemiBold.ttf'],
        'reddit_sans_medium' => ['RedditSans-Medium.ttf', 'RedditSans-ExtraBold.ttf'],
    ];

    /** @return array{0: string, 1: string} rutas [normal, destacada] */
    private function resolverFuente(string $fuente): array
    {
        $dejavu = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        ];
        if ($fuente === 'dejavu' || !isset(self::FUENTES_SELLO[$fuente])) {
            return $dejavu;
        }

        [$normal, $bold] = self::FUENTES_SELLO[$fuente];
        $dir = resource_path('fonts/reddit-sans/');
        if (!file_exists($dir . $normal) || !file_exists($dir . $bold)) {
            return $dejavu;
        }
        return [$dir . $normal, $dir . $bold];
    }

    private function hexToRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');
        return [
            hexdec(substr($hex, 0, 2)),
            hexdec(substr($hex, 2, 2)),
            hexdec(substr($hex, 4, 2)),
        ];
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
