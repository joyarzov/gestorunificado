<?php

namespace App\Http\Controllers;

use App\Models\ChatConversacion;
use App\Models\ChatLectura;
use App\Models\ChatMensaje;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Chat interno uno a uno.
 *
 * Canal INFORMAL para coordinar: lo que deba quedar registrado va a la
 * Conversación del expediente o de la correspondencia, que es la que tiene
 * trazabilidad. La interfaz lo dice explícitamente.
 *
 * Todo por sondeo: la plataforma no tiene WebSockets y con veinte funcionarios
 * no se justifica montarlos.
 */
class ChatController extends Controller
{
    /** Tope de mensajes por página al abrir una conversación. */
    private const MENSAJES_POR_PAGINA = 50;

    /**
     * Quién actúa en el chat: el usuario REAL, nunca el contexto de subrogancia.
     *
     * Es la excepción deliberada a la convención del proyecto. Derivar o firmar
     * son actos institucionales y por eso se hacen en nombre del titular; el
     * chat, en cambio, es comunicación entre personas. Si quien subroga
     * escribiera como el titular, sus mensajes aparecerían firmados por otro y
     * además vería conversaciones privadas ajenas.
     */
    private function actor(): User
    {
        return Auth::user();
    }

    /** Lista de conversaciones del usuario, la más reciente primero. */
    public function index()
    {
        $yo = $this->actor();

        $conversaciones = ChatConversacion::where('usuario_menor_id', $yo->id)
            ->orWhere('usuario_mayor_id', $yo->id)
            ->with([
                'usuarioMenor:id,nombre,cargo',
                'usuarioMayor:id,nombre,cargo',
            ])
            ->orderByRaw('ultimo_mensaje_at IS NULL, ultimo_mensaje_at DESC')
            ->get();

        if ($conversaciones->isEmpty()) {
            return $this->successResponse(['conversaciones' => [], 'no_leidos' => 0]);
        }

        $ids = $conversaciones->pluck('id');
        $lecturas = ChatLectura::where('usuario_id', $yo->id)
            ->whereIn('conversacion_id', $ids)
            ->pluck('leido_at', 'conversacion_id');

        // Último mensaje de cada conversación, para la previsualización.
        $ultimos = ChatMensaje::whereIn('conversacion_id', $ids)
            ->whereIn('id', function ($q) use ($ids) {
                $q->selectRaw('MAX(id)')
                  ->from('chat_mensajes')
                  ->whereIn('conversacion_id', $ids)
                  ->groupBy('conversacion_id');
            })
            ->get()
            ->keyBy('conversacion_id');

        // No leídos: mensajes del OTRO posteriores a mi última lectura.
        $noLeidosPorConv = $this->contarNoLeidos($yo->id, $ids->all());

        $items = $conversaciones->map(function (ChatConversacion $c) use ($yo, $ultimos, $noLeidosPorConv, $lecturas) {
            $otro = $c->interlocutorDe($yo->id);
            $ultimo = $ultimos[$c->id] ?? null;

            return [
                'id'              => $c->id,
                'interlocutor'    => $otro ? [
                    'id'     => $otro->id,
                    'nombre' => $otro->nombre,
                    'cargo'  => $otro->cargo,
                ] : null,
                'ultimo_mensaje'  => $ultimo ? [
                    'cuerpo'  => mb_strimwidth($ultimo->cuerpo, 0, 80, '…'),
                    'mio'     => $ultimo->usuario_id === $yo->id,
                    'fecha'   => $ultimo->created_at,
                ] : null,
                'no_leidos'       => $noLeidosPorConv[$c->id] ?? 0,
                'leido_at'        => $lecturas[$c->id] ?? null,
                'ultimo_mensaje_at' => $c->ultimo_mensaje_at,
            ];
        })->filter(fn ($c) => $c['interlocutor'] !== null)->values();

        return $this->successResponse([
            'conversaciones' => $items->all(),
            'no_leidos'      => $items->sum('no_leidos'),
        ]);
    }

