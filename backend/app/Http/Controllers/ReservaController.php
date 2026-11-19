<?php

namespace App\Http\Controllers;

use App\Mail\ReservaMail;
use App\Models\Espacio;
use App\Models\Notificacion;
use App\Models\Reserva;
use App\Models\User;
use App\Services\IcsBuilder;
use App\Services\NotificacionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Reservas de espacios municipales. El calendario es de solo lectura para todos;
 * los administradores del espacio crean reservas directas (aprobadas) y
 * aprueban/rechazan las solicitudes de los funcionarios.
 */
class ReservaController extends Controller
{
    /** Reservas de un espacio en un rango (para pintar el calendario). */
    public function index(Request $request)
    {
        $request->validate([
            'espacio_id' => 'required|exists:espacios,id',
            'desde' => 'nullable|date',
            'hasta' => 'nullable|date',
        ]);

        $desde = $request->filled('desde') ? Carbon::parse($request->input('desde')) : now()->subMonths(1);
        $hasta = $request->filled('hasta') ? Carbon::parse($request->input('hasta')) : now()->addMonths(2);

        $reservas = Reserva::where('espacio_id', $request->espacio_id)
            ->whereIn('estado', [Reserva::ESTADO_SOLICITADA, Reserva::ESTADO_APROBADA])
            ->enRango($desde, $hasta)
            ->with(['solicitante:id,nombre,cargo', 'asistentes:id,nombre,cargo'])
            ->orderBy('inicio')
            ->get();

        return $this->successResponse($reservas);
    }

    public function show(Reserva $reserva)
    {
        $reserva->load([
            'espacio:id,nombre,ubicacion,color',
            'solicitante:id,nombre,cargo',
            'aprobadaPor:id,nombre',
            'asistentes:id,nombre,cargo',
        ]);
        $reserva->puede_gestionar = $reserva->espacio->esAdministrador(Auth::user());

        return $this->successResponse($reserva);
    }

    public function store(Request $request)
    {
        $data = $this->validar($request);
        $user = Auth::user();
        $espacio = Espacio::findOrFail($data['espacio_id']);

        $esAdminEspacio = $espacio->esAdministrador($user);
        // Admin del espacio → reserva directa (aprobada). Funcionario → solicitud.
        $estado = $esAdminEspacio ? Reserva::ESTADO_APROBADA : Reserva::ESTADO_SOLICITADA;

        // Una reserva APROBADA no puede solaparse con otra aprobada del espacio.
        if ($estado === Reserva::ESTADO_APROBADA
            && $this->haySolapamiento($espacio->id, $data['inicio'], $data['fin'])) {
            return $this->errorResponse('Ese horario choca con otra reserva ya aprobada del espacio.', 422);
        }

        $reserva = Reserva::create([
            'espacio_id' => $espacio->id,
            'titulo' => $data['titulo'],
            'descripcion' => $data['descripcion'] ?? null,
            'inicio' => $data['inicio'],
            'fin' => $data['fin'],
            'estado' => $estado,
            'solicitante_id' => $user->id,
            'aprobada_por_id' => $esAdminEspacio ? $user->id : null,
            'aprobada_at' => $esAdminEspacio ? now() : null,
        ]);

        $this->sincronizarAsistentes($reserva, $request);

        if ($estado === Reserva::ESTADO_APROBADA) {
            $this->avisarAsistentes($reserva, 'Te convocaron a una reserva', 'confirmada');
        } else {
            $this->avisarAdministradores($espacio, $reserva);
        }

        $reserva->load(['solicitante:id,nombre', 'asistentes:id,nombre', 'espacio:id,nombre']);

        return $this->successResponse(
            $reserva,
            $esAdminEspacio ? 'Reserva creada' : 'Solicitud enviada; queda pendiente de aprobación',
            201
        );
    }

    public function update(Request $request, Reserva $reserva)
    {
        $user = Auth::user();
        $esAdmin = $reserva->espacio->esAdministrador($user);
        $esSolicitantePendiente = $reserva->solicitante_id === $user->id
            && $reserva->estado === Reserva::ESTADO_SOLICITADA;

        if (!$esAdmin && !$esSolicitantePendiente) {
            return $this->errorResponse('No puedes editar esta reserva.', 403);
        }

        $data = $this->validar($request, $reserva->espacio_id);

        if ($reserva->estado === Reserva::ESTADO_APROBADA
            && $this->haySolapamiento($reserva->espacio_id, $data['inicio'], $data['fin'], $reserva->id)) {
            return $this->errorResponse('Ese horario choca con otra reserva ya aprobada del espacio.', 422);
        }

        $reserva->update([
            'titulo' => $data['titulo'],
            'descripcion' => $data['descripcion'] ?? null,
            'inicio' => $data['inicio'],
            'fin' => $data['fin'],
        ]);
        $this->sincronizarAsistentes($reserva, $request);

        $reserva->load(['solicitante:id,nombre', 'asistentes:id,nombre', 'espacio:id,nombre']);

        return $this->successResponse($reserva, 'Reserva actualizada');
    }

