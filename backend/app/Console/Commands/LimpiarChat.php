<?php

namespace App\Console\Commands;

use App\Models\ChatConversacion;
use App\Models\ChatMensaje;
use Illuminate\Console\Command;

/**
 * Borra los mensajes de chat más antiguos que N días.
 *
 * El chat es un canal de coordinación, no un archivo: dejarlo crecer sin
 * límite lo convertiría en un expediente paralelo al que nadie le hace
 * trazabilidad. Lo que deba conservarse se lleva a la Conversación del
 * expediente o de la correspondencia.
 *
 * NO está programado en el scheduler a propósito: se ejecuta a mano cuando el
 * municipio defina su política de retención. Úsese primero con --simular.
 */
class LimpiarChat extends Command
{
    protected $signature = 'chat:limpiar
                            {--dias=90 : Antigüedad en días a partir de la cual se borra}
                            {--simular : Solo informa cuánto borraría, sin tocar nada}';

    protected $description = 'Elimina mensajes de chat anteriores a N días (retención del canal informal)';

    public function handle(): int
    {
        $dias = max(1, (int) $this->option('dias'));
        $corte = now()->subDays($dias);
        $simular = (bool) $this->option('simular');

        $total = ChatMensaje::where('created_at', '<', $corte)->count();

        $this->info(sprintf(
            '%s %d mensaje(s) anteriores al %s (%d días).',
            $simular ? 'Se borrarían' : 'Borrando',
            $total,
            $corte->format('d-m-Y H:i'),
            $dias
        ));

        if ($simular || $total === 0) {
            return self::SUCCESS;
        }

        ChatMensaje::where('created_at', '<', $corte)->delete();

        // Conversaciones que quedaron sin ningún mensaje: se retiran para que
        // la lista no muestre hilos vacíos.
        $vacias = ChatConversacion::whereDoesntHave('mensajes')->delete();

        $this->info("Listo. Conversaciones vacías retiradas: {$vacias}.");

        return self::SUCCESS;
    }
}
