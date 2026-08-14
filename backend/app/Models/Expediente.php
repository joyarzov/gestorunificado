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

    /**
     * Derivaciones vivas: las que aún no se cerraron al re-derivar. Con multi-destino
     * son varias a la vez y son la fuente de verdad de quién tiene el expediente.
     */
    public function derivacionesActivas()
    {
        return $this->morphMany(Derivacion::class, 'derivable')
            ->whereIn('estado', ['pendiente', 'recibido'])
            ->orderBy('created_at', 'desc');
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

    /**
     * Expedientes que le pertenecen al usuario: los que creó, los que tiene a su
     * cargo y los que le llegaron por derivación (a él, o a su departamento cuando
     * la derivación fue sin destinatario nombrado).
     *
     * Pertenecer al departamento NO basta: si no participó, no lo ve.
     */
    public function scopeVisiblesPara($query, $user)
    {
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        return $query->where(function ($q) use ($user, $ctx) {
            $q->where('creado_por', $user->id)
                ->orWhere('responsable_actual_usuario_id', $ctx->id)
                ->orWhereHas('derivaciones', function ($d) use ($ctx) {
                    $d->where('usuario_destino_id', $ctx->id)
                        ->orWhere(function ($d2) use ($ctx) {
                            $d2->whereNull('usuario_destino_id')
                                ->where('departamento_destino_id', $ctx->departamento_id);
                        });
                });
        });
    }

    /**
     * Expedientes con una derivación en el estado dado ('pendiente' o 'recibido')
     * dirigida al usuario, o a su departamento cuando no se nombró destinatario.
     */
    public function scopeDerivadosA($query, $user, string $estadoDerivacion)
    {
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        return $query->whereHas('derivaciones', function ($d) use ($ctx, $estadoDerivacion) {
            $d->where('estado', $estadoDerivacion)
                ->where(function ($q) use ($ctx) {
                    $q->where('usuario_destino_id', $ctx->id)
                        ->orWhere(function ($q2) use ($ctx) {
                            $q2->whereNull('usuario_destino_id')
                                ->where('departamento_destino_id', $ctx->departamento_id);
                        });
                });
        });
    }

    /**
     * Expedientes abiertos que el usuario tiene efectivamente a su cargo:
     * - acusó recibo de una derivación dirigida a él (con multi-destino son varios
     *   los que lo tienen a la vez, por eso no basta el responsable único);
     * - o es el responsable actual;
     * - o lo creó y nadie lo ha derivado todavía (responsable nulo).
     * Excluye los que aún no acusa recibo: esos viven en "Por recibir" y no deben
     * aparecer dos veces.
     */
    public function scopeEnPoderDe($query, $user)
    {
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        return $query->abiertos()
            ->where(function ($q) use ($user, $ctx) {
                $q->where('responsable_actual_usuario_id', $ctx->id)
                    ->orWhereHas('derivaciones', function ($d) use ($ctx) {
                        $d->where('estado', 'recibido')
                            ->where(function ($q3) use ($ctx) {
                                $q3->where('usuario_destino_id', $ctx->id)
                                    ->orWhere(function ($q4) use ($ctx) {
                                        $q4->whereNull('usuario_destino_id')
                                            ->where('departamento_destino_id', $ctx->departamento_id);
                                    });
                            });
                    })
                    ->orWhere(function ($q2) use ($user) {
                        $q2->whereNull('responsable_actual_usuario_id')
                            ->where('creado_por', $user->id)
                            ->whereDoesntHave('derivaciones', function ($d) {
                                $d->whereIn('estado', ['pendiente', 'recibido']);
                            });
                    });
            })
            ->whereDoesntHave('derivaciones', function ($d) use ($ctx) {
                $d->where('estado', 'pendiente')
                    ->where(function ($q) use ($ctx) {
                        $q->where('usuario_destino_id', $ctx->id)
                            ->orWhere(function ($q2) use ($ctx) {
                                $q2->whereNull('usuario_destino_id')
                                    ->where('departamento_destino_id', $ctx->departamento_id);
                            });
                    });
            });
    }

    public function estaCerrado(): bool
    {
        return in_array($this->estado, [self::ESTADO_CERRADO, self::ESTADO_ARCHIVADO]);
    }

    /**
     * ¿Puede este usuario incorporarle documentos —antecedentes o documentos que
     * van a firma? Además del creador y de administración, puede quien lo tiene en
     * su poder: el responsable actual o el destinatario de una derivación viva. El
     * funcionario que está tramitando necesita adjuntar sus respaldos sin tener que
     * devolverle el expediente al creador.
     *
     * Es más amplio que "gestionar" (editar, cerrar, asociar documentos ajenos),
     * que sigue siendo del creador. Sigue al contexto —respeta subrogancia— salvo
     * en "lo creó", que es un hecho del actor real.
     */
    public function puedeAportarDocumentos(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        $roles = is_array($user->roles) ? $user->roles : [];
        if (in_array('admin', $roles, true)) {
            return true;
        }

        if ((int) $this->creado_por === (int) $user->id) {
            return true;
        }

        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        if ($this->responsable_actual_usuario_id
            && (int) $this->responsable_actual_usuario_id === (int) $ctx->id) {
            return true;
        }

        return $this->derivacionesActivas->contains(fn ($d) => $d->esDestinatario($user));
    }
}
