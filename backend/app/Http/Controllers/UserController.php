<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\OnboardingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with('departamento');

        if ($request->has('activo')) {
            $query->where('activo', $request->boolean('activo'));
        }

        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }

        $users = $query->orderBy('nombre')->paginate($request->input('per_page', 50));

        return $this->successResponse($users);
    }

    public function funcionarios()
    {
        // El admin es una cuenta técnica: NO debe aparecer como opción operativa
        // (firmante, destinatario de correspondencia/documentos, jefatura, OIRS…).
        // Este endpoint alimenta todos esos selectores, así que se filtra aquí.
        $funcionarios = User::where('activo', true)
            ->whereJsonDoesntContain('roles', 'admin')
            ->orderBy('nombre')
            ->get(['id', 'rut', 'nombre', 'cargo', 'departamento_id', 'roles']);

        return $this->successResponse($funcionarios);
    }

    public function store(Request $request)
    {
        $request->validate([
            'rut' => 'required|string|max:12|unique:users,rut',
            'password' => 'required|string|min:6',
            'nombre' => 'required|string|max:100',
            'cargo' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:150',
            'roles' => 'required|array',
            'aplicaciones_permitidas' => 'nullable|array',
            'departamento_id' => 'nullable|exists:departamentos,id',
            'visador' => 'sometimes|boolean',
            'puede_ver_registro_correspondencia' => 'sometimes|boolean',
        ]);

        $rut = User::formatRut($request->rut);

        $user = User::create([
            'rut' => $rut,
            'password' => Hash::make($request->password),
            'nombre' => $request->nombre,
            'cargo' => $request->cargo,
            'email' => $request->email,
            'roles' => $request->roles,
            'aplicaciones_permitidas' => $request->aplicaciones_permitidas,
            'departamento_id' => $request->departamento_id,
            'visador' => $request->boolean('visador'),
            'puede_ver_registro_correspondencia' => $request->boolean('puede_ver_registro_correspondencia'),
            'activo' => true,
        ]);

        $user->load('departamento');

        return $this->successResponse($user, 'Usuario creado', 201);
    }

    public function show(User $user)
    {
        $user->load('departamento');

        return $this->successResponse($user);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'nombre' => 'sometimes|required|string|max:100',
            'cargo' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:150',
            'password' => 'nullable|string|min:6',
            'roles' => 'sometimes|array',
            'aplicaciones_permitidas' => 'nullable|array',
            'departamento_id' => 'nullable|exists:departamentos,id',
            'visador' => 'sometimes|boolean',
            'puede_ver_registro_correspondencia' => 'sometimes|boolean',
        ]);

        $data = $request->only([
            'nombre',
            'cargo',
            'email',
            'roles',
            'aplicaciones_permitidas',
            'departamento_id',
            'visador',
            'puede_ver_registro_correspondencia',
        ]);

        // Solo actualizar contraseña si viene con valor
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        $user->load('departamento');

        return $this->successResponse($user, 'Usuario actualizado');
    }

    public function destroy(User $user)
    {
        $user->update(['activo' => false]);

        // El bloqueo es inmediato: se revocan todas sus sesiones activas,
        // no solo se impide el próximo login.
        $user->tokens()->delete();

        return $this->successResponse(null, 'Usuario desactivado');
    }

    public function activar(User $user)
    {
        $user->update(['activo' => true]);

        return $this->successResponse($user, 'Usuario activado');
    }

    public function cambiarPassword(Request $request, User $user)
    {
        $request->validate([
            'password' => 'required|string|min:6|confirmed',
        ]);

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return $this->successResponse(null, 'Contraseña actualizada');
    }

    /**
     * Envía al usuario un correo de acceso con una contraseña temporal y lo deja
     * obligado a cambiarla en el próximo inicio de sesión. Dos modalidades:
     *  - 'bienvenida': correo de incorporación con instrucciones (certificado, red).
     *  - 'reset': solo restablecimiento de la contraseña.
     */
    public function enviarAcceso(Request $request, User $user, OnboardingService $onboarding)
    {
        $request->validate([
            'tipo' => 'required|in:bienvenida,reset',
        ]);

        try {
            $onboarding->enviar($user, $request->tipo);
        } catch (\Throwable $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }

        $mensaje = $request->tipo === 'reset'
            ? "Contraseña restablecida. Se envió la nueva clave temporal a {$user->email}."
            : "Correo de bienvenida enviado a {$user->email}.";

        return $this->successResponse(null, $mensaje);
    }
}