    /**
     * Solo el contador global de no leídos.
     *
     * Lo pide el badge del globo flotante; es mucho más barato que traerse
     * todas las conversaciones en cada sondeo.
     */
    public function noLeidos()
    {
        $yo = $this->actor();

        $ids = ChatConversacion::where('usuario_menor_id', $yo->id)
            ->orWhere('usuario_mayor_id', $yo->id)
            ->pluck('id')
            ->all();

        if (!$ids) {
            return $this->successResponse(['no_leidos' => 0, 'ultimo' => null]);
        }

        $porConversacion = $this->contarNoLeidos($yo->id, $ids);
        $total = array_sum($porConversacion);

        // El último mensaje sin leer viaja con el contador para que el aviso
        // flotante pueda decir quién escribió y qué, sin una segunda consulta.
        $ultimo = null;
        if ($total > 0) {
            $mensaje = ChatMensaje::whereIn('conversacion_id', array_keys(array_filter($porConversacion)))
                ->where('usuario_id', '!=', $yo->id)
                ->with('usuario:id,nombre')
                ->orderByDesc('id')
                ->first();

            if ($mensaje) {
                $ultimo = [
                    'conversacion_id' => $mensaje->conversacion_id,
                    'autor_id'        => $mensaje->usuario_id,
                    'autor'           => $mensaje->usuario?->nombre,
                    // Recortado: el aviso muestra un adelanto, no el mensaje entero.
                    'cuerpo'          => mb_strimwidth($mensaje->cuerpo, 0, 120, '…'),
                    'fecha'           => $mensaje->created_at,
                ];
            }
        }

        return $this->successResponse(['no_leidos' => $total, 'ultimo' => $ultimo]);
    }

    /**
     * Mensajes de una conversación y estado de lectura del interlocutor.
     *
     * Admite dos modos:
     *  - Sin `desde`: la carga inicial, con los últimos mensajes en orden
     *    cronológico.
     *  - Con `desde=<id>`: SOLO lo posterior a ese mensaje. Es el que usa el
     *    sondeo, y es lo que hace viable consultar cada dos segundos: cuando no
     *    hay nada nuevo —la inmensa mayoría de las veces— la respuesta pesa
     *    unas decenas de bytes en vez de reenviar el hilo completo.
     */
    public function mensajes(Request $request, ChatConversacion $conversacion)
    {
        $yo = $this->actor();
        if (!$conversacion->participa($yo->id)) {
            return $this->errorResponse('Esta conversación no es tuya.', 403);
        }

        $desde = (int) $request->input('desde', 0);
        $consulta = $conversacion->mensajes()->with('usuario:id,nombre,cargo');

        if ($desde > 0) {
            $mensajes = $consulta->where('id', '>', $desde)
                ->orderBy('id')
                ->limit(self::MENSAJES_POR_PAGINA)
                ->get();
        } else {
            $mensajes = $consulta->orderByDesc('id')
                ->limit((int) $request->input('limit', self::MENSAJES_POR_PAGINA))
                ->get()
                ->reverse()
                ->values();
        }

        // Tener la conversación a la vista es leerla, pero la marca solo se
        // toca cuando hay algo nuevo que leer (o en la carga inicial): con el
        // sondeo cada dos segundos, escribir siempre sería un UPDATE constante
        // por cada persona con el chat abierto, para nada.
        //
        // En modo auditoría NO se marca: el admin que mira como otro no debe
        // apagarle los no leídos al funcionario real.
        $hayAjenos = $mensajes->contains(fn (ChatMensaje $m) => $m->usuario_id !== $yo->id);
        if (!Auth::user()->estaAuditando() && ($desde === 0 || $hayAjenos)) {
            ChatLectura::updateOrCreate(
                ['usuario_id' => $yo->id, 'conversacion_id' => $conversacion->id],
                ['leido_at' => now()]
            );
        }

        $otro = $conversacion->interlocutorDe($yo->id);

        // Hasta cuándo leyó el OTRO: con eso el frontend marca como vistos los
        // mensajes propios anteriores a esa hora.
        $leidoPorElOtro = $otro
            ? ChatLectura::where('usuario_id', $otro->id)
                ->where('conversacion_id', $conversacion->id)
                ->value('leido_at')
            : null;

        return $this->successResponse([
            'conversacion_id'   => $conversacion->id,
            'interlocutor'      => $otro ? ['id' => $otro->id, 'nombre' => $otro->nombre, 'cargo' => $otro->cargo] : null,
            'leido_por_el_otro' => $leidoPorElOtro,
            // Con `desde` esto es solo el incremento; el frontend lo añade a lo
            // que ya tiene en pantalla.
            'incremental'       => $desde > 0,
            'mensajes'          => $mensajes->map(fn (ChatMensaje $m) => [
                'id'     => $m->id,
                'cuerpo' => $m->cuerpo,
                'mio'    => $m->usuario_id === $yo->id,
                'autor'  => $m->usuario?->nombre,
                'fecha'  => $m->created_at,
            ])->values()->all(),
        ]);
    }

