<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->foreignId('actuando_como_user_id')
                ->nullable()
                ->after('usuario_destino_id')
                ->comment('Si la derivación fue creada por un subrogante actuando en nombre del subrogado, su id queda aquí.')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('derivaciones', function (Blueprint $table) {
            $table->dropForeign(['actuando_como_user_id']);
            $table->dropColumn('actuando_como_user_id');
        });
    }
};
