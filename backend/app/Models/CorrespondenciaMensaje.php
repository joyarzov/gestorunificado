<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CorrespondenciaMensaje extends Model
{
    protected $table = 'correspondencia_mensajes';

    protected $fillable = [
        'correspondencia_id',
        'usuario_id',
        'mensaje',
    ];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    public function adjuntos()
    {
        return $this->hasMany(CorrespondenciaMensajeAdjunto::class, 'mensaje_id');
    }
}
