<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Configuracion extends Model
{
    protected $table      = 'configuracion';
    protected $primaryKey = 'clave';
    public    $incrementing = false;
    protected $keyType    = 'string';

    protected $fillable = ['clave', 'valor', 'descripcion'];

    /**
     * Obtiene el valor de una clave de configuración.
     */
    public static function get(string $clave, mixed $default = null): mixed
    {
        $row = static::find($clave);
        return $row !== null ? $row->valor : $default;
    }

    /**
     * Establece el valor de una clave de configuración.
     */
    public static function set(string $clave, mixed $valor): void
    {
        static::updateOrCreate(
            ['clave' => $clave],
            ['valor' => (string) $valor]
        );
    }
}
