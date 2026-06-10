<?php

namespace App\Services;

use App\Mail\NotificacionMail;
use App\Models\Notificacion;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Punto único para emitir notificaciones. Crea la notificación in-app (campana)
 * y encola el email correspondiente. Cualquier módulo (actual o futuro) debe
 * notificar a través de aquí para obtener ambos canales y el etiquetado por módulo.
 */
class NotificacionService
{
    /**
     * Notifica a uno o varios usuarios.
     *
     * @param  User|int|iterable  $destinatarios  Usuario(s) o id(s)
     * @param  string  $modulo  clave del módulo (config/notificaciones.php): cero_papel|correspondencia|oirs|...
     * @param  string  $tipo    tipo de evento (string libre, ej. documento_pendiente_firma)
     * @param  array   $data    payload; usar 'url' para el enlace al frontend
     */
    public static function enviar(
        $destinatarios,
        string $modulo,
        string $tipo,
        string $titulo,
        string $mensaje,
        array $data = []
    ): void {
        $data['modulo'] = $modulo; // disponible también dentro del payload para el frontend

        $directos = [];
        foreach (self::resolverUsuarios($destinatarios) as $user) {
            if (!$user || !$user->id || !($user->activo ?? true)) {
                continue;
            }
            $directos[$user->id] = $user;
        }

        foreach ($directos as $user) {
            $notif = Notificacion::create([
                'user_id' => $user->id,
                'modulo'  => $modulo,
                'tipo'    => $tipo,
                'titulo'  => $titulo,
                'mensaje' => $mensaje,
                'data'    => $data,
            ]);

            self::encolarEmail($user, $notif, $modulo, $titulo, $mensaje, $data);
        }

        // Subrogancia: si un destinatario está ausente (subrogancia activa), su
        // subrogante recibe un aviso espejo para que nada quede sin ver. No se
        // duplica si el subrogante ya era destinatario directo, y no cascadea
        // (el subrogante del subrogante no se notifica).
        foreach ($directos as $user) {
            if (!$user->subrogante_id || !$user->tieneSubroganciaActiva()) {
                continue;
            }
            if (isset($directos[$user->subrogante_id])) {
                continue;
            }
            $subrogante = User::find($user->subrogante_id);
            if (!$subrogante || !$subrogante->activo) {
                continue;
            }

            $mensajeEspejo = "Para {$user->nombre}, a quien subrogas: {$mensaje}";
            $dataEspejo = $data + ['subrogado_de' => ['id' => $user->id, 'nombre' => $user->nombre]];

            $notif = Notificacion::create([
                'user_id' => $subrogante->id,
                'modulo'  => $modulo,
                'tipo'    => $tipo,
                'titulo'  => $titulo,
                'mensaje' => $mensajeEspejo,
                'data'    => $dataEspejo,
            ]);

            self::encolarEmail($subrogante, $notif, $modulo, $titulo, $mensajeEspejo, $dataEspejo);
        }
    }

    private static function encolarEmail(User $user, Notificacion $notif, string $modulo, string $titulo, string $mensaje, array $data): void
    {
        if (empty($user->email) || !filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        try {
            Mail::to($user->email)->queue(
                new NotificacionMail($user->nombre ?? '', $modulo, $titulo, $mensaje, $data)
            );
            $notif->forceFill(['email_enviado_at' => now()])->saveQuietly();
        } catch (\Throwable $e) {
            // No romper el flujo de negocio si el correo falla; la notificación in-app ya quedó.
            Log::warning("NotificacionService: no se pudo encolar email para user {$user->id}: " . $e->getMessage());
        }
    }

    /**
     * @return iterable<User>
     */
    private static function resolverUsuarios($destinatarios): iterable
    {
        if ($destinatarios instanceof User) {
            return [$destinatarios];
        }
        if (is_numeric($destinatarios)) {
            $u = User::find($destinatarios);
            return $u ? [$u] : [];
        }

        $users = [];
        $idsAResolver = [];
        foreach ($destinatarios as $d) {
            if ($d instanceof User) {
                $users[$d->id] = $d;
            } elseif (is_numeric($d)) {
                $idsAResolver[] = (int) $d;
            }
        }
        if ($idsAResolver) {
            foreach (User::whereIn('id', array_unique($idsAResolver))->get() as $u) {
                $users[$u->id] = $u;
            }
        }
        return array_values($users);
    }
}
