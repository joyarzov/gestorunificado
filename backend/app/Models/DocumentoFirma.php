<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentoFirma extends Model
{
    use HasFactory;

    protected $table = 'documento_firmas';

    protected $fillable = [
        'documento_id',
        'usuario_id',
        'actuando_como_user_id',
        'cargo_firmado',
        'tipo_firma',
        'orden',
        'estado',
        'fecha_firma',
        'observacion',
        'firma_gob_id',
        'firma_gob_data',
    ];

    protected $casts = [
        'fecha_firma' => 'datetime',
        'firma_gob_data' => 'array',
    ];

    public function documento()
    {
        return $this->belongsTo(Documento::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Subrogado en cuyo nombre se ejecutó esta firma, si aplica.
     */
    public function actuandoComo()
    {
        return $this->belongsTo(User::class, 'actuando_como_user_id');
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeFirmadas($query)
    {
        return $query->where('estado', 'firmado');
    }

    public function firmar(?string $observacion = null)
    {
        $this->update([
            'estado' => 'firmado',
            'fecha_firma' => now(),
            'observacion' => $observacion,
        ]);
    }

    public function rechazar(string $observacion)
    {
        $this->update([
            'estado' => 'rechazado',
            'fecha_firma' => now(),
            'observacion' => $observacion,
        ]);
    }
}
