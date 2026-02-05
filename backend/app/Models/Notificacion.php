<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notificacion extends Model
{
    use HasFactory;

    protected $table = 'notificaciones';

    protected $fillable = [
        'user_id',
        'tipo',
        'titulo',
        'mensaje',
        'data',
        'leida',
        'leida_at',
    ];

    protected $casts = [
        'data' => 'array',
        'leida' => 'boolean',
        'leida_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeNoLeidas($query)
    {
        return $query->where('leida', false);
    }

    public function marcarComoLeida()
    {
        $this->update([
            'leida' => true,
            'leida_at' => now(),
        ]);
    }
}
