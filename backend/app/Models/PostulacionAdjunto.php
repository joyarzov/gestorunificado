<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostulacionAdjunto extends Model
{
    use HasFactory;

    protected $table = 'postulacion_adjuntos';

    protected $fillable = [
        'postulacion_id',
        'tipo_documento',
        'nombre_archivo',
        'ruta_archivo',
        'tipo_mime',
        'tamanio_bytes',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }
}
