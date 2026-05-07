<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class PdfSignatureDetector
{
    /**
     * Detecta firmas digitales embebidas en un PDF usando pdfsig (poppler-utils).
     *
     * @param string $absolutePath ruta absoluta al archivo PDF
     * @return array{has_signatures: bool, signatures: array<int, array{signer: string, date: ?string, valid: bool, raw: string}>, error: ?string}
     */
    public function detect(string $absolutePath): array
    {
        $result = [
            'has_signatures' => false,
            'signatures' => [],
            'error' => null,
        ];

        if (!is_readable($absolutePath)) {
            $result['error'] = 'Archivo no legible';
            return $result;
        }

        try {
            $process = new Process(['pdfsig', $absolutePath]);
            $process->setTimeout(30);
            $process->run();

            $output = trim($process->getOutput() . "\n" . $process->getErrorOutput());

            // pdfsig retorna exit code != 0 cuando no hay firmas; aún así parseamos la salida.
            if (stripos($output, 'File has no signatures') !== false || stripos($output, 'no signatures') !== false) {
                return $result;
            }

            $signatures = $this->parseOutput($output);
            $result['has_signatures'] = !empty($signatures);
            $result['signatures'] = $signatures;
        } catch (\Throwable $e) {
            Log::warning('PdfSignatureDetector: no se pudo ejecutar pdfsig', [
                'error' => $e->getMessage(),
            ]);
            $result['error'] = $e->getMessage();
        }

        return $result;
    }

    /**
     * Parsea la salida de pdfsig. Cada firma aparece como bloque "Signature #N:" con líneas
     * tipo "  - Signer Certificate Common Name: Juan Pérez"
     */
    private function parseOutput(string $output): array
    {
        $signatures = [];
        $blocks = preg_split('/Signature\s*#\d+:/i', $output);
        if (!$blocks || count($blocks) < 2) {
            return [];
        }

        // El primer bloque es lo que está antes de "Signature #1:"
        array_shift($blocks);

        foreach ($blocks as $block) {
            $signer = $this->extract($block, '/(?:Signer\s+(?:Certificate\s+)?Common\s+Name|Signer):\s*(.+)/i')
                ?? $this->extract($block, '/Subject\s+Common\s+Name:\s*(.+)/i')
                ?? 'Firmante desconocido';

            $date = $this->extract($block, '/Signing\s+Time:\s*(.+)/i');
            $validity = $this->extract($block, '/Signature\s+Validation:\s*(.+)/i') ?? '';
            $valid = stripos($validity, 'valid') !== false && stripos($validity, 'invalid') === false;

            $signatures[] = [
                'signer' => trim($signer),
                'date' => $date ? trim($date) : null,
                'valid' => $valid,
                'raw' => trim($block),
            ];
        }

        return $signatures;
    }

    private function extract(string $haystack, string $pattern): ?string
    {
        if (preg_match($pattern, $haystack, $matches)) {
            return $matches[1];
        }
        return null;
    }
}
