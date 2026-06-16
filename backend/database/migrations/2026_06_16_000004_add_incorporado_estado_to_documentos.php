<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Estado "incorporado": para documentos subidos como PDF (escaneados/externos) que
 * ya son finales y no pasan por el ciclo de firma electrónica del sistema. Antes
 * entraban como "borrador", lo que era engañoso para un archivo cerrado.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE documentos MODIFY estado ENUM('borrador','pendiente_firma','firmado','rechazado','anulado','incorporado') NOT NULL DEFAULT 'borrador'");
    }

    public function down(): void
    {
        // Reasignar los que estén en 'incorporado' antes de quitar el valor del enum.
        DB::statement("UPDATE documentos SET estado = 'borrador' WHERE estado = 'incorporado'");
        DB::statement("ALTER TABLE documentos MODIFY estado ENUM('borrador','pendiente_firma','firmado','rechazado','anulado') NOT NULL DEFAULT 'borrador'");
    }
};
