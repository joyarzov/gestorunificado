<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Nombre del token de la sesión "propia" (perfil usuario). Solo conviven
     * con esta las sesiones de subrogancia (tokens nombrados con el prefijo
     * de abajo). Un login propio cierra otras sesiones propias, nunca las de
     * subrogancia.
     */
    private const TOKEN_PROPIO = 'usuario';
    private const TOKEN_SUBROGANCIA_PREFIX = 'subrogancia:';

    /**
     * Login con RUT y contraseña
     */
    public function login(Request $request)
    {
        $request->validate([
            'rut' => 'required|string',
            'password' => 'required|string',
            'forzar' => 'sometimes|boolean',
        ]);

        // Formatear RUT
        $rut = User::formatRut($request->rut);

        // Buscar usuario
        $user = User::where('rut', $rut)
            ->where('activo', true)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'rut' => ['RUT o contraseña incorrectos'],
            ]);
        }

        // Sesión propia (perfil usuario): si ya hay otra activa, no la cerramos
        // en silencio — pedimos confirmación. Las sesiones de subrogancia
        // (token subrogancia:*) NO se tocan: pueden convivir con esta.
        $sesionPropiaActiva = $user->tokens()->where('name', self::TOKEN_PROPIO)->exists();
        if ($sesionPropiaActiva && !$request->boolean('forzar')) {
            return $this->errorResponse(
                'Ya hay una sesión activa de este usuario en otro dispositivo o navegador. Si continúas, esa sesión se cerrará.',
                409,
                ['requiere_confirmacion' => true]
            );
        }

        // Cerrar solo las sesiones propias previas; dejar vivas las de subrogancia.
        $user->tokens()->where('name', self::TOKEN_PROPIO)->delete();

        // Registrar el último inicio de sesión (visible para el admin).
        $user->forceFill(['ultimo_acceso' => now()])->save();

        // Crear nuevo token (perfil propio)
        $token = $user->createToken(self::TOKEN_PROPIO)->plainTextToken;

        // Cargar relaciones
        $user->load('departamento');

        return $this->successResponse([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'rut' => $user->rut,
                'nombre' => $user->nombre,
                'cargo' => $user->cargo,
                'email' => $user->email,
                'roles' => $user->roles ?? [],
                'aplicaciones_permitidas' => $user->aplicaciones_permitidas,
                'departamento_id' => $user->departamento_id,
                'departamento' => $user->departamento?->nombre,
                'visador' => $user->visador,
                'puede_ver_registro_correspondencia' => (bool) $user->puede_ver_registro_correspondencia,
                'firma_desatendida_habilitada' => (bool) $user->firma_desatendida_habilitada,
                'firma_modo_preferido' => $user->firma_modo_preferido ?? 'atendido',
                'debe_cambiar_password' => (bool) $user->debe_cambiar_password,
                'subrogados_activos' => $this->subrogadosActivos($user),
            ],
        ], 'Login exitoso');
    }

    /**
     * Lista de usuarios cuya subrogancia está activa *hoy* y cuyo subrogante es $user.
     * El frontend usa esto para ofrecer "Actuar como X" en el selector de rol.
     */
    private function subrogadosActivos(User $user): array
    {
        $now = now();
        return User::where('subrogante_id', $user->id)
            ->where('subrogancia_activa', true)
            ->where('activo', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('subrogancia_desde')->orWhere('subrogancia_desde', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('subrogancia_hasta')->orWhere('subrogancia_hasta', '>=', $now);
            })
            ->get(['id', 'nombre', 'cargo', 'roles', 'departamento_id', 'subrogancia_hasta',
                'aplicaciones_permitidas', 'puede_ver_registro_correspondencia'])
            ->map(fn ($u) => [
                'id'               => $u->id,
                'nombre'           => $u->nombre,
                'cargo'            => $u->cargo,
                'roles'            => $u->roles ?? [],
                'departamento_id'  => $u->departamento_id,
                'subrogancia_hasta' => $u->subrogancia_hasta,
                // Permisos del subrogado: al subrogar se ve EXACTAMENTE lo suyo
                // (el frontend arma el menú con estos, no con los del subrogante).
                'aplicaciones_permitidas' => $u->aplicaciones_permitidas ?? [],
                'puede_ver_registro_correspondencia' => (bool) $u->puede_ver_registro_correspondencia,
            ])
            ->all();
    }

    /**
     * Emite un token de sesión de SUBROGANCIA, independiente de la sesión
     * propia. Permite operar "actuando como X" sin que un nuevo login propio
     * (en otro equipo) cierre esta sesión: el login propio solo borra tokens
     * 'usuario', no los 'subrogancia:*'.
     */
    public function subrogarToken(Request $request)
    {
        $request->validate([
            'subrogado_id' => 'required|integer',
            'forzar' => 'sometimes|boolean',
        ]);

        $user = $request->user();
        $subrogado = collect($this->subrogadosActivos($user))
            ->firstWhere('id', (int) $request->subrogado_id);

        if (!$subrogado) {
            return $this->errorResponse('No tienes una subrogancia activa para ese usuario.', 403);
        }

        $name = self::TOKEN_SUBROGANCIA_PREFIX . $subrogado['id'];

        if ($user->tokens()->where('name', $name)->exists() && !$request->boolean('forzar')) {
            return $this->errorResponse(
                "Ya hay una sesión de subrogancia activa para {$subrogado['nombre']}. Si continúas, esa sesión se cerrará.",
                409,
                ['requiere_confirmacion' => true]
            );
        }

        $user->tokens()->where('name', $name)->delete();
        $token = $user->createToken($name)->plainTextToken;

        return $this->successResponse([
            'token' => $token,
            'subrogado' => $subrogado,
        ], 'Sesión de subrogancia iniciada');
    }

    /**
     * Cierra solo la sesión de subrogancia actual (cuando el token vigente es
     * de subrogancia). Se usa al salir de "actuar como" sin tocar la sesión
     * propia.
     */
    public function subrogarLogout(Request $request)
    {
        $current = $request->user()->currentAccessToken();
        if ($current && str_starts_with($current->name, self::TOKEN_SUBROGANCIA_PREFIX)) {
            $current->delete();
        }

        return $this->successResponse(null, 'Sesión de subrogancia cerrada');
    }

    /**
     * Modo auditoría ("ver como"): el admin inicia una sesión de solo lectura
     * para ver la plataforma como el funcionario indicado. No genera token nuevo
     * (usa el propio del admin + header X-Auditar-Como); aquí solo se valida y se
     * registra en el log de auditoría, y se devuelve el perfil del funcionario
     * para que el frontend arme su vista.
     */
    public function auditarIniciar(Request $request)
    {
        $request->validate(['funcionario_id' => 'required|integer|exists:users,id']);

        $user = $request->user();
        if (!$user->hasRole('admin')) {
            return $this->errorResponse('Solo un administrador puede usar el modo auditoría.', 403);
        }

        $funcionario = User::where('id', $request->funcionario_id)->where('activo', true)->first();
        if (!$funcionario || $funcionario->id === $user->id) {
            return $this->errorResponse('Funcionario no válido para auditar.', 422);
        }

        \Log::info('AUDITORIA ver-como: inicio', [
            'admin_id' => $user->id, 'admin' => $user->nombre,
            'auditado_id' => $funcionario->id, 'auditado' => $funcionario->nombre,
            'ip' => $request->ip(),
        ]);

        return $this->successResponse([
            'funcionario' => [
                'id' => $funcionario->id,
                'nombre' => $funcionario->nombre,
                'cargo' => $funcionario->cargo,
                'roles' => $funcionario->roles ?? [],
                'aplicaciones_permitidas' => $funcionario->aplicaciones_permitidas ?? [],
                'departamento_id' => $funcionario->departamento_id,
                'puede_ver_registro_correspondencia' => (bool) $funcionario->puede_ver_registro_correspondencia,
            ],
        ], 'Modo auditoría iniciado');
    }

    /** Registra el fin de una sesión de auditoría (el frontend limpia el header). */
    public function auditarLogout(Request $request)
    {
        \Log::info('AUDITORIA ver-como: fin', ['admin_id' => $request->user()->id]);

        return $this->successResponse(null, 'Modo auditoría finalizado');
    }

    /**
     * Cerrar sesión
     */
    public function logout(Request $request)
    {
        // Revocar token actual
        $request->user()->currentAccessToken()->delete();

        return $this->successResponse(null, 'Sesión cerrada correctamente');
    }

    /**
     * Obtener usuario autenticado
     */
    public function me(Request $request)
    {
        $user = $request->user();
        $user->load(['departamento', 'subrogante:id,nombre,cargo']);

        return $this->successResponse([
            'id' => $user->id,
            'rut' => $user->rut,
            'nombre' => $user->nombre,
            'cargo' => $user->cargo,
            'email' => $user->email,
            'roles' => $user->roles ?? [],
            'aplicaciones_permitidas' => $user->aplicaciones_permitidas,
            'departamento_id' => $user->departamento_id,
            'departamento' => $user->departamento?->nombre,
            'subrogante_id' => $user->subrogante_id,
            'subrogante' => $user->subrogante ? [
                'id' => $user->subrogante->id,
                'nombre' => $user->subrogante->nombre,
                'cargo' => $user->subrogante->cargo,
            ] : null,
            'subrogancia_activa' => $user->subrogancia_activa,
            'subrogancia_desde' => $user->subrogancia_desde,
            'subrogancia_hasta' => $user->subrogancia_hasta,
            'subrogados_activos' => $this->subrogadosActivos($user),
            'visador' => $user->visador,
            'puede_ver_registro_correspondencia' => (bool) $user->puede_ver_registro_correspondencia,
            'firma_desatendida_habilitada' => (bool) $user->firma_desatendida_habilitada,
            'firma_modo_preferido' => $user->firma_modo_preferido ?? 'atendido',
            'debe_cambiar_password' => (bool) $user->debe_cambiar_password,
            'activo' => $user->activo,
        ]);
    }

    /**
     * Actualizar perfil del usuario autenticado
     */
    public function updateProfile(Request $request)
    {
        $request->validate([
            'cargo' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $user->update($request->only('cargo'));
        $user->load('departamento');

        return $this->successResponse([
            'id' => $user->id,
            'rut' => $user->rut,
            'nombre' => $user->nombre,
            'cargo' => $user->cargo,
            'email' => $user->email,
            'roles' => $user->roles ?? [],
            'aplicaciones_permitidas' => $user->aplicaciones_permitidas,
            'departamento_id' => $user->departamento_id,
            'departamento' => $user->departamento?->nombre,
            'visador' => $user->visador,
            'puede_ver_registro_correspondencia' => (bool) $user->puede_ver_registro_correspondencia,
        ], 'Perfil actualizado correctamente');
    }

    /**
     * Cambiar contraseña
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:6|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['La contraseña actual es incorrecta'],
            ]);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'debe_cambiar_password' => false,
        ]);

        return $this->successResponse(null, 'Contraseña actualizada correctamente');
    }
}
