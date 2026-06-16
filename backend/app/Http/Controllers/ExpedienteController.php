<?php

namespace App\Http\Controllers;

use App\Models\Derivacion;
use App\Models\Documento;
use App\Models\DocumentoFirma;
use App\Models\DocumentoTrazabilidad;
use App\Models\Expediente;
use App\Models\ExpedienteActividad;
use App\Models\User;
use App\Services\NotificacionService;
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
            'documentos.firmantesAsignados',
            'documentos.firmas',
            'actividades.usuario',
            'responsableActual',
            'responsableActualDepartamento',
            'ultimaDerivacion.usuarioOrigen',
        ]);

        // Marcar, por documento, si el usuario actual tiene una firma pendiente
        // (mismo criterio que DocumentoController::pendientesFirma: firmante por contexto,
        // "ya firmé" contra el actor real).
        $user = Auth::user();
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;
        $expediente->documentos->each(function ($doc) use ($ctx, $user) {
            $esFirmante = (int) $doc->firmante_asignado_id === (int) $ctx->id
                || $doc->firmantesAsignados->contains('id', $ctx->id);
            $yaFirmo = $doc->firmas->contains(
                fn ($f) => (int) $f->usuario_id === (int) $user->id && $f->estado === 'firmado'
            );
            $doc->mi_firma_pendiente = $doc->estado === Documento::ESTADO_PENDIENTE_FIRMA && $esFirmante && !$yaFirmo;
        });

        // Agregar atributos computados
        $expediente->nivel_acceso_texto = $expediente->nivel_acceso_texto;
        $expediente->estado_texto = $expediente->estado_texto;

        return $this->successResponse($expediente);
    }

    public function update(Request $request, Expediente $expediente)
    {
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se puede editar un expediente cerrado', 400);
        }

        if (!$this->puedeGestionarExpediente($expediente)) {
            return $this->errorResponse('Solo el creador del expediente o un administrador puede editarlo', 403);
        }

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
        if (!$this->puedeGestionarExpediente($expediente)) {
            return $this->errorResponse('Solo el creador del expediente o un administrador puede cerrarlo', 403);
        }

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
        if (!$this->puedeGestionarExpediente($expediente)) {
            return $this->errorResponse('Solo el creador del expediente o un administrador puede reabrirlo', 403);
        }

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
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        // Visibilidad personal: el creador, el responsable actual, y quien haya tenido el
        // expediente por una derivación (a sí mismo, o a su depto cuando fue sin usuario).
        // NO se incluyen todos los expedientes del departamento por el solo hecho de pertenecer a él.
        $query = Expediente::with(['creador', 'departamento', 'responsableActual'])
            ->where(function ($q) use ($user, $ctx) {
                $q->where('creado_por', $user->id)
                    ->orWhere('responsable_actual_usuario_id', $ctx->id)
                    ->orWhereHas('derivaciones', function ($d) use ($ctx) {
                        $d->where('usuario_destino_id', $ctx->id)
                            ->orWhere(function ($d2) use ($ctx) {
                                $d2->whereNull('usuario_destino_id')
                                    ->where('departamento_destino_id', $ctx->departamento_id);
                            });
                    });
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
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se pueden asociar documentos a un expediente cerrado', 400);
        }

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

        DocumentoTrazabilidad::registrar(
            $documento->id,
            'asociado',
            "Asociado al expediente {$expediente->identificador}",
            ['expediente_id' => $expediente->id, 'expediente' => $expediente->identificador]
        );

        $expediente->load(['documentos', 'creador', 'departamento']);

        return $this->successResponse($expediente, 'Documento asociado exitosamente');
    }

    public function subirDocumento(Request $request, Expediente $expediente)
    {
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se pueden subir documentos a un expediente cerrado', 400);
        }

        $request->validate([
            'archivo' => 'required|file|mimes:pdf|max:20480',
            'titulo' => 'required|string|max:255',
            'tipo_documental_id' => 'required|exists:tipos_documentales,id',
        ]);

        DB::beginTransaction();
        try {
            $archivo = $request->file('archivo');
            $path = $archivo->store('documentos', 'public');

            $documento = Documento::create([
                'titulo' => $request->titulo,
                'tipo_documental_id' => $request->tipo_documental_id,
                'formato' => 'PDF',
                'mecanismo_incorporacion' => Documento::MECANISMO_FISICO,
                'archivo_pdf' => $path,
                'estado' => Documento::ESTADO_INCORPORADO,
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

            DocumentoTrazabilidad::registrar(
                $documento->id,
                'incorporado',
                "Documento subido e incorporado al expediente {$expediente->identificador}",
                ['expediente_id' => $expediente->id, 'expediente' => $expediente->identificador]
            );

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
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se puede reordenar un expediente cerrado', 400);
        }

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

    /**
     * Derivar el expediente a un funcionario específico (responsable). El expediente
     * es la unidad que circula: viaja con todos sus documentos. Reusa el motor de
     * Derivacion (polimórfico) sin generar providencia firmada — eso es exclusivo del
     * módulo de Correspondencia.
     */
    public function derivar(Request $request, Expediente $expediente)
    {
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se puede derivar un expediente cerrado', 400);
        }
        if (!$this->puedeDerivarExpediente($expediente)) {
            return $this->errorResponse('No tienes el expediente en tu poder para derivarlo', 403);
        }

        $request->validate([
            'usuario_destino_id' => 'required|integer|exists:users,id',
            'observaciones' => 'nullable|string',
            'acciones_para' => 'nullable|array',
        ]);

        $user = Auth::user();
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;
        $destino = User::findOrFail($request->usuario_destino_id);

        if ((int) $destino->id === (int) $ctx->id) {
            return $this->errorResponse('No puedes derivarte el expediente a ti mismo', 400);
        }

        DB::beginTransaction();
        try {
            // Cerrar la(s) derivación(es) que el actor tenía activas sobre este expediente.
            foreach ($expediente->derivaciones()->whereIn('estado', ['pendiente', 'recibido'])->get() as $previa) {
                if ($previa->esDestinatario($user)) {
                    $previa->update(['estado' => 'derivado']);
                }
            }

            $derivacion = Derivacion::create([
                'derivable_type' => Expediente::class,
                'derivable_id' => $expediente->id,
                'departamento_origen_id' => $ctx->departamento_id,
                'departamento_destino_id' => $destino->departamento_id,
                'usuario_origen_id' => $user->id,
                'usuario_destino_id' => $destino->id,
                'actuando_como_user_id' => ((int) $ctx->id !== (int) $user->id) ? $ctx->id : null,
                'observaciones' => $request->observaciones,
                'acciones_para' => $request->acciones_para,
                'estado' => 'pendiente',
            ]);

            $expediente->update([
                'estado' => Expediente::ESTADO_EN_TRAMITE,
                'responsable_actual_usuario_id' => $destino->id,
                'responsable_actual_departamento_id' => $destino->departamento_id,
                'actualizado_por' => $user->id,
            ]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => $user->id,
                'tipo' => 'derivacion',
                'descripcion' => "Expediente derivado a {$destino->nombre}"
                    . ($request->observaciones ? ": {$request->observaciones}" : ''),
                'metadata' => [
                    'derivacion_id' => $derivacion->id,
                    'usuario_destino_id' => $destino->id,
                    'acciones_para' => $request->acciones_para,
                ],
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al derivar el expediente: ' . $e->getMessage(), 500);
        }

        // Notificar al destinatario (campana in-app + email), reusando el servicio único.
        $acciones = !empty($request->acciones_para) ? ' Acciones: ' . implode(', ', $request->acciones_para) . '.' : '';
        NotificacionService::enviar(
            $destino,
            'cero_papel',
            'expediente_derivado',
            'Expediente derivado a tu cargo',
            "El expediente {$expediente->identificador} \"{$expediente->titulo}\" te fue derivado por {$user->nombre}."
                . ($request->observaciones ? " Observaciones: {$request->observaciones}." : '')
                . $acciones,
            ['expediente_id' => $expediente->id, 'url' => '/expedientes/' . $expediente->id]
        );

        $expediente->load(['responsableActual', 'responsableActualDepartamento', 'creador', 'departamento']);

        return $this->successResponse($expediente, "Expediente derivado a {$destino->nombre}");
    }

    /**
     * Marcar como recibida la derivación pendiente del expediente dirigida al usuario.
     */
    public function recibir(Expediente $expediente)
    {
        $user = Auth::user();

        $derivacion = $expediente->derivaciones()
            ->where('estado', 'pendiente')
            ->latest()
            ->first();

        if (!$derivacion) {
            return $this->errorResponse('Este expediente no tiene una derivación pendiente', 400);
        }
        if (!$derivacion->esDestinatario($user)) {
            return $this->errorResponse('No eres el destinatario de esta derivación', 403);
        }

        $derivacion->update(['estado' => 'recibido', 'fecha_recepcion' => now()]);

        ExpedienteActividad::create([
            'expediente_id' => $expediente->id,
            'usuario_id' => $user->id,
            'tipo' => 'recepcion',
            'descripcion' => 'Expediente recibido',
            'metadata' => ['derivacion_id' => $derivacion->id],
        ]);

        return $this->successResponse($expediente, 'Expediente recibido');
    }

    /**
     * Bandeja de expedientes que le llegaron al usuario por derivación.
     * Filtro por estado de la derivación: 'pendiente' (por recibir) o 'recibido' (en su poder).
     */
    public function bandeja(Request $request)
    {
        $user = Auth::user();
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;
        $estado = $request->input('estado', 'pendiente');

        $expedienteIds = Derivacion::deExpedientes()
            ->where('estado', $estado)
            ->where(function ($q) use ($ctx) {
                $q->where('usuario_destino_id', $ctx->id)
                    ->orWhere(function ($q2) use ($ctx) {
                        $q2->whereNull('usuario_destino_id')
                            ->where('departamento_destino_id', $ctx->departamento_id);
                    });
            })
            ->pluck('derivable_id')
            ->unique()
            ->values();

        $expedientes = Expediente::with([
            'creador',
            'departamento',
            'responsableActual',
            'ultimaDerivacion.usuarioOrigen',
        ])
            ->whereIn('id', $expedienteIds)
            ->orderBy('updated_at', 'desc')
            ->get();

        return $this->successResponse($expedientes);
    }

    /**
     * Hoja de ruta consolidada del expediente: une sus actividades (creación,
     * asociación de documentos, derivaciones, recepciones, cierre) con las firmas
     * de sus documentos, en una sola línea de tiempo cronológica.
     */
    public function hojaRuta(Expediente $expediente)
    {
        $eventos = [];

        foreach ($expediente->actividades()->with('usuario:id,nombre')->get() as $a) {
            // Las firmas/rechazos se toman de DocumentoFirma (nombran el documento);
            // se omite la actividad genérica equivalente para no duplicar.
            if (in_array($a->tipo, ['documento_firmado', 'documento_rechazado'], true)) {
                continue;
            }
            $eventos[] = [
                'fuente' => 'actividad',
                'tipo' => $a->tipo,
                'descripcion' => $a->descripcion,
                'usuario' => $a->usuario?->nombre ?? 'Sistema',
                'fecha' => $a->created_at,
            ];
        }

        $expediente->loadMissing('documentos');
        $docIds = $expediente->documentos->pluck('id');
        if ($docIds->isNotEmpty()) {
            $firmas = DocumentoFirma::whereIn('documento_id', $docIds)
                ->whereIn('estado', ['firmado', 'rechazado'])
                ->with(['usuario:id,nombre', 'documento:id,titulo'])
                ->get();
            foreach ($firmas as $f) {
                $accion = $f->estado === 'firmado' ? 'Firmó' : 'Rechazó la firma de';
                $eventos[] = [
                    'fuente' => 'firma',
                    'tipo' => $f->estado === 'firmado' ? 'documento_firmado' : 'documento_rechazado',
                    'descripcion' => "{$accion} el documento \"" . ($f->documento?->titulo ?? 'documento') . '"'
                        . ($f->observacion ? ": {$f->observacion}" : ''),
                    'usuario' => $f->usuario?->nombre ?? 'Sistema',
                    'fecha' => $f->fecha_firma ?? $f->updated_at,
                ];
            }
        }

        usort($eventos, fn ($a, $b) => ($b['fecha']?->timestamp ?? 0) <=> ($a['fecha']?->timestamp ?? 0));

        return $this->successResponse($eventos);
    }

    private function puedeGestionarExpediente(Expediente $expediente): bool
    {
        $user = Auth::user();
        if (!$user) {
            return false;
        }

        $roles = is_array($user->roles) ? $user->roles : [];
        if (in_array('admin', $roles, true)) {
            return true;
        }

        return $expediente->creado_por === $user->id;
    }

    /**
     * Puede derivar quien tiene el expediente en su poder: el responsable actual,
     * el creador mientras nadie lo haya recibido aún, o un administrador.
     */
    private function puedeDerivarExpediente(Expediente $expediente): bool
    {
        $user = Auth::user();
        if (!$user) {
            return false;
        }

        $roles = is_array($user->roles) ? $user->roles : [];
        if (in_array('admin', $roles, true)) {
            return true;
        }

        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        if ((int) $expediente->responsable_actual_usuario_id === (int) $ctx->id) {
            return true;
        }

        // Aún sin responsable asignado (recién creado): puede iniciarlo su creador o su departamento.
        if (is_null($expediente->responsable_actual_usuario_id)) {
            return $expediente->creado_por === $user->id
                || (int) $expediente->departamento_id === (int) $ctx->departamento_id;
        }

        return false;
    }
}
