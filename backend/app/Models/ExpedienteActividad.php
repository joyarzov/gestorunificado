<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExpedienteActividad extends Model
{
    use HasFactory;

    protected $table = 'expediente_actividades';

    protected $fillable = [
        'expediente_id',
        'usuario_id',
        'tipo',
        'descripcion',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function expediente()
    {
        return $this->belongsTo(Expediente::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }
}