    public function aprobar(Reserva $reserva)
    {
        $user = Auth::user();
        if (!$reserva->espacio->esAdministrador($user)) {
            return $this->errorResponse('No administras este espacio.', 403);
        }
        if ($reserva->estado !== Reserva::ESTADO_SOLICITADA) {
            return $this->errorResponse('Solo se pueden aprobar solicitudes pendientes.', 422);
        }
        if ($this->haySolapamiento($reserva->espacio_id, $reserva->inicio, $reserva->fin, $reserva->id)) {
            return $this->errorResponse('No se puede aprobar: el horario choca con otra reserva ya aprobada.', 422);
        }

        $reserva->update([
            'estado' => Reserva::ESTADO_APROBADA,
            'aprobada_por_id' => $user->id,
            'aprobada_at' => now(),
        ]);

        $this->avisarSolicitante($reserva, 'Tu solicitud de reserva fue aprobada',
            "Tu reserva de \"{$reserva->espacio->nombre}\" para {$this->rango($reserva)} fue aprobada.");
        $this->avisarAsistentes($reserva, 'Te convocaron a una reserva', 'confirmada');

        return $this->successResponse($reserva->fresh(), 'Reserva aprobada');
    }

    public function rechazar(Request $request, Reserva $reserva)
    {
        $user = Auth::user();
        if (!$reserva->espacio->esAdministrador($user)) {
            return $this->errorResponse('No administras este espacio.', 403);
        }
        if ($reserva->estado !== Reserva::ESTADO_SOLICITADA) {
            return $this->errorResponse('Solo se pueden rechazar solicitudes pendientes.', 422);
        }
        $request->validate(['motivo_rechazo' => 'nullable|string|max:500']);

        $reserva->update([
            'estado' => Reserva::ESTADO_RECHAZADA,
            'motivo_rechazo' => $request->input('motivo_rechazo'),
        ]);

        $motivo = $request->filled('motivo_rechazo') ? " Motivo: {$request->input('motivo_rechazo')}." : '';
        $this->avisarSolicitante($reserva, 'Tu solicitud de reserva fue rechazada',
            "Tu solicitud de reserva de \"{$reserva->espacio->nombre}\" para {$this->rango($reserva)} fue rechazada.{$motivo}");

        return $this->successResponse($reserva->fresh(), 'Solicitud rechazada');
    }

    public function cancelar(Reserva $reserva)
    {
        $user = Auth::user();
        $esAdmin = $reserva->espacio->esAdministrador($user);
        $esSolicitante = $reserva->solicitante_id === $user->id;
        if (!$esAdmin && !$esSolicitante) {
            return $this->errorResponse('No puedes cancelar esta reserva.', 403);
        }
        if (in_array($reserva->estado, [Reserva::ESTADO_CANCELADA, Reserva::ESTADO_RECHAZADA], true)) {
            return $this->errorResponse('Esta reserva ya no está activa.', 422);
        }

        $eraAprobada = $reserva->estado === Reserva::ESTADO_APROBADA;
        $reserva->update(['estado' => Reserva::ESTADO_CANCELADA]);

        // Si estaba confirmada, avisar a los asistentes que se canceló.
        if ($eraAprobada) {
            $this->avisarAsistentes($reserva, 'Se canceló una reserva', 'cancelada');
        }
        // Si la canceló el administrador (no el propio solicitante), avisar al solicitante.
        if ($esAdmin && !$esSolicitante) {
            $this->avisarSolicitante($reserva, 'Se canceló tu reserva',
                "Tu reserva de \"{$reserva->espacio->nombre}\" para {$this->rango($reserva)} fue cancelada.");
        }

        return $this->successResponse($reserva->fresh(), 'Reserva cancelada');
    }

