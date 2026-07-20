<?php

namespace App\Console\Commands;

use App\Models\Documento;
use App\Models\Notificacion;
use App\Services\NotificacionService;
use Illuminate\Console\Command;

/**
 * Detecta documentos atrapados en "pendiente de firma" y avisa.
 *
 * El caso que motiva esto: un documento se envía a firma, el firmante se
 * ausenta (o su subrogancia vence a mitad de la cadena) y el documento se
 * queda esperando indefinidamente. Nadie lo nota, porque no aparece en
 * ninguna bandeja como problema — solo como "pendiente".
 *
 * Se distinguen dos situaciones, porque se resuelven distinto:
 *  - ESTANCADO: el firmante puede firmar, pero no lo ha hecho. Se le recuerda.
 *  - BLOQUEADO: el firmante en turno está inactivo o ausente sin subrogante
 *    vigente. Recordarle a él no sirve; hay que avisar al emisor para que
 *    reasigne.
 */
class AlertarDocumentosEstancados extends Command
{
    protected $signature = 'documentos:alertar-estancados
                            {--dias= : Días sin avance para avisar (default: config)}
                            {--dry-run : Solo mostrar lo que se detectó, sin notificar}';

    protected $description = 'Avisa sobre documentos detenidos en pendiente de firma (y los que están bloqueados por ausencia del firmante)';

    public function handle(): int
    {
        $diasAviso = (int) ($this->option('dias') ?: config('cero_papel.estancados.dias_aviso', 3));
        $diasEscalamiento = (int) config('cero_papel.estancados.dias_escalamiento', 7);
        $dryRun = (bool) $this->option('dry-run');

        $documentos = Documento::where('estado', Documento::ESTADO_PENDIENTE_FIRMA)
            ->with(['firmantesAsignados', 'firmas', 'creador'])
            ->get();

        $avisados = 0;
        $bloqueados = 0;

        foreach ($documentos as $documento) {
            $dias = $documento->diasEsperandoFirma() ?? 0;
            if ($dias < $diasAviso) {
                continue;
            }

            $enTurno = $documento->firmanteEnTurno();
            if (!$enTurno) {
                continue; // ya firmaron todos; el estado se corrige solo al refrescar
            }

            $estaBloqueado = $this->estaBloqueado($enTurno);
            $glosa = "\"{$documento->titulo}\" lleva {$dias} días esperando firma de {$enTurno->nombre}";

            if ($dryRun) {
                $this->line(($estaBloqueado ? '[BLOQUEADO] ' : '[ESTANCADO] ') . $glosa);
                $estaBloqueado ? $bloqueados++ : $avisados++;
                continue;
            }

            $url = '/documentos/' . $documento->id;
            $data = [
                'documento_id' => $documento->id,
                'dias_esperando' => $dias,
                'bloqueado' => $estaBloqueado,
                'url' => $url,
            ];

            // Al firmante solo se le recuerda si efectivamente puede actuar.
            if (!$estaBloqueado && !$this->yaNotificadoHoy($enTurno->id, $documento->id)) {
                NotificacionService::enviar(
                    $enTurno,
                    'cero_papel',
                    'documento_estancado',
                    'Documento esperando tu firma',
                    "El documento {$glosa}. Fírmalo o avisa a quien lo emitió.",
                    $data
                );
                $avisados++;
            }

            // Al emisor se le avisa si el documento está bloqueado (no hay quien
            // firme) o si ya pasó el umbral de escalamiento.
            $debeEscalar = $estaBloqueado || $dias >= $diasEscalamiento;
            if ($debeEscalar && $documento->creado_por && !$this->yaNotificadoHoy($documento->creado_por, $documento->id)) {
                $mensaje = $estaBloqueado
                    ? "El documento {$glosa}, pero {$enTurno->nombre} no está disponible y no tiene subrogante vigente. Reasigna el firmante para destrabarlo."
                    : "El documento {$glosa} y no avanza. Considera hacer seguimiento.";

                NotificacionService::enviar(
                    $documento->creado_por,
                    'cero_papel',
                    'documento_estancado',
                    $estaBloqueado ? 'Documento bloqueado sin firmante disponible' : 'Documento detenido en firma',
                    $mensaje,
                    $data
                );
                $estaBloqueado ? $bloqueados++ : null;
            }
        }

        $this->info("Documentos estancados avisados: {$avisados}. Bloqueados sin firmante: {$bloqueados}.");

        return self::SUCCESS;
    }

    /**
     * ¿El firmante en turno está imposibilitado de firmar? Ocurre si su cuenta
     * está inactiva, o si está ausente con subrogancia activa pero sin un
     * subrogante que pueda asumir.
     */
    private function estaBloqueado($enTurno): bool
    {
        if (!$enTurno->activo) {
            return true;
        }

        if ($enTurno->tieneSubroganciaActiva()) {
            $subrogante = $enTurno->subrogante;
            return !$subrogante || !$subrogante->activo;
        }

        return false;
    }

    private function yaNotificadoHoy(int $userId, int $documentoId): bool
    {
        return Notificacion::where('user_id', $userId)
            ->where('tipo', 'documento_estancado')
            ->whereDate('created_at', today())
            ->whereJsonContains('data->documento_id', $documentoId)
            ->exists();
    }
}
