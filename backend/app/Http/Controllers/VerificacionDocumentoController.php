<?php

namespace App\Http\Controllers;

use App\Models\Documento;
use App\Models\Derivacion;
use Illuminate\Http\Request;

class VerificacionDocumentoController extends Controller
{
    public function verificar(string $codigo)
    {
        // Buscar primero en documentos
        $documento = Documento::with(['tipoDocumental:id,nombre,codigo', 'firmantesAsignados:id,nombre', 'firmas.usuario:id,nombre'])
            ->where('codigo_verificacion', $codigo)
            ->first();

        if ($documento) {
            $firmantes = [];
            if ($documento->firmas && $documento->firmas->count() > 0) {
                $firmantes = $documento->firmas
                    ->where('estado', 'firmado')
                    ->map(fn($f) => [
                        'nombre' => $f->usuario?->nombre ?? 'N/A',
                        'fecha_firma' => $f->fecha_firma,
                    ])
                    ->values()
                    ->toArray();
            }

            return $this->successResponse([
                'tipo_origen' => 'documento',
                'codigo' => $documento->codigo_verificacion,
                'identificador' => $documento->identificador,
                'numero' => $documento->numero,
                'titulo' => $documento->titulo,
                'tipo_documental' => $documento->tipoDocumental?->nombre,
                'estado' => $documento->estado,
                'firmado' => $documento->firmado,
                'fecha_creacion' => $documento->fecha_creacion,
                'fecha_firma' => $documento->fecha_firma,
                'firmantes' => $firmantes,
                'anio' => $documento->anio,
            ]);
        }

        // Buscar en derivaciones (providencias)
        $derivacion = Derivacion::with(['correspondencia', 'departamentoDestino:id,nombre', 'usuarioOrigen:id,nombre'])
            ->where('codigo_verificacion', $codigo)
            ->first();

        if ($derivacion) {
            return $this->successResponse([
                'tipo_origen' => 'providencia',
                'codigo' => $derivacion->codigo_verificacion,
                'folio' => $derivacion->folio,
                'fecha' => $derivacion->created_at,
                'remitente' => $derivacion->correspondencia?->remitente,
                'departamento_destino' => $derivacion->departamentoDestino?->nombre,
                'acciones' => $derivacion->acciones_para,
                'estado' => $derivacion->estado,
                'usuario_origen' => $derivacion->usuarioOrigen?->nombre,
            ]);
        }

        return $this->errorResponse('Documento no encontrado. El código de verificación ingresado no corresponde a ningún documento registrado.', 404);
    }
}
