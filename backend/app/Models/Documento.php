<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Barryvdh\DomPDF\Facade\Pdf;

class Documento extends Model
{
    use HasFactory, SoftDeletes;

    // Constantes de estado
    const ESTADO_BORRADOR = 'borrador';
    const ESTADO_PENDIENTE_FIRMA = 'pendiente_firma';
    const ESTADO_FIRMADO = 'firmado';
    const ESTADO_RECHAZADO = 'rechazado';
    const ESTADO_ANULADO = 'anulado';
    const ESTADO_INCORPORADO = 'incorporado'; // PDF subido (externo/escaneado), ya final

    // Constantes de nivel de acceso (NTDEE)
    const ACCESO_PUBLICO = 1;
    const ACCESO_RESTRINGIDO = 2;
    const ACCESO_RESERVADO = 3;
    const ACCESO_SECRETO = 4;

    // Mecanismo de incorporación
    const MECANISMO_FISICO = 1;     // Digitalizado desde físico
    const MECANISNO_DIGITAL = 2;    // Nativo digital

    // Modalidad de rectificación de un documento firme (ver rectificaA()).
    // RECTIFICA: el original sigue vigente y el nuevo corrige una parte de él.
    // DEJA_SIN_EFECTO: el original queda anulado y el nuevo lo reemplaza.
    const RECT_RECTIFICA = 'rectifica';
    const RECT_DEJA_SIN_EFECTO = 'deja_sin_efecto';

    // Origen del documento
    const ORIGEN_CREADO = 'creado';   // Generado desde plantilla en la plataforma
    const ORIGEN_SUBIDO = 'subido';   // PDF subido externamente

    protected $fillable = [
        'identificador',
        'codigo_verificacion',
        'numero',
        'titulo',
        'descripcion',
        'tipo_documental_id',
        'plantilla_id',
        'expediente_id',
        'rectifica_a_id',
        'tipo_rectificacion',
        'motivo_rectificacion',
        'rectificacion_aplicada_at',
        'creado_por',
        'emitido_en_nombre_de_id',
        'actualizado_por',
        'departamento_id',
        'contenido_json',
        'contenido_html',
        'archivo_pdf',
        'archivo_original',
        'formato',
        'metadata_pdfa',
        'estado',
        'nivel_acceso',
        'palabras_clave',
        'firmado',
        'fecha_firma',
        'firmante_asignado_id',
        'firmas_requeridas',
        'completado',
        'fecha_creacion',
        'mecanismo_incorporacion',
        'origen_carga',
        'firmas_externas',
        'orden_expediente',
        'folio_inicio',
        'folio_fin',
        'anio',
    ];

