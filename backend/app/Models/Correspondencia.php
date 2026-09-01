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
        'ultima_actividad_at',
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
        'ultima_actividad_at' => 'datetime',
    ];

    /**
     * Registra que ocurrió una acción (mensaje, acuse, derivación, cierre…):
     * actualiza la marca de actividad, deja el hito en la bitácora y, para el
     * actor, marca como leído (su propia acción no debe aparecerle como
     * novedad sin leer).
     *
     * Este es el único punto por el que pasa TODO movimiento del módulo, así
     * que también es el único que escribe `correspondencia_eventos`. De ahí
     * sale el feed de "últimos movimientos" con una sola consulta ordenada,
     * sin recomponer derivaciones + acuses + mensajes en PHP como hace el
     * hilo del detalle.
     *
     * @param  int|null     $ctxId   Contexto institucional (subrogado si hay actuando-como).
     *                               Es quien queda "al día": la lectura se marca para él,
     *                               porque es su bandeja la que no debe encenderse.
     * @param  string|null  $tipo    Tipo de movimiento (derivacion, acuse, mensaje, archivada…).
     * @param  string|null  $texto   Descripción legible, en tercera persona y sin el nombre
     *                               del actor: el feed lo antepone ("Juan Pérez " . $texto).
     * @param  int|null     $autorId Actor REAL que ejecutó la acción, para la trazabilidad
     *                               del hito (ver convención de subrogancia: trazabilidad =
     *                               actor real, visibilidad = contexto). Si se omite, se
     *                               asume que actor y contexto son la misma persona.
     */
    public function registrarActividad(
        ?int $ctxId = null,
        ?string $tipo = null,
        ?string $texto = null,
        ?int $autorId = null
    ): void {
        $this->forceFill(['ultima_actividad_at' => now()])->save();

        if ($tipo && $texto) {
            $this->eventos()->create([
                'usuario_id' => $autorId ?? $ctxId,
                'tipo'       => $tipo,
                // La columna es varchar(300): recortar antes que reventar el insert.
                'texto'      => mb_substr($texto, 0, 300),
            ]);
        }

        if ($ctxId) {
            CorrespondenciaLectura::updateOrCreate(
                ['usuario_id' => $ctxId, 'correspondencia_id' => $this->id],
                ['leido_at' => now()]
            );
        }
    }

    public function lecturas()
    {
        return $this->hasMany(CorrespondenciaLectura::class);
    }

    public function seguimientos()
    {
        return $this->hasMany(CorrespondenciaSeguimiento::class);
    }

    /**
     * Días sin ningún movimiento. Null si nunca registró actividad (datos
     * anteriores al indicador de novedades).
     */
    public function diasSinMovimiento(): ?int
    {
        return $this->ultima_actividad_at
            ? (int) $this->ultima_actividad_at->diffInDays(now())
            : null;
    }

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
     * 'mensajes'. Si el eager load usa un SELECT acotado de 'derivaciones', DEBE
     * incluir: usuario_origen_id, actuando_como_user_id, usuario_destino_id,
     * estado y fecha_recepcion (los dos primeros son imprescindibles para
     * detectar las derivaciones de tránsito, incluidas las hechas en
     * subrogancia; sin ellos el conteo de acuses queda inconsistente entre
     * vistas).
     */
    public function getResumenGestionAttribute(): array
    {
        // Destinatarios dirigidos a funcionarios. Se incluye 'archivado' porque
        // archivar la derivación es un archivo PERSONAL del funcionario: no borra
        // que fue destinatario ni que acusó recibo.
        // Se EXCLUYEN las derivaciones de TRÁNSITO: aquellas cuyo destinatario a
        // su vez re-derivó (la que el Alcalde recibió de Partes y reencaminó a
        // funcionarios). Ese destino no "acusa recibo" —deriva— así que no debe
        // contar como destinatario de gestión ni inflar el denominador de acuses.
        // Quién reencaminó se mide por el DUEÑO INSTITUCIONAL de la derivación
        // (Derivacion::titularOrigenId): si el Alcalde reenvió a través de su
        // subrogante, usuario_origen_id es el subrogante y el Alcalde quedaría
        // contado como un destinatario que nunca acusó — el "2 de 3" con solo
        // dos funcionarios derivados.
        $reencaminaron = $this->derivaciones
            ->map(fn ($d) => $d->titularOrigenId())
            ->filter()
            ->unique();
        $activas = $this->derivaciones
            ->whereIn('estado', ['pendiente', 'recibido', 'archivado'])
            ->reject(fn ($d) => $d->usuario_destino_id && $reencaminaron->contains($d->usuario_destino_id));
        $autoresIds = $this->mensajes->pluck('usuario_id')->unique();

        $respondieron = $activas
            ->filter(fn ($d) => $d->usuario_destino_id && $autoresIds->contains($d->usuario_destino_id))
            ->map(fn ($d) => ['id' => (int) $d->usuario_destino_id, 'nombre' => $d->usuarioDestino?->nombre])
            ->unique('id')
            ->values()
            ->all();

        return [
            'destinatarios' => $activas->count(),
            // El acuse es permanente: se cuenta por fecha_recepcion (no se pierde
            // al archivar, cuando el estado deja de ser 'recibido').
            'con_acuse'     => $activas->filter(fn ($d) => !is_null($d->fecha_recepcion))->count(),
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
     *
     * Lo derivado EN SUBROGANCIA lo ven los dos: el subrogante, porque lo
     * gestionó él (queda en usuario_origen_id), y el TITULAR, porque se derivó
     * en su nombre (actuando_como_user_id). Sin lo segundo el titular no vería
     * en su propia lista los asuntos que salieron de su despacho mientras
     * estaba ausente.
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
                    ->orWhere('actuando_como_user_id', $ctx->id)
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
