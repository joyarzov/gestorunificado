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
        'cargo',
        'email',
        'roles',
        'aplicaciones_permitidas',
        'departamento_id',
        'subrogante_id',
        'subrogancia_activa',
        'subrogancia_desde',
        'subrogancia_hasta',
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
        'subrogancia_activa' => 'boolean',
        'subrogancia_desde' => 'datetime',
        'subrogancia_hasta' => 'datetime',
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

    public function subrogante()
    {
        return $this->belongsTo(User::class, 'subrogante_id');
    }

    public function subrogados()
    {
        return $this->hasMany(User::class, 'subrogante_id');
    }

    public function jefaturas()
    {
        return $this->hasMany(Departamento::class, 'jefe_id');
    }

    /**
     * Usuario al que este User está "subrogando" en la request actual.
     * Lo setea el middleware ActuandoComo cuando el cliente envía
     * X-Actuando-Como con un subrogado válido.
     */
    protected ?User $actuandoComo = null;

    public function setActuandoComo(?User $u): void
    {
        $this->actuandoComo = $u;
    }

    public function getActuandoComo(): ?User
    {
        return $this->actuandoComo;
    }

    /**
     * Roles efectivos: propios ∪ roles del subrogado si hay actuandoComo activo.
     */
    public function getRolesEfectivos(): array
    {
        $propios = $this->roles ?? [];
        if ($this->actuandoComo) {
            $propios = array_values(array_unique(array_merge(
                $propios,
                $this->actuandoComo->roles ?? []
            )));
        }
        return $propios;
    }

    // Helpers
    public function hasRole(string $role): bool
    {
        return in_array($role, $this->getRolesEfectivos());
    }

    public function hasAnyRole(array $roles): bool
    {
        return !empty(array_intersect($roles, $this->getRolesEfectivos()));
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

    public function isAlcalde(): bool
    {
        return $this->hasRole('alcalde');
    }

    public function isVisador(): bool
    {
        return $this->visador;
    }

    /**
     * ¿Este usuario está actualmente subrogado? Devuelve true si el flag está activo
     * y la fecha actual cae dentro del rango (desde/hasta nullable los hace abiertos).
     */
    public function tieneSubroganciaActiva(): bool
    {
        if (!$this->subrogancia_activa) {
            return false;
        }
        $now = now();
        if ($this->subrogancia_desde && $now->lt($this->subrogancia_desde)) {
            return false;
        }
        if ($this->subrogancia_hasta && $now->gt($this->subrogancia_hasta)) {
            return false;
        }
        return true;
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
