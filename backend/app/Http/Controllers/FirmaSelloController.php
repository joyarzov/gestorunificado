<?php
namespace App\Http\Controllers;

use App\Models\FirmaSello;
use App\Services\FirmaGobService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class FirmaSelloController extends Controller
{
    public function index()
    {
        $sellos = FirmaSello::with('creador')
            ->orderByDesc('activo')
            ->orderByDesc('created_at')
            ->get();

        return $this->successResponse($sellos);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nombre'             => 'required|string|max:100',
            'color_primario'     => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_secundario'   => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_fondo'        => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'mostrar_logo'       => 'nullable|boolean',
            'nombre_institucion' => 'nullable|string|max:200',
            'texto_linea1'       => 'nullable|string|max:100',
            'texto_linea2'       => 'nullable|string|max:100',
        ]);

        $sello = FirmaSello::create([
            'nombre'             => $request->nombre,
            'color_primario'     => $request->color_primario     ?? '#0071BC',
            'color_secundario'   => $request->color_secundario   ?? '#00467E',
            'color_fondo'        => $request->color_fondo        ?? '#EBF5FF',
            'mostrar_logo'       => $request->boolean('mostrar_logo', true),
            'nombre_institucion' => $request->nombre_institucion ?? 'Ilustre Municipalidad de Cabo de Hornos',
            'texto_linea1'       => $request->texto_linea1       ?? 'FIRMA ELECTRÓNICA AVANZADA',
            'texto_linea2'       => $request->texto_linea2       ?? 'GOBIERNO DE CHILE',
            'activo'             => false,
            'creado_por'         => Auth::id(),
        ]);

        // Generar preview
        $this->generarYGuardarPreview($sello);

        $sello->load('creador');
        return $this->successResponse($sello, 'Diseño guardado', 201);
    }

    public function show(FirmaSello $firmaSello)
    {
        $firmaSello->load('creador');
        return $this->successResponse($firmaSello);
    }

    public function update(Request $request, FirmaSello $firmaSello)
    {
        if ($firmaSello->activo) {
            return $this->errorResponse('No se puede editar el sello activo. Desactívalo primero activando otro.', 422);
        }

        $request->validate([
            'nombre'             => 'sometimes|string|max:100',
            'color_primario'     => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_secundario'   => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_fondo'        => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'mostrar_logo'       => 'nullable|boolean',
            'nombre_institucion' => 'nullable|string|max:200',
            'texto_linea1'       => 'nullable|string|max:100',
            'texto_linea2'       => 'nullable|string|max:100',
        ]);

        $firmaSello->update($request->only([
            'nombre', 'color_primario', 'color_secundario', 'color_fondo',
            'mostrar_logo', 'nombre_institucion', 'texto_linea1', 'texto_linea2',
        ]));

        $this->generarYGuardarPreview($firmaSello);

        $firmaSello->load('creador');
        return $this->successResponse($firmaSello, 'Diseño actualizado');
    }

    public function destroy(FirmaSello $firmaSello)
    {
        if ($firmaSello->activo) {
            return $this->errorResponse('No se puede eliminar el sello activo.', 422);
        }

        if ($firmaSello->logo_path) {
            Storage::disk('public')->delete($firmaSello->logo_path);
        }
        if ($firmaSello->preview_path) {
            Storage::disk('public')->delete($firmaSello->preview_path);
        }

        $firmaSello->delete();
        return $this->successResponse(null, 'Diseño eliminado');
    }

    public function subirLogo(Request $request, FirmaSello $firmaSello)
    {
        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg|max:2048',
        ]);

        if ($firmaSello->logo_path) {
            Storage::disk('public')->delete($firmaSello->logo_path);
        }

        $path = $request->file('logo')->store('firma-sellos/logos', 'public');
        $firmaSello->update(['logo_path' => $path]);

        $this->generarYGuardarPreview($firmaSello);

        return $this->successResponse($firmaSello, 'Logo subido');
    }

    public function activar(FirmaSello $firmaSello)
    {
        $firmaSello->activar();
        $firmaSello->load('creador');
        return $this->successResponse($firmaSello, "Sello \"{$firmaSello->nombre}\" activado");
    }

    public function preview(Request $request)
    {
        // Preview en tiempo real con parámetros del request (sin guardar)
        $config = [
            'color_primario'     => $request->get('color_primario',     '#0071BC'),
            'color_secundario'   => $request->get('color_secundario',   '#00467E'),
            'color_fondo'        => $request->get('color_fondo',        '#EBF5FF'),
            'mostrar_logo'       => filter_var($request->get('mostrar_logo', true), FILTER_VALIDATE_BOOLEAN),
            'nombre_institucion' => $request->get('nombre_institucion', 'Ilustre Municipalidad de Cabo de Hornos'),
            'texto_linea1'       => $request->get('texto_linea1',       'FIRMA ELECTRÓNICA AVANZADA'),
            'texto_linea2'       => $request->get('texto_linea2',       'GOBIERNO DE CHILE'),
            'logo_path'          => $request->get('logo_path'),
        ];

        $service = app(FirmaGobService::class);
        $pngBase64 = $service->generarStampPreview(
            $config,
            'Juan Pérez González',
            'Alcalde',
            '12345678-0'
        );

        $pngData = base64_decode($pngBase64);
        return response($pngData, 200)->header('Content-Type', 'image/png');
    }

    private function generarYGuardarPreview(FirmaSello $sello): void
    {
        try {
            $config = $sello->toArray();
            $service = app(FirmaGobService::class);
            $pngBase64 = $service->generarStampPreview(
                $config,
                'Juan Pérez González',
                'Alcalde',
                '12345678-0'
            );

            $pngData = base64_decode($pngBase64);
            $path = 'firma-sellos/previews/sello_' . $sello->id . '.png';
            Storage::disk('public')->put($path, $pngData);
            $sello->update(['preview_path' => $path]);
        } catch (\Exception $e) {
            // Preview no crítico, no fallar
        }
    }
}