    /** Solicitudes pendientes de los espacios que administra el usuario. */
    public function pendientes()
    {
        $user = Auth::user();
        $espacioIds = $user->isAdmin()
            ? Espacio::pluck('id')
            : $user->espaciosQueAdministra()->pluck('espacios.id');

        $reservas = Reserva::whereIn('espacio_id', $espacioIds)
            ->where('estado', Reserva::ESTADO_SOLICITADA)
            ->with(['espacio:id,nombre,color', 'solicitante:id,nombre,cargo', 'asistentes:id,nombre'])
            ->orderBy('inicio')
            ->get();

        return $this->successResponse($reservas);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private function validar(Request $request, ?int $espacioFijo = null): array
    {
        $data = $request->validate([
            'espacio_id' => ($espacioFijo ? 'nullable' : 'required') . '|exists:espacios,id',
            'titulo' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'inicio' => 'required|date',
            'fin' => 'required|date|after:inicio',
            'asistente_ids' => 'nullable|array',
            'asistente_ids.*' => 'integer|exists:users,id',
        ]);
        $data['espacio_id'] = $espacioFijo ?? $data['espacio_id'];

        return $data;
    }

    private function haySolapamiento(int $espacioId, $inicio, $fin, ?int $excluirId = null): bool
    {
        return Reserva::where('espacio_id', $espacioId)
            ->where('estado', Reserva::ESTADO_APROBADA)
            ->when($excluirId, fn ($q) => $q->where('id', '!=', $excluirId))
            ->where('inicio', '<', $fin)
            ->where('fin', '>', $inicio)
            ->exists();
    }

    private function sincronizarAsistentes(Reserva $reserva, Request $request): void
    {
        if (!$request->has('asistente_ids')) {
            return;
        }
        $ids = collect($request->input('asistente_ids', []))
            ->map(fn ($i) => (int) $i)
            ->unique()
            ->values()
            ->all();
        $reserva->asistentes()->sync($ids);
    }

    private function rango(Reserva $reserva): string
    {
        $inicio = $reserva->inicio->copy()->timezone(config('app.timezone'));
        $fin = $reserva->fin->copy()->timezone(config('app.timezone'));
        if ($inicio->isSameDay($fin)) {
            return $inicio->format('d/m/Y H:i') . ' a ' . $fin->format('H:i');
        }
        return $inicio->format('d/m/Y H:i') . ' a ' . $fin->format('d/m/Y H:i');
    }

    /** Avisa a los asistentes (campana + correo con .ics de la cita). */
    private function avisarAsistentes(Reserva $reserva, string $titulo, string $situacion): void
    {
        $reserva->loadMissing(['espacio', 'asistentes', 'solicitante:id,nombre']);
        if ($reserva->asistentes->isEmpty()) {
            return;
        }

        $cuerpoBase = $situacion === 'cancelada'
            ? "Se canceló la reserva \"{$reserva->titulo}\" en {$reserva->espacio->nombre} ({$this->rango($reserva)})."
            : "{$reserva->solicitante->nombre} te convocó a \"{$reserva->titulo}\" en {$reserva->espacio->nombre} el {$this->rango($reserva)}."
                . ($reserva->descripcion ? " {$reserva->descripcion}" : '');

        // Solo se adjunta .ics cuando la cita está vigente (no al cancelar).
        $ics = $situacion === 'cancelada' ? null : IcsBuilder::forReserva($reserva);
        $data = ['reserva_id' => $reserva->id, 'url' => '/reservas'];

        foreach ($reserva->asistentes as $asistente) {
            if (!$asistente->activo) {
                continue;
            }
            // Campana (in-app).
            $notif = Notificacion::create([
                'user_id' => $asistente->id,
                'modulo' => 'reservas',
                'tipo' => $situacion === 'cancelada' ? 'reserva_cancelada' : 'reserva_confirmada',
                'titulo' => $titulo,
                'mensaje' => $cuerpoBase,
                'data' => $data,
            ]);
            // Correo (con .ics si aplica).
            if (!empty($asistente->email) && filter_var($asistente->email, FILTER_VALIDATE_EMAIL)) {
                try {
                    Mail::to($asistente->email)->queue(
                        new ReservaMail($asistente->nombre ?? '', $titulo, $cuerpoBase, $data, $ics, 'reserva.ics')
                    );
                    $notif->forceFill(['email_enviado_at' => now()])->saveQuietly();
                } catch (\Throwable $e) {
                    Log::warning("ReservaController: no se pudo encolar email a {$asistente->id}: " . $e->getMessage());
                }
            }
        }
    }

    /** Avisa a los administradores del espacio que llegó una solicitud. */
    private function avisarAdministradores(Espacio $espacio, Reserva $reserva): void
    {
        $admins = $espacio->administradores()->where('activo', true)->get();
        if ($admins->isEmpty()) {
            return;
        }
        NotificacionService::enviar(
            $admins,
            'reservas',
            'reserva_solicitada',
            'Nueva solicitud de reserva',
            "{$reserva->solicitante->nombre} solicitó \"{$reserva->titulo}\" en {$espacio->nombre} para {$this->rango($reserva)}. Requiere tu aprobación.",
            ['reserva_id' => $reserva->id, 'url' => '/reservas/solicitudes']
        );
    }

    private function avisarSolicitante(Reserva $reserva, string $titulo, string $cuerpo): void
    {
        $reserva->loadMissing('solicitante');
        if (!$reserva->solicitante) {
            return;
        }
        NotificacionService::enviar(
            $reserva->solicitante,
            'reservas',
            'reserva_resuelta',
            $titulo,
            $cuerpo,
            ['reserva_id' => $reserva->id, 'url' => '/reservas']
        );
    }
}
