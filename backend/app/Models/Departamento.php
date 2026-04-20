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
        'parent_id',
        'jefe_id',
        'tipo',
        'orden',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'orden' => 'integer',
    ];

    public function usuarios()
    {
        return $this->hasMany(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(Departamento::class, 'parent_id');
    }

    public function hijos()
    {
        return $this->hasMany(Departamento::class, 'parent_id')->orderBy('orden')->orderBy('nombre');
    }

    public function jefe()
    {
        return $this->belongsTo(User::class, 'jefe_id');
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
