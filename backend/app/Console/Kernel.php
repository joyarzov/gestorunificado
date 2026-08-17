<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $schedule->command('oirs:notificar-proximas-vencer')->dailyAt('08:00');
        $schedule->command('documentos:alertar-estancados')->weekdays()->dailyAt('08:30');
        // Tokens ya vencidos (más de 24 h pasada su expiración): se acumulaban
        // indefinidamente porque casi nadie usa "Cerrar sesión". Solo borra lo
        // que ya no autentica nada.
        $schedule->command('sanctum:prune-expired --hours=24')->dailyAt('03:00');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
