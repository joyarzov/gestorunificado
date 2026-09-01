<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CorrespondenciaEvento extends Model
{
    protected $table = 'correspondencia_eventos';

    /**
     * Hitos que el hilo del detalle muestra DESDE esta tabla.
     *
     * El resto de los tipos (derivacion, acuse, mensaje) también se registra
     * acá —para que el feed de "últimos movimientos" sea una sola consulta—,
     * pero el hilo los compone por su cuenta desde derivaciones y mensajes,
     * con destinatarios, adjuntos y estado de acuse. Si el hilo también los
     * leyera de acá, saldrían duplicados.
     */
    public const TIPOS_HITO = ['archivada', 'desarchivada'];

    protected $fillable = ['correspondencia_id', 'usuario_id', 'tipo', 'texto'];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
