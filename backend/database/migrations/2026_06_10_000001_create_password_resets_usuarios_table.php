<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tokens de restablecimiento de contraseña para funcionarios.
 * Un token activo por usuario; se guarda el HASH (sha256) del token,
 * nunca el token en claro. Caducidad controlada por expires_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_resets_usuarios', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained('users')->cascadeOnDelete();
            $table->string('token_hash', 64)->index();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_resets_usuarios');
    }
};
