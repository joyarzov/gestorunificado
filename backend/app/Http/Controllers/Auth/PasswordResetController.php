<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\NotificacionMail;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Restablecimiento de contraseña por correo (self-service).
 *
 * Diseño de seguridad:
 * - Respuesta SIEMPRE genérica al solicitar (no revela si el RUT existe
 *   ni si tiene correo) → sin enumeración de usuarios.
 * - Token aleatorio de 64 caracteres; en BD solo se guarda su sha256.
 * - Un token activo por usuario, caduca a los 60 minutos y es de un solo
 *   uso (se borra al restablecer).
 * - Cooldown de reenvío para no spamear el correo del usuario.
 * - Al restablecer se revocan TODOS los tokens Sanctum (cierra sesiones)
 *   y se avisa por correo del cambio.
 * - Ambos endpoints van con throttle en rutas.
 */
class PasswordResetController extends Controller
{
    private const TOKEN_TTL_MINUTES = 60;
    private const COOLDOWN_MINUTES = 2;

    public function solicitar(Request $request)
    {
        $request->validate(['rut' => 'required|string|max:12']);

        $generic = $this->successResponse(
            null,
            'Si el RUT corresponde a un usuario con correo registrado, enviaremos un enlace para restablecer la contraseña.'
        );

        $user = User::where('rut', $request->rut)->where('activo', true)->first();
        if (!$user || empty($user->email) || !filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
            return $generic;
        }

        $existente = DB::table('password_resets_usuarios')->where('user_id', $user->id)->first();
        if ($existente && Carbon::parse($existente->created_at)->gt(now()->subMinutes(self::COOLDOWN_MINUTES))) {
            return $generic;
        }

        $token = Str::random(64);
        DB::table('password_resets_usuarios')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'token_hash' => hash('sha256', $token),
                'expires_at' => now()->addMinutes(self::TOKEN_TTL_MINUTES),
                'created_at' => now(),
            ]
        );

        try {
            Mail::to($user->email)->queue(new NotificacionMail(
                $user->nombre,
                'sistema',
                'Restablecimiento de contraseña',
                'Recibimos una solicitud para restablecer tu contraseña en la plataforma municipal. '
                    . 'Usa el botón para crear una nueva; el enlace es válido por ' . self::TOKEN_TTL_MINUTES . ' minutos y solo puede usarse una vez. '
                    . 'Si no solicitaste este cambio, ignora este correo: tu contraseña actual sigue vigente.',
                ['url' => '/restablecer-password?token=' . $token]
            ));
        } catch (\Throwable $e) {
            Log::warning("PasswordReset: no se pudo encolar email para user {$user->id}: " . $e->getMessage());
        }

        return $generic;
    }

    public function restablecer(Request $request)
    {
        $request->validate([
            'token' => 'required|string|size:64',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $row = DB::table('password_resets_usuarios')
            ->where('token_hash', hash('sha256', $request->token))
            ->first();

        if (!$row || Carbon::parse($row->expires_at)->isPast()) {
            return $this->errorResponse('El enlace no es válido o ya expiró. Solicita uno nuevo.', 422);
        }

        $user = User::where('id', $row->user_id)->where('activo', true)->first();
        if (!$user) {
            return $this->errorResponse('El enlace no es válido o ya expiró. Solicita uno nuevo.', 422);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Un solo uso + cerrar todas las sesiones activas del usuario.
        DB::table('password_resets_usuarios')->where('user_id', $user->id)->delete();
        $user->tokens()->delete();

        try {
            Mail::to($user->email)->queue(new NotificacionMail(
                $user->nombre,
                'sistema',
                'Tu contraseña fue cambiada',
                'La contraseña de tu cuenta en la plataforma municipal acaba de ser restablecida y se cerraron todas tus sesiones. '
                    . 'Si no fuiste tú, contacta de inmediato al administrador del sistema.',
                []
            ));
        } catch (\Throwable $e) {
            Log::warning("PasswordReset: no se pudo encolar aviso de cambio para user {$user->id}: " . $e->getMessage());
        }

        return $this->successResponse(null, 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.');
    }
}
