<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_firmas', function (Blueprint $table) {
            $table->foreignId('actuando_como_user_id')
                ->nullable()
                ->after('usuario_id')
                ->comment('Si la firma fue ejecutada por un subrogante en nombre del subrogado, su id queda aquí. usuario_id sigue siendo el firmante real.')
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('documento_firmas', function (Blueprint $table) {
            $table->dropForeign(['actuando_como_user_id']);
            $table->dropColumn('actuando_como_user_id');
        });
    }
};
