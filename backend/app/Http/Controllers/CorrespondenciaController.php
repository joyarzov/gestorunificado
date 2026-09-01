<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CorrespondenciaController extends Controller
{
    public function index(Request $request)
    {
        // Visibilidad: admin/oficial ven todo; el resto solo donde participa.
        // Este listado es de ENTRADAS; las salidas tienen su propio módulo.
        $query = Correspondencia::visiblesPara(Auth::user())
            ->entradas()
            ->with([
                'departamento', 'usuario', 'adjuntos',
                'derivaciones:id,correspondencia_id,usuario_origen_id,actuando_como_user_id,usuario_destino_id,estado,fecha_recepcion',
                'derivaciones.usuarioDestino:id,nombre',
                'mensajes:id,correspondencia_id,usuario_id',
            ]);

        // Filtros
        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }

        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }

        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_recibo', '>=', $request->fecha_desde);
        }

        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_recibo', '<=', $request->fecha_hasta);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('remitente', 'like', "%{$search}%")
                    ->orWhere('numero_documento', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%");
            });
        }

        $correspondencias = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));
        $correspondencias->getCollection()->each(fn ($c) => $c->append('resumen_gestion'));
        $this->marcarBanderas($correspondencias->getCollection(), Auth::user()->contexto()->id);

        return $this->successResponse($correspondencias);
    }

    /**
     * Marca en cada correspondencia las dos banderas personales del usuario:
     * - tiene_novedades: su última actividad es posterior a la última lectura
     *   (o no la ha abierto todavía).
     * - en_seguimiento: la marcó con estrella para no perderla de vista.
     *
     * Las dos van juntas porque se pintan en la misma celda de los listados;
     * resolverlas de una pasada evita duplicar consultas por página.
     */
    private function marcarBanderas($correspondencias, int $usuarioId): void
    {
        $ids = collect($correspondencias)->pluck('id')->filter()->unique();
        if ($ids->isEmpty()) {
            return;
        }
        $lecturas = \App\Models\CorrespondenciaLectura::where('usuario_id', $usuarioId)
            ->whereIn('correspondencia_id', $ids)
            ->pluck('leido_at', 'correspondencia_id');
        $seguidas = \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $usuarioId)
            ->whereIn('correspondencia_id', $ids)
            ->pluck('correspondencia_id')
            ->flip();
        foreach ($correspondencias as $c) {
            $act = $c->ultima_actividad_at;
            $leido = $lecturas[$c->id] ?? null;
            $c->tiene_novedades = $act && (!$leido || $act->gt($leido));
            $c->en_seguimiento = $seguidas->has($c->id);
        }
    }

    // =====================================================
    // CIERRE DE PROCESOS (poner al día el rezago)
    // =====================================================

    /**
     * Días sin movimiento a partir de los cuales una correspondencia deja de
     * ser "se detuvo" y pasa a ser rezago administrativo: trabajo que
     * seguramente terminó pero que nadie formalizó.
     */
    private const DIAS_REZAGO = 30;

    /**
     * Lo que está en gestión y espera el cierre del Alcalde.
     *
     * Nace de un hecho medido: de 387 correspondencias de entrada, solo 15
     * estaban cerradas. No es que no se quiera cerrar —el Alcalde sabe que le
     * corresponde—, es que hacerlo de a una, 348 veces, no cabe en el día.
     *
     * Por eso este listado trae lo que hace falta para decidir sin abrir cada
     * una: cuánto lleva quieta y, sobre todo, si ya se despachó una respuesta
     * al remitente. Una correspondencia respondida es, casi siempre, una
     * correspondencia terminada.
     */
    public function porCerrar(Request $request)
    {
        $user = Auth::user();
        if (!$user->isAlcalde() && !$user->isAdmin()) {
            return $this->errorResponse('Solo el Alcalde puede cerrar procesos.', 403);
        }

        $query = Correspondencia::entradas()
            ->where('estado', 'completada')
            ->with(['departamento:id,nombre'])
            ->withCount(['respuestas as respuestas_despachadas' => fn ($q) => $q->whereNotNull('fecha_despacho')]);

        // Filtros pensados para poder avanzar por tandas seguras.
        if ($request->boolean('solo_respondidas')) {
            $query->whereHas('respuestas', fn ($q) => $q->whereNotNull('fecha_despacho'));
        }
        if ($request->filled('dias_min')) {
            $query->where('ultima_actividad_at', '<=', now()->subDays((int) $request->input('dias_min')));
        }

        $paginador = $query->orderBy('ultima_actividad_at')
            ->paginate($request->input('per_page', 50));

        $items = $paginador->getCollection()->map(fn (Correspondencia $c) => [
            'id'                 => $c->id,
            'folio'              => $c->folio,
            'remitente'          => $c->remitente,
            'descripcion'        => $c->descripcion ? mb_strimwidth($c->descripcion, 0, 90, '…') : null,
            'departamento'       => $c->departamento?->nombre,
            'fecha_recibo'       => $c->fecha_recibo,
            'dias_sin_movimiento' => $c->diasSinMovimiento(),
            'respondida'         => $c->respuestas_despachadas > 0,
        ]);

        return $this->successResponse([
            'items'     => $items->values()->all(),
            'total'     => $paginador->total(),
            'page'      => $paginador->currentPage(),
            'last_page' => $paginador->lastPage(),
            'per_page'  => $paginador->perPage(),
            'dias_rezago' => self::DIAS_REZAGO,
        ]);
    }

    /**
     * Cierra varios procesos de una vez.
     *
     * Cerrar sigue siendo un acto formal del Alcalde y cada cierre queda en la
     * bitácora igual que si se hiciera de a uno: lo único que cambia es que no
     * hay que entrar 348 veces. Se valida una por una y las que no cumplan se
     * informan en vez de romper el lote entero.
     */
    public function cerrarLote(Request $request)
    {
        $user = Auth::user();
        if (!$user->isAlcalde()) {
            return $this->errorResponse('Solo el Alcalde puede cerrar el proceso de una correspondencia.', 403);
        }

        $request->validate([
            'ids'   => 'required|array|min:1|max:200',
            'ids.*' => 'integer',
        ]);

        $cerradas = [];
        $omitidas = [];

        foreach (Correspondencia::whereIn('id', $request->input('ids'))->get() as $c) {
            if ($c->direccion !== 'entrada' || $c->estado !== 'completada') {
                $omitidas[] = ['folio' => $c->folio, 'motivo' => 'No está en gestión'];
                continue;
            }

            DB::transaction(function () use ($c, $user, &$cerradas) {
                $c->update([
                    'estado'        => 'archivado',
                    'archivada_por' => $user->id,
                    'archivada_at'  => now(),
                ]);
                $c->registrarActividad(
                    $user->contexto()->id,
                    'archivada',
                    'cerró el proceso (completada)',
                    $user->id
                );
                $cerradas[] = $c->folio;
            });
        }

        return $this->successResponse(
            ['cerradas' => count($cerradas), 'omitidas' => $omitidas, 'folios' => $cerradas],
            count($cerradas) === 1
                ? 'Se cerró 1 proceso'
                : 'Se cerraron ' . count($cerradas) . ' procesos'
        );
    }

    // =====================================================
    // SEGUIMIENTO PERSONAL ("estrella")
    // =====================================================

    /** Días sin movimiento a partir de los cuales una correspondencia en gestión se considera estancada. */
    private const DIAS_ESTANCADA = 7;

    /**
     * Entradas que el usuario puede ver, con el MISMO criterio que gobierna el
     * acceso al detalle (Correspondencia::esVisiblePara).
     *
     * El scope `visiblesPara` se queda corto acá: no contempla el permiso de
     * registro/repositorio, que sí abre el detalle. Usarlo tal cual haría que
     * el Alcalde o Eva marcaran una correspondencia con estrella y después no
     * la encontraran en su propia lista. Se resuelve solo para estos endpoints
     * nuevos, sin tocar el scope compartido por bandeja, listado y panel.
     */
    private function entradasVisibles(User $user)
    {
        // El flag se lee del CONTEXTO, no del actor: al subrogar se ven los
        // permisos del subrogado, ni más ni menos (misma regla que registro()).
        return $user->contexto()->puede_ver_registro_correspondencia
            ? Correspondencia::query()->entradas()
            : Correspondencia::visiblesPara($user)->entradas();
    }

    /**
     * Marca la correspondencia para seguimiento del usuario (o actualiza su
     * nota privada). Idempotente: volver a marcarla no duplica ni pierde la nota.
     */
    public function seguir(Request $request, Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if (!$correspondencia->esVisiblePara($user)) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }
        // En modo auditoría se mira, no se marca: la lista de seguimiento es del
        // funcionario auditado y no debe ensuciarse desde el "Ver como".
        if ($user->estaAuditando()) {
            return $this->errorResponse('En modo auditoría no se puede marcar seguimiento.', 403);
        }

        $request->validate(['nota' => 'nullable|string|max:300']);

        $seguimiento = \App\Models\CorrespondenciaSeguimiento::firstOrNew([
            'usuario_id'         => $user->contexto()->id,
            'correspondencia_id' => $correspondencia->id,
        ]);
        // Solo pisar la nota si vino en la petición: el toggle de la estrella no
        // manda nota y no debe borrar la que ya estaba escrita.
        if ($request->has('nota')) {
            $seguimiento->nota = $request->input('nota');
        }
        $seguimiento->save();

        return $this->successResponse(
            ['en_seguimiento' => true, 'nota' => $seguimiento->nota],
            "{$correspondencia->folio} quedó en seguimiento"
        );
    }

    /** Quita la correspondencia del seguimiento del usuario. */
    public function dejarDeSeguir(Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if ($user->estaAuditando()) {
            return $this->errorResponse('En modo auditoría no se puede cambiar el seguimiento.', 403);
        }

        \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $user->contexto()->id)
            ->where('correspondencia_id', $correspondencia->id)
            ->delete();

        return $this->successResponse(
            ['en_seguimiento' => false],
            "{$correspondencia->folio} salió de seguimiento"
        );
    }

    /**
     * Lo que el usuario sigue, ordenado por lo MÁS ESTANCADO primero (mayor
     * tiempo sin movimiento arriba). Es la lista corta y estable que no se
     * desordena aunque entren correspondencias nuevas todos los días.
     */
    public function seguimiento(Request $request)
    {
        $user  = Auth::user();
        $ctxId = $user->contexto()->id;

        $notas = \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $ctxId)
            ->pluck('nota', 'correspondencia_id');

        if ($notas->isEmpty()) {
            return $this->successResponse([
                'items' => [], 'total' => 0, 'page' => 1, 'last_page' => 1, 'per_page' => 0,
            ]);
        }

        // El filtro de visibilidad se aplica igual: seguir una correspondencia no
        // da acceso a ella. Si el usuario deja de tener acceso, deja de verla acá.
        $paginador = $this->entradasVisibles($user)
            ->whereIn('id', $notas->keys())
            ->with([
                'departamento', 'usuario',
                'derivaciones:id,correspondencia_id,usuario_origen_id,actuando_como_user_id,usuario_destino_id,estado,fecha_recepcion',
                'derivaciones.usuarioDestino:id,nombre',
                'mensajes:id,correspondencia_id,usuario_id',
            ])
            // NULL primero (nunca registró actividad), luego lo más antiguo.
            ->orderByRaw('ultima_actividad_at IS NULL DESC, ultima_actividad_at ASC')
            ->paginate($request->input('per_page', 30));

        $items = $paginador->getCollection();
        $items->each(fn ($c) => $c->append('resumen_gestion'));
        $this->marcarBanderas($items, $ctxId);
        $items->each(function ($c) use ($notas) {
            $c->nota_seguimiento   = $notas[$c->id] ?? null;
            $c->dias_sin_movimiento = $c->diasSinMovimiento();
            $c->estancada = !$c->estaArchivada()
                && $c->dias_sin_movimiento !== null
                && $c->dias_sin_movimiento >= self::DIAS_ESTANCADA;
        });

        return $this->successResponse([
            'items'     => $items->values()->all(),
            'total'     => $paginador->total(),
            'page'      => $paginador->currentPage(),
            'last_page' => $paginador->lastPage(),
            'per_page'  => $paginador->perPage(),
        ]);
    }

    /**
     * Feed de últimos movimientos del municipio (los visibles para el usuario).
     *
     * Una sola consulta ordenada sobre `correspondencia_eventos`, que desde
     * ahora recibe TODO movimiento vía Correspondencia::registrarActividad.
     * Antes esto habría exigido recomponer derivaciones + acuses + mensajes en
     * PHP, como hace el hilo del detalle, pero sin poder acotar por fecha.
     */
    public function movimientos(Request $request)
    {
        $user  = Auth::user();
        $ctxId = $user->contexto()->id;

        // Techo duro: este endpoint alimenta un panel del dashboard, no un listado.
        $limite = max(1, min((int) $request->input('limit', 20), 50));

        $visibles = $this->entradasVisibles($user)->select('correspondencia.id');

        $query = \App\Models\CorrespondenciaEvento::whereIn('correspondencia_id', $visibles)
            ->with([
                'usuario:id,nombre,cargo',
                'correspondencia:id,folio,remitente,estado',
            ])
            ->orderByDesc('created_at')
            ->limit($limite);

        if ($request->boolean('solo_seguidas')) {
            $query->whereIn(
                'correspondencia_id',
                \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $ctxId)
                    ->select('correspondencia_id')
            );
        }

        $items = $query->get()->map(fn ($e) => [
            'id'                 => $e->id,
            'correspondencia_id' => $e->correspondencia_id,
            'folio'              => $e->correspondencia?->folio,
            'remitente'          => $e->correspondencia?->remitente,
            'estado'             => $e->correspondencia?->estado,
            'tipo'               => $e->tipo,
            'autor'              => $e->usuario?->nombre,
            'cargo'              => $e->usuario?->cargo,
            'texto'              => ($e->usuario?->nombre ?? 'Sistema') . ' ' . $e->texto,
            'fecha'              => $e->created_at,
        ]);

        return $this->successResponse($items);
    }

    /**
     * Registro general de correspondencia (solo lectura): TODAS las correspondencias del
     * municipio —entradas y salidas, cualquier estado y nivel de acceso—, sin el filtro
     * de visibilidad. Disponible solo para usuarios con el permiso explícito (o admin).
     */
    public function registro(Request $request)
    {
        $user = Auth::user();
        // El permiso se evalúa sobre el CONTEXTO: al subrogar se ve exactamente
        // lo del subrogado (si él no puede ver el registro, el subrogante tampoco).
        if (!($user->contexto()->puede_ver_registro_correspondencia || $user->isAdmin())) {
            return $this->errorResponse('No tienes permiso para ver el registro de correspondencia', 403);
        }

        $query = Correspondencia::query()
            ->with([
                'departamento', 'usuario', 'adjuntos',
                'derivaciones:id,correspondencia_id,usuario_origen_id,actuando_como_user_id,usuario_destino_id,estado,fecha_recepcion',
                'derivaciones.usuarioDestino:id,nombre',
                'mensajes:id,correspondencia_id,usuario_id',
            ]);

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->filled('direccion')) {
            $query->where('direccion', $request->direccion);
        }
        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_recibo', '>=', $request->fecha_desde);
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_recibo', '<=', $request->fecha_hasta);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('remitente', 'like', "%{$search}%")
                    ->orWhere('numero_documento', 'like', "%{$search}%")
                    ->orWhere('folio', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%");
            });
        }

        $correspondencias = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));
        $correspondencias->getCollection()->each(fn ($c) => $c->append('resumen_gestion'));

        return $this->successResponse($correspondencias);
    }

    public function store(Request $request)
    {
        $request->validate([
            'remitente' => 'required|string|max:255',
            'fecha_recibo' => 'required|date',
            'numero_documento' => 'nullable|string|max:100',
            'fecha_documento' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'departamento_id' => 'nullable|exists:departamentos,id',
        ]);

        $correspondencia = Correspondencia::create([
            ...$request->only([
                'numero_documento',
                'remitente',
                'fecha_documento',
                'fecha_recibo',
                'descripcion',
                'departamento_id',
            ]),
            // Folio de ingreso: correlativo institucional propio, por año.
            'folio' => Correspondencia::siguienteFolio('ING'),
            'direccion' => 'entrada',
            'usuario_id' => Auth::id(),
            'estado' => 'pendiente',
        ]);

        $correspondencia->load(['departamento', 'usuario']);

        return $this->successResponse($correspondencia, 'Correspondencia creada correctamente', 201);
    }

    public function show(Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if (!$correspondencia->esVisiblePara($user)) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        // Marcar como leída al abrirla (apaga el indicador de novedades). En modo
        // auditoría NO se toca: no debe ensuciar las lecturas reales del funcionario.
        if (!$user->estaAuditando()) {
            \App\Models\CorrespondenciaLectura::updateOrCreate(
                ['usuario_id' => $user->contexto()->id, 'correspondencia_id' => $correspondencia->id],
                ['leido_at' => now()]
            );
        }

        $correspondencia->load([
            'departamento',
            'usuario',
            'adjuntos',
            'derivaciones.departamentoOrigen',
            'derivaciones.departamentoDestino',
            'derivaciones.usuarioOrigen',
            'derivaciones.usuarioDestino',
            'derivaciones.actuandoComo',
            'mensajes:id,correspondencia_id,usuario_id',
            'respuestas:id,folio,tipo_documento_salida,estado,remitente,firmante_nombre,fecha_despacho,respuesta_a_id,usuario_id',
            'respuestaA:id,folio,remitente',
        ]);
        $correspondencia->append('resumen_gestion');

        return $this->successResponse($correspondencia);
    }

    public function update(Request $request, Correspondencia $correspondencia)
    {
        // Solo oficial de partes o admin pueden editar, y solo mientras siga
        // pendiente. Usa roles EFECTIVOS (respeta el perfil activo elegido).
        $user = Auth::user();
        $puedeEditar = $user->isAdmin() || $user->isOficial();
        if (!$puedeEditar) {
            return $this->errorResponse('Solo la Oficina de Partes o un administrador pueden editar la correspondencia', 403);
        }

        if ($correspondencia->estado !== 'pendiente') {
            return $this->errorResponse('Solo se puede editar correspondencia en estado pendiente', 400);
        }

        $request->validate([
            'remitente' => 'sometimes|required|string|max:255',
            'fecha_recibo' => 'sometimes|required|date',
            'numero_documento' => 'nullable|string|max:100',
            'fecha_documento' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'departamento_id' => 'nullable|exists:departamentos,id',
            'estado' => 'sometimes|in:pendiente,derivada_alcaldia,en_proceso,derivada_funcionario,completada,archivado',
        ]);

        $correspondencia->update($request->only([
            'numero_documento',
            'remitente',
            'fecha_documento',
            'fecha_recibo',
            'descripcion',
            'departamento_id',
            'estado',
        ]));

        $correspondencia->load(['departamento', 'usuario']);

        return $this->successResponse($correspondencia, 'Correspondencia actualizada');
    }

    public function destroy(Correspondencia $correspondencia)
    {
        $user = Auth::user();

        // Solo oficina de partes / admin pueden eliminar registros de correspondencia.
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('No tienes permiso para eliminar correspondencia.', 403);
        }

        // Con derivaciones ya emitidas (providencias firmadas) el registro es parte
        // de la trazabilidad institucional: no se elimina.
        if ($correspondencia->derivaciones()->exists()) {
            return $this->errorResponse('No se puede eliminar: la correspondencia tiene derivaciones registradas.', 422);
        }

        // Borrar también los archivos físicos de los adjuntos.
        foreach ($correspondencia->adjuntos as $adjunto) {
            Storage::disk('public')->delete($adjunto->ruta_archivo);
        }

        $correspondencia->delete();

        return $this->successResponse(null, 'Correspondencia eliminada');
    }

    /**
     * Cierre formal del proceso: SOLO el Alcalde archiva, y solo cuando la
     * correspondencia ya fue recibida por sus destinatarios. Al archivar
     * queda de solo lectura (sin mensajes, derivaciones ni respuestas).
     */
    public function archivar(Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if (!$user->isAlcalde()) {
            return $this->errorResponse('Solo el Alcalde puede cerrar el proceso de una correspondencia.', 403);
        }
        if ($correspondencia->direccion !== 'entrada') {
            return $this->errorResponse('Solo se archivan correspondencias de entrada.', 422);
        }
        if ($correspondencia->estado !== 'completada') {
            return $this->errorResponse(
                'Solo se puede cerrar el proceso cuando la correspondencia fue recibida por sus destinatarios.',
                422
            );
        }

        $correspondencia->update([
            'estado' => 'archivado',
            'archivada_por' => $user->id,
            'archivada_at' => now(),
        ]);

        // Hito permanente en la trazabilidad del hilo (lo escribe registrarActividad,
        // único punto por el que pasa todo movimiento).
        $correspondencia->registrarActividad(
            $user->contexto()->id,
            'archivada',
            'cerró el proceso (completada)',
            $user->id
        );

        return $this->successResponse(
            $correspondencia->fresh(),
            "Proceso cerrado: {$correspondencia->folio} quedó completada"
        );
    }

    /** Reabre el proceso (solo el Alcalde): vuelve a "En gestión". */
    public function desarchivar(Correspondencia $correspondencia)
    {
        $user = Auth::user();
        if (!$user->isAlcalde()) {
            return $this->errorResponse('Solo el Alcalde puede desarchivar una correspondencia.', 403);
        }
        if ($correspondencia->estado !== 'archivado') {
            return $this->errorResponse('La correspondencia no está archivada.', 422);
        }

        $correspondencia->update([
            'estado' => 'completada',
            'archivada_por' => null,
            'archivada_at' => null,
        ]);

        // Hito permanente en la trazabilidad del hilo (lo escribe registrarActividad).
        $correspondencia->registrarActividad(
            $user->contexto()->id,
            'desarchivada',
            'reabrió el proceso (desarchivada)',
            $user->id
        );

        return $this->successResponse(
            $correspondencia->fresh(),
            "Proceso reabierto: {$correspondencia->folio} volvió a gestión"
        );
    }

    public function bandeja(Request $request)
    {
        $user = Auth::user();
        $ctx  = $user->contexto();

        $query = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino:id,nombre,cargo',
            'actuandoComo:id,nombre,cargo',
        ])->whereIn('estado', ['pendiente', 'recibido']);

        // Admin y oficina de partes (oficial) ven TODO (supervisión, solo lectura).
        // El resto ve lo dirigido a su persona, o a su departamento (cuando la
        // derivación no apunta a un usuario específico).
        if (!$user->isAdmin() && !$user->isOficial()) {
            $query->where(function ($q) use ($ctx) {
                $q->where('usuario_destino_id', $ctx->id)
                  ->orWhere(function ($q2) use ($ctx) {
                      $q2->whereNull('usuario_destino_id')
                         ->where('departamento_destino_id', $ctx->departamento_id);
                  });
            });
        }

        $derivaciones = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        // Marca por ítem si el usuario puede ACTUAR (recibir/archivar) o solo ver.
        $derivaciones->getCollection()->transform(function (Derivacion $d) use ($user) {
            $d->puede_actuar = $d->esDestinatario($user);
            return $d;
        });

        return $this->successResponse($derivaciones);
    }

    public function estadisticas()
    {
        // Mismos criterios de visibilidad que el listado: cada usuario ve
        // contadores de SU universo (admin/oficial, el total del municipio).
        $porEstado = Correspondencia::visiblesPara(Auth::user())
            ->entradas()
            ->selectRaw('estado, COUNT(*) as n')
            ->groupBy('estado')
            ->pluck('n', 'estado');

        $stats = [
            'total' => $porEstado->sum(),
            'pendientes' => (int) ($porEstado['pendiente'] ?? 0),
            'derivada_alcaldia' => (int) ($porEstado['derivada_alcaldia'] ?? 0),
            // "En proceso" agrupa TODO lo que está en gestión activa (derivada a
            // Alcaldía, circulando entre funcionarios, derivada a funcionario y en
            // gestión). Antes contaba solo el estado literal 'en_proceso', que
            // casi no se usa → mostraba 0 aunque hubiera correspondencia en curso.
            'en_proceso' => (int) (($porEstado['derivada_alcaldia'] ?? 0)
                + ($porEstado['en_proceso'] ?? 0)
                + ($porEstado['derivada_funcionario'] ?? 0)
                + ($porEstado['completada'] ?? 0)),
            'derivada_funcionario' => (int) ($porEstado['derivada_funcionario'] ?? 0),
            'completada' => (int) ($porEstado['completada'] ?? 0),
            // "Completadas" = proceso cerrado por el Alcalde ('archivado' en BD).
            'archivadas' => (int) ($porEstado['archivado'] ?? 0),
        ];

        return $this->successResponse($stats);
    }

    /**
     * Panel del alcalde: KPIs accionables, salud de la gestión, lo que requiere
     * su atención y los atrasos (derivaciones sin acuse). Todo sobre el universo
     * visible del usuario, calculado al vuelo (sin estados nuevos).
     */
    public function panelAlcalde()
    {
        $user  = Auth::user();
        $ctxId = $user->contexto()->id;

        $corrs = Correspondencia::visiblesPara($user)
            ->entradas()
            ->with([
                'derivaciones:id,correspondencia_id,usuario_origen_id,actuando_como_user_id,usuario_destino_id,estado,fecha_recepcion,created_at',
                'derivaciones.usuarioDestino:id,nombre',
                'mensajes:id,correspondencia_id,usuario_id',
            ])
            ->get();

        $lecturas = \App\Models\CorrespondenciaLectura::where('usuario_id', $ctxId)
            ->pluck('leido_at', 'correspondencia_id');

        $umbralAmarillo = 3; // días sin acuse → alerta
        $umbralRojo     = 5;
        $ahora = now();

        $kpis  = ['por_derivar' => 0, 'en_gestion' => 0, 'esperando_acuse' => 0, 'por_cerrar' => 0, 'completadas' => 0];
        $salud = ['derivadas' => 0, 'acuse_completo' => 0, 'acuse_parcial' => 0, 'sin_acuse' => 0, 'respondieron' => 0];
        $requiereAtencion = [];
        $atrasos = [];
        $estancadas = [];
        // Rezago: en gestión y sin movimiento hace más de DIAS_REZAGO. No es
        // urgencia, es trabajo por formalizar; se ataca con el cierre en lote.
        $rezago = 0;

        // Las que el Alcalde marcó con estrella: se destacan en su panel.
        $seguidas = \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $ctxId)
            ->pluck('correspondencia_id')
            ->flip();

        foreach ($corrs as $c) {
            if (in_array($c->estado, ['pendiente', 'derivada_alcaldia'], true)) {
                $kpis['por_derivar']++;
            } elseif (in_array($c->estado, ['derivada_funcionario', 'en_proceso', 'completada'], true)) {
                $kpis['en_gestion']++;
            } elseif ($c->estado === 'archivado') {
                $kpis['completadas']++;
            }
            if ($c->estado === 'completada') {
                $kpis['por_cerrar']++;
            }

            // Salud de la gestión (solo aplica cuando ya se derivó a funcionarios).
            $resumen = $c->resumen_gestion;
            if ($resumen['destinatarios'] > 0) {
                $salud['derivadas']++;
                if ($resumen['con_acuse'] >= $resumen['destinatarios']) {
                    $salud['acuse_completo']++;
                } elseif ($resumen['con_acuse'] > 0) {
                    $salud['acuse_parcial']++;
                } else {
                    $salud['sin_acuse']++;
                    $kpis['esperando_acuse']++;
                }
                if (count($resumen['respondieron']) > 0) {
                    $salud['respondieron']++;
                }
            }

            // Requiere tu atención: en su despacho, o con novedades sin leer.
            $act   = $c->ultima_actividad_at;
            $leido = $lecturas[$c->id] ?? null;
            $novedad = $act && (!$leido || $act->gt($leido));
            if (in_array($c->estado, ['pendiente', 'derivada_alcaldia'], true)) {
                $requiereAtencion[] = ['id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente, 'motivo' => 'En tu despacho'];
            } elseif ($novedad) {
                $requiereAtencion[] = ['id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente, 'motivo' => 'Novedad sin leer'];
            }

            // ESTANCADAS: ya la acusaron —entonces no figura como atraso—, pero
            // nadie ha hecho nada en semanas. Es el agujero que dejaba el panel:
            // acusar recibo es el gesto más barato del destinatario y apagaba
            // toda alarma, dejando la correspondencia fuera del radar del Alcalde.
            //
            // Es una VENTANA (7 a 30 días), no un piso. Con un piso, el rezago
            // de meses sepultaba lo accionable: en la medición del 2026-09-01
            // eran 306 de 387, con las 27 que de verdad se acababan de detener
            // perdidas entre 200 de más de un mes. Lo más antiguo que eso no es
            // algo que "se detuvo": es trabajo terminado sin cerrar, y va al
            // contador de rezago, que se resuelve cerrando en lote.
            if (in_array($c->estado, ['derivada_funcionario', 'en_proceso', 'completada'], true)) {
                $diasQuieta = $c->diasSinMovimiento();

                if ($diasQuieta !== null && $diasQuieta > self::DIAS_REZAGO && $c->estado === 'completada') {
                    $rezago++;
                }

                if ($diasQuieta !== null
                    && $diasQuieta >= self::DIAS_ESTANCADA
                    && $diasQuieta <= self::DIAS_REZAGO) {
                    $estancadas[] = [
                        'id'             => $c->id,
                        'folio'          => $c->folio,
                        'remitente'      => $c->remitente,
                        'estado'         => $c->estado,
                        'dias'           => $diasQuieta,
                        'en_seguimiento' => $seguidas->has($c->id),
                    ];
                }
            }

            // Atrasos: derivaciones a un funcionario, sin acuse, hace ≥ umbral días.
            foreach ($c->derivaciones as $d) {
                if ($d->usuario_destino_id && $d->estado === 'pendiente' && !$d->fecha_recepcion) {
                    $dias = (int) $d->created_at->diffInDays($ahora);
                    if ($dias >= $umbralAmarillo) {
                        $atrasos[] = [
                            'id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente,
                            'destinatario' => $d->usuarioDestino?->nombre, 'dias' => $dias,
                            'nivel' => $dias >= $umbralRojo ? 'rojo' : 'amarillo',
                        ];
                    }
                }
            }
        }

        usort($atrasos, fn ($a, $b) => $b['dias'] <=> $a['dias']);
        // Lo seguido primero y, dentro de eso, lo más quieto arriba.
        usort($estancadas, fn ($a, $b) => [$b['en_seguimiento'], $b['dias']] <=> [$a['en_seguimiento'], $a['dias']]);

        return $this->successResponse([
            'kpis'                => $kpis,
            'salud'               => $salud,
            'requiere_atencion'   => array_slice($requiereAtencion, 0, 8),
            'atrasos'             => array_slice($atrasos, 0, 8),
            'estancadas'          => array_slice($estancadas, 0, 8),
            'total_estancadas'    => count($estancadas),
            'dias_estancada'      => self::DIAS_ESTANCADA,
            'dias_rezago'         => self::DIAS_REZAGO,
            'rezago_por_cerrar'   => $rezago,
            'total_en_seguimiento' => $seguidas->count(),
        ]);
    }

    /**
     * Panel del funcionario común: KPIs de SU trabajo (lo que le derivaron),
     * lo que requiere su atención y lo que lleva sin acusar (atrasos).
     */
    public function panelFuncionario()
    {
        $user  = Auth::user();
        $ctx   = $user->contexto();
        $ctxId = $ctx->id;

        // Derivaciones dirigidas a mí (a mi persona, o a mi depto sin usuario),
        // igual criterio que la bandeja.
        $derivaciones = Derivacion::where(function ($q) use ($ctxId, $ctx) {
                $q->where('usuario_destino_id', $ctxId)
                  ->orWhere(function ($q2) use ($ctx) {
                      $q2->whereNull('usuario_destino_id')
                         ->where('departamento_destino_id', $ctx->departamento_id);
                  });
            })
            ->with(['correspondencia:id,folio,remitente,estado,ultima_actividad_at'])
            ->get();

        $lecturas = \App\Models\CorrespondenciaLectura::where('usuario_id', $ctxId)
            ->pluck('leido_at', 'correspondencia_id');

        $umbralAmarillo = 3;
        $umbralRojo     = 5;
        $ahora = now();

        $kpis = ['por_recibir' => 0, 'en_gestion' => 0, 'con_novedades' => 0, 'archivadas' => 0];
        $requiereAtencion = [];
        $atrasos = [];

        foreach ($derivaciones as $d) {
            $c = $d->correspondencia;
            if (!$c) {
                continue;
            }

            if ($d->estado === 'pendiente') {
                $kpis['por_recibir']++;
                $requiereAtencion[] = ['id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente, 'motivo' => 'Por acusar recibo'];
                $dias = (int) $d->created_at->diffInDays($ahora);
                if ($dias >= $umbralAmarillo) {
                    $atrasos[] = [
                        'id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente,
                        'dias' => $dias, 'nivel' => $dias >= $umbralRojo ? 'rojo' : 'amarillo',
                    ];
                }
            } elseif ($d->estado === 'recibido') {
                $kpis['en_gestion']++;
            } elseif ($d->estado === 'archivado') {
                $kpis['archivadas']++;
            }

            // Novedades sin leer (no las que ya están "por acusar", para no duplicar).
            $act   = $c->ultima_actividad_at;
            $leido = $lecturas[$c->id] ?? null;
            if ($act && (!$leido || $act->gt($leido))) {
                $kpis['con_novedades']++;
                if ($d->estado !== 'pendiente') {
                    $requiereAtencion[] = ['id' => $c->id, 'folio' => $c->folio, 'remitente' => $c->remitente, 'motivo' => 'Novedad sin leer'];
                }
            }
        }

        usort($atrasos, fn ($a, $b) => $b['dias'] <=> $a['dias']);

        return $this->successResponse([
            'kpis'              => $kpis,
            'requiere_atencion' => array_slice($requiereAtencion, 0, 8),
            'atrasos'           => array_slice($atrasos, 0, 8),
        ]);
    }

    public function search(Request $request)
    {
        return $this->index($request);
    }

    /**
     * Exporta el libro de correspondencia a CSV (compatible con Excel),
     * respetando los mismos filtros del listado. Solo Oficina de Partes
     * y administradores.
     */
    public function exportar(Request $request)
    {
        $user = Auth::user();
        if (!$user->isAdmin() && !$user->isOficial()) {
            return $this->errorResponse('Solo la Oficina de Partes o un administrador pueden exportar', 403);
        }

        $query = Correspondencia::visiblesPara($user)
            ->entradas()
            ->with(['departamento', 'usuario', 'derivaciones.usuarioDestino', 'derivaciones.departamentoDestino']);

        if ($request->filled('estado')) {
            $query->where('estado', $request->estado);
        }
        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }
        if ($request->filled('fecha_desde')) {
            $query->whereDate('fecha_recibo', '>=', $request->fecha_desde);
        }
        if ($request->filled('fecha_hasta')) {
            $query->whereDate('fecha_recibo', '<=', $request->fecha_hasta);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('remitente', 'like', "%{$search}%")
                    ->orWhere('numero_documento', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%");
            });
        }

        $correspondencias = $query->orderBy('fecha_recibo')->orderBy('id')->get();

        $estadoLabels = [
            'pendiente' => 'Pendiente',
            'derivada_alcaldia' => 'Derivada a Alcaldía',
            'en_proceso' => 'En Proceso',
            'derivada_funcionario' => 'Derivada a Funcionario',
            'completada' => 'En gestión',
            'archivado' => 'Completada',
        ];

        $filename = 'libro-correspondencia-' . now()->format('Y-m-d_Hi') . '.csv';

        return response()->streamDownload(function () use ($correspondencias, $estadoLabels) {
            $out = fopen('php://output', 'w');
            // BOM UTF-8 para que Excel reconozca acentos; separador ";" (Excel es-CL)
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Folio', 'N° Documento', 'Remitente', 'Fecha Documento', 'Fecha Recibo',
                'Departamento', 'Descripción', 'Estado', 'Derivada a', 'Folio Providencia', 'Ingresada por',
            ], ';');

            foreach ($correspondencias as $c) {
                $destinos = $c->derivaciones
                    ->map(fn ($d) => $d->usuarioDestino?->nombre ?? $d->departamentoDestino?->nombre)
                    ->filter()->unique()->implode(', ');
                $folios = $c->derivaciones->pluck('folio')->filter()->implode(', ');

                fputcsv($out, [
                    $c->folio ?? $c->id,
                    $c->numero_documento,
                    $c->remitente,
                    $c->fecha_documento?->format('d-m-Y'),
                    $c->fecha_recibo?->format('d-m-Y'),
                    $c->departamento?->nombre,
                    $c->descripcion,
                    $estadoLabels[$c->estado] ?? $c->estado,
                    $destinos,
                    $folios,
                    $c->usuario?->nombre,
                ], ';');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function getAlcaldeInfo()
    {
        $alcalde = User::where('activo', true)
            ->whereJsonContains('roles', 'alcalde')
            ->with('departamento')
            ->first();

        if (!$alcalde) {
            return $this->errorResponse('No se encontró un usuario con rol Alcalde activo', 404);
        }

        return $this->successResponse([
            'user_id' => $alcalde->id,
            'nombre' => $alcalde->nombre,
            'departamento_id' => $alcalde->departamento_id,
            'departamento_nombre' => $alcalde->departamento?->nombre,
        ]);
    }

    public function descargarProvidencia(Correspondencia $correspondencia)
    {
        if (!$correspondencia->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }

        if (!$correspondencia->providencia_generada || !$correspondencia->providencia_pdf) {
            return $this->errorResponse('Esta correspondencia no tiene providencia generada', 404);
        }

        $path = 'public/' . $correspondencia->providencia_pdf;

        if (!Storage::exists($path)) {
            return $this->errorResponse('Archivo de providencia no encontrado', 404);
        }

        return Storage::download($path, 'providencia_' . $correspondencia->id . '.pdf', [
            'Content-Type' => 'application/pdf',
        ]);
    }
}
