<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documento_firmantes_asignados', function (Blueprint $table) {
            $table->id();
            $table->foreignId('documento_id')->constrained('documentos')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->unsignedInteger('orden')->default(1);
            $table->timestamps();

            $table->unique(['documento_id', 'user_id']);
            $table->index('documento_id');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documento_firmantes_asignados');
    }
};
