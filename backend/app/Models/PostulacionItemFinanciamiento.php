<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PostulacionItemFinanciamiento extends Model
{
    use HasFactory;

    protected $table = 'postulacion_items_financiamiento';

    protected $fillable = [
        'postulacion_id',
        'sub_item',
        'producto_servicio',
        'justificacion',
        'plazo_ejecucion',
        'numero_cotizacion',
        'proveedor',
        'cantidad',
        'valor_unitario',
        'valor_total',
        'monto_municipio',
        'monto_cofinanciamiento',
    ];

    protected $casts = [
        'valor_unitario' => 'decimal:0',
        'valor_total' => 'decimal:0',
        'monto_municipio' => 'decimal:0',
        'monto_cofinanciamiento' => 'decimal:0',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }
}
