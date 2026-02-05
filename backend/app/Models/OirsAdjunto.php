<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OirsAdjunto extends Model
{
    use HasFactory;

    protected $table = 'oirs_adjuntos';

    protected $fillable = [
        'oirs_solicitud_id',
        'nombre_archivo',
        'ruta_archivo',
        'tipo_mime',
        'tamanio_bytes',
        'origen', // 'solicitante', 'funcionario', 'admin'
    ];

    public function solicitud()
    {
        return $this->belongsTo(OirsSolicitud::class, 'oirs_solicitud_id');
    }
}
