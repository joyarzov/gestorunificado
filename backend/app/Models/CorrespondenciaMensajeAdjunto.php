<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CorrespondenciaMensajeAdjunto extends Model
{
    protected $table = 'correspondencia_mensaje_adjuntos';

    protected $fillable = [
        'mensaje_id',
        'nombre_archivo',
        'ruta_archivo',
        'tipo_mime',
        'tamanio_bytes',
    ];

    public function mensaje()
    {
        return $this->belongsTo(CorrespondenciaMensaje::class, 'mensaje_id');
    }
}
