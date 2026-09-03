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
    // Misma resolución de destinos que la correspondencia: el expediente circula
    // con el mismo motor de Derivacion y admite varios destinos por envío.
    use \App\Http\Controllers\Concerns\ResuelveDestinosDerivacion;

    /**
     * Repositorio de expedientes (solo lectura): TODOS los expedientes del municipio,
     * sin el filtro de visibilidad personal. Es una consulta privilegiada, disponible
     * solo para quien tiene el permiso explícito (alcalde, jefaturas, quien lo tenga
     * habilitado) o para un administrador — mismo criterio que el registro de
     * correspondencia.
     */
    public function repositorio(Request $request)
    {
        $user = Auth::user();
        // El permiso se evalúa sobre el CONTEXTO: al subrogar se ve exactamente lo del
        // subrogado (si él no tiene repositorio, el subrogante tampoco).
        if (!($user->contexto()->puede_ver_repositorio || $user->isAdmin())) {
            return $this->errorResponse('No tienes permiso para ver el repositorio de expedientes', 403);
        }

        return $this->listado($request, Expediente::with(['creador', 'departamento', 'responsableActual']));
    }

    public function index(Request $request)
    {
        // Sin el filtro de visibilidad, cualquiera podía listar los expedientes de
        // todo el municipio pidiendo esta ruta a mano. Ver repositorio() para la
        // consulta privilegiada.
        return $this->listado(
            $request,
            Expediente::with(['creador', 'departamento'])->visiblesPara(Auth::user())
        );
    }

    /**
     * Filtros y paginación comunes al listado propio y al repositorio: lo único que
     * los diferencia es el alcance con el que llega la consulta.
     */
    private function listado(Request $request, $query)
    {
        // "abierto" es un alias para "expedientes donde aún se puede trabajar"
        // (borrador + en trámite): lo usan los selectores de documento.
        if ($request->filled('estado')) {
            if ($request->estado === 'abierto') {
                $query->abiertos();
            } else {
                $query->where('estado', $request->estado);
            }
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
                // El responsable queda nulo a propósito hasta la primera derivación:
                // así el expediente recién creado lo puede iniciar su creador o su
                // departamento (ver puedeDerivarExpediente y scopeEnPoderDe).
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
        if (!$this->puedeVerExpediente($expediente)) {
            return $this->errorResponse('No tienes acceso a este expediente', 403);
        }

        $expediente->load([
            'creador',
            'departamento',
            'documentos.creador:id,nombre',
            'documentos.firmantesAsignados',
            'documentos.firmas',
            'actividades.usuario',
            'responsableActual',
            'responsableActualDepartamento',
            'ultimaDerivacion.usuarioOrigen',
            'derivacionesActivas.usuarioDestino:id,nombre',
            'derivacionesActivas.departamentoDestino:id,nombre',
            'derivacionesActivas.usuarioOrigen:id,nombre',
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

        // Quién puso cada documento en ESTE expediente, que no siempre es quien lo
        // redactó: al asociar uno existente, lo incorpora un tercero. La bitácora del
        // expediente lo sabe; si no hay rastro (documentos anteriores a la bitácora),
        // se cae al creador del documento.
        $incorporadores = $expediente->actividades
            ->whereIn('tipo', ['documento_creado', 'documento_asociado'])
            ->sortBy('id')
            ->reduce(function ($mapa, $act) {
                $docId = $act->metadata['documento_id'] ?? null;
                if ($docId && $act->usuario) {
                    // La última incorporación manda: un documento puede haberse
                    // quitado y vuelto a asociar.
                    $mapa[(int) $docId] = [
                        'usuario' => ['id' => $act->usuario->id, 'nombre' => $act->usuario->nombre],
                        'fecha' => $act->created_at,
                    ];
                }
                return $mapa;
            }, []);

        $expediente->documentos->each(function ($doc) use ($incorporadores) {
            $rastro = $incorporadores[$doc->id] ?? null;
            $doc->incorporado_por = $rastro['usuario'] ?? ($doc->creador
                ? ['id' => $doc->creador->id, 'nombre' => $doc->creador->nombre]
                : null);
            $doc->incorporado_en = $rastro['fecha'] ?? $doc->pivot?->created_at ?? $doc->created_at;
        });

        // Con multi-destino la UI no puede deducir esto de la última derivación (que
        // puede ser de otro destinatario): se lo decimos con el mismo criterio que
        // aplica el backend al recibir y al derivar.
        $expediente->mi_derivacion_pendiente = $expediente->derivacionesActivas
            ->contains(fn ($d) => $d->estado === 'pendiente' && $d->esDestinatario($user));
        $expediente->puedo_derivar = !$expediente->estaCerrado()
            && $this->puedeDerivarExpediente($expediente);
        // Sumar un destinatario olvidado: solo tiene sentido si el expediente ya
        // está circulando (si no, lo que corresponde es derivarlo).
        $expediente->puedo_agregar_destinatarios = !$expediente->estaCerrado()
            && $expediente->derivacionesActivas->isNotEmpty()
            && $expediente->puedeAportarDocumentos($user);
        // Quién lo tiene ahora, en palabras: con varios destinos no hay responsable único.
        //
        // "Lo tiene" NO es lo mismo que "se lo enviaron": una derivación 'pendiente'
        // significa que le llegó pero todavía no la acusa, y hasta entonces el
        // expediente no está realmente en sus manos (scopeEnPoderDe aplica el mismo
        // criterio para las bandejas). Mezclarlas hacía que la cabecera afirmara
        // "En poder de Fulano" de alguien que nunca lo abrió.
        $nombreDestino = fn ($d) => $d->usuarioDestino?->nombre ?? $d->departamentoDestino?->nombre;

        $expediente->tenedores = $expediente->derivacionesActivas
            ->where('estado', 'recibido')
            ->map($nombreDestino)
            ->filter()->unique()->values()->all();

        // Sin ninguna derivación viva mandan los campos del expediente: es el caso
        // legado (derivación única antes del multi-destino) y el del recién creado.
        if (empty($expediente->tenedores) && $expediente->derivacionesActivas->isEmpty()
            && $expediente->responsableActual) {
            $expediente->tenedores = [$expediente->responsableActual->nombre];
        }

        $expediente->pendientes_de_recibir = $expediente->derivacionesActivas
            ->where('estado', 'pendiente')
            ->map($nombreDestino)
            ->filter()->unique()->values()->all();

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
        if (!$this->puedeVerExpediente($expediente)) {
            return $this->errorResponse('No tienes acceso a este expediente', 403);
        }

        $expediente->load(['documentos.firmas.usuario', 'documentos.rectificaA:id,numero,identificador']);

        // Vínculos de rectificación dentro del propio expediente: quién corrige a
        // quién. Se resuelve con los documentos ya cargados, sin más consultas.
        $rectificadores = $expediente->documentos
            ->filter(fn ($d) => $d->rectifica_a_id && $d->esFirme())
            ->keyBy('rectifica_a_id');

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
            'documentos' => $expediente->documentos->map(function ($doc, $index) use ($rectificadores) {
                return [
                    'orden' => $index + 1,
                    'numero' => $doc->numero ?? $doc->id,
                    'titulo' => $doc->titulo,
                    'tipo' => $doc->tipo_documento ?? 'documento',
                    'fecha' => $doc->created_at,
                    'firmado' => $doc->firmas ? $doc->firmas->where('estado', 'firmado')->count() > 0 : false,
                    'estado' => $doc->estado,
                    // El índice es la carátula del expediente: tiene que decir qué
                    // piezas siguen vigentes y cuáles fueron corregidas.
                    'rectificado_por' => ($r = $rectificadores->get($doc->id))
                        ? [
                            'numero' => $r->numero ?: $r->identificador,
                            'tipo_rectificacion' => $r->tipo_rectificacion,
                        ]
                        : null,
                    'rectifica_a' => $doc->rectificaA
                        ? [
                            'numero' => $doc->rectificaA->numero ?: $doc->rectificaA->identificador,
                            'tipo_rectificacion' => $doc->tipo_rectificacion,
                        ]
                        : null,
                ];
            }),
            'total_documentos' => $expediente->documentos->count(),
            'generado_en' => now(),
        ];

        return $this->successResponse($indice);
    }

    public function actividades(Expediente $expediente)
    {
        if (!$this->puedeVerExpediente($expediente)) {
            return $this->errorResponse('No tienes acceso a este expediente', 403);
        }

        $actividades = $expediente->actividades()
            ->with('usuario')
            ->orderBy('created_at', 'desc')
            ->get();

        return $this->successResponse($actividades);
    }

    /**
     * Vistas de la pantalla única de expedientes. Son los tabs que ve el funcionario
     * y están pensadas para no solaparse entre sí (salvo "creados", que es otro eje:
     * lo que yo abrí, esté donde esté).
     */
    private const VISTAS = ['por_recibir', 'en_poder', 'creados', 'cerrados'];

    /**
     * Aplica el filtro del tab. Se usa tanto para listar como para contar, así que
     * la definición de cada vista vive en un solo lugar.
     */
    private function aplicarVista($query, $user, string $vista)
    {
        return match ($vista) {
            'por_recibir' => $query->abiertos()->derivadosA($user, 'pendiente'),
            'en_poder' => $query->enPoderDe($user),
            'creados' => $query->where('creado_por', $user->id),
            'cerrados' => $query->cerrados(),
            default => $query,
        };
    }

    public function misExpedientes(Request $request)
    {
        $user = Auth::user();

        // Visibilidad personal: creador, responsable actual o destinatario de una
        // derivación (ver Expediente::scopeVisiblesPara).
        $query = Expediente::with([
            'creador',
            'departamento',
            'responsableActual',
            'ultimaDerivacion.usuarioOrigen',
            // Para la columna "En poder de": con multi-destino no hay responsable único.
            'derivacionesActivas.usuarioDestino:id,nombre',
            'derivacionesActivas.departamentoDestino:id,nombre',
        ])->visiblesPara($user);

        // Tab de la pantalla de expedientes. Sin 'vista' devuelve todo lo visible,
        // que es lo que esperan los selectores de documento.
        if (in_array($request->input('vista'), self::VISTAS, true)) {
            $this->aplicarVista($query, $user, $request->input('vista'));
        }

        // "abierto" es un alias para "expedientes donde aún se puede trabajar"
        // (borrador + en trámite): lo usan los selectores de documento.
        if ($request->filled('estado')) {
            if ($request->estado === 'abierto') {
                $query->abiertos();
            } else {
                $query->where('estado', $request->estado);
            }
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

    /**
     * Cantidad de expedientes por tab, para los contadores de la pantalla única.
     */
    public function resumenVistas()
    {
        $user = Auth::user();

        $conteos = [];
        foreach (self::VISTAS as $vista) {
            $conteos[$vista] = $this->aplicarVista(
                Expediente::query()->visiblesPara($user),
                $user,
                $vista
            )->count();
        }

        return $this->successResponse($conteos);
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

    /**
     * Quitar un documento del expediente mientras se está armando (borrador).
     *
     * Solo lo DESASOCIA: el documento sigue existiendo en "Mis documentos", de
     * modo que sacarlo de la carpeta nunca destruye el archivo ni sus firmas.
     * Una vez que el expediente sale a trámite deja de permitirse: ya circuló con
     * ese contenido y quitarle piezas rompería la trazabilidad de quien lo revisó.
     */
    public function quitarDocumento(Expediente $expediente, Documento $documento)
    {
        if ($expediente->estado !== Expediente::ESTADO_BORRADOR) {
            return $this->errorResponse(
                'Solo se pueden quitar documentos mientras el expediente está en borrador. '
                    . 'Este ya está en trámite: su contenido quedó registrado en la hoja de ruta.',
                400
            );
        }
        if (!$this->puedeGestionarExpediente($expediente)) {
            return $this->errorResponse('Solo el creador del expediente o un administrador puede quitar documentos', 403);
        }
        if (!$expediente->documentos()->where('documento_id', $documento->id)->exists()) {
            return $this->errorResponse('Ese documento no está en este expediente', 404);
        }

        DB::beginTransaction();
        try {
            $expediente->documentos()->detach($documento->id);

            // Renumerar los que quedan: el orden es la posición en la carpeta y no
            // debe quedar con huecos tras sacar una pieza del medio.
            foreach ($expediente->documentos()->get() as $i => $doc) {
                $expediente->documentos()->updateExistingPivot($doc->id, ['orden' => $i + 1]);
            }

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => Auth::id(),
                'tipo' => 'documento_desasociado',
                'descripcion' => "Documento \"{$documento->titulo}\" quitado del expediente",
                'metadata' => ['documento_id' => $documento->id],
            ]);

            DocumentoTrazabilidad::registrar(
                $documento->id,
                'desasociado',
                "Quitado del expediente {$expediente->identificador}",
                ['expediente_id' => $expediente->id, 'expediente' => $expediente->identificador]
            );

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al quitar el documento: ' . $e->getMessage(), 500);
        }

        $expediente->load(['documentos', 'creador', 'departamento']);

        return $this->successResponse($expediente, 'Documento quitado del expediente');
    }

    /**
     * Adjunta un ANTECEDENTE al expediente: un PDF que se archiva tal como llegó
     * (cotización, certificado, correo) y que no pasa por el circuito de firma —
     * por eso nace en estado "incorporado", que ya es final.
     *
     * Un memo, informe u oficio NO va por aquí: esos suben por el asistente de
     * DocumentoController::subirDocumento, que detecta las firmas del PDF y deja
     * elegir quién firma.
     */
    public function subirDocumento(Request $request, Expediente $expediente)
    {
        // Faltaba: bastaba conocer el id para meterle un PDF a un expediente ajeno.
        // Pueden el creador, administración y quien lo tenga en su poder: el que
        // tramita necesita adjuntar sus respaldos sin devolver el expediente.
        if (!$expediente->puedeAportarDocumentos(Auth::user())) {
            return $this->errorResponse('No tienes permiso para agregar documentos a este expediente', 403);
        }

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
                'archivo_original' => $path,
                'estado' => Documento::ESTADO_INCORPORADO,
                'origen_carga' => Documento::ORIGEN_SUBIDO,
                'nivel_acceso' => $expediente->nivel_acceso ?? 1,
                'creado_por' => Auth::id(),
                'actualizado_por' => Auth::id(),
                'departamento_id' => Auth::user()->departamento_id,
            ]);

            $maxOrden = $expediente->documentos()->max('documento_expediente.orden') ?? 0;
            $expediente->documentos()->attach($documento->id, ['orden' => $maxOrden + 1]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => Auth::id(),
                'tipo' => 'documento_asociado',
                'descripcion' => "Antecedente \"{$request->titulo}\" adjuntado al expediente",
                'metadata' => ['documento_id' => $documento->id, 'archivo' => $path],
            ]);

            DocumentoTrazabilidad::registrar(
                $documento->id,
                'incorporado',
                "Antecedente adjuntado al expediente {$expediente->identificador} (no requiere firma)",
                ['expediente_id' => $expediente->id, 'expediente' => $expediente->identificador]
            );

            DB::commit();

            $expediente->load(['documentos', 'creador', 'departamento']);

            return $this->successResponse($expediente, 'Antecedente adjuntado al expediente', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al adjuntar el antecedente: ' . $e->getMessage(), 500);
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
     * Derivar el expediente a uno o varios funcionarios y/o departamentos completos.
     * El expediente es la unidad que circula: viaja con todos sus documentos. Reusa
     * el motor de Derivacion (polimórfico) y la misma resolución de destinos que la
     * correspondencia, sin generar providencia firmada — eso es exclusivo del módulo
     * de Correspondencia.
     *
     * Con varios destinos se crea una derivación por destino y cada uno acusa recibo
     * por separado; el expediente queda en poder de todos ellos a la vez.
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
            'usuario_destino_id' => 'nullable|integer|exists:users,id',
            'usuario_destino_ids' => 'nullable|array',
            'usuario_destino_ids.*' => 'integer|exists:users,id',
            'departamento_destino_ids' => 'nullable|array',
            'departamento_destino_ids.*' => 'integer|exists:departamentos,id',
            'observaciones' => 'nullable|string',
            'acciones_para' => 'nullable|array',
        ]);

        $user = Auth::user();
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        // resolverDestinos ya descarta la auto-derivación y la fila nominal del
        // funcionario cuyo departamento se deriva completo (ver el trait).
        [$destinatarios, $departamentosDestino] = $this->resolverDestinos($request);
        if ($destinatarios->isEmpty() && $departamentosDestino->isEmpty()) {
            return $this->errorResponse(
                'Indica al menos un destino: funcionario(s) o departamento(s).',
                422
            );
        }

        $resumenDestinos = implode(', ', $destinatarios->pluck('nombre')
            ->merge($departamentosDestino->pluck('nombre'))
            ->all());

        DB::beginTransaction();
        try {
            // Cerrar las derivaciones activas que el actor tenía sobre este expediente.
            // Quien deriva sin ser destinatario (un administrador moviendo el
            // expediente) cierra TODAS las activas: si no, la anterior quedaría
            // pendiente y el expediente aparecería en dos bandejas a la vez.
            $activas = $expediente->derivaciones()->whereIn('estado', ['pendiente', 'recibido'])->get();
            $esDestinatarioActivo = $activas->contains(fn ($d) => $d->esDestinatario($user));
            foreach ($activas as $previa) {
                if (!$esDestinatarioActivo || $previa->esDestinatario($user)) {
                    $previa->update(['estado' => 'derivado']);
                }
            }

            $base = [
                'derivable_type' => Expediente::class,
                'derivable_id' => $expediente->id,
                'departamento_origen_id' => $ctx->departamento_id,
                'usuario_origen_id' => $user->id,
                'actuando_como_user_id' => ((int) $ctx->id !== (int) $user->id) ? $ctx->id : null,
                'observaciones' => $request->observaciones,
                'acciones_para' => $request->acciones_para,
                'estado' => 'pendiente',
            ];

            $creadas = [];
            foreach ($destinatarios as $destino) {
                $creadas[] = Derivacion::create($base + [
                    'departamento_destino_id' => $destino->departamento_id,
                    'usuario_destino_id' => $destino->id,
                ]);
            }
            // Derivación departamental: sin usuario_destino_id, la recibe cualquiera
            // del departamento (ver Derivacion::esDestinatario).
            foreach ($departamentosDestino as $depto) {
                $creadas[] = Derivacion::create($base + [
                    'departamento_destino_id' => $depto->id,
                    'usuario_destino_id' => null,
                ]);
            }

            // El responsable único solo tiene sentido con un destinatario nominal;
            // con varios destinos la responsabilidad vive en las derivaciones y el
            // campo queda nulo (quién lo tiene se resuelve con scopeEnPoderDe).
            $unico = ($destinatarios->count() === 1 && $departamentosDestino->isEmpty())
                ? $destinatarios->first()
                : null;

            $expediente->update([
                'estado' => Expediente::ESTADO_EN_TRAMITE,
                'responsable_actual_usuario_id' => $unico?->id,
                'responsable_actual_departamento_id' => $unico
                    ? $unico->departamento_id
                    : ($departamentosDestino->count() === 1 && $destinatarios->isEmpty()
                        ? $departamentosDestino->first()->id
                        : null),
                'actualizado_por' => $user->id,
            ]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => $user->id,
                'tipo' => 'derivacion',
                'descripcion' => "Expediente derivado a {$resumenDestinos}"
                    . ($request->observaciones ? ": {$request->observaciones}" : ''),
                'metadata' => [
                    'derivacion_ids' => array_map(fn ($d) => $d->id, $creadas),
                    'usuario_destino_ids' => $destinatarios->pluck('id')->all(),
                    'departamento_destino_ids' => $departamentosDestino->pluck('id')->all(),
                    'acciones_para' => $request->acciones_para,
                ],
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al derivar el expediente: ' . $e->getMessage(), 500);
        }

        $this->notificarDerivacionExpediente($expediente, $destinatarios, $departamentosDestino, $user, $request);

        $expediente->load(['responsableActual', 'responsableActualDepartamento', 'creador', 'departamento']);

        return $this->successResponse($expediente, "Expediente derivado a {$resumenDestinos}");
    }

    /**
     * Suma destinatarios a un expediente que YA está circulando, sin quitárselo
     * a quien lo tiene.
     *
     * derivar() MUEVE el expediente: cierra las derivaciones activas y lo entrega
     * a los nuevos destinos. Eso dejaba sin salida el olvido más común —"lo mandé
     * a Eva y se me pasó incluir a Winston"—: el creador ya no lo tiene en su
     * poder, así que el botón Derivar desaparece, y aunque fuera admin, derivar de
     * nuevo se lo habría quitado a Eva. Aquí las derivaciones vigentes NO se
     * tocan: el expediente queda en varias bandejas a la vez, que es exactamente
     * lo que permite el multi-destino cuando se eligen todos de una.
     *
     * Es el equivalente para expedientes de lo que en correspondencia puede hacer
     * el alcalde (ver DerivacionController::alcaldePuedeDerivar): derivar es un
     * acto repetible y sumar un destinatario no debe deshacer lo ya hecho.
     *
     * Permiso: el mismo que para aportar documentos (creador + admin + quien lo
     * tiene en su poder). Quien puede meter papeles en el expediente puede decidir
     * a quién más le llega.
     */
    public function agregarDestinatarios(Request $request, Expediente $expediente)
    {
        if ($expediente->estaCerrado()) {
            return $this->errorResponse('No se puede modificar un expediente cerrado', 400);
        }

        $user = Auth::user();
        if (!$expediente->puedeAportarDocumentos($user)) {
            return $this->errorResponse('No puedes agregar destinatarios a este expediente', 403);
        }

        $request->validate([
            'usuario_destino_ids' => 'nullable|array',
            'usuario_destino_ids.*' => 'integer|exists:users,id',
            'departamento_destino_ids' => 'nullable|array',
            'departamento_destino_ids.*' => 'integer|exists:departamentos,id',
            'observaciones' => 'nullable|string',
            'acciones_para' => 'nullable|array',
        ]);

        $activas = $expediente->derivaciones()->whereIn('estado', ['pendiente', 'recibido'])->get();
        if ($activas->isEmpty()) {
            return $this->errorResponse(
                'Este expediente todavía no está en circulación: usa Derivar para enviarlo.',
                422
            );
        }

        [$destinatarios, $departamentosDestino] = $this->resolverDestinos($request);

        // Quien ya lo tiene no se suma de nuevo: una segunda derivación al mismo
        // destinatario le pediría acusar recibo dos veces del mismo expediente.
        $destinatarios = $destinatarios->reject(
            fn ($u) => $activas->contains(fn ($d) => (int) $d->usuario_destino_id === (int) $u->id)
        );
        $departamentosDestino = $departamentosDestino->reject(
            fn ($dep) => $activas->contains(
                fn ($d) => is_null($d->usuario_destino_id)
                    && (int) $d->departamento_destino_id === (int) $dep->id
            )
        );

        if ($destinatarios->isEmpty() && $departamentosDestino->isEmpty()) {
            return $this->errorResponse(
                'Indica al menos un destino nuevo: los que elegiste ya tienen el expediente.',
                422
            );
        }

        $resumenDestinos = implode(', ', $destinatarios->pluck('nombre')
            ->merge($departamentosDestino->pluck('nombre'))
            ->all());

        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        DB::beginTransaction();
        try {
            $base = [
                'derivable_type' => Expediente::class,
                'derivable_id' => $expediente->id,
                'departamento_origen_id' => $ctx->departamento_id,
                'usuario_origen_id' => $user->id,
                'actuando_como_user_id' => ((int) $ctx->id !== (int) $user->id) ? $ctx->id : null,
                'observaciones' => $request->observaciones,
                'acciones_para' => $request->acciones_para,
                'estado' => 'pendiente',
            ];

            $creadas = [];
            foreach ($destinatarios as $destino) {
                $creadas[] = Derivacion::create($base + [
                    'departamento_destino_id' => $destino->departamento_id,
                    'usuario_destino_id' => $destino->id,
                ]);
            }
            foreach ($departamentosDestino as $depto) {
                $creadas[] = Derivacion::create($base + [
                    'departamento_destino_id' => $depto->id,
                    'usuario_destino_id' => null,
                ]);
            }

            // Ahora lo tienen varios: la responsabilidad pasa a vivir en las
            // derivaciones y el responsable único deja de tener sentido (misma
            // convención que derivar() con multi-destino, ver scopeEnPoderDe).
            $expediente->update([
                'estado' => Expediente::ESTADO_EN_TRAMITE,
                'responsable_actual_usuario_id' => null,
                'responsable_actual_departamento_id' => null,
                'actualizado_por' => $user->id,
            ]);

            ExpedienteActividad::create([
                'expediente_id' => $expediente->id,
                'usuario_id' => $user->id,
                'tipo' => 'derivacion',
                'descripcion' => "Se sumó a {$resumenDestinos} como destinatario"
                    . ($request->observaciones ? ": {$request->observaciones}" : ''),
                'metadata' => [
                    'derivacion_ids' => array_map(fn ($d) => $d->id, $creadas),
                    'usuario_destino_ids' => $destinatarios->pluck('id')->all(),
                    'departamento_destino_ids' => $departamentosDestino->pluck('id')->all(),
                    'acciones_para' => $request->acciones_para,
                    'sumado_a_derivacion_existente' => true,
                ],
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return $this->errorResponse('Error al agregar destinatarios: ' . $e->getMessage(), 500);
        }

        $this->notificarDerivacionExpediente($expediente, $destinatarios, $departamentosDestino, $user, $request);

        $expediente->load(['responsableActual', 'responsableActualDepartamento', 'creador', 'departamento']);

        return $this->successResponse($expediente, "Se agregó a {$resumenDestinos} al expediente");
    }

    /**
     * Avisa a cada destinatario de la derivación (campana in-app + correo). Los
     * departamentos derivados completos notifican a todos sus funcionarios activos.
     */
    private function notificarDerivacionExpediente(
        Expediente $expediente,
        $destinatarios,
        $departamentosDestino,
        User $user,
        Request $request
    ): void {
        $acciones = !empty($request->acciones_para)
            ? ' Acciones: ' . implode(', ', $request->acciones_para) . '.'
            : '';
        $cuerpo = "El expediente {$expediente->identificador} \"{$expediente->titulo}\" te fue derivado por {$user->nombre}."
            . ($request->observaciones ? " Observaciones: {$request->observaciones}." : '')
            . $acciones;

        $aAvisar = $destinatarios->all();
        foreach ($departamentosDestino as $depto) {
            foreach (User::where('departamento_id', $depto->id)->where('activo', true)->get() as $u) {
                $aAvisar[] = $u;
            }
        }

        $vistos = [];
        foreach ($aAvisar as $destino) {
            if (isset($vistos[$destino->id]) || (int) $destino->id === (int) $user->id) {
                continue;
            }
            $vistos[$destino->id] = true;
            NotificacionService::enviar(
                $destino,
                'cero_papel',
                'expediente_derivado',
                'Expediente derivado a tu cargo',
                $cuerpo,
                ['expediente_id' => $expediente->id, 'url' => '/expedientes/' . $expediente->id]
            );
        }
    }

    /**
     * Marcar como recibida la derivación pendiente del expediente dirigida al usuario.
     */
    public function recibir(Expediente $expediente)
    {
        $user = Auth::user();

        // Con varios destinatarios hay varias pendientes a la vez: hay que acusar
        // recibo de la propia, no de la última creada (que puede ser de otro).
        $pendientes = $expediente->derivaciones()->where('estado', 'pendiente')->latest()->get();

        if ($pendientes->isEmpty()) {
            return $this->errorResponse('Este expediente no tiene una derivación pendiente', 400);
        }

        $derivacion = $pendientes->first(fn ($d) => $d->esDestinatario($user));
        if (!$derivacion) {
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
     * Hoja de ruta consolidada del expediente: une sus actividades (creación,
     * asociación de documentos, derivaciones, recepciones, cierre) con las firmas
     * de sus documentos, en una sola línea de tiempo cronológica.
     */
    public function hojaRuta(Expediente $expediente)
    {
        if (!$this->puedeVerExpediente($expediente)) {
            return $this->errorResponse('No tienes acceso a este expediente', 403);
        }

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

    /**
     * ¿Puede este usuario LEER el expediente? Participa en él (lo creó, lo tiene a
     * cargo o se lo derivaron: ver scopeVisiblesPara), o mira desde una posición
     * habilitada para ver todo el municipio (repositorio o administración).
     *
     * Hasta agosto de 2026 no se comprobaba en ninguna parte: cualquier funcionario
     * abría el expediente de otro departamento por su id, con sus actividades, su
     * hoja de ruta y su índice, incluso marcado Secreto.
     */
    private function puedeVerExpediente(Expediente $expediente): bool
    {
        $user = Auth::user();
        if (!$user) {
            return false;
        }
        if ($user->isAdmin() || $user->contexto()->puede_ver_repositorio) {
            return true;
        }

        return Expediente::query()->visiblesPara($user)->whereKey($expediente->id)->exists();
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

        // Lo tiene en su bandeja: es destinatario de una derivación activa. Es el caso
        // normal cuando se derivó a varios y por eso no hay responsable único.
        $activas = $expediente->derivaciones()->whereIn('estado', ['pendiente', 'recibido'])->get();
        if ($activas->contains(fn ($d) => $d->esDestinatario($user))) {
            return true;
        }

        // Nadie lo tiene todavía (recién creado): puede iniciarlo su creador o su departamento.
        if (is_null($expediente->responsable_actual_usuario_id) && $activas->isEmpty()) {
            return $expediente->creado_por === $user->id
                || (int) $expediente->departamento_id === (int) $ctx->departamento_id;
        }

        return false;
    }
}
