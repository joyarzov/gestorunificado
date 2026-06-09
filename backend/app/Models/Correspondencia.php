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
