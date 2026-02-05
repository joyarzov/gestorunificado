<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TipoDocumental extends Model
{
    use HasFactory;

    protected $table = 'tipos_documentales';

    protected $fillable = [
        'codigo',
        'nombre',
        'descripcion',
        'requiere_firma',
        'genera_correlativo',
        'prefijo_correlativo',
        'activo',
    ];

    protected $casts = [
        'requiere_firma' => 'boolean',
        'genera_correlativo' => 'boolean',
        'activo' => 'boolean',
    ];

    public function documentos()
    {
        return $this->hasMany(Documento::class);
    }

    public function plantillas()
    {
        return $this->hasMany(DocumentoPlantilla::class);
    }

    public function correlativos()
    {
        return $this->hasMany(Correlativo::class);
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
