<?php

namespace App\Console\Commands;

use App\Models\Documento;
use App\Models\Expediente;
use App\Models\ExpedienteActividad;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillExpedientesDocumentos extends Command
{
    protected $signature = 'documentos:backfill-expedientes {--dry-run : Solo listar los documentos huérfanos sin crear nada}';

    protected $description = 'Asocia un expediente contenedor a cada documento de Cero Papel que no tenga ninguno (regla: todo documento debe pertenecer a un expediente).';

    public function handle(): int
    {
        $huerfanos = Documento::whereDoesntHave('expedientes')->get();

        if ($huerfanos->isEmpty()) {
            $this->info('No hay documentos huérfanos: todos están asociados a al menos un expediente.');
            return self::SUCCESS;
        }

        $this->warn("Documentos sin expediente: {$huerfanos->count()}");

        if ($this->option('dry-run')) {
            $this->table(
                ['ID', 'Identificador', 'Título', 'Depto', 'Creado por'],
                $huerfanos->map(fn ($d) => [
                    $d->id,
                    $d->identificador,
                    mb_strimwidth((string) $d->titulo, 0, 50, '…'),
                    $d->departamento_id,
                    $d->creado_por,
                ])->all()
            );
            $this->info('Dry-run: no se creó ningún expediente.');
            return self::SUCCESS;
        }

        $creados = 0;
        foreach ($huerfanos as $documento) {
            DB::transaction(function () use ($documento, &$creados) {
                $expediente = Expediente::create([
                    'identificador' => Expediente::generarIdentificador(),
                    'titulo' => $documento->titulo ?: "Expediente del documento {$documento->identificador}",
                    'asunto' => "Expediente generado automáticamente para el documento {$documento->identificador}.",
                    'nivel_acceso' => $documento->nivel_acceso ?? 1,
                    'informacion_sensible' => false,
                    'departamento_id' => $documento->departamento_id,
                    'estado' => Expediente::ESTADO_EN_TRAMITE,
                    'fecha_creacion' => now(),
                    'creado_por' => $documento->creado_por,
                    'actualizado_por' => $documento->creado_por,
                ]);

                $documento->expedientes()->attach($expediente->id, ['orden' => 0]);

                ExpedienteActividad::create([
                    'expediente_id' => $expediente->id,
                    'usuario_id' => $documento->creado_por,
                    'tipo' => 'documento_asociado',
                    'descripcion' => "Documento asociado al regularizar (backfill): {$documento->titulo}",
                    'metadata' => ['documento_id' => $documento->id, 'origen' => 'backfill'],
                ]);

                $creados++;
            });
        }

        $this->info("Listo: se crearon {$creados} expediente(s) contenedor y se asociaron sus documentos.");
        return self::SUCCESS;
    }
}
