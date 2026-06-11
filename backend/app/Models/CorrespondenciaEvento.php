<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CorrespondenciaEvento extends Model
{
    protected $table = 'correspondencia_eventos';

    protected $fillable = ['correspondencia_id', 'usuario_id', 'tipo', 'texto'];

    public function correspondencia()
    {
        return $this->belongsTo(Correspondencia::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
