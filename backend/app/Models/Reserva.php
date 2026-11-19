<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Reserva de un espacio: un bloque de uso (periodo inicio–fin) con su motivo,
 * descripción, asistentes y estado. Una reserva creada por el administrador del
 * espacio nace 'aprobada'; una pedida por un funcionario nace 'solicitada' y
 * requiere aprobación del administrador del espacio.
 */
class Reserva extends Model
{
    protected $table = 'reservas';

    public const ESTADO_SOLICITADA = 'solicitada';
    public const ESTADO_APROBADA   = 'aprobada';
    public const ESTADO_RECHAZADA  = 'rechazada';
    public const ESTADO_CANCELADA  = 'cancelada';

    protected $fillable = [
        'espacio_id',
        'titulo',
        'descripcion',
        'inicio',
        'fin',
        'estado',
        'solicitante_id',
        'aprobada_por_id',
        'aprobada_at',
        'motivo_rechazo',
    ];

    protected $casts = [
        'inicio' => 'datetime',
        'fin' => 'datetime',
        'aprobada_at' => 'datetime',
    ];

    public function espacio()
    {
        return $this->belongsTo(Espacio::class);
    }

    public function solicitante()
    {
        return $this->belongsTo(User::class, 'solicitante_id');
    }

    public function aprobadaPor()
    {
        return $this->belongsTo(User::class, 'aprobada_por_id');
    }

    public function asistentes()
    {
        return $this->belongsToMany(User::class, 'reserva_asistentes', 'reserva_id', 'user_id')
            ->withTimestamps();
    }

    public function scopeAprobadas($query)
    {
        return $query->where('estado', self::ESTADO_APROBADA);
    }

    /** Reservas que caen (aunque sea parcialmente) dentro del rango dado. */
    public function scopeEnRango($query, $desde, $hasta)
    {
        return $query->where('inicio', '<', $hasta)->where('fin', '>', $desde);
    }

    /**
     * ¿Se solapa con alguna otra reserva APROBADA del mismo espacio? Dos bloques
     * se solapan si inicio_a < fin_b y inicio_b < fin_a. Se excluye a sí misma.
     */
    public function chocaConAprobada(): bool
    {
        return self::where('espacio_id', $this->espacio_id)
            ->where('id', '!=', $this->id)
            ->where('estado', self::ESTADO_APROBADA)
            ->where('inicio', '<', $this->fin)
            ->where('fin', '>', $this->inicio)
            ->exists();
    }
}
