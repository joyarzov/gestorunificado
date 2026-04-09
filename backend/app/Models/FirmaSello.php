<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class FirmaSello extends Model
{
    protected $table = 'firma_sellos';

    protected $fillable = [
        'nombre', 'logo_path', 'color_primario', 'color_secundario', 'color_fondo',
        'mostrar_logo', 'nombre_institucion', 'texto_linea1', 'texto_linea2',
        'activo', 'preview_path', 'creado_por',
    ];

    protected $casts = [
        'mostrar_logo' => 'boolean',
        'activo'       => 'boolean',
    ];

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public static function obtenerActivo(): ?self
    {
        return static::where('activo', true)->first();
    }

    public function activar(): void
    {
        DB::transaction(function () {
            static::where('activo', true)->update(['activo' => false]);
            $this->update(['activo' => true]);
        });
    }
}
