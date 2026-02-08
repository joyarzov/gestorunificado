<?php

namespace App\Http\Controllers;

use App\Models\User;
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
        $funcionarios = User::where('activo', true)
            ->orderBy('nombre')
            ->get(['id', 'rut', 'nombre', 'cargo', 'departamento_id']);

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
        ]);

        $data = $request->only([
            'nombre',
            'cargo',
            'email',
            'roles',
            'aplicaciones_permitidas',
            'departamento_id',
            'visador',
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
}
