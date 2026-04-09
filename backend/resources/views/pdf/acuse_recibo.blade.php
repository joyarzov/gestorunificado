<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Acuse de Recibo {{ $folio }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12px;
            color: #000;
            line-height: 1.6;
        }
        .page {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }
        .header-table { width: 100%; margin-bottom: 20px; }
        .header-table td { vertical-align: top; }
        .logo-cell { width: 170px; }
        .logo-cell img { max-width: 158px; height: auto; }
        .title-cell { text-align: center; vertical-align: middle; }
        .title-cell h1 {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 4px;
        }
        .title-cell .subtitle { font-size: 11px; color: #333; }
        .date-right { text-align: right; font-size: 12px; margin-bottom: 25px; }
        .doc-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 20px 0 25px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 8px;
        }
        .section { margin-bottom: 18px; }
        .section-title {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
            text-decoration: underline;
        }
        .info-row { margin-bottom: 4px; padding-left: 20px; }
        .info-label { font-weight: bold; }
        .recepcion-box {
            border: 1px solid #000;
            padding: 12px 15px;
            margin-bottom: 18px;
        }
        .firma-area { margin-top: 80px; text-align: center; }
        .firma-linea {
            border-top: 1px solid #000;
            width: 280px;
            margin: 0 auto;
            padding-top: 5px;
            font-size: 12px;
            line-height: 1.4;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 8pt;
            font-style: italic;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 8px;
        }
    </style>
</head>
<body>
    <div class="page">
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    @if(!empty($logo_base64))
                        <img src="{{ $logo_base64 }}" alt="Logo Municipalidad" />
                    @endif
                </td>
                <td class="title-cell">
                    <h1>Ilustre Municipalidad de Cabo de Hornos</h1>
                    <div class="subtitle">Regi&oacute;n de Magallanes y de la Ant&aacute;rtica Chilena</div>
                </td>
            </tr>
        </table>

        <div class="date-right">
            Puerto Williams, {{ $fecha }}
        </div>

        <div class="doc-title">
            ACUSE DE RECIBO N&ordm; {{ $folio }}
        </div>

        <div class="section">
            <div class="section-title">Datos de la Correspondencia</div>
            <div class="info-row">
                <span class="info-label">Remitente:</span> {{ $remitente }}
            </div>
            <div class="info-row">
                <span class="info-label">N&ordm; Documento:</span> {{ $numero_documento ?? 'Sin n&uacute;mero' }}
            </div>
            <div class="info-row">
                <span class="info-label">Fecha Recepci&oacute;n:</span> {{ $fecha_recepcion }}
            </div>
            <div class="info-row">
                <span class="info-label">Descripci&oacute;n:</span> {{ $descripcion ?? 'Sin descripci&oacute;n' }}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Recepci&oacute;n</div>
            <div class="recepcion-box">
                El suscrito declara haber recibido conforme la correspondencia indicada, quedando registrada en el Sistema de Correspondencia Municipal en esta fecha.
            </div>
        </div>

        <div class="firma-area">
            <div class="firma-linea">
                {{ $receptor }}<br>
                Alcalde<br>
                Ilustre Municipalidad de Cabo de Hornos
            </div>
        </div>

        <div class="footer">
            Documento generado autom&aacute;ticamente por el Sistema de Correspondencia Municipal &mdash; {{ $folio }} &mdash; {{ $fecha }}
            @if(!empty($codigo_verificacion))
                <br/>Verifique en: <strong>{{ $verificar_url ?? '' }}</strong>
            @endif
        </div>

        @if(!empty($codigo_verificacion))
        <div style="position:fixed;bottom:30px;right:40px;text-align:center;">
            @if(!empty($qr_svg))
                <div style="width:70px;height:70px;">{!! $qr_svg !!}</div>
            @endif
            <div style="font-size:6px;color:#666;margin-top:1px;">
                C&oacute;d: {{ $codigo_verificacion }}
            </div>
        </div>
        @endif
    </div>
</body>
</html>