    /**
     * Envía un mensaje a otro funcionario. Crea la conversación si es la
     * primera vez que se escriben.
     */
    public function enviar(Request $request)
    {
        $yo = $this->actor();

        if (Auth::user()->estaAuditando()) {
            return $this->errorResponse('En modo auditoría no se puede escribir.', 403);
        }

        $request->validate([
            'destinatario_id' => 'required|integer|exists:users,id',
            'cuerpo'          => 'required|string|max:2000',
        ]);

        $destinatarioId = (int) $request->input('destinatario_id');
        if ($destinatarioId === $yo->id) {
            return $this->errorResponse('No puedes escribirte a ti mismo.', 422);
        }

        $destinatario = User::where('id', $destinatarioId)->where('activo', true)->first();
        if (!$destinatario) {
            return $this->errorResponse('El funcionario no está disponible.', 422);
        }

        $mensaje = DB::transaction(function () use ($yo, $destinatarioId, $request) {
            $conversacion = ChatConversacion::entre($yo->id, $destinatarioId);

            $mensaje = $conversacion->mensajes()->create([
                'usuario_id' => $yo->id,
                'cuerpo'     => trim($request->input('cuerpo')),
            ]);

            $conversacion->forceFill(['ultimo_mensaje_at' => now()])->save();

            // Quien escribe queda al día con su propio mensaje.
            ChatLectura::updateOrCreate(
                ['usuario_id' => $yo->id, 'conversacion_id' => $conversacion->id],
                ['leido_at' => now()]
            );

            return $mensaje;
        });

        // A propósito NO se envía correo ni notificación de campana: el chat es
        // para coordinar en el momento y sumar avisos agravaría la fatiga de
        // bandeja que ya se decidió reducir. El aviso es el contador del globo.

        return $this->successResponse([
            'conversacion_id' => $mensaje->conversacion_id,
            'mensaje' => [
                'id'     => $mensaje->id,
                'cuerpo' => $mensaje->cuerpo,
                'mio'    => true,
                'autor'  => $yo->nombre,
                'fecha'  => $mensaje->created_at,
            ],
        ], 'Mensaje enviado', 201);
    }

    /** Marca la conversación como leída sin traer los mensajes. */
    public function marcarLeida(ChatConversacion $conversacion)
    {
        $yo = $this->actor();
        if (!$conversacion->participa($yo->id)) {
            return $this->errorResponse('Esta conversación no es tuya.', 403);
        }
        if (Auth::user()->estaAuditando()) {
            return $this->errorResponse('En modo auditoría no se marca como leído.', 403);
        }

        ChatLectura::updateOrCreate(
            ['usuario_id' => $yo->id, 'conversacion_id' => $conversacion->id],
            ['leido_at' => now()]
        );

        return $this->successResponse(['leido' => true]);
    }

    /**
     * Mensajes sin leer por conversación: los escritos por el OTRO después de
     * mi última lectura (o todos, si nunca la abrí).
     *
     * @return array<int,int> [conversacion_id => cantidad]
     */
    private function contarNoLeidos(int $usuarioId, array $conversacionIds): array
    {
        if (!$conversacionIds) {
            return [];
        }

        // Se cuenta en la base y no en PHP: este método lo llama el sondeo del
        // badge, y traerse todos los mensajes para contarlos crecería sin
        // control con el uso.
        //
        // La comparación es entre dos columnas escritas por la propia
        // aplicación, así que no hay riesgo de desfase horario (no interviene
        // NOW() de MySQL, que va en UTC mientras la app va en Punta Arenas).
        return DB::table('chat_mensajes as m')
            ->leftJoin('chat_lecturas as l', function ($join) use ($usuarioId) {
                $join->on('l.conversacion_id', '=', 'm.conversacion_id')
                     ->where('l.usuario_id', '=', $usuarioId);
            })
            ->whereIn('m.conversacion_id', $conversacionIds)
            ->where('m.usuario_id', '!=', $usuarioId)
            ->where(function ($q) {
                $q->whereNull('l.leido_at')
                  ->orWhereColumn('m.created_at', '>', 'l.leido_at');
            })
            ->groupBy('m.conversacion_id')
            ->selectRaw('m.conversacion_id, COUNT(*) as total')
            ->pluck('total', 'conversacion_id')
            ->map(fn ($n) => (int) $n)
            ->all();
    }
}
