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
        'creado_por',
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

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
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
            ->withPivot('orden')
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
     * Firmante (User) a quien le toca firmar ahora: el de menor orden que aún no
     * ha firmado. Devuelve null si ya firmaron todos. La firma es SECUENCIAL.
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
            if (!$this->firmanteYaFirmo($firmante->id)) {
                return $firmante;
            }
        }
        return null;
    }

    public function puedeSerFirmadoPor(User $user): bool
    {
        // El "firmante institucional" es el subrogado si hay actuando-como activo;
        // si no, el propio usuario. La firma electrónica la ejecuta siempre $user.
        $ctx = $user->contexto();

        // Firma secuencial: solo puede firmar quien tiene el turno (el firmante de
        // menor orden que aún no ha firmado). Respeta subrogancia.
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

        return (int) $enTurno->id === (int) $ctx->id;
    }

    public function registrarFirma(User $user, ?string $observacion = null, ?array $firmaGobData = null): DocumentoFirma
    {
        $actuandoComo = $user->getActuandoComo();

        $fields = [
            'documento_id' => $this->id,
            'usuario_id' => $user->id,
            'actuando_como_user_id' => $actuandoComo?->id,
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
