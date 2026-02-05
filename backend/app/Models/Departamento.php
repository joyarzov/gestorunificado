<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Departamento extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'codigo',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function usuarios()
    {
        return $this->hasMany(User::class);
    }

    public function correspondencias()
    {
        return $this->hasMany(Correspondencia::class);
    }

    public function derivacionesRecibidas()
    {
        return $this->hasMany(Derivacion::class, 'departamento_destino_id');
    }

    public function derivacionesEnviadas()
    {
        return $this->hasMany(Derivacion::class, 'departamento_origen_id');
    }

    public function expedientes()
    {
        return $this->hasMany(Expediente::class);
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
