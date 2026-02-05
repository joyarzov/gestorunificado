<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OirsHistorial extends Model
{
    use HasFactory;

    protected $table = 'oirs_historial';

    protected $fillable = [
        'oirs_solicitud_id',
        'usuario_id',
        'accion',
        'estado_anterior',
        'estado_nuevo',
        'observaciones',
    ];

    public function solicitud()
    {
        return $this->belongsTo(OirsSolicitud::class, 'oirs_solicitud_id');
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }
}
