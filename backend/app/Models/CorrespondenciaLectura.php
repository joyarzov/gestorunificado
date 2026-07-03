<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Hasta cuándo un usuario leyó una correspondencia. Se compara con
 * Correspondencia::ultima_actividad_at para saber si hay novedades sin leer.
 */
class CorrespondenciaLectura extends Model
{
    protected $table = 'correspondencia_lecturas';

    protected $fillable = [
        'usuario_id',
        'correspondencia_id',
        'leido_at',
    ];

    protected $casts = [
        'leido_at' => 'datetime',
    ];
}
