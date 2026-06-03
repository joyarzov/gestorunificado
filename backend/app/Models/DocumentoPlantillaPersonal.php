<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentoPlantillaPersonal extends Model
{
    use HasFactory;

    protected $table = 'documento_plantillas_personales';

    protected $fillable = [
        'user_id',
        'nombre',
        'plantilla_id',
        'contenido_json',
    ];

    protected $casts = [
        'contenido_json' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function plantillaBase()
    {
        return $this->belongsTo(DocumentoPlantilla::class, 'plantilla_id');
    }
}
