<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Hasta cuándo leyó cada participante su conversación. Mismo patrón last-read
 * que correspondencia_lecturas: no leído = hay mensajes del otro posteriores
 * a leido_at.
 */
class ChatLectura extends Model
{
    protected $table = 'chat_lecturas';

    protected $fillable = [
        'usuario_id',
        'conversacion_id',
        'leido_at',
    ];

    protected $casts = [
        'leido_at' => 'datetime',
    ];
}
