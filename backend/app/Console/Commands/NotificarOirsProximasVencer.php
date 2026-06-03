<?php

namespace App\Console\Commands;

use App\Models\Notificacion;
use App\Models\OirsSolicitud;
use App\Services\NotificacionService;
use Illuminate\Console\Command;

class NotificarOirsProximasVencer extends Command
{
    protected $signature = 'oirs:notificar-proximas-vencer';
    protected $description = 'Notificar a funcionarios sobre solicitudes OIRS próximas a vencer (3 días)';

    public function handle()
    {
        $solicitudes = OirsSolicitud::whereIn('estado', ['asignada', 'en_analisis'])
            ->whereNotNull('funcionario_asignado_id')
            ->where('fecha_limite_respuesta', '<=', now()->addDays(3))
            ->where('fecha_limite_respuesta', '>', now())
            ->get();

        $count = 0;
        foreach ($solicitudes as $oir) {
            // Evitar notificaciones duplicadas el mismo día
            $yaNotificado = Notificacion::where('user_id', $oir->funcionario_asignado_id)
                ->where('tipo', 'oirs_proxima_vencer')
                ->whereDate('created_at', today())
                ->whereJsonContains('data->oirs_id', $oir->id)
                ->exists();

            if (!$yaNotificado) {
                $diasRestantes = now()->diffInDays($oir->fecha_limite_respuesta);
                $textoUrgencia = $diasRestantes <= 1 ? 'MAÑANA' : "en {$diasRestantes} días";

                NotificacionService::enviar(
                    $oir->funcionario_asignado_id,
                    'oirs',
                    'oirs_proxima_vencer',
                    'OIRS próxima a vencer',
                    "La solicitud OIRS {$oir->folio} vence {$textoUrgencia}. Asunto: \"{$oir->asunto}\".",
                    ['oirs_id' => $oir->id, 'url' => '/oirs-admin/' . $oir->id]
                );
                $count++;
            }
        }

        $this->info("Se enviaron {$count} notificaciones de OIRS próximas a vencer.");
    }
}
