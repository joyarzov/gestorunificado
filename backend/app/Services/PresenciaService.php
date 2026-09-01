<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Quién está conectado a la plataforma, ahora mismo.
 *
 * No hace falta un "latido" propio ni WebSockets: cada petición autenticada
 * refresca `personal_access_tokens.last_used_at`, y el sondeo de la campana de
 * notificaciones (cada 30 s mientras la pestaña esté abierta) lo mantiene
 * fresco solo. La presencia es, entonces, un efecto secundario gratuito de algo
 * que la aplicación ya hacía.
 *
 * Es la MISMA noción que usa AuthController::sesionPropiaViva() para avisar
 * "su sesión ya está en uso": si allá se considera viva, aquí se ve conectado.
 *
 * ⚠️ Ojo con la hora: MySQL corre en UTC y la aplicación en America/Punta_Arenas
 * (UTC-3). Todos los cortes se calculan con `now()` de PHP —zona de la app—, que
 * es la misma zona con que Eloquent escribió esos timestamps. Comparar contra
 * `NOW()` de MySQL da tres horas de desfase y hace parecer que no hay nadie
 * conectado.
 */
class PresenciaService
{
    /** Nombre del token de sesión de usuario (AuthController::TOKEN_PROPIO). */
    public const TOKEN_SESION = 'usuario';

    /** Hasta cuántos minutos de inactividad se considera "en línea". */
    public const MINUTOS_EN_LINEA = 5;

    /**
     * Hasta cuántos minutos se considera "ausente" (pestaña abierta, persona no).
     * Coincide con AuthController::MINUTOS_INACTIVIDAD: pasado ese punto, la
     * sesión ya no se considera viva en ninguna parte del sistema.
     */
    public const MINUTOS_AUSENTE = 30;

    /**
     * Última actividad registrada por usuario: [usuario_id => Carbon].
     *
     * Solo cuenta los tokens de sesión de usuario. Los tokens de servicio o de
     * verificación no representan a una persona sentada frente a la pantalla.
     */
    public function ultimasActividades(): Collection
    {
        return DB::table('personal_access_tokens')
            ->where('tokenable_type', User::class)
            ->where('name', self::TOKEN_SESION)
            ->whereNotNull('last_used_at')
            ->groupBy('tokenable_id')
            ->select('tokenable_id', DB::raw('MAX(last_used_at) as visto'))
            ->pluck('visto', 'tokenable_id')
            ->map(fn ($fecha) => $fecha ? Carbon::parse($fecha) : null)
            ->filter();
    }

    /**
     * Traduce una última actividad al estado que se muestra.
     *
     * @return string en_linea | ausente | desconectado
     */
    public function estado(?Carbon $visto): string
    {
        if (!$visto) {
            return 'desconectado';
        }
        if ($visto->gte(now()->subMinutes(self::MINUTOS_EN_LINEA))) {
            return 'en_linea';
        }
        if ($visto->gte(now()->subMinutes(self::MINUTOS_AUSENTE))) {
            return 'ausente';
        }

        return 'desconectado';
    }

    /**
     * Listado de usuarios activos con su estado de presencia, ordenado para
     * mostrarse tal cual: primero los conectados, después los ausentes, y el
     * resto por nombre.
     *
     * @param  User  $solicitante  Se excluye a sí mismo del listado.
     */
    public function listado(User $solicitante): array
    {
        $actividades = $this->ultimasActividades();

        $usuarios = User::where('activo', true)
            ->where('id', '!=', $solicitante->id)
            ->with('departamento:id,nombre')
            ->get(['id', 'nombre', 'cargo', 'departamento_id']);

        $orden = ['en_linea' => 0, 'ausente' => 1, 'desconectado' => 2];

        return $usuarios
            ->map(function (User $u) use ($actividades) {
                $visto = $actividades[$u->id] ?? null;

                return [
                    'id'           => $u->id,
                    'nombre'       => $u->nombre,
                    'cargo'        => $u->cargo,
                    'departamento' => $u->departamento?->nombre,
                    'estado'       => $this->estado($visto),
                    // Se manda el instante, no un texto: el frontend decide cómo
                    // redactarlo ("hace 3 min", "ayer 17:40") según el idioma.
                    'visto_at'     => $visto?->toIso8601String(),
                ];
            })
            // Clave compuesta: el estado manda, y dentro de cada grupo va el
            // nombre. Más simple que encadenar criterios y con el mismo efecto.
            ->sortBy(fn ($u) => $orden[$u['estado']] . '-' . mb_strtolower($u['nombre']))
            ->values()
            ->all();
    }
}
