<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido(a) a la Plataforma de Correspondencia Digital</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color:#4D4D4D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

                    {{-- Encabezado --}}
                    <tr>
                        <td style="background-color:#0071BC; padding:24px 28px;">
                            <span style="display:inline-block; color:#ffffff; font-size:18px; font-weight:bold; letter-spacing:0.3px;">
                                Ilustre Municipalidad de Cabo de Hornos
                            </span>
                            <br>
                            <span style="display:inline-block; margin-top:4px; color:rgba(255,255,255,0.85); font-size:13px;">
                                Plataforma de Correspondencia Digital
                            </span>
                        </td>
                    </tr>

                    {{-- Barra de colores corporativa --}}
                    <tr>
                        <td style="font-size:0; line-height:0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td height="4" style="background-color:#2DC700;"></td>
                                    <td height="4" style="background-color:#8AC53E;"></td>
                                    <td height="4" style="background-color:#EB1B78;"></td>
                                    <td height="4" style="background-color:#28A9E3;"></td>
                                    <td height="4" style="background-color:#EE5825;"></td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Cuerpo --}}
                    <tr>
                        <td style="padding:32px 28px 8px 28px;">
                            <p style="margin:0 0 16px 0; font-size:15px;">Hola{{ $nombre ? ' ' . $nombre : '' }},</p>
                            <h1 style="margin:0 0 12px 0; font-size:20px; color:#1a1a1a; font-weight:bold;">Has sido incorporado(a) a la plataforma</h1>
                            <p style="margin:0 0 20px 0; font-size:15px; line-height:1.6;">
                                Te damos la bienvenida a la nueva <strong>Plataforma de Correspondencia Digital</strong> de la
                                Ilustre Municipalidad de Cabo de Hornos. Tu cuenta ya está creada. A continuación encontrarás
                                tus credenciales de acceso y los pasos que debes seguir antes de ingresar.
                            </p>
                        </td>
                    </tr>

                    {{-- Credenciales --}}
                    <tr>
                        <td style="padding:0 28px 8px 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f7fc; border:1px solid #cfe4f3; border-radius:8px;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p style="margin:0 0 10px 0; font-size:13px; font-weight:bold; color:#005a96; text-transform:uppercase; letter-spacing:0.5px;">Tus credenciales</p>
                                        <p style="margin:0 0 6px 0; font-size:15px;">
                                            <strong>Usuario (RUT):</strong>
                                            <span style="font-family:'Courier New', monospace;">{{ $rut }}</span>
                                        </p>
                                        <p style="margin:0 0 6px 0; font-size:15px;">
                                            <strong>Contraseña temporal:</strong>
                                            <span style="font-family:'Courier New', monospace; background-color:#ffffff; border:1px dashed #28A9E3; padding:2px 8px; border-radius:4px; letter-spacing:1px;">{{ $passwordTemporal }}</span>
                                        </p>
                                        <p style="margin:10px 0 0 0; font-size:13px; color:#777777;">
                                            Por seguridad, al iniciar sesión por primera vez el sistema te pedirá
                                            <strong>cambiar esta contraseña</strong> por una personal.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Requisitos antes de acceder --}}
                    <tr>
                        <td style="padding:20px 28px 8px 28px;">
                            <h2 style="margin:0 0 12px 0; font-size:16px; color:#1a1a1a;">Antes de ingresar, sigue estos pasos</h2>

                            <p style="margin:0 0 14px 0; font-size:15px; line-height:1.6;">
                                <strong>1. Conéctate a la red del municipio.</strong><br>
                                La plataforma solo funciona estando conectado(a) a la red interna municipal
                                (en las dependencias del municipio o por la red autorizada). Desde fuera de esa
                                red no podrás acceder.
                            </p>

                            <p style="margin:0 0 14px 0; font-size:15px; line-height:1.6;">
                                <strong>2. Descarga e instala el certificado de seguridad (SSL).</strong><br>
                                Es necesario para que tu navegador confíe en la plataforma y no muestre advertencias.
                                Descárgalo desde:
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px 0;">
                                <tr>
                                    <td style="border-radius:6px; background-color:#0071BC;">
                                        <a href="{{ $certUrl }}" target="_blank"
                                           style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">
                                            Descargar certificado SSL
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:0 0 14px 0; font-size:13px; color:#777777; word-break:break-all;">
                                Enlace directo: <a href="{{ $certUrl }}" style="color:#0071BC;">{{ $certUrl }}</a><br>
                                Guía paso a paso para instalarlo: <a href="{{ $certGuiaUrl }}" style="color:#0071BC;">{{ $certGuiaUrl }}</a>
                            </p>
                        </td>
                    </tr>

                    {{-- Acceso --}}
                    <tr>
                        <td style="padding:8px 28px 24px 28px;">
                            <h2 style="margin:0 0 12px 0; font-size:16px; color:#1a1a1a;">Accede a la plataforma</h2>
                            <p style="margin:0 0 14px 0; font-size:15px; line-height:1.6;">
                                Una vez conectado(a) a la red municipal y con el certificado instalado, ingresa en:
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="border-radius:6px; background-color:#005a96;">
                                        <a href="{{ $appUrl }}" target="_blank"
                                           style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">
                                            Ir a la plataforma &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin:12px 0 0 0; font-size:13px; color:#777777; word-break:break-all;">
                                {{ $appUrl }}
                            </p>
                        </td>
                    </tr>

                    {{-- Pie --}}
                    <tr>
                        <td style="padding:20px 28px; border-top:1px solid #ececec; background-color:#fafafa;">
                            <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
                                Si tienes problemas para acceder, contacta al administrador del sistema.<br>
                                Correo automático del Gestor Municipal — Ilustre Municipalidad de Cabo de Hornos.
                                Por favor no respondas a esta dirección.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