    protected $casts = [
        'contenido_json' => 'array',
        'metadata_pdfa' => 'array',
        'firmas_externas' => 'array',
        'firmado' => 'boolean',
        'completado' => 'boolean',
        'fecha_firma' => 'datetime',
        'fecha_creacion' => 'datetime',
        'rectificacion_aplicada_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($documento) {
            if (empty($documento->identificador)) {
                $documento->identificador = self::generarIdentificador();
            }
            if (empty($documento->codigo_verificacion)) {
                $documento->codigo_verificacion = self::generarCodigoVerificacion();
            }
            if (empty($documento->fecha_creacion)) {
                $documento->fecha_creacion = now();
            }
            if (empty($documento->anio)) {
                $documento->anio = date('Y');
            }
        });
    }

    // Relaciones
    public function tipoDocumental()
    {
        return $this->belongsTo(TipoDocumental::class);
    }

    public function plantilla()
    {
        return $this->belongsTo(DocumentoPlantilla::class, 'plantilla_id');
    }

    public function expediente()
    {
        return $this->belongsTo(Expediente::class);
    }

    public function expedientes()
    {
        return $this->belongsToMany(Expediente::class, 'documento_expediente')
            ->withTimestamps();
    }

    /**
     * Documento firme al que este rectifica (null si no es un rectificatorio).
     */
    public function rectificaA()
    {
        return $this->belongsTo(Documento::class, 'rectifica_a_id');
    }

    /**
     * Documentos emitidos para rectificar a este. Puede haber más de uno: un
     * documento se rectifica las veces que haga falta y la cadena queda completa.
     */
    public function rectificaciones()
    {
        return $this->hasMany(Documento::class, 'rectifica_a_id')->orderBy('id');
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    /** Titular en cuyo nombre se emitió el documento (delegación de emisión). */
    public function emitidoEnNombreDe()
    {
        return $this->belongsTo(User::class, 'emitido_en_nombre_de_id');
    }

    public function actualizador()
    {
        return $this->belongsTo(User::class, 'actualizado_por');
    }

    public function firmanteAsignado()
    {
        return $this->belongsTo(User::class, 'firmante_asignado_id');
    }

    public function firmantesAsignados()
    {
        return $this->belongsToMany(User::class, 'documento_firmantes_asignados', 'documento_id', 'user_id')
            ->withPivot('orden', 'subrogando_a_user_id')
            ->withTimestamps()
            ->orderBy('orden');
    }

    public function departamento()
    {
        return $this->belongsTo(Departamento::class);
    }

    public function firmas()
    {
        return $this->hasMany(DocumentoFirma::class)->orderBy('orden');
    }

    public function envios()
    {
        return $this->hasMany(DocumentoEnvio::class);
    }

    public function trazabilidades()
    {
        return $this->hasMany(DocumentoTrazabilidad::class)->orderBy('created_at');
    }

    public function adjuntos()
    {
        return $this->hasMany(DocumentoAdjunto::class)->orderBy('created_at');
    }

    public function firmasPendientes()
    {
        return $this->firmas()->where('estado', 'pendiente');
    }

    public function firmasCompletadas()
    {
        return $this->firmas()->where('estado', 'firmado');
    }

    // Generadores
    public static function generarIdentificador(): string
    {
        $anio = date('Y');
        $timestamp = now()->format('His');
        $random = str_pad(random_int(0, 999), 3, '0', STR_PAD_LEFT);

        return "DOC-{$anio}-{$timestamp}{$random}";
    }

    public static function generarCorrelativo(int $tipoDocumentalId): array
    {
        $tipoDocumental = TipoDocumental::find($tipoDocumentalId);
        if (!$tipoDocumental) {
            return ['numero' => null, 'completo' => null];
        }

        $numero = Correlativo::obtenerSiguiente($tipoDocumental->codigo);
        $anio = date('Y');

        return [
            'numero' => $numero,
            'completo' => "{$numero}/{$anio}",
            'tipo_documental' => $tipoDocumental
        ];
    }

    public static function generarCodigoVerificacion(): string
    {
        // Caracteres sin ambigüedad (sin 0,O,I,L,1)
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        $maxAttempts = 10;

        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            $codigo = '';
            for ($i = 0; $i < 8; $i++) {
                $codigo .= $chars[random_int(0, strlen($chars) - 1)];
            }

            // Verificar unicidad en documentos y derivaciones
            $existeEnDocumentos = self::where('codigo_verificacion', $codigo)->exists();
            $existeEnDerivaciones = DB::table('derivaciones')->where('codigo_verificacion', $codigo)->exists();

            if (!$existeEnDocumentos && !$existeEnDerivaciones) {
                return $codigo;
            }
        }

        // Fallback: agregar timestamp para garantizar unicidad
        $codigo = '';
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        for ($i = 0; $i < 8; $i++) {
            $codigo .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $codigo;
    }

    public function generarPdfFinal(): void
    {
        // Render por bloques (Fase 2): si la plantilla usa el motor de bloques,
        // se arma el PDF con PlantillaRenderer en vez del contenido_html legacy.
        $this->loadMissing('plantilla');
        if ($this->plantilla && $this->plantilla->esMotorBloques()) {
            $this->generarPdfBloques();
            return;
        }

        if (empty($this->contenido_html)) {
            return;
        }

        $contenido = $this->contenido_html;

        // Convertir logo a base64 para que DomPDF pueda renderizarlo
        $logoPath = storage_path('app/public/logo.png');
        if (file_exists($logoPath)) {
            $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            $contenido = str_replace(
                ['src="/logo.png"', "src='/logo.png'"],
                ['src="' . $logoBase64 . '"', 'src="' . $logoBase64 . '"'],
                $contenido
            );
        }

        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
    @page { margin: 1.2cm 2cm 1.5cm 2.5cm; }
    body { font-family: serif; font-size: 12pt; margin: 0; padding: 0; line-height: 1.5; }
    body > div { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
</style>
</head><body>' . $contenido . '</body></html>';

        $pdf = Pdf::loadHTML($html);
        $pdf->setPaper('letter');
        $pdf->setOption('isRemoteEnabled', true);

        $filename = 'documentos/' . $this->identificador . '_' . time() . '.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        $this->update(['archivo_pdf' => $filename]);
    }

    /** Genera el PDF usando el motor de bloques (Fase 2). */
    private function generarPdfBloques(): void
    {
        $renderer = app(\App\Services\PlantillaRenderer::class);
        $appUrl = rtrim(config('app.verificacion_url'), '/');
        $meta = [
            'codigo_verificacion' => $this->codigo_verificacion,
            'verificar_url'       => $appUrl . '/verificar/' . $this->codigo_verificacion,
        ];

        $data = $renderer->viewData($this->plantilla, $this->contenido_json ?? [], $meta);
        $pdf = Pdf::loadView('pdf.plantilla_base', $data);
        $pdf->setOption('isRemoteEnabled', true);

        $filename = 'documentos/' . $this->identificador . '_' . time() . '.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        $this->update(['archivo_pdf' => $filename]);
    }

    // Verificaciones
    /**
     * Firmantes asignados ordenados por su orden de firma (cadena secuencial).
     */
    public function firmantesOrdenados()
    {
        return $this->firmantesAsignados()
            ->orderBy('documento_firmantes_asignados.orden')
            ->get();
    }

    /**
     * ¿El firmante institucional ($firmanteId) ya estampó su firma? Considera
     * subrogancia: la firma pudo ejecutarla el actor real (usuario_id) o quedar
     * registrada a nombre del subrogado en actuando_como_user_id.
     */
    public function firmanteYaFirmo(int $firmanteId): bool
    {
        return $this->firmas()
            ->where('estado', 'firmado')
            ->where(function ($q) use ($firmanteId) {
                $q->where('usuario_id', $firmanteId)
                    ->orWhere('actuando_como_user_id', $firmanteId);
            })
            ->exists();
    }

    /**
     * Quién debe firmar realmente por una asignación, considerando su calidad.
     *
     * Si la asignación se hizo en subrogancia y ésta ya NO está vigente (el
     * titular volvió, o venció el plazo), el turno vuelve al titular: el cargo
     * siempre fue suyo y firmar con "(S)" fuera del período de subrogancia no
     * tendría respaldo administrativo. Así ningún documento queda esperando a
     * alguien que ya perdió la calidad para firmarlo.
     */
    private function firmanteEfectivo(User $asignado): User
    {
        $titularId = $asignado->pivot?->subrogando_a_user_id;
        if (!$titularId) {
            return $asignado;
        }

        $titular = $this->cacheTitulares[$titularId] ??= User::find($titularId);
        if (!$titular) {
            return $asignado;
        }

        $vigente = $titular->tieneSubroganciaActiva()
            && (int) $titular->subrogante_id === (int) $asignado->id;

        return $vigente ? $asignado : $titular;
    }

    /**
     * Cache de titulares subrogados, por instancia (evita N+1 al evaluar la
     * cadena de firmas del mismo documento).
     *
     * NO debe ser estático: los workers de cola y el scheduler viven horas, y
     * una subrogancia que vence a mitad de proceso quedaría cacheada como
     * vigente para siempre.
     */
    private array $cacheTitulares = [];

    /**
     * Firmante (User) a quien le toca firmar ahora: el de menor orden que aún no
     * ha firmado. Devuelve null si ya firmaron todos. La firma es SECUENCIAL.
     *
     * Cuando el turno corresponde a una asignación en subrogancia vigente, el
     * User devuelto conserva su `pivot` — de ahí sale el "(S)" del sello.
     */
    public function firmanteEnTurno(): ?User
    {
        $ordenados = $this->firmantesOrdenados();

        if ($ordenados->isEmpty()) {
            // Compatibilidad con el firmante único legacy.
            if ($this->firmante_asignado_id && !$this->firmanteYaFirmo($this->firmante_asignado_id)) {
                return User::find($this->firmante_asignado_id);
            }
            return null;
        }

        foreach ($ordenados as $firmante) {
            $efectivo = $this->firmanteEfectivo($firmante);
            if (!$this->firmanteYaFirmo($efectivo->id)) {
                return $efectivo;
            }
        }
        return null;
    }

    /**
     * Días que el documento lleva esperando sin avance: desde la última firma
     * estampada o, si aún no hay ninguna, desde que se envió a firma. Devuelve
     * null si no está pendiente de firma.
     */
    public function diasEsperandoFirma(): ?int
    {
        if ($this->estado !== self::ESTADO_PENDIENTE_FIRMA) {
            return null;
        }

        $desde = $this->firmas()->where('estado', 'firmado')->max('fecha_firma');
        $desde = $desde ? \Illuminate\Support\Carbon::parse($desde) : null;

        $desde ??= $this->trazabilidades()
            ->where('accion', 'enviado_a_firma')
            ->latest('created_at')
            ->value('created_at');

        $desde ??= $this->updated_at;

        // absolute=false para que el signo sea explícito en Carbon 2 y 3 por igual.
        return (int) $desde->diffInDays(now(), false);
    }

    public function puedeSerFirmadoPor(User $user): bool
    {
        // Firma secuencial: solo puede firmar quien tiene el turno (el firmante de
        // menor orden que aún no ha firmado).
        $enTurno = $this->firmanteEnTurno();
        if (!$enTurno) {
            return false;
        }

        // El actor real no debe haber firmado ya (evita doble firma al entrar como sí mismo).
        $yaFirmoActorReal = $this->firmas()
            ->where('usuario_id', $user->id)
            ->where('estado', 'firmado')
            ->exists();
        if ($yaFirmoActorReal) {
            return false;
        }

        // Si la asignación declaró que esa persona firma EN SUBROGANCIA de un
        // titular, firma exactamente ella: la calidad quedó fijada al enviar a
        // firma y no depende de quién tenga el header X-Actuando-Como puesto.
        if ($enTurno->pivot?->subrogando_a_user_id) {
            return (int) $enTurno->id === (int) $user->id;
        }

        // Asignación en calidad propia: el firmante institucional es el subrogado
        // si hay actuando-como activo. La firma la ejecuta siempre $user.
        return (int) $enTurno->id === (int) $user->contexto()->id;
    }

    /**
     * Calidad en que $user firmaría este documento ahora: a nombre de quién y
     * con qué cargo se estampa el sello.
     *
     * Manda lo declarado en la asignación (`subrogando_a_user_id`). Solo si la
     * asignación no declaró nada se cae al header de sesión, que es como
     * operaban los documentos anteriores a esta funcionalidad.
     *
     * @return array{subrogado_id: int|null, cargo: string|null}
     */
    public function calidadFirmaDe(User $user): array
    {
        $subrogadoId = $this->firmanteEnTurno()?->pivot?->subrogando_a_user_id
            ?? $user->getActuandoComo()?->id;

        $enSubrogancia = $subrogadoId && (int) $subrogadoId !== (int) $user->id;

        if (!$enSubrogancia) {
            return ['subrogado_id' => null, 'cargo' => $user->cargo ?: null];
        }

        // El sello lleva el cargo SUBROGADO con sufijo "(S)": se firma el cargo
        // que se está subrogando, no el propio. Si el Jefe de Contabilidad
        // subroga al Director de Control, el sello dice "Director de Control (S)".
        $titular = $this->cacheTitulares[$subrogadoId] ??= User::find($subrogadoId);
        $cargo = $titular?->cargo ?: $user->cargo;

        return [
            'subrogado_id' => (int) $subrogadoId,
            'cargo' => $cargo ? $cargo . ' (S)' : null,
        ];
    }

    public function registrarFirma(User $user, ?string $observacion = null, ?array $firmaGobData = null): DocumentoFirma
    {
        $calidad = $this->calidadFirmaDe($user);

        $fields = [
            'documento_id' => $this->id,
            'usuario_id' => $user->id,
            'actuando_como_user_id' => $calidad['subrogado_id'],
            'cargo_firmado' => $calidad['cargo'],
            'fecha_firma' => now(),
            'observacion' => $observacion,
            'estado' => 'firmado',
        ];

        if ($firmaGobData) {
            $fields['firma_gob_id']   = $firmaGobData['firma_gob_id'] ?? null;
            $fields['firma_gob_data'] = $firmaGobData['firma_gob_data'] ?? null;
        }

        $firma = DocumentoFirma::create($fields);

        // Verificar si todos han firmado
        if ($this->todosHanFirmado()) {
            $this->marcarComoFirmado($user);
        }

        return $firma;
    }

    public function todosHanFirmado(): bool
    {
        $firmantesAsignadosCount = $this->firmantesAsignados()->count();
        if ($firmantesAsignadosCount === 0 && $this->firmante_asignado_id) {
            $firmantesAsignadosCount = 1;
        }

        $firmasCount = $this->firmas()->where('estado', 'firmado')->count();

        // Si hay firmas_requeridas definidas, usar ese número
        if ($this->firmas_requeridas) {
            return $firmasCount >= $this->firmas_requeridas;
        }

        return $firmasCount >= $firmantesAsignadosCount && $firmantesAsignadosCount > 0;
    }

    public function marcarComoFirmado(User $user): void
    {
        $this->update([
            'estado' => self::ESTADO_FIRMADO,
            'firmado' => true,
            'fecha_firma' => now(),
            'completado' => true,
            'actualizado_por' => $user->id,
        ]);

        try {
            $this->generarPdfFinal();
        } catch (\Exception $e) {
            Log::error('Error al generar PDF del documento firmado: ' . $e->getMessage());
        }

        // Si este documento rectifica a otro, recién ahora —firmado— surte efecto.
        $this->aplicarRectificacionSiCorresponde();
    }

    public function puedeSerFirmado(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE_FIRMA && !$this->completado;
    }

    // Scopes
    public function scopeBorradores($query)
    {
        return $query->where('estado', self::ESTADO_BORRADOR);
    }

    public function scopePendientesFirma($query)
    {
        return $query->where('estado', self::ESTADO_PENDIENTE_FIRMA);
    }

    public function scopeFirmados($query)
    {
        return $query->where('estado', self::ESTADO_FIRMADO);
    }

    /**
     * Documentos en los que el usuario participa. Es el equivalente de
     * Expediente::scopeVisiblesPara para el otro objeto que circula, y reúne todas
     * las vías legítimas por las que alguien llega a un documento:
     *
     * - lo creó, o lo redactó otro en su nombre (delegación de emisión);
     * - es firmante asignado —titular o de la lista— o ya lo firmó;
     * - se lo enviaron, o él lo envió (documento_envios);
     * - participa en algún expediente que lo contiene.
     *
     * Pertenecer al mismo departamento NO basta: si no participó, no lo ve. Para
     * consultar todo el municipio está el repositorio, que exige permiso explícito.
     *
     * La regla sigue al contexto (respeta subrogancia) salvo en "lo creó", que es un
     * hecho del actor real.
     */
    public function scopeVisiblesPara($query, $user)
    {
        $ctx = method_exists($user, 'contexto') ? $user->contexto() : $user;

        return $query->where(function ($q) use ($user, $ctx) {
            $q->where('creado_por', $user->id)
                ->orWhere('emitido_en_nombre_de_id', $ctx->id)
                ->orWhere('firmante_asignado_id', $ctx->id)
                ->orWhereHas('firmantesAsignados', fn ($f) => $f->where('users.id', $ctx->id))
                ->orWhereHas('firmas', fn ($f) => $f->where('usuario_id', $ctx->id))
                ->orWhereHas('envios', fn ($e) => $e->where('destinatario_id', $ctx->id)
                    ->orWhere('remitente_id', $ctx->id))
                ->orWhereHas('expedientes', fn ($e) => $e->visiblesPara($user));
        });
    }

    /**
     * Puede LEER el documento: participa en él (ver scopeVisiblesPara) o mira
     * desde una posición habilitada para todo el municipio (repositorio o
     * administración).
     *
     * Vive en el modelo, no en un controlador, porque el criterio lo necesitan
     * varios: DocumentoController lo tenía privado y AdjuntoController —que
     * entrega los MISMOS archivos— no lo alcanzaba, así que descargaba sin
     * comprobar nada. Un criterio de acceso que solo un controlador puede leer
     * termina, tarde o temprano, sin aplicarse en el de al lado.
     */
    public function esVisiblePara(User $user): bool
    {
        if ($user->isAdmin() || $user->contexto()->puede_ver_repositorio) {
            return true;
        }

        return static::query()->visiblesPara($user)->whereKey($this->id)->exists();
    }

    /**
     * Puede AGREGAR o QUITAR adjuntos del documento.
     *
     * Más estricto que esVisiblePara a propósito: el permiso de repositorio
     * habilita a leer todo el municipio, no a escribir en el borrador ajeno.
     * Acá se exige participación real (autor, firmante, destinatario de un
     * envío, expediente propio) o ser administrador.
     */
    public function puedeGestionarAdjuntos(User $user): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return static::query()->visiblesPara($user)->whereKey($this->id)->exists();
    }

    // Helpers
    public function estaFirmado(): bool
    {
        return $this->estado === self::ESTADO_FIRMADO;
    }

    public function puedeEditarse(): bool
    {
        return $this->estado === self::ESTADO_BORRADOR;
    }

    public function puedeFirmarse(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE_FIRMA;
    }

    /**
     * ¿Es un documento cerrado e inmutable? Firmado electrónicamente en la
     * plataforma, o incorporado como antecedente (PDF externo, ya final).
     */
    public function esFirme(): bool
    {
        return in_array($this->estado, [self::ESTADO_FIRMADO, self::ESTADO_INCORPORADO], true);
    }

    public function esRectificatorio(): bool
    {
        return $this->rectifica_a_id !== null;
    }

    /**
     * La rectificación que ya surtió efecto sobre este documento, si existe.
     * Un rectificatorio en borrador o esperando firma todavía no rectifica nada.
     */
    public function rectificacionFirme(): ?Documento
    {
        return $this->rectificaciones()
            ->whereIn('estado', [self::ESTADO_FIRMADO, self::ESTADO_INCORPORADO])
            ->orderByDesc('id')
            ->first();
    }

    public function estaRectificado(): bool
    {
        return $this->rectificacionFirme() !== null;
    }

    /**
     * Rectificatorio ya emitido pero todavía sin firmar. Mientras exista, el
     * original sigue vigente y no corresponde emitir un segundo rectificatorio:
     * serían dos documentos corrigiendo lo mismo.
     */
    public function rectificacionEnCurso(): ?Documento
    {
        return $this->rectificaciones()
            ->whereIn('estado', [self::ESTADO_BORRADOR, self::ESTADO_PENDIENTE_FIRMA])
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Solo se rectifica lo que ya no se puede editar. Un borrador se corrige
     * editándolo, y uno rechazado con "Devolver a borrador"; emitir un
     * rectificatorio para esos casos ensuciaría el expediente sin necesidad.
     */
    public function puedeRectificarse(): bool
    {
        return $this->esFirme() && !$this->estaRectificado() && !$this->rectificacionEnCurso();
    }

    /**
     * Quién puede rectificar: quien lo redactó, quien lo firmó (es el responsable
     * del contenido) o la administración. Sigue al actor real, no al contexto:
     * rectificar es un acto que se le imputa a quien lo ejecuta.
     */
    public function puedeSerRectificadoPor(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->isAdmin()) {
            return true;
        }

        if ((int) $this->creado_por === (int) $user->id) {
            return true;
        }

        return $this->firmas()
            ->where('estado', 'firmado')
            ->where(function ($q) use ($user) {
                $q->where('usuario_id', $user->id)
                  ->orWhere('actuando_como_user_id', $user->id);
            })
            ->exists();
    }

    /**
     * Surte el efecto del rectificatorio sobre el documento original, una sola vez
     * y solo cuando el rectificatorio ya quedó firme. Con la modalidad
     * "deja sin efecto" el original pasa a anulado; con "rectifica" queda vigente
     * y solo se anota el vínculo.
     *
     * Es idempotente: se invoca desde todos los caminos por los que un documento
     * puede quedar firme (firma electrónica, cierre de PDF con firmas externas,
     * vinculación de un documento ya firme) sin riesgo de anular dos veces.
     */
    public function aplicarRectificacionSiCorresponde(): void
    {
        if (!$this->esRectificatorio() || !$this->esFirme() || $this->rectificacion_aplicada_at) {
            return;
        }

        $original = $this->rectificaA()->first();
        if (!$original) {
            return;
        }

        $dejaSinEfecto = $this->tipo_rectificacion === self::RECT_DEJA_SIN_EFECTO;
        $refNuevo = $this->numero ?: $this->identificador;
        $refOriginal = $original->numero ?: $original->identificador;

        DB::transaction(function () use ($original, $dejaSinEfecto, $refNuevo, $refOriginal) {
            $this->forceFill(['rectificacion_aplicada_at' => now()])->save();

            if ($dejaSinEfecto && $original->estado !== self::ESTADO_ANULADO) {
                $original->forceFill(['estado' => self::ESTADO_ANULADO])->save();
            }

            $glosaOriginal = $dejaSinEfecto
                ? "Dejado sin efecto por el documento {$refNuevo}"
                : "Rectificado por el documento {$refNuevo}";

            \App\Models\DocumentoTrazabilidad::registrar(
                $original->id,
                $dejaSinEfecto ? 'dejado_sin_efecto' : 'rectificado',
                $glosaOriginal . ($this->motivo_rectificacion ? ". Motivo: {$this->motivo_rectificacion}" : ''),
                [
                    'rectificatorio_id' => $this->id,
                    'tipo_rectificacion' => $this->tipo_rectificacion,
                    'motivo' => $this->motivo_rectificacion,
                ]
            );

            \App\Models\DocumentoTrazabilidad::registrar(
                $this->id,
                'rectificacion_aplicada',
                $dejaSinEfecto
                    ? "Deja sin efecto al documento {$refOriginal}"
                    : "Rectifica al documento {$refOriginal}",
                [
                    'original_id' => $original->id,
                    'tipo_rectificacion' => $this->tipo_rectificacion,
                ]
            );

            // Dejar constancia en la hoja de ruta de los expedientes donde vive el
            // documento corregido: ahí es donde se lee la historia del asunto.
            foreach ($original->expedientes()->pluck('expedientes.id') as $expedienteId) {
                \App\Models\ExpedienteActividad::create([
                    'expediente_id' => $expedienteId,
                    'usuario_id' => \Illuminate\Support\Facades\Auth::id(),
                    'tipo' => $dejaSinEfecto ? 'documento_dejado_sin_efecto' : 'documento_rectificado',
                    'descripcion' => "{$glosaOriginal}: \"{$original->titulo}\"",
                    'metadata' => [
                        'documento_id' => $original->id,
                        'rectificatorio_id' => $this->id,
                        'tipo_rectificacion' => $this->tipo_rectificacion,
                        'motivo' => $this->motivo_rectificacion,
                    ],
                ]);
            }
        });
    }

    public function getNivelAccesoTextoAttribute(): string
    {
        $niveles = [
            self::ACCESO_PUBLICO => 'Público',
            self::ACCESO_RESTRINGIDO => 'Restringido',
            self::ACCESO_RESERVADO => 'Reservado',
            self::ACCESO_SECRETO => 'Secreto',
        ];

        return $niveles[$this->nivel_acceso] ?? 'Desconocido';
    }
}
