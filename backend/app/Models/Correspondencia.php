<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Correspondencia extends Model
{
    use HasFactory;

    protected $table = 'correspondencia';

    protected $fillable = [
        'numero_documento',
        'remitente',
        'fecha_documento',
        'fecha_recibo',
        'descripcion',
        'departamento_id',
        'fecha_revision',
        'fecha_envio',
        'usuario_id',
        'estado',
        'providencia_pdf',
        'providencia_generada',
    ];

    protected $casts = [
        'fecha_documento' => 'date',
        'fecha_recibo' => 'date',
        'fecha_revision' => 'date',
        'fecha_envio' => 'date',
        'providencia_generada' => 'boolean',
    ];

    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }

    public function adjuntos()
    {
        return $this->hasMany(CorrespondenciaAdjunto::class);
    }

    public function derivaciones()
    {
        return $this->hasMany(Derivacion::class);
    }

    public function mensajes()
    {
        return $this->hasMany(CorrespondenciaMensaje::class);
    }

    public function ultimaDerivacion()
    {
        return $this->hasOne(Derivacion::class)->latestOfMany();
    }

    /**
     * Correspondencias visibles para un usuario.
     * - admin / oficial (oficina de partes): TODAS (supervisión).
     * - resto: solo donde participa — la creó, está en la cadena de derivaciones
     *   (origen o destino), o fue derivada a su departamento sin usuario específico.
     * Usa contexto() para respetar la subrogancia.
     */
    public function scopeVisiblesPara($query, User $user)
    {
        if ($user->isAdmin() || $user->isOficial()) {
            return $query;
        }
        $ctx = $user->contexto();
        return $query->where(function ($q) use ($ctx) {
            $q->where('usuario_id', $ctx->id)
              ->orWhereHas('derivaciones', function ($d) use ($ctx) {
                  $d->where('usuario_origen_id', $ctx->id)
                    ->orWhere('usuario_destino_id', $ctx->id)
                    ->orWhere(function ($d2) use ($ctx) {
                        $d2->whereNull('usuario_destino_id')
                           ->where('departamento_destino_id', $ctx->departamento_id);
                    });
              });
        });
    }

    public function esVisiblePara(User $user): bool
    {
        return static::visiblesPara($user)->whereKey($this->id)->exists();
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeEnProceso($query)
    {
        return $query->where('estado', 'en_proceso');
    }

    public function scopeArchivadas($query)
    {
        return $query->where('estado', 'archivado');
    }
}
