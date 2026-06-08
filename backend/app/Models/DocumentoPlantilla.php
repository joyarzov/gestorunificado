<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class DocumentoPlantilla extends Model
{
    use HasFactory;

    protected $table = 'documento_plantillas';

    // Tipos de plantilla
    const TIPO_DECRETO_ALCALDICIO = 'decreto_alcaldicio';
    const TIPO_MEMORANDUM = 'memorandum';
    const TIPO_CONVENIO = 'convenio';
    const TIPO_OFICIO = 'oficio';
    const TIPO_RESOLUCION = 'resolucion';
    const TIPO_CERTIFICADO = 'certificado';
    const TIPO_INFORME = 'informe';

    protected $fillable = [
        'nombre',
        'codigo',
        'descripcion',
        'tipo_documental_id',
        'contenido_html',
        'variables_json',
        'activo',
        'requiere_firma',
        'requiere_aprobacion',
        'editable_admin',
        'orden',
        'origen',
        'creado_por',
    ];

    protected $casts = [
        'variables_json' => 'array',
        'activo' => 'boolean',
        'requiere_firma' => 'boolean',
        'requiere_aprobacion' => 'boolean',
        'editable_admin' => 'boolean',
    ];

    /**
     * Invalida la cache de plantillas activas ante cualquier cambio,
     * para que el mantenedor refleje las ediciones al instante.
     */
    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('plantillas_activas'));
        static::deleted(fn () => Cache::forget('plantillas_activas'));
    }

    public function tipoDocumental()
    {
        return $this->belongsTo(TipoDocumental::class);
    }

    public function documentos()
    {
        return $this->hasMany(Documento::class, 'plantilla_id');
    }

    public function plantillasPersonales()
    {
        return $this->hasMany(DocumentoPlantillaPersonal::class, 'plantilla_id');
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    // Scope para plantillas activas
    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }

    // Verificar si es plantilla de decreto
    public function esDecreto(): bool
    {
        return $this->codigo === 'PLT_DECRETO_001' ||
               strpos(strtolower($this->codigo), 'decreto') !== false;
    }

    // Obtener variables como array
    public function getVariablesAttribute(): array
    {
        return $this->variables_json ?? [];
    }
}
