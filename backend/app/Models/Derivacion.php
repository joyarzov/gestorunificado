<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Derivacion extends Model
{
    use HasFactory;

    protected $table = 'derivaciones';

    protected $fillable = [
        'correspondencia_id',
        'departamento_origen_id',
        'departamento_destino_id',
        'usuario_origen_id',
        'usuario_destino_id',
        'actuando_como_user_id',
        'pdf_ruta',
        'observaciones',
        'acciones_para',
        'folio',
        'codigo_verificacion',
        'estado',
        'fecha_recepcion',
    ];

    protected $casts = [
        'fecha_recepcion' => 'datetime',
        'acciones_para' => 'array',
    ];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
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
