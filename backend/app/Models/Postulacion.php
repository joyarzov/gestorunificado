<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Postulacion extends Model
{
    use HasFactory;

    protected $table = 'postulaciones';

    protected $fillable = [
        'codigo',
        'fondo_id',
        'nombre_postulante',
        'rut_postulante',
        'email_postulante',
        'telefono_postulante',
        'contenido_json',
        'estado',
        'puntaje',
        'puntaje_detalle',
        'observaciones_evaluacion',
        'evaluado_por',
        'fecha_evaluacion',
        'monto_aprobado',
        'paso_actual',
    ];

    protected $casts = [
        'contenido_json' => 'array',
        'puntaje_detalle' => 'array',
        'fecha_evaluacion' => 'datetime',
        'puntaje' => 'decimal:2',
        'monto_aprobado' => 'decimal:0',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($postulacion) {
            if (empty($postulacion->codigo)) {
                $postulacion->codigo = self::generarCodigo();
            }
        });
    }

    public static function generarCodigo(): string
    {
        do {
            $codigo = 'TNC-' . Str::upper(Str::random(6));
        } while (self::where('codigo', $codigo)->exists());

        return $codigo;
    }

    public function fondo()
    {
        return $this->belongsTo(FondoConcursable::class, 'fondo_id');
    }

    public function evaluador()
    {
        return $this->belongsTo(User::class, 'evaluado_por');
    }

    public function itemsFinanciamiento()
    {
        return $this->hasMany(PostulacionItemFinanciamiento::class);
    }

    public function adjuntos()
    {
        return $this->hasMany(PostulacionAdjunto::class);
    }
}
