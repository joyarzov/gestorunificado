<?php

namespace App\Http\Controllers;

use App\Models\Configuracion;
use App\Mail\NotificacionMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;

class ConfiguracionController extends Controller
{
    // Claves de propósito general expuestas al panel
    private const ADMIN_CLAVES = ['firmagob_simulate'];

    // Claves SMTP editables (la contraseña se enmascara al leer)
    private const MAIL_CLAVES = [
        'mail_host', 'mail_port', 'mail_username', 'mail_password',
        'mail_encryption', 'mail_from_address', 'mail_from_name',
    ];

    private const PASSWORD_MASK = '********';

    public function index()
    {
        $claves = array_merge(self::ADMIN_CLAVES, self::MAIL_CLAVES);
        $rows = Configuracion::whereIn('clave', $claves)->get()->keyBy('clave');

        // Valor efectivo de fallback (.env) para las claves de mail sin override en BD
        $fallback = [
            'mail_host'         => config('mail.mailers.smtp.host'),
            'mail_port'         => (string) config('mail.mailers.smtp.port'),
            'mail_username'     => config('mail.mailers.smtp.username'),
            'mail_password'     => config('mail.mailers.smtp.password'),
            'mail_encryption'   => config('mail.mailers.smtp.encryption'),
            'mail_from_address' => config('mail.from.address'),
            'mail_from_name'    => config('mail.from.name'),
        ];

        $config = collect($claves)->mapWithKeys(function ($clave) use ($rows, $fallback) {
            $row = $rows->get($clave);
            $valor = $row?->valor;

            if (in_array($clave, self::MAIL_CLAVES, true) && ($valor === null || $valor === '')) {
                $valor = $fallback[$clave] ?? null; // mostrar lo que está en efecto (.env)
            }
            if ($clave === 'mail_password') {
                $valor = !empty($valor) ? self::PASSWORD_MASK : ''; // nunca exponer la clave real
            }

            return [$clave => [
                'clave'       => $clave,
                'valor'       => $valor,
                'descripcion' => $row?->descripcion,
            ]];
        });

        return $this->successResponse($config);
    }

    public function update(Request $request, string $clave)
    {
        $permitidas = array_merge(self::ADMIN_CLAVES, self::MAIL_CLAVES);
        if (!in_array($clave, $permitidas, true)) {
            return $this->errorResponse('Clave de configuración no válida', 422);
        }

        // firmagob_simulate exige valor; las de mail pueden quedar vacías (fallback al .env)
        $esMail = in_array($clave, self::MAIL_CLAVES, true);
        $request->validate(['valor' => $esMail ? 'nullable|string' : 'required|string']);

        // No sobrescribir la contraseña si llega vacía o con la máscara
        if ($clave === 'mail_password') {
            if (in_array($request->valor, [null, '', self::PASSWORD_MASK], true)) {
                return $this->successResponse(null, 'Sin cambios en la contraseña');
            }
        }

        Configuracion::set($clave, (string) ($request->valor ?? ''));

        return $this->successResponse(null, 'Configuración actualizada');
    }

    /**
     * Enviar un correo de prueba para validar la configuración SMTP.
     * Aplica los overrides de BD ya cargados por MailConfigServiceProvider.
     */
    public function probarCorreo(Request $request)
    {
        // Siempre se envía al correo del propio admin autenticado (no a direcciones arbitrarias).
        $destino = Auth::user()?->email;

        if (!$destino) {
            return $this->errorResponse('Tu usuario no tiene un correo registrado', 422);
        }

        try {
            Mail::to($destino)->sendNow(new NotificacionMail(
                Auth::user()?->nombre ?? '',
                'cero_papel',
                'Correo de prueba',
                "Este es un correo de prueba del sistema de notificaciones del Gestor Municipal. Si lo recibes, la configuración SMTP es correcta.",
                []
            ));

            return $this->successResponse(['email' => $destino], "Correo de prueba enviado a {$destino}");
        } catch (\Throwable $e) {
            return $this->errorResponse('Error al enviar el correo de prueba: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Estado de FirmaGob — accesible por cualquier usuario autenticado
     * para que el modal de firma pueda mostrar el aviso de simulación.
     */
    public function firmagobEstado()
    {
        $simulate = filter_var(
            Configuracion::get('firmagob_simulate', config('firmagob.simulate', false)),
            FILTER_VALIDATE_BOOLEAN
        );

        return $this->successResponse([
            'simulate' => $simulate,
            'enabled'  => (bool) config('firmagob.enabled'),
        ]);
    }
}
