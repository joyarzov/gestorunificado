<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FondoConcursable extends Model
{
    use HasFactory;

    protected $table = 'fondos_concursables';

    protected $fillable = [
        'nombre',
        'codigo',
        'descripcion',
        'bases_pdf_path',
        'monto_total',
        'monto_maximo_por_proyecto',
        'estado',
        'fecha_apertura',
        'fecha_cierre',
        'anio',
    ];

    protected $casts = [
        'fecha_apertura' => 'date',
        'fecha_cierre' => 'date',
        'monto_total' => 'decimal:0',
        'monto_maximo_por_proyecto' => 'decimal:0',
    ];

    public function postulaciones()
    {
        return $this->hasMany(Postulacion::class, 'fondo_id');
    }

    public function scopeAbierto($query)
    {
        return $query->where('estado', 'abierto');
    }
}
