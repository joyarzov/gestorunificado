<?php

namespace App\Console\Commands;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use App\Models\Documento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class RegenerarProvidencias extends Command
{
    protected $signature = 'providencias:regenerar';
    protected $description = 'Regenerar providencias PDF que están faltantes en disco';

    public function handle()
    {
        $correspondencias = Correspondencia::where('providencia_generada', true)
            ->whereNotNull('providencia_pdf')
            ->get();

        $regeneradas = 0;

        foreach ($correspondencias as $correspondencia) {
            if (Storage::disk('public')->exists($correspondencia->providencia_pdf)) {
                $this->info("Corresp {$correspondencia->id}: OK");
                continue;
            }

            $this->warn("Corresp {$correspondencia->id}: MISSING - regenerando...");

            // Buscar la derivación con folio (providencia del alcalde)
            $derivacion = Derivacion::where('correspondencia_id', $correspondencia->id)
                ->whereNotNull('folio')
                ->with(['departamentoOrigen', 'departamentoDestino', 'usuarioOrigen', 'usuarioDestino'])
                ->first();

            if (!$derivacion) {
                $this->error("  No se encontró derivación con folio para corresp {$correspondencia->id}");
                continue;
            }

            try {
                $correspondencia->load(['departamento']);

                $logoPath = storage_path('app/public/logo.png');
                $logoBase64 = '';
                if (file_exists($logoPath)) {
                    $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
                }

                $codigoVerificacion = $derivacion->codigo_verificacion ?? Documento::generarCodigoVerificacion();
                $appUrl = rtrim(config('app.url'), '/');
                $verificarUrl = "{$appUrl}/verificar/{$codigoVerificacion}";

                $qrSvg = '';
                try {
                    $qrSvg = (string) QrCode::format('svg')->size(80)->margin(0)->generate($verificarUrl);
                } catch (\Exception $e) {
                    // ignore
                }

                $meses = [
                    1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
                    5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
                    9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre',
                ];
                $fechaDerivacion = $derivacion->created_at;
                $fechaFormateada = $fechaDerivacion->format('d \d\e ') . ($meses[$fechaDerivacion->month] ?? '') . $fechaDerivacion->format(' \d\e Y');

                $pdfData = [
                    'folio' => $derivacion->folio,
                    'fecha' => $fechaFormateada,
                    'remitente' => $correspondencia->remitente,
                    'numero_documento' => $correspondencia->numero_documento,
                    'fecha_recepcion' => $correspondencia->fecha_recibo ? $correspondencia->fecha_recibo->format('d/m/Y') : 'No especificada',
                    'descripcion' => $correspondencia->descripcion,
                    'usuario_origen' => $derivacion->usuarioOrigen->nombre ?? 'Alcalde',
                    'departamento_origen' => $derivacion->departamentoOrigen->nombre ?? 'Alcaldía',
                    'departamento_destino' => $derivacion->departamentoDestino->nombre ?? '',
                    'usuario_destino' => $derivacion->usuarioDestino->nombre ?? '',
                    'acciones_para' => $derivacion->acciones_para ?? [],
                    'observaciones' => $derivacion->observaciones,
                    'logo_base64' => $logoBase64,
                    'codigo_verificacion' => $codigoVerificacion,
                    'qr_svg' => $qrSvg,
                    'verificar_url' => $verificarUrl,
                ];

                $pdf = Pdf::loadView('pdf.providencia', $pdfData);
                $pdf->setPaper('letter');

                $filename = 'providencia_' . str_replace('-', '', $derivacion->folio) . '_' . time() . '.pdf';
                Storage::disk('public')->put('providencias/' . $filename, $pdf->output());

                // Actualizar referencia en la correspondencia y la derivación
                $correspondencia->update(['providencia_pdf' => 'providencias/' . $filename]);
                $derivacion->update(['pdf_ruta' => 'providencias/' . $filename]);

                $this->info("  Regenerada: {$filename}");
                $regeneradas++;
            } catch (\Exception $e) {
                $this->error("  Error regenerando corresp {$correspondencia->id}: {$e->getMessage()}");
                Log::error("Error regenerando providencia: " . $e->getMessage());
            }
        }

        $this->info("\nSe regeneraron {$regeneradas} providencias.");
    }
}
