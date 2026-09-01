<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Quién está conectado a la plataforma, ahora mismo.
 *
 * La señal es `users.presencia_at`, que marca ÚNICAMENTE el endpoint de
 * presencia. Antes se deducía de `personal_access_tokens.last_used_at`, pero esa
 * marca la refresca cualquier petición: bastaba con que el chat sondeara para
 * dejar verde a quien no estaba. Con una señal propia, el sondeo de presencia
 * puede detenerse cuando la persona se va del puesto —y así el verde significa
 * algo— mientras el chat sigue consultando para poder avisar de un mensaje.
 *
 * ⚠️ Ojo con la hora: MySQL corre en UTC y la aplicación en America/Punta_Arenas
 * (UTC-3). Todos los cortes se calculan con `now()` de PHP —zona de la app—, que
 * es la misma zona con que Eloquent escribió esos timestamps. Comparar contra
 * `NOW()` de MySQL da tres horas de desfase y hace parecer que no hay nadie
 * conectado.
 */
class PresenciaService
{
    /**
     * Hasta cuántos minutos desde la última señal se considera "en línea".
     *
     * Hay solo DOS estados a propósito. Un estado intermedio ("ausente")
     * prometía más de lo que el sistema puede saber y nadie sabía cómo
     * interpretarlo: para el resto se muestra "activo hace X", que es un dato
     * verificable y que no induce a error.
     *
     * El margen es amplio en relación al sondeo (cada 60 s) porque el frontend
     * deja de consultar cuando la persona se va del puesto: la marca envejece
     * sola y quien no está cae de la lista sin necesidad de otro umbral.
     *
     * Diez y no cinco: con cinco, cualquier tropiezo del sondeo —un minuto de
     * red lenta, la pestaña recién recuperada— borraba de la lista a alguien
     * que estaba sentado frente al computador.
     */
    public const MINUTOS_EN_LINEA = 10;

    /** Deja constancia de que este usuario está frente a la pantalla ahora. */
    public function registrar(User $user): void
    {
        $user->forceFill(['presencia_at' => now()])->saveQuietly();
    }

    /**
     * Última señal de presencia por usuario: [usuario_id => Carbon].
     */
    public function ultimasActividades(): Collection
    {
        return DB::table('users')
            ->whereNotNull('presencia_at')
            ->pluck('presencia_at', 'id')
            ->map(fn ($fecha) => $fecha ? Carbon::parse($fecha) : null)
            ->filter();
    }

    /**
     * Traduce una última actividad al estado que se muestra.
     *
     * @return string en_linea | desconectado
     */
    public function estado(?Carbon $visto): string
    {
        return $visto && $visto->gte(now()->subMinutes(self::MINUTOS_EN_LINEA))
            ? 'en_linea'
            : 'desconectado';
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

        $orden = ['en_linea' => 0, 'desconectado' => 1];

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
