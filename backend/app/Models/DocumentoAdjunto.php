<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentoAdjunto extends Model
{
    use HasFactory;

    protected $table = 'documento_adjuntos';

    protected $fillable = [
        'documento_id',
        'nombre_archivo',
        'ruta_archivo',
        'tipo_mime',
        'tamanio_bytes',
        'subido_por',
    ];

    public function documento()
    {
        return $this->belongsTo(Documento::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'subido_por');
    }
}
