<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'rut',
        'password',
        'nombre',
        'email',
        'roles',
        'aplicaciones_permitidas',
        'departamento_id',
        'activo',
        'visador',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'roles' => 'array',
        'aplicaciones_permitidas' => 'array',
        'activo' => 'boolean',
        'visador' => 'boolean',
    ];

    // Relaciones
    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }

    public function correspondencias()
    {
        return $this->hasMany(Correspondencia::class, 'usuario_id');
    }

    public function derivacionesEnviadas()
    {
        return $this->hasMany(Derivacion::class, 'usuario_origen_id');
    }

    public function derivacionesRecibidas()
    {
        return $this->hasMany(Derivacion::class, 'usuario_destino_id');
    }

    public function notificaciones()
    {
        return $this->hasMany(Notificacion::class);
    }

    public function documentosCreados()
    {
        return $this->hasMany(Documento::class, 'usuario_creador_id');
    }

    public function firmas()
    {
        return $this->hasMany(DocumentoFirma::class, 'usuario_id');
    }

    // Helpers
    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles ?? []);
    }

    public function hasAnyRole(array $roles): bool
    {
        return !empty(array_intersect($roles, $this->roles ?? []));
    }

    public function hasAplicacion(string $app): bool
    {
        // Si no hay restricción, tiene acceso a todo
        if (empty($this->aplicaciones_permitidas)) {
            return true;
        }
        return in_array($app, $this->aplicaciones_permitidas);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    public function isOficial(): bool
    {
        return $this->hasRole('oficial');
    }

    public function isVisador(): bool
    {
        return $this->visador;
    }

    // Formatear RUT
    public static function formatRut(string $rut): string
    {
        $rut = preg_replace('/[^0-9kK]/', '', $rut);
        if (strlen($rut) >= 2) {
            return substr($rut, 0, -1) . '-' . strtoupper(substr($rut, -1));
        }
        return $rut;
    }
}
