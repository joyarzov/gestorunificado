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
     * Login con RUT y contraseña
     */
    public function login(Request $request)
    {
        $request->validate([
            'rut' => 'required|string',
            'password' => 'required|string',
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

        // Revocar tokens anteriores
        $user->tokens()->delete();

        // Crear nuevo token
        $token = $user->createToken('auth_token')->plainTextToken;

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
            ->get(['id', 'nombre', 'cargo', 'roles', 'departamento_id', 'subrogancia_hasta'])
            ->map(fn ($u) => [
                'id'               => $u->id,
                'nombre'           => $u->nombre,
                'cargo'            => $u->cargo,
                'roles'            => $u->roles ?? [],
                'departamento_id'  => $u->departamento_id,
                'subrogancia_hasta' => $u->subrogancia_hasta,
            ])
            ->all();
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
        ]);

        return $this->successResponse(null, 'Contraseña actualizada correctamente');
    }
}
