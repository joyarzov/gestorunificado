<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CorrespondenciaAdjunto extends Model
{
    use HasFactory;

    protected $table = 'correspondencia_adjuntos';

    protected $fillable = [
        'correspondencia_id',
        'nombre_archivo',
        'ruta_archivo',
        'tipo_mime',
        'tamanio_bytes',
    ];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }
}
