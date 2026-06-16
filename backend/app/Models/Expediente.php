<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expediente extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'identificador',
        'estado',
        'titulo',
        'asunto',
        'resumen',
        'nivel_acceso',
        'informacion_sensible',
        'cpat_codigo',
        'cpat_nombre',
        'departamento_id',
        'responsable_actual_usuario_id',
        'responsable_actual_departamento_id',
        'fecha_creacion',
        'fecha_cierre',
        'creado_por',
        'actualizado_por',
    ];

    protected $casts = [
        'fecha_creacion' => 'datetime',
        'fecha_cierre' => 'datetime',
        'informacion_sensible' => 'boolean',
    ];

    // Estados del expediente
    const ESTADO_BORRADOR = 'borrador';
    const ESTADO_EN_TRAMITE = 'en_tramite';
    const ESTADO_CERRADO = 'cerrado';
    const ESTADO_ARCHIVADO = 'archivado';

    // Niveles de acceso
    const ACCESO_PUBLICO = 1;
    const ACCESO_RESTRINGIDO = 2;
    const ACCESO_RESERVADO = 3;
    const ACCESO_SECRETO = 4;

    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function actualizador()
    {
        return $this->belongsTo(User::class, 'actualizado_por');
    }

    public function documentos()
    {
        return $this->belongsToMany(Documento::class, 'documento_expediente')
            ->withPivot('orden')
            ->withTimestamps()
            ->orderBy('documento_expediente.orden');
    }

    public function actividades()
    {
        return $this->hasMany(ExpedienteActividad::class)->orderBy('created_at', 'desc');
    }

    /** Usuario en cuyo poder está ahora el expediente (cambia en cada derivación). */
    public function responsableActual()
    {
        return $this->belongsTo(User::class, 'responsable_actual_usuario_id');
    }

    /** Departamento del responsable actual (dato derivado del responsable). */
    public function responsableActualDepartamento()
    {
        return $this->belongsTo(Departamento::class, 'responsable_actual_departamento_id');
    }

    /** Derivaciones del expediente (relación polimórfica), reusa el motor de derivación. */
    public function derivaciones()
    {
        return $this->morphMany(Derivacion::class, 'derivable')->orderBy('created_at', 'desc');
    }

    public function ultimaDerivacion()
    {
        return $this->morphOne(Derivacion::class, 'derivable')->latestOfMany();
    }

    // Generar identificador único
    public static function generarIdentificador(): string
    {
        $anio = date('Y');
        $ultimo = self::whereYear('created_at', $anio)
            ->orderBy('id', 'desc')
            ->first();

        if ($ultimo) {
            $partes = explode('-', $ultimo->identificador);
            $numero = (int) end($partes) + 1;
        } else {
            $numero = 1;
        }

        return sprintf('EXP-%d-%06d', $anio, $numero);
    }

    // Texto del nivel de acceso
    public function getNivelAccesoTextoAttribute(): string
    {
        return match($this->nivel_acceso) {
            self::ACCESO_PUBLICO => 'Público',
            self::ACCESO_RESTRINGIDO => 'Restringido',
            self::ACCESO_RESERVADO => 'Reservado',
            self::ACCESO_SECRETO => 'Secreto',
            default => 'Desconocido'
        };
    }

    // Texto del estado
    public function getEstadoTextoAttribute(): string
    {
        return match($this->estado) {
            self::ESTADO_BORRADOR => 'Borrador',
            self::ESTADO_EN_TRAMITE => 'En Trámite',
            self::ESTADO_CERRADO => 'Cerrado',
            self::ESTADO_ARCHIVADO => 'Archivado',
            default => ucfirst($this->estado)
        };
    }

    public function scopeAbiertos($query)
    {
        return $query->whereNotIn('estado', [self::ESTADO_CERRADO, self::ESTADO_ARCHIVADO]);
    }

    public function scopeCerrados($query)
    {
        return $query->whereIn('estado', [self::ESTADO_CERRADO, self::ESTADO_ARCHIVADO]);
    }

    public function estaCerrado(): bool
    {
        return in_array($this->estado, [self::ESTADO_CERRADO, self::ESTADO_ARCHIVADO]);
    }
}
