<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Correlativo extends Model
{
    use HasFactory;

    protected $table = 'correlativos';

    protected $fillable = [
        'tipo',
        'prefijo',
        'valor_actual',
        'anio',
        'reinicio_anual',
        'ultimo_reset',
    ];

    protected $casts = [
        'reinicio_anual' => 'boolean',
        'ultimo_reset' => 'datetime',
    ];

    /**
     * Obtiene el siguiente correlativo de forma atómica
     */
    public static function obtenerSiguiente(string $tipo): int
    {
        $anioActual = (int) date('Y');

        return DB::transaction(function () use ($tipo, $anioActual) {
            $correlativo = self::lockForUpdate()
                ->where('tipo', $tipo)
                ->first();

            if (!$correlativo) {
                $correlativo = self::create([
                    'tipo' => $tipo,
                    'prefijo' => strtoupper(substr($tipo, 0, 3)),
                    'valor_actual' => 0,
                    'anio' => $anioActual,
                    'reinicio_anual' => true,
                ]);
            }

            // Si cambió el año y tiene reinicio anual, resetear
            if ($correlativo->reinicio_anual && $correlativo->anio !== $anioActual) {
                $correlativo->valor_actual = 0;
                $correlativo->anio = $anioActual;
                $correlativo->ultimo_reset = now();
            }

            $correlativo->increment('valor_actual');

            return $correlativo->valor_actual;
        });
    }

    /**
     * Genera el número formateado
     */
    public static function generarNumero(string $tipo, ?string $prefijo = null): string
    {
        $anio = date('Y');
        $numero = self::obtenerSiguiente($tipo);

        $correlativo = self::where('tipo', $tipo)->first();
        $prefijo = $prefijo ?? $correlativo?->prefijo ?? strtoupper(substr($tipo, 0, 3));

        return sprintf('%s-%s-%06d', $prefijo, $anio, $numero);
    }
}
