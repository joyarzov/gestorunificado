<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Marca personal de "seguir" una correspondencia (estrella). Existe una fila
 * por usuario que la marcó; su ausencia significa que no la sigue.
 */
class CorrespondenciaSeguimiento extends Model
{
    protected $table = 'correspondencia_seguimientos';

    protected $fillable = [
        'usuario_id',
        'correspondencia_id',
        'nota',
    ];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
