<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\Expediente;
use App\Models\ExpedienteActividad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ExpedienteController extends Controller
{
    public function index(Request $request)
    {
        $query = Expediente::with(['creador', 'departamento']);

        // Filtros
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('nivel_acceso')) {
            $query->where('nivel_acceso', $request->nivel_acceso);
        }

        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_creacion', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_creacion', '<=', $request->fecha_hasta);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('identificador', 'like', "%{$search}%")
                    ->orWhere('titulo', 'like', "%{$search}%")
                    ->orWhere('asunto', 'like', "%{$search}%");
            });
        }

        $expedientes = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($expedientes);
    }

    public function store(Request $request)
    {
        $request->validate([
            'titulo' => 'required|string|max:255',
            'asunto' => 'required|string',
            'resumen' => 'nullable|string',
            'nivel_acceso' => 'required|integer|in:1,2,3,4',
            'informacion_sensible' => 'boolean',
            'cpat_codigo' => 'nullable|string|max:50',
            'cpat_nombre' => 'nullable|string|max:255',
        ]);

        DB::beginTransaction();
        try {
            $identificador = Expediente::generarIdentificador();

            $expediente = Expediente::create([
                'identificador' => $identificador,
                'titulo' => $request->titulo,
                'asunto' => $request->asunto,
                'resumen' => $request->resumen,
                'nivel_acceso' => $request->nivel_acceso ?? 1,
                'informacion_sensible' => $request->boolean('informacion_sensible', false),
                'cpat_codigo' => $request->cpat_codigo,
                'cpat_nombre' => $request->cpat_nombre,
                'departamento_id' => Auth::user()->departamento_id,
                'estado' => 'borrador',
                'fecha_creacion' => now(),
                'creado_por' => Auth::id(),
            ]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => Auth::id(),
                'tipo' => 'creacion',
                'descripcion' => 'Expediente creado',
            ]);

            DB::commit();

            $expediente->load(['creador', 'departamento']);

            return $this->successResponse($expediente, 'Expediente creado', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al crear expediente: ' . $e->getMessage(), 500);
        }
    }

    public function show(Expediente $expediente)
    {
        $expediente->load([
            'creador',
            'departamento',
            'documentos',
            'actividades.usuario',
        ]);

        // Agregar atributos computados
        $expediente->nivel_acceso_texto = $expediente->nivel_acceso_texto;
        $expediente->estado_texto = $expediente->estado_texto;

        return $this->successResponse($expediente);
    }

    public function update(Request $request, Expediente $expediente)
    {
        $request->validate([
            'titulo' => 'sometimes|string|max:255',
            'asunto' => 'sometimes|string',
            'resumen' => 'nullable|string',
            'nivel_acceso' => 'sometimes|integer|in:1,2,3,4',
            'informacion_sensible' => 'boolean',
            'cpat_codigo' => 'nullable|string|max:50',
            'cpat_nombre' => 'nullable|string|max:255',
        ]);

        $cambios = [];
        $campos = ['titulo', 'asunto', 'resumen', 'nivel_acceso', 'cpat_codigo'];
        foreach ($campos as $campo) {
            if ($request->has($campo) && $expediente->$campo !== $request->$campo) {
                $cambios[$campo] = ['anterior' => $expediente->$campo, 'nuevo' => $request->$campo];
            }
        }

        $expediente->update($request->only([
            'titulo',
            'asunto',
            'resumen',
            'nivel_acceso',
            'informacion_sensible',
            'cpat_codigo',
            'cpat_nombre',
        ]));

        $expediente->actualizado_por = Auth::id();
        $expediente->save();

        if (!empty($cambios)) {
            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => Auth::id(),
                'tipo' => 'modificacion',
                'descripcion' => 'Expediente modificado',
                'metadata' => ['cambios' => $cambios],
            ]);
        }

        $expediente->load(['creador', 'departamento']);

        return $this->successResponse($expediente, 'Expediente actualizado');
    }

    public function cerrar(Expediente $expediente)
    {
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('El expediente ya está cerrado', 400);
        }

        $expediente->update([
            'estado' => 'cerrado',
            'fecha_cierre' => now(),
            'actualizado_por' => Auth::id(),
        ]);

        ExpedienteActividad::create([
            'expediente_id' => $expediente->id,
            'usuario_id' => Auth::id(),
            'tipo' => 'cierre',
            'descripcion' => 'Expediente cerrado',
        ]);

        return $this->successResponse($expediente, 'Expediente cerrado');
    }

    public function reabrir(Expediente $expediente)
    {
        if (!$expediente->estaCerrado()) {
            return $this->errorResponse('El expediente no está cerrado', 400);
        }

        $expediente->update([
            'estado' => 'en_tramite',
            'fecha_cierre' => null,
            'actualizado_por' => Auth::id(),
        ]);

        ExpedienteActividad::create([
            'expediente_id' => $expediente->id,
            'usuario_id' => Auth::id(),
            'tipo' => 'reapertura',
            'descripcion' => 'Expediente reabierto',
        ]);

        return $this->successResponse($expediente, 'Expediente reabierto');
    }

    public function indiceElectronico(Expediente $expediente)
    {
        $expediente->load(['documentos.firmas.usuario']);

        $indice = [
            'expediente' => [
                'identificador' => $expediente->identificador,
                'titulo' => $expediente->titulo,
                'asunto' => $expediente->asunto,
                'estado' => $expediente->estado,
                'nivel_acceso' => $expediente->nivel_acceso_texto,
                'fecha_creacion' => $expediente->fecha_creacion,
                'fecha_cierre' => $expediente->fecha_cierre,
            ],
            'documentos' => $expediente->documentos->map(function ($doc, $index) {
                return [
                    'orden' => $index + 1,
                    'numero' => $doc->numero ?? $doc->id,
                    'titulo' => $doc->titulo,
                    'tipo' => $doc->tipo_documento ?? 'documento',
                    'fecha' => $doc->created_at,
                    'firmado' => $doc->firmas ? $doc->firmas->where('estado', 'firmado')->count() > 0 : false,
                ];
            }),
            'total_documentos' => $expediente->documentos->count(),
            'generado_en' => now(),
        ];

        return $this->successResponse($indice);
    }

    public function actividades(Expediente $expediente)
    {
        $actividades = $expediente->actividades()
            ->with('usuario')
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($actividades);
    }

    public function misExpedientes(Request $request)
    {
        $user = Auth::user();

        $query = Expediente::with(['creador', 'departamento'])
            ->where(function ($q) use ($user) {
                $q->where('creado_por', $user->id)
                    ->orWhere('departamento_id', $user->departamento_id);
            });

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('identificador', 'like', "%{$search}%")
                    ->orWhere('titulo', 'like', "%{$search}%")
                    ->orWhere('asunto', 'like', "%{$search}%");
            });
        }

        $expedientes = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return $this->successResponse($expedientes);
    }

    public function asociarDocumento(Request $request, Expediente $expediente)
    {
        $request->validate([
            'documento_id' => 'required|integer|exists:documentos,id',
        ]);

        $documentoId = $request->documento_id;

        // Verificar que no esté ya asociado
        if ($expediente->documentos()->where('documento_id', $documentoId)->exists()) {
            return $this->errorResponse('El documento ya está asociado a este expediente', 400);
        }

        $maxOrden = $expediente->documentos()->max('documento_expediente.orden') ?? 0;
        $expediente->documentos()->attach($documentoId, ['orden' => $maxOrden + 1]);

        $documento = Documento::find($documentoId);

        ExpedienteActividad::create([
            'expediente_id' => $expediente->id,
            'usuario_id' => Auth::id(),
            'tipo' => 'documento_asociado',
            'descripcion' => "Documento \"{$documento->titulo}\" asociado al expediente",
            'metadata' => ['documento_id' => $documentoId],
        ]);

        $expediente->load(['documentos', 'creador', 'departamento']);

        return $this->successResponse($expediente, 'Documento asociado exitosamente');
    }

    public function subirDocumento(Request $request, Expediente $expediente)
    {
        $request->validate([
            'archivo' => 'required|file|mimes:pdf|max:20480',
            'titulo' => 'required|string|max:255',
        ]);

        DB::beginTransaction();
        try {
            $archivo = $request->file('archivo');
            $path = $archivo->store('documentos', 'public');

            $documento = Documento::create([
                'titulo' => $request->titulo,
                'formato' => 'PDF',
                'mecanismo_incorporacion' => Documento::MECANISMO_FISICO,
                'archivo_pdf' => $path,
                'estado' => Documento::ESTADO_BORRADOR,
                'nivel_acceso' => $expediente->nivel_acceso ?? 1,
                'creado_por' => Auth::id(),
                'departamento_id' => Auth::user()->departamento_id,
            ]);

            $maxOrden = $expediente->documentos()->max('documento_expediente.orden') ?? 0;
            $expediente->documentos()->attach($documento->id, ['orden' => $maxOrden + 1]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => Auth::id(),
                'tipo' => 'documento_asociado',
                'descripcion' => "Documento PDF \"{$request->titulo}\" subido y asociado al expediente",
                'metadata' => ['documento_id' => $documento->id, 'archivo' => $path],
            ]);

            DB::commit();

            $expediente->load(['documentos', 'creador', 'departamento']);

            return $this->successResponse($expediente, 'Documento subido y asociado exitosamente', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al subir documento: ' . $e->getMessage(), 500);
        }
    }

    public function reordenarDocumentos(Request $request, Expediente $expediente)
    {
        $request->validate([
            'documentos' => 'required|array|min:1',
            'documentos.*.id' => 'required|integer|exists:documentos,id',
            'documentos.*.orden' => 'required|integer|min:1',
        ]);

        foreach ($request->documentos as $item) {
            $expediente->documentos()->updateExistingPivot($item['id'], [
                'orden' => $item['orden'],
            ]);
        }

        $expediente->load(['documentos', 'creador', 'departamento']);

        return $this->successResponse($expediente, 'Orden actualizado');
    }

    public function estadisticas()
    {
        $stats = [
            'total' => Expediente::count(),
            'borrador' => Expediente::where('estado', 'borrador')->count(),
            'en_tramite' => Expediente::where('estado', 'en_tramite')->count(),
            'cerrados' => Expediente::whereIn('estado', ['cerrado', 'archivado'])->count(),
            'por_nivel_acceso' => [
                'publico' => Expediente::where('nivel_acceso', 1)->count(),
                'restringido' => Expediente::where('nivel_acceso', 2)->count(),
                'reservado' => Expediente::where('nivel_acceso', 3)->count(),
                'secreto' => Expediente::where('nivel_acceso', 4)->count(),
            ],
            'creados_este_mes' => Expediente::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
        ];

        return $this->successResponse($stats);
    }
}
