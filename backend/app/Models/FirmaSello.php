<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class FirmaSello extends Model
{
    protected $table = 'firma_sellos';

    protected $fillable = [
        'nombre', 'logo_path', 'color_primario', 'color_secundario', 'color_fondo',
        'fondo_opacidad', 'mostrar_logo', 'nombre_institucion', 'texto_linea1', 'texto_linea2',
        'texto_linea3', 'mostrar_cargo', 'mostrar_rut', 'mostrar_fecha', 'formato_fecha',
        'layout', 'borde_estilo', 'borde_redondeado', 'tamano_fuente', 'rol_asignado',
        'activo', 'preview_path', 'creado_por',
    ];

    protected $casts = [
        'mostrar_logo'     => 'boolean',
        'mostrar_cargo'    => 'boolean',
        'mostrar_rut'      => 'boolean',
        'mostrar_fecha'    => 'boolean',
        'borde_redondeado' => 'boolean',
        'activo'           => 'boolean',
        'fondo_opacidad'   => 'integer',
    ];

    /** Prioridad para elegir el sello cuando el firmante tiene varios roles. */
    private const PRIORIDAD_ROLES = ['alcalde', 'admin', 'oficial', 'oirs', 'fomento_productivo', 'usuario'];

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    /** Sello general activo (sin rol asignado). */
    public static function obtenerActivo(): ?self
    {
        return static::where('activo', true)->whereNull('rol_asignado')->first()
            ?? static::where('activo', true)->first();
    }

    /**
     * Sello para un firmante concreto: el activo asignado a su rol de mayor
     * prioridad, o el general si no tiene uno específico.
     */
    public static function obtenerParaUsuario(?User $user): ?self
    {
        if ($user) {
            $roles = $user->roles ?? [];
            foreach (self::PRIORIDAD_ROLES as $rol) {
                if (!in_array($rol, $roles, true)) {
                    continue;
                }
                $sello = static::where('activo', true)->where('rol_asignado', $rol)->first();
                if ($sello) {
                    return $sello;
                }
            }
        }
        return static::obtenerActivo();
    }

    public static function obtenerParaRut(?string $rut): ?self
    {
        $user = $rut ? User::where('rut', $rut)->first() : null;
        return static::obtenerParaUsuario($user);
    }

    /**
     * Activa este sello dentro de su ámbito: desactiva solo a los del MISMO
     * rol asignado (o a los generales si no tiene rol). Así conviven un sello
     * general activo y sellos activos por rol.
     */
    public function activar(): void
    {
        DB::transaction(function () {
            static::where('activo', true)
                ->when(
                    $this->rol_asignado,
                    fn ($q) => $q->where('rol_asignado', $this->rol_asignado),
                    fn ($q) => $q->whereNull('rol_asignado')
                )
                ->update(['activo' => false]);
            $this->update(['activo' => true]);
        });
    }
}
