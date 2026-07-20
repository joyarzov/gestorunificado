<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Calidad en que firma cada firmante asignado.
 *
 * Hasta ahora la subrogancia en la firma dependía del header X-Actuando-Como
 * del momento: el "(S)" del sello salía de la sesión, no del documento. Eso
 * dejaba dos huecos: (a) si alguien asignaba directamente al subrogante como
 * persona, el documento quedaba amarrado a él aunque el cargo fuera del
 * titular, y (b) si la subrogancia expiraba entre el envío y la firma, el
 * mismo documento se firmaba con distinta calidad sin que nadie lo decidiera.
 *
 * Con subrogando_a_user_id la calidad queda declarada EN LA ASIGNACIÓN: al
 * enviar a firma se decide si esa persona firma en calidad propia (null) o en
 * subrogancia de un titular (id del titular). El sello y la trazabilidad se
 * derivan de ahí y ya no del estado de la sesión.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documento_firmantes_asignados', function (Blueprint $table) {
            $table->foreignId('subrogando_a_user_id')
                ->nullable()
                ->after('user_id')
                ->constrained('users')
                ->nullOnDelete()
                ->comment('Si el firmante fue asignado para firmar en subrogancia, id del titular subrogado. NULL = firma en calidad propia.');
        });

        Schema::table('documento_firmas', function (Blueprint $table) {
            // El cargo estampado en el PDF no era reconstruible desde la BD: si
            // el firmante cambiaba de cargo, se perdía qué decía el sello. Se
            // congela aquí al momento de firmar (valor probatorio).
            $table->string('cargo_firmado', 255)
                ->nullable()
                ->after('actuando_como_user_id')
                ->comment('Cargo tal como quedó estampado en el sello, congelado al firmar (incluye el sufijo "(S)" si aplica).');
        });
    }

    public function down(): void
    {
        Schema::table('documento_firmantes_asignados', function (Blueprint $table) {
            $table->dropConstrainedForeignId('subrogando_a_user_id');
        });

        Schema::table('documento_firmas', function (Blueprint $table) {
            $table->dropColumn('cargo_firmado');
        });
    }
};
