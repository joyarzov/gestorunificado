<?php

namespace App\Services;

use App\Models\Reserva;
use Illuminate\Support\Carbon;

/**
 * Genera el contenido de un archivo .ics (iCalendar) para una reserva, para
 * adjuntarlo al correo de los asistentes y que entre en su calendario.
 */
class IcsBuilder
{
    public static function forReserva(Reserva $reserva): string
    {
        $espacio = $reserva->espacio;
        $lugar = trim(($espacio->nombre ?? 'Espacio municipal')
            . ($espacio && $espacio->ubicacion ? ' - ' . $espacio->ubicacion : ''));

        $uid = 'reserva-' . $reserva->id . '@imcabodehornos.cl';
        $stamp = Carbon::now('UTC')->format('Ymd\THis\Z');
        $inicio = $reserva->inicio->copy()->utc()->format('Ymd\THis\Z');
        $fin = $reserva->fin->copy()->utc()->format('Ymd\THis\Z');

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Ilustre Municipalidad de Cabo de Hornos//Reservas//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            'UID:' . $uid,
            'DTSTAMP:' . $stamp,
            'DTSTART:' . $inicio,
            'DTEND:' . $fin,
            'SUMMARY:' . self::escape($reserva->titulo),
            'DESCRIPTION:' . self::escape((string) $reserva->descripcion),
            'LOCATION:' . self::escape($lugar),
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR',
        ];

        // iCalendar separa líneas con CRLF.
        return implode("\r\n", $lines) . "\r\n";
    }

    private static function escape(string $text): string
    {
        $text = str_replace('\\', '\\\\', $text);
        $text = str_replace(["\r\n", "\n", "\r"], '\\n', $text);
        $text = str_replace(',', '\\,', $text);
        $text = str_replace(';', '\\;', $text);

        return $text;
    }
}
