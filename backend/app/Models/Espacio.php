<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Espacio municipal reservable (sala de concejo, etc.). Cada uno tiene uno o
 * más administradores que crean reservas directas y aprueban/rechazan las
 * solicitudes de los funcionarios.
 */
class Espacio extends Model
{
    protected $table = 'espacios';

    protected $fillable = [
        'nombre',
        'descripcion',
        'ubicacion',
        'capacidad',
        'color',
        'activo',
        'creado_por',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'capacidad' => 'integer',
    ];

    public function administradores()
    {
        return $this->belongsToMany(User::class, 'espacio_administradores', 'espacio_id', 'user_id')
            ->withTimestamps();
    }

    public function reservas()
    {
        return $this->hasMany(Reserva::class);
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    /** ¿Este usuario es administrador de este espacio? (o admin de plataforma). */
    public function esAdministrador(User $user): bool
    {
        if ($user->isAdmin()) {
            return true;
        }
        return $this->administradores()->where('users.id', $user->id)->exists();
    }
}
