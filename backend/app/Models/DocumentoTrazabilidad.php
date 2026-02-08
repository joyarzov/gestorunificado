<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class DocumentoTrazabilidad extends Model
{
    protected $table = 'documento_trazabilidades';

    protected $fillable = [
        'documento_id',
        'usuario_id',
        'accion',
        'descripcion',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function documento()
    {
        return $this->belongsTo(Documento::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class);
    }

    public static function registrar(int $documentoId, string $accion, string $descripcion, ?array $metadata = null): self
    {
        return self::create([
            'documento_id' => $documentoId,
            'usuario_id' => Auth::id(),
            'accion' => $accion,
            'descripcion' => $descripcion,
            'metadata' => $metadata,
        ]);
    }
}
