<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('oirs_solicitudes', function (Blueprint $table) {
            $table->string('codigo_seguimiento', 16)
                ->nullable()
                ->unique()
                ->after('folio')
                ->comment('Código alfanumérico que permite al ciudadano consultar su solicitud sin entregar su RUT');
        });
    }

    public function down(): void
    {
        Schema::table('oirs_solicitudes', function (Blueprint $table) {
            $table->dropUnique(['codigo_seguimiento']);
            $table->dropColumn('codigo_seguimiento');
        });
    }
};
