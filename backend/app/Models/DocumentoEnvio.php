<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentoEnvio extends Model
{
    protected $table = 'documento_envios';

    protected $fillable = [
        'documento_id',
        'remitente_id',
        'destinatario_id',
        'estado',
        'fecha_envio',
        'fecha_recepcion',
        'observaciones',
    ];

    protected $casts = [
        'fecha_envio' => 'datetime',
        'fecha_recepcion' => 'datetime',
    ];

    public function documento()
    {
        return $this->belongsTo(Documento::class);
    }

    public function remitente()
    {
        return $this->belongsTo(User::class, 'remitente_id');
    }

    public function destinatario()
    {
        return $this->belongsTo(User::class, 'destinatario_id');
    }
}
