<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OirsSolicitud extends Model
{
    use HasFactory;

    protected $table = 'oirs_solicitudes';

    protected $fillable = [
        'folio',
        'tipo_solicitud',
        'nombre_solicitante',
        'rut_solicitante',
        'email_solicitante',
        'telefono_solicitante',
        'direccion_solicitante',
        'comuna_solicitante',
        'anonimo',
        'categoria',
        'unidad_municipal',
        'asunto',
        'descripcion',
        'fecha_hecho',
        'lugar_hecho',
        'medio_respuesta',
        'estado',
        'unidad_responsable_id',
        'funcionario_asignado_id',
        'prioridad',
        'fecha_limite_respuesta',
        'fecha_respuesta',
        'respuesta',
        'respuesta_funcionario',
        'fecha_respuesta_funcionario',
        'canal_ingreso',
        'ip_address',
    ];

    protected $casts = [
        'anonimo' => 'boolean',
        'fecha_hecho' => 'date',
        'fecha_limite_respuesta' => 'date',
        'fecha_respuesta' => 'date',
        'fecha_respuesta_funcionario' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($solicitud) {
            if (empty($solicitud->folio)) {
                $solicitud->folio = self::generarFolio();
            }
        });
    }

    public function unidadResponsable()
    {
        return $this->belongsTo(Departamento::class, 'unidad_responsable_id');
    }

    public function funcionarioAsignado()
    {
        return $this->belongsTo(User::class, 'funcionario_asignado_id');
    }

    public function adjuntos()
    {
        return $this->hasMany(OirsAdjunto::class);
    }

    public function historial()
    {
        return $this->hasMany(OirsHistorial::class);
    }

    // Generar folio único
    public static function generarFolio(): string
    {
        $anio = date('Y');
        $ultimoFolio = self::whereYear('created_at', $anio)
            ->orderBy('id', 'desc')
            ->first();

        if ($ultimoFolio) {
            $partes = explode('-', $ultimoFolio->folio);
            $numero = (int) end($partes) + 1;
        } else {
            $numero = 1;
        }

        return sprintf('OIRS-%d-%05d', $anio, $numero);
    }

    public function scopePendientes($query)
    {
        return $query->whereIn('estado', ['recibido', 'asignada', 'pendiente', 'en_analisis']);
    }

    public function scopeRespondidas($query)
    {
        return $query->whereIn('estado', ['respondido', 'cerrado']);
    }
}
