<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Derivacion extends Model
{
    use HasFactory;

    protected $table = 'derivaciones';

    protected $fillable = [
        'derivable_type',
        'derivable_id',
        'correspondencia_id',
        'departamento_origen_id',
        'departamento_destino_id',
        'usuario_origen_id',
        'usuario_destino_id',
        'actuando_como_user_id',
        'pdf_ruta',
        'observaciones',
        'acciones_para',
        'fecha_limite_respuesta',
        'cumplida_at',
        'folio',
        'codigo_verificacion',
        'estado',
        'fecha_recepcion',
    ];

    protected $casts = [
        'fecha_recepcion' => 'datetime',
        'fecha_limite_respuesta' => 'date',
        'cumplida_at' => 'datetime',
        'acciones_para' => 'array',
    ];

    /**
     * Entidad derivada: Correspondencia o Expediente (relación polimórfica).
     */
    public function derivable()
    {
        return $this->morphTo();
    }

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }

    /** Solo derivaciones cuyo derivable es un Expediente. */
    public function scopeDeExpedientes($query)
    {
        return $query->where('derivable_type', Expediente::class);
    }

    /** Solo derivaciones cuyo derivable es una Correspondencia. */
    public function scopeDeCorrespondencia($query)
    {
        return $query->where('derivable_type', Correspondencia::class);
    }

    public function departamentoOrigen()
    {
        return $this->belongsTo(Departamento::class, 'departamento_origen_id');
    }

    public function departamentoDestino()
    {
        return $this->belongsTo(Departamento::class, 'departamento_destino_id');
    }

    public function usuarioOrigen()
    {
        return $this->belongsTo(User::class, 'usuario_origen_id');
    }

    public function usuarioDestino()
    {
        return $this->belongsTo(User::class, 'usuario_destino_id');
    }

    /**
     * Subrogado en cuyo nombre el usuario_origen creó esta derivación, si aplica.
     */
    public function actuandoComo()
    {
        return $this->belongsTo(User::class, 'actuando_como_user_id');
    }

    /**
     * DUEÑO INSTITUCIONAL del origen de la derivación: el subrogado si se derivó
     * en subrogancia, o el usuario que derivó si no la hubo.
     *
     * usuario_origen_id guarda SIEMPRE al actor real (trazabilidad de quién
     * apretó el botón) y no cambia cuando la subrogancia termina. Por eso todo
     * lo que sigue al asunto en el tiempo —avisos de acuse, mensajes del hilo—
     * debe apuntar aquí y no a usuario_origen_id: de lo contrario el subrogante
     * sigue recibiendo notificaciones de asuntos ajenos para siempre y el
     * titular nunca recibe los suyos. Mientras la subrogancia siga vigente, el
     * NotificacionService ya le manda copia espejo al subrogante.
     */
    public function titularOrigenId(): ?int
    {
        return $this->actuando_como_user_id ?: $this->usuario_origen_id;
    }

    /**
     * Semáforo del plazo de respuesta para esta derivación, para la bandeja y la
     * lista de seguimiento. Devuelve null cuando no aplica (sin plazo, o el plazo
     * ya se cumplió porque la correspondencia se respondió o se cerró), o
     * 'verde' | 'amarillo' | 'rojo' según los días que falten para la fecha límite.
     *
     * Umbrales acordados: 🟢 faltan más de 2 días · 🟡 quedan 2 días o menos
     * (incluye hoy y mañana) · 🔴 ya venció. "Responder" es más que "acusar
     * recibo": recibir NO apaga el semáforo, solo responder o cerrar el proceso.
     *
     * El "hoy" se calcula en la zona horaria de la app (America/Punta_Arenas),
     * no en UTC del contenedor — ver timezone_utc_vs_punta_arenas.
     */
    public function semaforo(): ?string
    {
        return $this->semaforoPara($this->correspondencia);
    }

    /**
     * Igual que semaforo() pero recibe la correspondencia como parámetro, para no
     * tener que mutar la relación `correspondencia` del modelo. Esto es CLAVE
     * cuando la derivación ya vive dentro de `$correspondencia->derivaciones`:
     * hacer `setRelation('correspondencia', $c)` crearía una referencia circular
     * ($c → derivaciones → $d → correspondencia → $c) que, al serializar la
     * respuesta a JSON, recursa infinito y mata el proceso.
     */
    public function semaforoPara(?Correspondencia $correspondencia): ?string
    {
        if (!$this->fecha_limite_respuesta) {
            return null;
        }

        // Este funcionario ya marcó su entrega como cumplida: su semáforo se apaga
        // de forma individual, sin esperar a los demás.
        if ($this->cumplida_at !== null) {
            return null;
        }

        if ($correspondencia
            && ($correspondencia->respondida_at !== null || $correspondencia->estado === 'archivado')) {
            return null; // plazo cumplido: respondida o cerrada
        }

        $hoy = \Illuminate\Support\Carbon::today();
        $limite = $this->fecha_limite_respuesta->copy()->startOfDay();
        $diasRestantes = $hoy->diffInDays($limite, false);

        if ($diasRestantes < 0) {
            return 'rojo';      // vencido
        }
        if ($diasRestantes <= 2) {
            return 'amarillo';  // hoy, mañana o pasado mañana
        }

        return 'verde';
    }

    /**
     * ¿El usuario puede marcar como CUMPLIDA su entrega en esta derivación?
     * Solo tiene sentido en derivaciones con plazo: requiere ser el destinatario,
     * haber ACUSADO RECIBO ya (estado 'recibido'), no haberla cumplido todavía, y
     * que la correspondencia siga activa (no respondida por partes ni cerrada).
     */
    public function puedeMarcarCumplida(User $user): bool
    {
        if (!$this->fecha_limite_respuesta || $this->cumplida_at !== null) {
            return false;
        }
        if ($this->estado !== 'recibido') {
            return false;
        }
        $correspondencia = $this->correspondencia;
        if ($correspondencia
            && ($correspondencia->respondida_at !== null || $correspondencia->estado === 'archivado')) {
            return false;
        }

        return $this->esDestinatario($user);
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeRecibidas($query)
    {
        return $query->where('estado', 'recibido');
    }

    /**
     * ¿El usuario es el destinatario legítimo de esta derivación?
     * - Si la derivación va a un USUARIO específico → debe ser ese usuario.
     * - Si va a nivel de DEPARTAMENTO (sin usuario) → debe estar en ese depto.
     * Usa el contexto (respeta subrogancia). Admin/oficial NO son destinatarios
     * por el solo hecho de supervisar: solo ven, no intervienen.
     */
    public function esDestinatario(User $user): bool
    {
        $ctx = $user->contexto();
        if ($this->usuario_destino_id) {
            return (int) $this->usuario_destino_id === (int) $ctx->id;
        }
        return (int) $this->departamento_destino_id === (int) $ctx->departamento_id;
    }
}
