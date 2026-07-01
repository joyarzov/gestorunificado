<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Indicadores para el Panel de Administración (solo admin). Devuelve conteos
 * agregados de usuarios, correspondencia, documentos, expedientes y OIRS.
 */
class AdminDashboardController extends Controller
{
    public function stats()
    {
        $usuarios = [
            'activos'            => DB::table('users')->where('activo', 1)->count(),
            'inactivos'          => DB::table('users')->where('activo', 0)->count(),
            'sin_primer_ingreso' => DB::table('users')->where('activo', 1)->whereNull('ultimo_acceso')->count(),
            'clave_pendiente'    => DB::table('users')->where('activo', 1)->where('debe_cambiar_password', 1)->count(),
        ];

        $correspondencia = [
            'total'              => DB::table('correspondencia')->count(),
            'entradas'           => DB::table('correspondencia')->where('direccion', 'entrada')->count(),
            'salidas'            => DB::table('correspondencia')->where('direccion', 'salida')->count(),
            'archivadas'         => DB::table('correspondencia')->where('estado', 'archivado')->count(),
            'salidas_pendientes' => DB::table('correspondencia')->where('direccion', 'salida')
                ->whereIn('estado', ['reservada', 'por_despachar', 'devuelta'])->count(),
        ];

        $documentos = [
            'total'           => DB::table('documentos')->count(),
            'borrador'        => DB::table('documentos')->where('estado', 'borrador')->count(),
            'pendiente_firma' => DB::table('documentos')->where('estado', 'pendiente_firma')->count(),
            'firmado'         => DB::table('documentos')->where('estado', 'firmado')->count(),
        ];

        $expedientes = DB::table('expedientes')->count();
        $oirs = Schema::hasTable('oirs_solicitudes') ? DB::table('oirs_solicitudes')->count() : 0;

        return $this->successResponse(compact('usuarios', 'correspondencia', 'documentos', 'expedientes', 'oirs'));
    }
}
