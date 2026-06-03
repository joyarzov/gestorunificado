<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $titulo }}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; color:#4D4D4D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">

                    {{-- Encabezado con color del módulo --}}
                    <tr>
                        <td style="background-color:{{ $moduloColor }}; padding:20px 28px;">
                            <span style="display:inline-block; background-color:rgba(255,255,255,0.22); color:#ffffff; font-size:12px; font-weight:bold; letter-spacing:0.5px; text-transform:uppercase; padding:4px 10px; border-radius:4px;">
                                {{ $moduloLabel }}
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
                        <td style="padding:32px 28px 24px 28px;">
                            <p style="margin:0 0 16px 0; font-size:15px;">Hola{{ $nombre ? ' ' . $nombre : '' }},</p>
                            <h1 style="margin:0 0 12px 0; font-size:20px; color:#1a1a1a; font-weight:bold;">{{ $titulo }}</h1>
                            <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#4D4D4D;">{!! nl2br(e($cuerpo)) !!}</p>

                            @if($url)
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="border-radius:6px; background-color:{{ $moduloColor }};">
                                        <a href="{{ $url }}" target="_blank"
                                           style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:6px;">
                                            Ver en el sistema &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            @endif
                        </td>
                    </tr>

                    {{-- Pie --}}
                    <tr>
                        <td style="padding:20px 28px; border-top:1px solid #ececec; background-color:#fafafa;">
                            <p style="margin:0; font-size:12px; color:#999999; line-height:1.5;">
                                Notificación automática del Gestor Municipal — Ilustre Municipalidad de Cabo de Hornos.<br>
                                Este correo es solo informativo, por favor no respondas a esta dirección.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
