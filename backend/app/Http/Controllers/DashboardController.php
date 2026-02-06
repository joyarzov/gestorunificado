<?php

namespace App\Http\Controllers;

use App\Models\Correspondencia;
use App\Models\Derivacion;
use App\Models\Documento;
use App\Models\Expediente;
use App\Models\OirsSolicitud;
use App\Models\Notificacion;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function resumen()
    {
        $user = Auth::user();
        $data = [];

        // === CORRESPONDENCIA ===
        $data['correspondencia'] = $this->getCorrespondenciaStats($user);

        // === OIRS ===
        $data['oirs'] = $this->getOirsStats($user);

        // === GESTOR DOCUMENTAL ===
        $data['gestor'] = $this->getGestorStats($user);

        // === ACTIVIDAD RECIENTE (últimos 7 días) ===
        $data['actividad_reciente'] = $this->getActividadReciente($user);

        // === RESUMEN MENSUAL (últimos 6 meses) ===
        $data['resumen_mensual'] = $this->getResumenMensual();

        return $this->successResponse($data);
    }

    private function getCorrespondenciaStats($user)
    {
        // Derivaciones pendientes para el departamento del usuario
        $pendientesBandeja = 0;
        if ($user->departamento_id) {
            $pendientesBandeja = Derivacion::where('departamento_destino_id', $user->departamento_id)
                ->whereIn('estado', ['pendiente', 'recibido'])
                ->count();
        }

        $stats = [
            'total' => Correspondencia::count(),
            'pendientes' => Correspondencia::where('estado', 'pendiente')->count(),
            'en_proceso' => Correspondencia::whereIn('estado', ['derivada_alcaldia', 'en_proceso', 'derivada_funcionario'])->count(),
            'completadas' => Correspondencia::where('estado', 'completada')->count(),
            'archivadas' => Correspondencia::where('estado', 'archivado')->count(),
            'pendientes_bandeja' => $pendientesBandeja,
            'ingresadas_hoy' => Correspondencia::whereDate('created_at', Carbon::today())->count(),
        ];

        return $stats;
    }

    private function getOirsStats($user)
    {
        $stats = [
            'total' => OirsSolicitud::count(),
            'pendientes' => OirsSolicitud::whereIn('estado', ['recibido', 'pendiente'])->count(),
            'en_proceso' => OirsSolicitud::whereIn('estado', ['asignada', 'en_analisis', 'derivado'])->count(),
            'respondidas' => OirsSolicitud::whereIn('estado', ['respondido', 'cerrado'])->count(),
            'mis_asignadas' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->whereNotIn('estado', ['respondido', 'cerrado'])
                ->count(),
            'proximas_vencer' => OirsSolicitud::where('funcionario_asignado_id', $user->id)
                ->whereIn('estado', ['asignada', 'en_analisis'])
                ->where('fecha_limite_respuesta', '<=', now()->addDays(3))
                ->count(),
            'por_tipo' => OirsSolicitud::selectRaw('tipo_solicitud, count(*) as total')
                ->groupBy('tipo_solicitud')
                ->pluck('total', 'tipo_solicitud'),
        ];

        return $stats;
    }

    private function getGestorStats($user)
    {
        // Documentos pendientes de firma para el usuario
        $pendientesFirma = Documento::where('estado', 'pendiente_firma')
            ->where(function ($query) use ($user) {
                $query->where('firmante_asignado_id', $user->id)
                    ->orWhereHas('firmantesAsignados', function ($q) use ($user) {
                        $q->where('user_id', $user->id);
                    });
            })
            ->whereDoesntHave('firmas', function ($q) use ($user) {
                $q->where('usuario_id', $user->id)
                    ->where('estado', 'firmado');
            })
            ->count();

        $stats = [
            'documentos_total' => Documento::count(),
            'documentos_borrador' => Documento::where('estado', 'borrador')->count(),
            'documentos_pendiente_firma' => Documento::where('estado', 'pendiente_firma')->count(),
            'documentos_firmados' => Documento::where('estado', 'firmado')->count(),
            'mis_pendientes_firma' => $pendientesFirma,
            'expedientes_abiertos' => Expediente::whereIn('estado', ['abierto', 'en_tramite'])->count(),
            'expedientes_total' => Expediente::count(),
            'creados_este_mes' => Documento::whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count(),
        ];

        return $stats;
    }

    private function getActividadReciente($user)
    {
        $items = [];

        // Últimas correspondencias ingresadas
        $correspondencias = Correspondencia::orderBy('created_at', 'desc')
            ->limit(5)
            ->get(['id', 'remitente', 'descripcion', 'estado', 'created_at']);

        foreach ($correspondencias as $c) {
            $items[] = [
                'tipo' => 'correspondencia',
                'titulo' => 'Correspondencia de ' . $c->remitente,
                'descripcion' => $c->descripcion ? mb_substr($c->descripcion, 0, 80) . '...' : '',
                'estado' => $c->estado,
                'fecha' => $c->created_at,
                'id' => $c->id,
            ];
        }

        // Últimos documentos creados
        $documentos = Documento::with('creador:id,nombre')
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get(['id', 'titulo', 'estado', 'creado_por', 'created_at']);

        foreach ($documentos as $d) {
            $items[] = [
                'tipo' => 'documento',
                'titulo' => $d->titulo,
                'descripcion' => 'Creado por ' . ($d->creador->nombre ?? 'Sistema'),
                'estado' => $d->estado,
                'fecha' => $d->created_at,
                'id' => $d->id,
            ];
        }

        // Últimas solicitudes OIRS
        $oirs = OirsSolicitud::orderBy('created_at', 'desc')
            ->limit(5)
            ->get(['id', 'folio', 'asunto', 'tipo_solicitud', 'estado', 'created_at']);

        foreach ($oirs as $o) {
            $items[] = [
                'tipo' => 'oirs',
                'titulo' => $o->folio . ' - ' . $o->asunto,
                'descripcion' => ucfirst(str_replace('_', ' ', $o->tipo_solicitud)),
                'estado' => $o->estado,
                'fecha' => $o->created_at,
                'id' => $o->id,
            ];
        }

        // Ordenar por fecha descendente y tomar los 10 más recientes
        usort($items, function ($a, $b) {
            return strtotime($b['fecha']) - strtotime($a['fecha']);
        });

        return array_slice($items, 0, 10);
    }

    private function getResumenMensual()
    {
        $meses = [];
        for ($i = 5; $i >= 0; $i--) {
            $fecha = Carbon::now()->subMonths($i);
            $mes = $fecha->month;
            $anio = $fecha->year;

            $meses[] = [
                'mes' => $fecha->locale('es')->isoFormat('MMM YYYY'),
                'correspondencia' => Correspondencia::whereMonth('created_at', $mes)
                    ->whereYear('created_at', $anio)
                    ->count(),
                'documentos' => Documento::whereMonth('created_at', $mes)
                    ->whereYear('created_at', $anio)
                    ->count(),
                'oirs' => OirsSolicitud::whereMonth('created_at', $mes)
                    ->whereYear('created_at', $anio)
                    ->count(),
            ];
        }

        return $meses;
    }
}
