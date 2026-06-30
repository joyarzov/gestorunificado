<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Correspondencia extends Model
{
    use HasFactory;

    protected $table = 'correspondencia';

    /** Series de folio para salidas, por tipo de documento. */
    public const TIPOS_SALIDA = [
        'oficio' => 'OF',
        'ordinario' => 'ORD',
        'circular' => 'CIRC',
        'carta' => 'CARTA',
    ];

    protected $fillable = [
        'folio',
        'direccion',
        'numero_documento',
        'tipo_documento_salida',
        'remitente',
        'fecha_documento',
        'fecha_recibo',
        'descripcion',
        'departamento_id',
        'respuesta_a_id',
        'fecha_revision',
        'fecha_envio',
        'usuario_id',
        'estado',
        'providencia_pdf',
        'providencia_generada',
        'documento_ruta',
        'documento_nombre',
        'firmante_nombre',
        'medio_despacho',
        'fecha_despacho',
        'referencia_despacho',
        'despachada_por',
        'motivo_devolucion',
        'respondida_at',
        'archivada_por',
        'archivada_at',
    ];

    protected $casts = [
        'fecha_documento' => 'date',
        'fecha_recibo' => 'date',
        'fecha_revision' => 'date',
        'fecha_envio' => 'date',
        'fecha_despacho' => 'date',
        'providencia_generada' => 'boolean',
        'respondida_at' => 'datetime',
        'archivada_at' => 'datetime',
    ];

    /** ¿Proceso cerrado por el Alcalde? Solo lectura hasta desarchivar. */
    public function estaArchivada(): bool
    {
        return $this->estado === 'archivado';
    }

    /**
     * Folio correlativo por serie y año, calculado desde la propia tabla
     * (mismo patrón que PROV-/LIBRO-). El índice único de `folio` protege
     * contra carreras: si dos creaciones simultáneas calculan el mismo
     * número, la segunda falla en vez de duplicar.
     */
    public static function siguienteFolio(string $prefijo): string
    {
        return static::formatearFolio($prefijo, static::siguienteNumero($prefijo));
    }

    /** Siguiente correlativo (int) de la serie del prefijo para el año en curso. */
    public static function siguienteNumero(string $prefijo): int
    {
        $anio = now()->year;
        $ultimo = static::where('folio', 'like', "{$prefijo}-{$anio}-%")
            ->orderByRaw('CAST(SUBSTRING_INDEX(folio, "-", -1) AS UNSIGNED) DESC')
            ->first();

        return $ultimo
            ? (int) substr($ultimo->folio, strrpos($ultimo->folio, '-') + 1) + 1
            : 1;
    }

    /** Arma el folio formateado a partir del prefijo y el número correlativo. */
    public static function formatearFolio(string $prefijo, int $numero, ?int $anio = null): string
    {
        return sprintf('%s-%d-%05d', $prefijo, $anio ?? now()->year, $numero);
    }

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

    public function eventos()
    {
        return $this->hasMany(CorrespondenciaEvento::class);
    }

    public function ultimaDerivacion()
    {
        return $this->hasOne(Derivacion::class)->latestOfMany();
    }

    /** Entrada a la que responde esta salida. */
    public function respuestaA()
    {
        return $this->belongsTo(self::class, 'respuesta_a_id');
    }

    /** Salidas que responden esta entrada. */
    public function respuestas()
    {
        return $this->hasMany(self::class, 'respuesta_a_id');
    }

    /**
     * Resumen de gestión que complementa el estado "derivada_funcionario":
     * de los destinatarios activos (derivaciones pendiente/recibido), cuántos
     * ya dieron acuse de recibo y cuáles respondieron (escribieron en la
     * conversación). NO agrega estados nuevos: todo se deriva de las
     * derivaciones activas y los mensajes ya existentes.
     *
     * Requiere tener cargadas las relaciones 'derivaciones.usuarioDestino' y
     * 'mensajes' (los controladores las eager-loadean para evitar N+1).
     */
    public function getResumenGestionAttribute(): array
    {
        $activas = $this->derivaciones->whereIn('estado', ['pendiente', 'recibido']);
        $autoresIds = $this->mensajes->pluck('usuario_id')->unique();

        $respondieron = $activas
            ->filter(fn ($d) => $d->usuario_destino_id && $autoresIds->contains($d->usuario_destino_id))
            ->map(fn ($d) => ['id' => (int) $d->usuario_destino_id, 'nombre' => $d->usuarioDestino?->nombre])
            ->unique('id')
            ->values()
            ->all();

        return [
            'destinatarios' => $activas->count(),
            'con_acuse'     => $activas->where('estado', 'recibido')->count(),
            'respondieron'  => $respondieron,
        ];
    }

    public function despachadaPor()
    {
        return $this->belongsTo(User::class, 'despachada_por');
    }

    public function archivadaPor()
    {
        return $this->belongsTo(User::class, 'archivada_por');
    }

    public function scopeEntradas($query)
    {
        return $query->where('direccion', 'entrada');
    }

    public function scopeSalidas($query)
    {
        return $query->where('direccion', 'salida');
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
        // Quien tiene el permiso de registro puede ver (solo lectura) cualquier correspondencia.
        if ($user->puede_ver_registro_correspondencia) {
            return true;
        }
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
