<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Conversación uno a uno entre dos funcionarios.
 *
 * El par se guarda ORDENADO (menor, mayor) para que exista una sola fila por
 * pareja, la abra quien la abra: sin eso, A→B y B→A crearían dos hilos que
 * mostrarían historiales distintos a cada lado.
 */
class ChatConversacion extends Model
{
    protected $table = 'chat_conversaciones';

    protected $fillable = [
        'usuario_menor_id',
        'usuario_mayor_id',
        'ultimo_mensaje_at',
    ];

    protected $casts = [
        'ultimo_mensaje_at' => 'datetime',
    ];

    public function mensajes()
    {
        return $this->hasMany(ChatMensaje::class, 'conversacion_id');
    }

    public function lecturas()
    {
        return $this->hasMany(ChatLectura::class, 'conversacion_id');
    }

    public function usuarioMenor()
    {
        return $this->belongsTo(User::class, 'usuario_menor_id');
    }

    public function usuarioMayor()
    {
        return $this->belongsTo(User::class, 'usuario_mayor_id');
    }

    /**
     * Busca la conversación entre dos usuarios, o la crea. Idempotente.
     *
     * Si los dos se escriben por primera vez en el mismo instante, ambos
     * intentan crear la misma fila y el índice único deja pasar solo a uno; el
     * otro recibiría un error 500 por algo que en realidad ya está resuelto.
     * Por eso, ante la colisión, se relee la fila que acaba de ganar.
     */
    public static function entre(int $unUsuario, int $otroUsuario): self
    {
        [$menor, $mayor] = $unUsuario < $otroUsuario
            ? [$unUsuario, $otroUsuario]
            : [$otroUsuario, $unUsuario];

        $claves = ['usuario_menor_id' => $menor, 'usuario_mayor_id' => $mayor];

        try {
            return static::firstOrCreate($claves);
        } catch (\Illuminate\Database\QueryException $e) {
            return static::where($claves)->firstOrFail();
        }
    }

    /** ¿Este usuario es parte de la conversación? */
    public function participa(int $usuarioId): bool
    {
        return $this->usuario_menor_id === $usuarioId
            || $this->usuario_mayor_id === $usuarioId;
    }

    /** El otro lado de la conversación, visto desde $usuarioId. */
    public function interlocutorDe(int $usuarioId): ?User
    {
        if ($this->usuario_menor_id === $usuarioId) {
            return $this->usuarioMayor;
        }
        if ($this->usuario_mayor_id === $usuarioId) {
            return $this->usuarioMenor;
        }

        return null;
    }
}
