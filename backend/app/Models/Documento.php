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

    // Constantes de nivel de acceso (NTDEE)
    const ACCESO_PUBLICO = 1;
    const ACCESO_RESTRINGIDO = 2;
    const ACCESO_RESERVADO = 3;
    const ACCESO_SECRETO = 4;

    // Mecanismo de incorporación
    const MECANISMO_FISICO = 1;     // Digitalizado desde físico
    const MECANISNO_DIGITAL = 2;    // Nativo digital

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
        'orden_expediente',
        'folio_inicio',
        'folio_fin',
        'anio',
    ];

    protected $casts = [
        'contenido_json' => 'array',
        'metadata_pdfa' => 'array',
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
        if (empty($this->contenido_html)) {
            return;
        }

        $html = '<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
    @page { margin: 2.5cm 1.9cm 2.5cm 2.5cm; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12px; margin: 0; padding: 0; line-height: 1.6; }
    body > div { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
</style>
</head><body>' . $this->contenido_html . '</body></html>';

        $pdf = Pdf::loadHTML($html);
        $pdf->setPaper('letter');

        $filename = 'documentos/' . $this->identificador . '_' . time() . '.pdf';
        Storage::disk('public')->put($filename, $pdf->output());

        $this->update(['archivo_pdf' => $filename]);
    }

    // Verificaciones
    public function puedeSerFirmadoPor(User $user): bool
    {
        // Verificar si el usuario está en los firmantes asignados
        $esAsignado = $this->firmantesAsignados()
            ->where('user_id', $user->id)
            ->exists();

        if (!$esAsignado) {
            // Verificar firmante legacy
            $esAsignado = $this->firmante_asignado_id === $user->id;
        }

        if (!$esAsignado) {
            return false;
        }

        // Verificar que no haya firmado ya
        $yaFirmo = $this->firmas()
            ->where('usuario_id', $user->id)
            ->whereIn('estado', ['firmado'])
            ->exists();

        return !$yaFirmo;
    }

    public function registrarFirma(User $user, ?string $observacion = null): DocumentoFirma
    {
        $firma = DocumentoFirma::create([
            'documento_id' => $this->id,
            'usuario_id' => $user->id,
            'fecha_firma' => now(),
            'observacion' => $observacion,
            'estado' => 'firmado',
        ]);

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
