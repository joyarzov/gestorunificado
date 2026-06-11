<?php
namespace App\Http\Controllers;

use App\Models\FirmaSello;
use App\Services\FirmaGobService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class FirmaSelloController extends Controller
{
    /** Reglas compartidas de las opciones del sello v2. */
    private const REGLAS_V2 = [
        'texto_linea3'      => 'nullable|string|max:120',
        'mostrar_cargo'     => 'nullable|boolean',
        'mostrar_rut'       => 'nullable|boolean',
        'mostrar_fecha'     => 'nullable|boolean',
        'formato_fecha'     => 'nullable|in:fecha_hora,fecha,larga',
        'layout'            => 'nullable|in:horizontal,vertical,solo_texto,compacto',
        'borde_estilo'      => 'nullable|in:solido,doble,sin_borde',
        'borde_redondeado'  => 'nullable|boolean',
        'tamano_fuente'     => 'nullable|in:S,M,L',
        'rol_asignado'      => 'nullable|in:alcalde,admin,oficial,oirs,fomento_productivo,usuario',
    ];

    private const CAMPOS_V2 = [
        'texto_linea3', 'mostrar_cargo', 'mostrar_rut', 'mostrar_fecha', 'formato_fecha',
        'layout', 'borde_estilo', 'borde_redondeado', 'tamano_fuente', 'rol_asignado',
    ];

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
            'fondo_opacidad'     => 'nullable|integer|min:0|max:100',
            'mostrar_logo'       => 'nullable|boolean',
            'nombre_institucion' => 'nullable|string|max:200',
            'texto_linea1'       => 'nullable|string|max:100',
            'texto_linea2'       => 'nullable|string|max:100',
            ...self::REGLAS_V2,
        ]);

        $sello = FirmaSello::create([
            ...$request->only(self::CAMPOS_V2),
            'nombre'             => $request->nombre,
            'color_primario'     => $request->color_primario     ?? '#0071BC',
            'color_secundario'   => $request->color_secundario   ?? '#00467E',
            'color_fondo'        => $request->color_fondo        ?? '#EBF5FF',
            'fondo_opacidad'     => $request->input('fondo_opacidad', 100),
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
        // Se permite editar el sello activo: los cambios se reflejan en las firmas
        // NUEVAS (las ya generadas no se modifican). El preview se regenera abajo.
        $request->validate([
            'nombre'             => 'sometimes|string|max:100',
            'color_primario'     => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_secundario'   => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'color_fondo'        => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'fondo_opacidad'     => 'nullable|integer|min:0|max:100',
            'mostrar_logo'       => 'nullable|boolean',
            'nombre_institucion' => 'nullable|string|max:200',
            'texto_linea1'       => 'nullable|string|max:100',
            'texto_linea2'       => 'nullable|string|max:100',
            ...self::REGLAS_V2,
        ]);

        $firmaSello->update($request->only([
            'nombre', 'color_primario', 'color_secundario', 'color_fondo', 'fondo_opacidad',
            'mostrar_logo', 'nombre_institucion', 'texto_linea1', 'texto_linea2',
            ...self::CAMPOS_V2,
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

    /**
     * Sello del usuario autenticado con SUS datos reales (nombre, cargo con
     * sufijo (S) si subroga, RUT), usando el sello activo. Para que el modal
     * de firma muestre una miniatura fiel de cómo quedará el sello.
     */
    public function miSello()
    {
        $user = Auth::user();
        $png = app(FirmaGobService::class)->generarStampPreview(
            [],
            $user->nombre,
            $user->cargoFirma() ?? ($user->cargo ?? ''),
            $user->rut
        );

        return response(base64_decode($png), 200)
            ->header('Content-Type', 'image/png')
            ->header('Cache-Control', 'private, max-age=300');
    }

    public function preview(Request $request)
    {
        // Preview en tiempo real con parámetros del request (sin guardar)
        // Acepta POST con multipart para recibir logo temporalmente
        $config = [
            'color_primario'     => $request->input('color_primario',     '#0071BC'),
            'color_secundario'   => $request->input('color_secundario',   '#00467E'),
            'color_fondo'        => $request->input('color_fondo',        '#EBF5FF'),
            'fondo_opacidad'     => (int) $request->input('fondo_opacidad', 100),
            'mostrar_logo'       => filter_var($request->input('mostrar_logo', true), FILTER_VALIDATE_BOOLEAN),
            'nombre_institucion' => $request->input('nombre_institucion', 'Ilustre Municipalidad de Cabo de Hornos'),
            'texto_linea1'       => $request->input('texto_linea1',       'FIRMA ELECTRÓNICA AVANZADA'),
            'texto_linea2'       => $request->input('texto_linea2',       'GOBIERNO DE CHILE'),
            'texto_linea3'       => $request->input('texto_linea3', ''),
            'mostrar_cargo'      => filter_var($request->input('mostrar_cargo', true), FILTER_VALIDATE_BOOLEAN),
            'mostrar_rut'        => filter_var($request->input('mostrar_rut', true), FILTER_VALIDATE_BOOLEAN),
            'mostrar_fecha'      => filter_var($request->input('mostrar_fecha', true), FILTER_VALIDATE_BOOLEAN),
            'formato_fecha'      => $request->input('formato_fecha', 'fecha_hora'),
            'layout'             => $request->input('layout', 'horizontal'),
            'borde_estilo'       => $request->input('borde_estilo', 'solido'),
            'borde_redondeado'   => filter_var($request->input('borde_redondeado', false), FILTER_VALIDATE_BOOLEAN),
            'tamano_fuente'      => $request->input('tamano_fuente', 'M'),
            'logo_path'          => $request->input('logo_path'),
        ];

        // Si viene un logo como archivo temporal, guardarlo en /tmp y apuntar a él
        if ($request->hasFile('logo_preview')) {
            $tmpPath = $request->file('logo_preview')->store('tmp-previews', 'public');
            $config['logo_path'] = $tmpPath;
            $config['logo_tmp']  = true; // marcar para borrar después
        }

        // Vista previa con MIS datos reales (por defecto) o con datos de ejemplo
        $user = Auth::user();
        $misDatos = filter_var($request->input('mis_datos', true), FILTER_VALIDATE_BOOLEAN);

        $service = app(FirmaGobService::class);
        $pngBase64 = $service->generarStampPreview(
            $config,
            $misDatos ? $user->nombre : 'Juan Pérez González',
            $misDatos ? ($user->cargoFirma() ?? ($user->cargo ?? '')) : 'Alcalde',
            $misDatos ? $user->rut : '12345678-0'
        );

        // Limpiar archivo temporal
        if (!empty($config['logo_tmp']) && !empty($config['logo_path'])) {
            Storage::disk('public')->delete($config['logo_path']);
        }

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
