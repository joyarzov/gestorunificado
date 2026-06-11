<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LibroCorrespondencia extends Model
{
    protected $table = 'libros_correspondencia';

    protected $fillable = [
        'folio',
        'tipo',
        'fecha_desde',
        'fecha_hasta',
        'total_registros',
        'generado_por',
        'codigo_verificacion',
        'pdf_ruta',
        'firmado',
    ];

    protected $casts = [
        'fecha_desde' => 'date',
        'fecha_hasta' => 'date',
        'firmado' => 'boolean',
    ];

    public function generadoPor()
    {
        return $this->belongsTo(User::class, 'generado_por');
    }
}
