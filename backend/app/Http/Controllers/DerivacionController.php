<?php

namespace App\Http\Controllers;

use App\Models\Departamento;
use App\Models\Derivacion;
use App\Models\Correspondencia;
use App\Models\Notificacion;
use App\Models\User;
use App\Services\NotificacionService;
use App\Services\FirmaGobService;
use App\Services\ProvidenciaPdfService;
use App\Exceptions\FirmaGobException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DerivacionController extends Controller
{
    // resolverDestinos/resolverDestinatarios/resolverDepartamentosDestino nacieron
    // aquí; viven en el trait desde que los expedientes también derivan a varios.
    use \App\Http\Controllers\Concerns\ResuelveDestinosDerivacion;

    private const PREVIEW_CACHE_PREFIX = 'derivacion_preview:';
    private const PREVIEW_TTL_MINUTES = 15;

    public function index(Request $request)
    {
        $query = Derivacion::with([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino',
        ])
            // Solo derivaciones de correspondencias visibles para el usuario
            // (admin/oficial ven todo; el resto, solo donde participa).
            ->whereHas('correspondencia', function ($q) {
                $q->visiblesPara(Auth::user());
            });

        if ($request->filled('correspondencia_id')) {
            $query->where('correspondencia_id', $request->correspondencia_id);
        }

        $derivaciones = $query->orderBy('created_at', 'desc')->get();

        return $this->successResponse($derivaciones);
    }

    public function store(Request $request)
    {
        $request->validate([
            'correspondencia_id' => 'required|exists:correspondencia,id',
            'departamento_destino_id' => 'nullable|exists:departamentos,id',
            'departamento_destino_ids' => 'nullable|array',
            'departamento_destino_ids.*' => 'exists:departamentos,id',
            'usuario_destino_id' => 'nullable|exists:users,id',
            'usuario_destino_ids' => 'nullable|array',
            'usuario_destino_ids.*' => 'exists:users,id',
            'derivar_a_todos' => 'nullable|boolean',
            'observaciones' => 'nullable|string',
            'acciones_para' => 'nullable|array',
            'acciones_para.*' => 'string',
            'otp'        => 'nullable|string',
            'firma_desatendida' => 'nullable|boolean',
            'firma_y'    => 'nullable|integer|min:0|max:20000',
            'firma_page' => 'nullable|string',
            'firma_col'  => 'nullable|integer|in:0,1,2',
            'firma_x'    => 'nullable|integer|min:0|max:20000',
            'firma_x2'   => 'nullable|integer|min:0|max:20000',
            'firma_y2'   => 'nullable|integer|min:0|max:20000',
            'firma_page_h' => 'nullable|integer|min:100|max:20000',
            'firma_page_w' => 'nullable|integer|min:100|max:20000',
            'preview_token' => 'nullable|string',
        ]);

        $user = Auth::user();
        $ctx = $user->contexto();
        $correspondencia = Correspondencia::find($request->correspondencia_id);

        // Destinos: funcionarios específicos y/o departamentos completos. Ambas
        // listas son independientes y se pueden combinar en una misma derivación
        // (ej: al Director de Obras y, además, a todo SECPLAN). Ver resolverDestinos()
        // para la normalización de quien queda cubierto por ambas vías.
        [$destinatarios, $departamentosDestino] = $this->resolverDestinos($request);
        if ($destinatarios->isEmpty() && $departamentosDestino->isEmpty()) {
            return $this->errorResponse(
                'Indica al menos un destino: funcionario(s), departamento(s) o todos los funcionarios.',
                422
            );
        }
        $esAlcaldeDerivando = $this->alcaldePuedeDerivar($user, $correspondencia);

        // Autorización para derivar:
        // - oficina de partes / admin: la primera derivación (estado pendiente);
        // - alcalde: lo que está en su despacho, y también lo ya derivado, para
        //   poder sumar a alguien que se olvidó (ver alcaldePuedeDerivar);
        // - funcionario: re-derivar solo lo que tiene activo en su bandeja
        //   (es destinatario de una derivación pendiente/recibida).
        if (!$correspondencia->esVisiblePara($user)) {
            return $this->errorResponse('No tienes acceso a esta correspondencia.', 403);
        }
        if ($correspondencia->estaArchivada()) {
            return $this->errorResponse('El proceso está cerrado (archivada por el Alcalde): no admite nuevas derivaciones.', 422);
        }
        $esOficinaPartes = ($user->isAdmin() || $user->isOficial()) && $correspondencia->estado === 'pendiente';
        $esDestinatarioActivo = $correspondencia->derivaciones()
            ->whereIn('estado', ['pendiente', 'recibido'])
            ->get()
            ->contains(fn ($d) => $d->esDestinatario($user));
        if (!$esOficinaPartes && !$esAlcaldeDerivando && !$esDestinatarioActivo) {
            return $this->errorResponse('No puedes derivar esta correspondencia en su estado actual.', 403);
        }

        // Origen institucional = subrogado si hay actuando-como (es el alcalde
        // quien "deriva"); actor real (usuario_origen_id) sigue siendo $user,
        // con actuando_como_user_id apuntando al subrogado para trazabilidad.
        $derivacionData = [
            'correspondencia_id' => $request->correspondencia_id,
            'departamento_origen_id' => $ctx->departamento_id,
            'usuario_origen_id' => $user->id,
            'actuando_como_user_id' => $user->getActuandoComo()?->id,
            'observaciones' => $request->observaciones,
            'acciones_para' => $request->acciones_para,
            'estado' => 'pendiente',
        ];

        // Si es alcalde derivando a funcionario, obtener providencia (de cache si vino preview_token)
        if ($esAlcaldeDerivando) {
            $correspondencia->load(['departamento']);

            $resolved = $this->resolverProvidencia(
                $request->preview_token,
                $user,
                $correspondencia,
                fn () => $this->paramsProvidenciaDerivar($request, $user)
            );

            if ($resolved === null) {
                return $this->errorResponse(
                    'La vista previa de la providencia expiró. Vuelve a derivar para regenerarla.',
                    422
                );
            }

            $pdfContent = $resolved['pdf_content'];
            $folio = $resolved['folio'];
            $codigoVerificacion = $resolved['codigo_verificacion'];

            // Firma desatendida (sin OTP): solo si el usuario la tiene habilitada.
            $desatendida = $request->boolean('firma_desatendida');
            if ($desatendida && !$user->firma_desatendida_habilitada) {
                return $this->errorResponse(
                    'No tienes habilitada la firma desatendida. Solicítala al administrador.',
                    403
                );
            }

            // Firmar con FirmaGob si viene OTP (atendida) o si es desatendida.
            $debeFirmar = ($request->filled('otp') || $desatendida) && config('firmagob.enabled');
            if ($debeFirmar) {
                $this->recordarModoFirma($user, $desatendida);
                try {
                    $firmaService = app(FirmaGobService::class);
                    [$coords, $pageH] = $this->calcularCoordenadas($request);
                    $firmaPage = $request->firma_page ?? 'LAST';
                    $signed = $firmaService->sign(
                        $pdfContent,
                        'Providencia ' . $folio,
                        $user->rut,
                        $desatendida ? null : $request->otp,
                        $user->nombre,
                        $user->cargoFirma() ?? 'Alcalde',
                        $coords,
                        $firmaPage,
                        $desatendida ? config('firmagob.purpose_desatendido') : null,
                        $pageH
                    );
                    $pdfContent = $signed['content'];
                    Log::info('Providencia firmada con FirmaGob', [
                        'folio' => $folio,
                        'modo'  => $desatendida ? 'desatendida' : 'atendida',
                    ]);
                } catch (FirmaGobException $e) {
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            // Persistir PDF (firmado o no) sólo después de que la firma haya tenido éxito
            $filename = 'providencia_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            Storage::put($path, $pdfContent);

            // El folio es ÚNICO en derivaciones (verificación QR: 1 folio = 1 fila),
            // así que la providencia se asocia solo a la primera derivación del lote.
            $providenciaData = [
                'folio' => $folio,
                'codigo_verificacion' => $codigoVerificacion,
                'pdf_ruta' => 'providencias/' . $filename,
            ];

            $this->descartarPreview($request->preview_token);
        }

        // Crear las derivaciones: una por funcionario destinatario y una por
        // departamento completo. El departamento de una derivación a funcionario
        // es el suyo (respaldo: el del propio origen).
        // El folio de providencia es ÚNICO en derivaciones, así que la providencia
        // se asocia solo a la primera fila del lote.
        $derivaciones = collect();
        foreach ($destinatarios as $dest) {
            $derivaciones->push(Derivacion::create($derivacionData + [
                'usuario_destino_id' => $dest->id,
                'departamento_destino_id' => $dest->departamento_id
                    ?? $request->departamento_destino_id
                    ?? $ctx->departamento_id,
            ] + ($derivaciones->isEmpty() ? ($providenciaData ?? []) : [])));
        }
        foreach ($departamentosDestino as $depto) {
            $derivaciones->push(Derivacion::create($derivacionData + [
                'usuario_destino_id' => null,
                'departamento_destino_id' => $depto->id,
            ] + ($derivaciones->isEmpty() ? ($providenciaData ?? []) : [])));
        }
        $derivacion = $derivaciones->first();

        // Actualizar estado de la correspondencia
        if ($esAlcaldeDerivando) {
            $correspondencia->update([
                'estado' => 'derivada_funcionario',
                'providencia_pdf' => $providenciaData['pdf_ruta'] ?? null,
                'providencia_generada' => true,
            ]);

            // Marcar la derivación original del alcalde como "derivado" (buscar
            // por el depto del subrogado si hay actuando-como; en modo normal
            // contexto == user).
            Derivacion::where('correspondencia_id', $correspondencia->id)
                ->where('departamento_destino_id', $ctx->departamento_id)
                ->whereIn('estado', ['pendiente', 'recibido'])
                ->whereNotIn('id', $derivaciones->pluck('id'))
                ->update(['estado' => 'derivado']);
        } else {
            $nuevoEstado = 'en_proceso';

            // Check if derivation is to the alcalde (by user or department)
            $esDerivacionAAlcalde = $destinatarios->contains(fn ($d) => $d->isAlcalde());

            // Also check if any destination department has an alcalde user
            if (!$esDerivacionAAlcalde && $departamentosDestino->isNotEmpty()) {
                $esDerivacionAAlcalde = User::whereIn('departamento_id', $departamentosDestino->pluck('id'))
                    ->whereJsonContains('roles', 'alcalde')
                    ->exists();
            }

            if ($esDerivacionAAlcalde) {
                $nuevoEstado = 'derivada_alcaldia';
            }

            $correspondencia->update(['estado' => $nuevoEstado]);
        }

        // Novedad para los destinatarios (quien deriva queda "al día") y hito
        // en la bitácora, que alimenta el feed de últimos movimientos.
        $nombresDestino = $destinatarios->pluck('nombre')
            ->merge($departamentosDestino->pluck('nombre'))
            ->filter()
            ->values();
        $correspondencia->registrarActividad(
            $ctx->id,
            'derivacion',
            'derivó a ' . ($nombresDestino->isNotEmpty()
                ? $nombresDestino->join(', ', ' y ')
                : 'su destinatario'),
            $user->id
        );

        $derivacion->load([
            'correspondencia',
            'departamentoOrigen',
            'departamentoDestino',
        ]);

        // Notificar a los destinatarios específicos y, por cada departamento
        // destino, a sus funcionarios. Quien ya fue notificado como destinatario
        // directo no se vuelve a notificar por su departamento.
        $yaNotificados = $destinatarios->pluck('id')->all();

        if ($destinatarios->isNotEmpty()) {
            NotificacionService::enviar(
                $destinatarios,
                'correspondencia',
                'correspondencia_recibida',
                'Nueva correspondencia en tu bandeja',
                "Se te ha derivado la correspondencia {$correspondencia->folio} de \"{$correspondencia->remitente}\".",
                ['correspondencia_id' => $correspondencia->id, 'derivacion_id' => $derivacion->id, 'url' => '/correspondencia/' . $correspondencia->id]
            );
        }

        $derivacionesPorDepto = $derivaciones->whereNull('usuario_destino_id')->keyBy('departamento_destino_id');
        foreach ($departamentosDestino as $depto) {
            $usuariosDestino = User::where('departamento_id', $depto->id)->get();

            // Si el departamento destino tiene un alcalde, la derivación "a
            // Alcaldía" está dirigida al alcalde: se notifica SOLO a quienes
            // tienen rol 'alcalde', no a todos los miembros del departamento
            // (evita que la secretaría u otros usuarios del depto —o el admin—
            // reciban la correspondencia del alcalde). Para departamentos
            // normales (sin alcalde) se sigue notificando a todo el departamento.
            $alcaldesDestino = $usuariosDestino->filter(fn ($u) => $u->isAlcalde());
            if ($alcaldesDestino->isNotEmpty()) {
                $usuariosDestino = $alcaldesDestino;
            }

            $usuariosDestino = $usuariosDestino
                ->reject(fn ($u) => in_array($u->id, $yaNotificados, true))
                ->values();
            if ($usuariosDestino->isEmpty()) {
                continue;
            }
            $yaNotificados = array_merge($yaNotificados, $usuariosDestino->pluck('id')->all());

            $derivacionDepto = $derivacionesPorDepto[$depto->id] ?? $derivacion;
            NotificacionService::enviar(
                $usuariosDestino,
                'correspondencia',
                'correspondencia_recibida',
                'Nueva correspondencia en tu bandeja',
                "Se ha derivado la correspondencia {$correspondencia->folio} de \"{$correspondencia->remitente}\" a {$depto->nombre}.",
                ['correspondencia_id' => $correspondencia->id, 'derivacion_id' => $derivacionDepto->id, 'url' => '/correspondencia/' . $correspondencia->id]
            );
        }

        $message = $esAlcaldeDerivando
            ? 'Derivación creada con providencia generada'
            : ($derivaciones->count() > 1
                ? "Derivación creada para {$derivaciones->count()} destinos"
                : 'Derivación creada correctamente');

        return $this->successResponse($derivacion, $message, 201);
    }

    /**
     * ¿El alcalde puede derivar esta correspondencia (generando providencia)?
     *
     * No solo la que está en su despacho (`derivada_alcaldia`): también la que ya
     * derivó. Derivar es un acto que se puede repetir — si se olvidó de un
     * destinatario, antes no había forma de sumarlo, porque el botón desaparecía
     * y previewDerivar respondía 403; había que corregir la base de datos a mano.
     * Cada derivación nueva genera su PROPIA providencia firmada (el folio PROV-
     * es un correlativo independiente), sin tocar las anteriores, igual que en
     * papel un oficio va acumulando providencias a medida que circula.
     *
     * Se excluye 'pendiente' (aún no pasa por oficina de partes: no le
     * corresponde al alcalde saltarse el ingreso) y la archivada, que ya se
     * bloquea antes por estar cerrada. Si la correspondencia estaba 'completada'
     * (todos acusaron), sumar un destinatario la devuelve a 'derivada_funcionario':
     * vuelve a haber un acuse pendiente.
     */
    private function alcaldePuedeDerivar(User $user, ?Correspondencia $correspondencia): bool
    {
        return $user->isAlcalde()
            && $correspondencia
            && in_array(
                $correspondencia->estado,
                ['derivada_alcaldia', 'derivada_funcionario', 'en_proceso', 'completada'],
                true
            );
    }

    /**
     * Descarga el PDF asociado a una derivación (providencia o acuse de recibo).
     */
    public function pdf(Derivacion $derivacion)
    {
        // Misma regla de visibilidad que el resto del módulo: admin/oficial ven todo;
        // el resto, solo derivaciones de correspondencias donde participa (la regla
        // sigue a contexto(), así el subrogante ve los PDFs del titular).
        if (!$derivacion->correspondencia?->esVisiblePara(Auth::user())) {
            return $this->errorResponse('Sin acceso a este documento', 403);
        }

        if (!$derivacion->pdf_ruta) {
            return $this->errorResponse('Esta derivación no tiene PDF generado', 404);
        }

        $fullPath = storage_path('app/public/' . $derivacion->pdf_ruta);
        if (!file_exists($fullPath)) {
            return $this->errorResponse('Archivo no encontrado', 404);
        }

        return response()->file($fullPath, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . basename($fullPath) . '"',
        ]);
    }

    /**
     * Calcula las coordenadas del sello [llx, lly, urx, ury] a partir de Y y columna.
     */
    /**
     * Caja del sello y alto de la página, tal como los midió el frontend sobre
     * el PDF real que se previsualizó.
     *
     * @return array{0: array<int>, 1: int} [[llx, lly, urx, ury], altoPagina]
     */
    private function calcularCoordenadas(Request $request): array
    {
        return FirmaGobService::rectDesdeParametros(
            $request->only(['firma_x', 'firma_y', 'firma_x2', 'firma_y2', 'firma_col', 'firma_page_h', 'firma_page_w']),
            2 // por defecto, columna derecha (donde va el timbre de la providencia)
        );
    }

    /**
     * Persiste el modo de firma elegido por el usuario para preseleccionarlo por
     * defecto en las próximas firmas. Solo escribe si cambió.
     */
    private function recordarModoFirma(User $user, bool $desatendida): void
    {
        $modo = $desatendida ? 'desatendido' : 'atendido';
        if ($user->firma_modo_preferido !== $modo) {
            $user->update(['firma_modo_preferido' => $modo]);
        }
    }

    /**
     * Si viene preview_token y es válido, retorna el PDF cacheado.
     * Si no viene token, genera un PDF fresco usando el callback de parámetros.
     * Retorna null si el token vino pero no es válido (expirado o de otro usuario/correspondencia).
     *
     * @return array{pdf_content: string, folio: string, codigo_verificacion: string}|null
     */
    private function resolverProvidencia(
        ?string $token,
        User $user,
        Correspondencia $correspondencia,
        callable $paramsBuilder
    ): ?array {
        if (!empty($token)) {
            $cached = Cache::get(self::PREVIEW_CACHE_PREFIX . $token);
            if (!$cached
                || ($cached['user_id'] ?? null) !== $user->id
                || ($cached['correspondencia_id'] ?? null) !== $correspondencia->id) {
                return null;
            }
            return [
                'pdf_content'         => base64_decode($cached['pdf_content']),
                'folio'               => $cached['folio'],
                'codigo_verificacion' => $cached['codigo_verificacion'],
            ];
        }

        return app(ProvidenciaPdfService::class)->generar($correspondencia, $paramsBuilder());
    }

    private function descartarPreview(?string $token): void
    {
        if (!empty($token)) {
            Cache::forget(self::PREVIEW_CACHE_PREFIX . $token);
        }
    }

    /**
     * Construye los parámetros para una providencia generada al derivar (alcalde → funcionario).
     */
    private function paramsProvidenciaDerivar(Request $request, User $user): array
    {
        // Destino para el cuerpo de la providencia según la modalidad: todos, o
        // la combinación de funcionario(s) específico(s) y departamento(s)
        // completo(s). Los departamentos de la providencia son los de los
        // funcionarios destinatarios MÁS los departamentos derivados completos.
        if ($request->boolean('derivar_a_todos')) {
            $departamentoDestino = 'Todas las direcciones y departamentos municipales';
            $usuarioDestino = 'Todos los funcionarios';
        } else {
            [$destinatarios, $departamentosDestino] = $this->resolverDestinos($request);
            $destinatarios->loadMissing('departamento');

            // ->toBase() NO es decorativo: map() sobre una colección de Eloquent
            // VACÍA sigue devolviendo una colección de Eloquent (no hay elementos
            // que la degraden a colección base), y merge() de Eloquent asume
            // modelos — le pide getKey() a cada uno y revienta con estos strings.
            // Pasa justo al derivar solo a departamento(s), que deja esta lista vacía.
            $departamentoDestino = $destinatarios
                ->map(fn ($d) => $d->departamento?->nombre)
                ->toBase()
                ->merge($departamentosDestino->pluck('nombre')->toBase())
                ->filter()->unique()->implode(', ');
            $usuarioDestino = $destinatarios->pluck('nombre')->toBase()->implode(', ');
        }

        return array_merge(
            $this->paramsTitularYSubrogante($user),
            [
                'departamento_destino' => $departamentoDestino,
                'usuario_destino'      => $usuarioDestino,
                'acciones_para'        => $request->acciones_para ?? [],
                'observaciones'        => $request->observaciones,
            ]
        );
    }

    /**
     * Construye los parámetros para una providencia generada al marcar como recibida.
     * Por defecto la providencia queda dirigida a Alcaldía.
     */
    private function paramsProvidenciaRecibir(User $user): array
    {
        $base = $this->paramsTitularYSubrogante($user);
        $deptoNombre = $base['departamento_origen'];

        return array_merge($base, [
            'departamento_destino' => $deptoNombre,
            'usuario_destino'      => '',
            'acciones_para'        => [],
            'observaciones'        => null,
        ]);
    }

    /**
     * Bloque común: si el actor está actuando como subrogado, el "titular" del
     * cargo (lo que aparece en el cuerpo de la providencia) es el subrogado;
     * el "subrogante" es el actor real que firma. Si no hay subrogancia,
     * titular = actor y no se pasa subrogante.
     */
    private function paramsTitularYSubrogante(User $user): array
    {
        $titular = $user->getActuandoComo();

        if ($titular) {
            $titular->loadMissing('departamento');
            return [
                'usuario_origen'      => $titular->nombre,
                'cargo_titular'       => $titular->cargo ?? 'Alcalde',
                'titular_rut'         => $titular->rut,
                'departamento_origen' => $titular->departamento?->nombre ?? 'Alcaldía',
                'subrogante_nombre'   => $user->nombre,
                'subrogante_cargo'    => $user->cargo,
                'subrogante_rut'      => $user->rut,
            ];
        }

        return [
            'usuario_origen'      => $user->nombre,
            'cargo_titular'       => $user->cargo ?? 'Alcalde',
            'titular_rut'         => $user->rut,
            'departamento_origen' => $user->departamento?->nombre ?? 'Alcaldía',
            'subrogante_nombre'   => null,
            'subrogante_cargo'    => null,
            'subrogante_rut'      => null,
        ];
    }

    /**
     * Genera la providencia, la cachea con un token UUID y la retorna como blob.
     * No persiste nada en disco ni base de datos.
     */
    public function previewDerivar(Request $request)
    {
        $request->validate([
            'correspondencia_id'         => 'required|exists:correspondencia,id',
            'departamento_destino_id'    => 'nullable|exists:departamentos,id',
            'departamento_destino_ids'   => 'nullable|array',
            'departamento_destino_ids.*' => 'exists:departamentos,id',
            'usuario_destino_id'         => 'nullable|exists:users,id',
            'usuario_destino_ids'        => 'nullable|array',
            'usuario_destino_ids.*'      => 'exists:users,id',
            'derivar_a_todos'            => 'nullable|boolean',
            'observaciones'              => 'nullable|string',
            'acciones_para'              => 'nullable|array',
            'acciones_para.*'            => 'string',
        ]);

        $user = Auth::user();
        $correspondencia = Correspondencia::find($request->correspondencia_id);

        if ($correspondencia->estaArchivada()) {
            return $this->errorResponse('El proceso está cerrado (archivada por el Alcalde): no admite nuevas derivaciones.', 422);
        }
        if (!$this->alcaldePuedeDerivar($user, $correspondencia)) {
            return $this->errorResponse('Sólo el Alcalde puede generar una providencia, sobre una correspondencia que esté en su despacho o que ya haya derivado.', 403);
        }

        $correspondencia->load(['departamento']);

        $generated = app(ProvidenciaPdfService::class)->generar(
            $correspondencia,
            $this->paramsProvidenciaDerivar($request, $user)
        );

        return $this->cachearYDevolverPreview($generated, $user, $correspondencia);
    }

    /**
     * Genera la providencia de "marcar como recibida" (dirigida a Alcaldía por defecto),
     * la cachea y retorna el blob.
     */
    public function previewRecibir(Derivacion $derivacion)
    {
        $user = Auth::user();

        if (!$user->isAlcalde()) {
            return $this->errorResponse('Sólo el Alcalde puede previsualizar la providencia de recepción', 403);
        }

        if ($derivacion->departamento_destino_id !== $user->contexto()->departamento_id) {
            return $this->errorResponse('No tienes permiso para esta derivación', 403);
        }

        $correspondencia = $derivacion->correspondencia;
        $correspondencia->load(['departamento']);

        $generated = app(ProvidenciaPdfService::class)->generar(
            $correspondencia,
            $this->paramsProvidenciaRecibir($user)
        );

        return $this->cachearYDevolverPreview($generated, $user, $correspondencia);
    }

    private function cachearYDevolverPreview(array $generated, User $user, Correspondencia $correspondencia)
    {
        $token = (string) Str::uuid();
        Cache::put(
            self::PREVIEW_CACHE_PREFIX . $token,
            [
                'pdf_content'         => base64_encode($generated['pdf_content']),
                'folio'               => $generated['folio'],
                'codigo_verificacion' => $generated['codigo_verificacion'],
                'user_id'             => $user->id,
                'correspondencia_id'  => $correspondencia->id,
            ],
            now()->addMinutes(self::PREVIEW_TTL_MINUTES)
        );

        return response($generated['pdf_content'], 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="providencia-preview.pdf"',
            'X-Preview-Token'     => $token,
            'Access-Control-Expose-Headers' => 'X-Preview-Token',
        ]);
    }

    public function show(Derivacion $derivacion)
    {
        if (!$derivacion->correspondencia?->esVisiblePara(Auth::user())) {
            return $this->errorResponse('No tienes acceso a esta derivación.', 403);
        }

        $derivacion->load([
            'correspondencia.adjuntos',
            'departamentoOrigen',
            'departamentoDestino',
            'usuarioOrigen',
            'usuarioDestino',
        ]);

        return $this->successResponse($derivacion);
    }

    public function pendientes(Request $request)
    {
        // Switch limpio: si hay subrogancia activa (X-Actuando-Como), la bandeja
        // es la del subrogado. Sin toggle, es la propia. El usuario real
        // (Auth::user()) solo importa para trazabilidad y firma, no aquí.
        $user = Auth::user();
        $ctx = $user->contexto();

        // Base: dirigida a MÍ (usuario), o a MI departamento cuando no hay
        // usuario específico. Así una derivación a una persona le llega aunque
        // su depto no coincida con el departamento_destino guardado.
        $base = Derivacion::where(function ($q) use ($ctx) {
            $q->where('usuario_destino_id', $ctx->id)
              ->orWhere(function ($q2) use ($ctx) {
                  $q2->whereNull('usuario_destino_id')
                     ->where('departamento_destino_id', $ctx->departamento_id);
              });
        });

        // Pestaña "Archivadas" = archivo personal del funcionario (su derivación
        // en estado 'archivado') O proceso cerrado por el Alcalde (correspondencia
        // 'archivado'). Sin la primera condición, archivar la propia derivación la
        // hacía desaparecer de TODAS las pestañas mientras el proceso siguiera abierto.
        $noArchivadas = fn ($q) => $q->whereHas('correspondencia', fn ($c) => $c->where('estado', '!=', 'archivado'));
        $archivadas = fn ($q) => $q->where(function ($q2) {
            $q2->where('estado', 'archivado')
               ->orWhereHas('correspondencia', fn ($c) => $c->where('estado', 'archivado'));
        });

        // Contadores de las pestañas (independientes de la página actual)
        $counts = [
            'pendientes' => $noArchivadas((clone $base)->whereIn('estado', ['pendiente', 'derivado']))->count(),
            'recibidas'  => $noArchivadas((clone $base)->where('estado', 'recibido'))->count(),
            'archivadas' => $archivadas(clone $base)->count(),
        ];

        $tab = $request->input('tab', 'pendientes');
        $query = (clone $base)->with([
            'correspondencia',
            // Para el resumen de gestión (acuses / respondieron) en la bandeja.
            'correspondencia.derivaciones:id,correspondencia_id,usuario_origen_id,actuando_como_user_id,usuario_destino_id,estado,fecha_recepcion',
            'correspondencia.derivaciones.usuarioDestino:id,nombre',
            'correspondencia.mensajes:id,correspondencia_id,usuario_id',
            'departamentoOrigen',
            'usuarioOrigen',
            'usuarioDestino:id,nombre,cargo',
            'actuandoComo:id,nombre,cargo',
        ]);

        if ($tab === 'archivadas') {
            $archivadas($query);
        } elseif ($tab === 'recibidas') {
            $noArchivadas($query->where('estado', 'recibido'));
        } else {
            $noArchivadas($query->whereIn('estado', ['pendiente', 'derivado']));
        }

        $derivaciones = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 30));

        // Igual que CorrespondenciaController::bandeja(): marca por ítem si el
        // usuario puede ACTUAR (recibir/archivar) o solo ver. Sin este campo el
        // frontend muestra "Solo lectura" aunque el usuario sea el destinatario.
        // Además marca si la correspondencia tiene novedades sin leer para el
        // contexto (actividad más reciente que su última lectura).
        $idsCorresp = $derivaciones->getCollection()->pluck('correspondencia_id')->filter()->unique();
        $lecturas = \App\Models\CorrespondenciaLectura::where('usuario_id', $ctx->id)
            ->whereIn('correspondencia_id', $idsCorresp)
            ->pluck('leido_at', 'correspondencia_id');
        // Estrella de seguimiento: se pinta en la misma celda del folio que el
        // punto de novedades, así que se resuelve en la misma pasada.
        $seguidas = \App\Models\CorrespondenciaSeguimiento::where('usuario_id', $ctx->id)
            ->whereIn('correspondencia_id', $idsCorresp)
            ->pluck('correspondencia_id')
            ->flip();
        $derivaciones->getCollection()->transform(function (Derivacion $d) use ($user, $lecturas, $seguidas) {
            $d->puede_actuar = $d->esDestinatario($user);
            $act = $d->correspondencia?->ultima_actividad_at;
            $leido = $lecturas[$d->correspondencia_id] ?? null;
            $d->tiene_novedades = $act && (!$leido || $act->gt($leido));
            $d->en_seguimiento = $seguidas->has($d->correspondencia_id);
            // Resumen de gestión (acuses / respondieron) para mostrarlo en la bandeja.
            $d->correspondencia?->append('resumen_gestion');
            return $d;
        });

        return $this->successResponse([
            'items'     => $derivaciones->items(),
            'total'     => $derivaciones->total(),
            'page'      => $derivaciones->currentPage(),
            'last_page' => $derivaciones->lastPage(),
            'per_page'  => $derivaciones->perPage(),
            'counts'    => $counts,
        ]);
    }

    public function recibir(Request $request, Derivacion $derivacion)
    {
        $user = Auth::user();

        // Solo el destinatario legítimo puede recibir (usuario dirigido, o el depto
        // cuando no hay usuario). Admin/oficina de partes supervisan, no intervienen.
        if (!$derivacion->esDestinatario($user)) {
            return $this->errorResponse('No tienes permiso para recibir esta derivación', 403);
        }
        if ($derivacion->correspondencia?->estaArchivada()) {
            return $this->errorResponse('El proceso está cerrado (archivada por el Alcalde).', 422);
        }

        // Idempotencia: una derivación solo se acusa una vez. Evita que un doble clic
        // regenere providencia, sobrescriba fecha_recepcion (evidencia del libro) o
        // duplique notificaciones.
        if ($derivacion->estado !== 'pendiente') {
            return $this->errorResponse('Esta derivación ya fue recibida.', 422);
        }

        // Si es Alcalde, generar y firmar una Providencia (dirigida a Alcaldía por defecto) con FirmaGob
        if ($user->isAlcalde()) {
            // Firma desatendida (sin OTP): solo si el usuario la tiene habilitada.
            // El backend re-verifica el flag; nunca confía en el cliente.
            $desatendida = $request->boolean('firma_desatendida');
            if ($desatendida && !$user->firma_desatendida_habilitada) {
                return $this->errorResponse(
                    'No tienes habilitada la firma desatendida. Solicítala al administrador.',
                    403
                );
            }
            $request->validate([
                'firma_desatendida' => 'nullable|boolean',
                'otp'        => $desatendida ? 'nullable|string' : 'required|string',
                'firma_y'    => 'nullable|integer|min:0|max:20000',
                'firma_page' => 'nullable|string',
                'firma_col'  => 'nullable|integer|in:0,1,2',
                'firma_x'    => 'nullable|integer|min:0|max:20000',
                'firma_x2'   => 'nullable|integer|min:0|max:20000',
                'firma_y2'   => 'nullable|integer|min:0|max:20000',
                'firma_page_h' => 'nullable|integer|min:100|max:20000',
                'firma_page_w' => 'nullable|integer|min:100|max:20000',
                'preview_token' => 'nullable|string',
            ]);

            // Recordar el modo elegido para preseleccionarlo en las próximas firmas.
            $this->recordarModoFirma($user, $desatendida);

            $correspondencia = $derivacion->correspondencia;
            $correspondencia->load(['departamento']);

            $resolved = $this->resolverProvidencia(
                $request->preview_token,
                $user,
                $correspondencia,
                fn () => $this->paramsProvidenciaRecibir($user)
            );

            if ($resolved === null) {
                return $this->errorResponse(
                    'La vista previa de la providencia expiró. Vuelve a marcar como recibida para regenerarla.',
                    422
                );
            }

            $pdfContent = $resolved['pdf_content'];
            $folio = $resolved['folio'];
            $codigoVerificacion = $resolved['codigo_verificacion'];

            // Firmar con FirmaGob
            if (config('firmagob.enabled')) {
                try {
                    $firmaService = app(FirmaGobService::class);
                    [$coords, $pageH] = $this->calcularCoordenadas($request);
                    $firmaPage = $request->firma_page ?? 'LAST';
                    $signed = $firmaService->sign(
                        $pdfContent,
                        'Providencia ' . $folio,
                        $user->rut,
                        $desatendida ? null : $request->otp,
                        $user->nombre,
                        $user->cargoFirma() ?? 'Alcalde',
                        $coords,
                        $firmaPage,
                        $desatendida ? config('firmagob.purpose_desatendido') : null,
                        $pageH
                    );
                    $pdfContent = $signed['content'];
                    Log::info('Providencia (recepción) firmada con FirmaGob', [
                        'folio' => $folio,
                        'modo'  => $desatendida ? 'desatendida' : 'atendida',
                    ]);
                } catch (FirmaGobException $e) {
                    return $this->errorResponse($e->getMessage(), 422);
                }
            }

            // Persistir PDF en disco sólo después de firma exitosa
            $filename = 'providencia_' . str_replace('-', '', $folio) . '_' . time() . '.pdf';
            $path = 'public/providencias/' . $filename;
            Storage::put($path, $pdfContent);

            $derivacion->update([
                'folio'              => $folio,
                'codigo_verificacion' => $codigoVerificacion,
                'pdf_ruta'           => 'providencias/' . $filename,
            ]);

            // Reflejar en la correspondencia que ya hay providencia generada
            $correspondencia->update([
                'providencia_pdf'      => 'providencias/' . $filename,
                'providencia_generada' => true,
            ]);

            $this->descartarPreview($request->preview_token);
        }

        $derivacion->update([
            'estado' => 'recibido',
            // Subrogancia: NO reasignar la derivación al actor real (el subrogante),
            // porque las bandejas filtran el destino por el contexto institucional
            // (el titular) y la correspondencia desaparecería de su bandeja. Si la
            // derivación iba a un usuario específico, se conserva a ese titular; si
            // iba a un departamento (sin usuario), la toma el contexto (titular).
            'usuario_destino_id' => $derivacion->usuario_destino_id ?? $user->contexto()->id,
            'fecha_recepcion' => now(),
        ]);

        // Completar la correspondencia SOLO cuando todos los destinatarios
        // acusaron recibo. Con derivación múltiple (varios funcionarios o
        // "todos"), el primer acuse no debe marcarla Completada.
        $correspondencia = $derivacion->correspondencia;
        if ($correspondencia && in_array($correspondencia->estado, ['derivada_funcionario', 'derivada_alcaldia', 'en_proceso'])) {
            $quedanPendientes = Derivacion::where('correspondencia_id', $correspondencia->id)
                ->where('estado', 'pendiente')
                ->exists();

            if (!$quedanPendientes) {
                $correspondencia->update(['estado' => 'completada']);

                // Marcar la derivación del alcalde como completada
                Derivacion::where('correspondencia_id', $correspondencia->id)
                    ->where('estado', 'derivado')
                    ->update(['estado' => 'recibido']);
            }

            // Notificar a quien derivó originalmente. Si derivó en subrogancia,
            // el aviso es del TITULAR (ver Derivacion::titularOrigenId): el
            // subrogante solo recibe copia mientras la subrogancia siga vigente.
            $destinatarioAviso = $derivacion->titularOrigenId();
            // Quien acusa recibo subrogando se identifica como tal: el aviso lo
            // lee el titular del asunto, que no tiene por qué saber quién está
            // subrogando hoy en el departamento de destino.
            $quienRecibio = $user->getActuandoComo()
                ? "{$user->nombre} (subrogando a {$user->getActuandoComo()->nombre})"
                : $user->nombre;
            if ($destinatarioAviso) {
                NotificacionService::enviar(
                    $destinatarioAviso,
                    'correspondencia',
                    $quedanPendientes ? 'correspondencia_recibida_parcial' : 'correspondencia_en_gestion',
                    $quedanPendientes ? 'Acuse de recibo' : 'Correspondencia recibida',
                    $quedanPendientes
                        ? "{$quienRecibio} recibió la correspondencia {$correspondencia->folio} de \"{$correspondencia->remitente}\" (aún hay destinatarios pendientes)."
                        : "La correspondencia {$correspondencia->folio} de \"{$correspondencia->remitente}\" fue recibida por {$quienRecibio} y quedó en gestión. El proceso se cierra cuando el Alcalde lo dé por completado.",
                    ['correspondencia_id' => $correspondencia->id, 'url' => '/correspondencia/' . $correspondencia->id]
                );
            }
        }

        // El acuse es una novedad para el resto (quien recibió queda "al día").
        if ($correspondencia) {
            $correspondencia->registrarActividad(
                $user->contexto()->id,
                'acuse',
                'acusó recibo',
                $user->id
            );
        }

        return $this->successResponse($derivacion, 'Derivación recibida');
    }

    public function archivar(Derivacion $derivacion)
    {
        $user = Auth::user();

        // Solo el destinatario legítimo puede archivar (no el supervisor que solo ve).
        if (!$derivacion->esDestinatario($user)) {
            return $this->errorResponse('No tienes permiso para archivar esta derivación', 403);
        }

        // Flujo obligatorio: primero el acuse de recibo, después el archivo.
        // (La UI ya lo impone; este guard evita saltárselo por API directa.)
        if ($derivacion->estado !== 'recibido') {
            return $this->errorResponse('Debes marcar la derivación como recibida antes de archivarla.', 422);
        }

        // Archivo PERSONAL del funcionario: solo su derivación. No toca el estado
        // de la correspondencia — el cierre formal del proceso (correspondencia
        // 'archivado' = "Completada") es exclusivo del Alcalde vía "Cerrar proceso".
        $derivacion->update(['estado' => 'archivado']);

        return $this->successResponse($derivacion, 'Derivación archivada');
    }

    /**
     * Devuelve a la bandeja activa una derivación que el funcionario había
     * archivado. Es el reverso exacto de archivar(): vuelve a 'recibido', el
     * estado en que estaba.
     *
     * Igual que aquel, es archivo PERSONAL: no toca el estado de la
     * correspondencia. Si el proceso completo está cerrado por el Alcalde, no
     * hay nada que devolver a la bandeja: eso lo reabre él con "Reabrir proceso".
     */
    public function desarchivar(Derivacion $derivacion)
    {
        $user = Auth::user();

        if (!$derivacion->esDestinatario($user)) {
            return $this->errorResponse('No tienes permiso para desarchivar esta derivación', 403);
        }

        if ($derivacion->estado !== 'archivado') {
            return $this->errorResponse('Esta derivación no está archivada.', 422);
        }

        if ($derivacion->correspondencia?->estaArchivada()) {
            return $this->errorResponse(
                'El proceso completo está cerrado por el Alcalde. Solicítale reabrirlo.',
                422
            );
        }

        $derivacion->update(['estado' => 'recibido']);

        return $this->successResponse($derivacion, 'Derivación devuelta a tu bandeja');
    }
}
