<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Providencia {{ $folio }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
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
        .header-table {
            width: 100%;
            margin-bottom: 20px;
        }
        .header-table td {
            vertical-align: top;
        }
        .logo-cell {
            width: 170px;
        }
        .logo-cell img {
            max-width: 158px;
            height: auto;
        }
        .title-cell {
            text-align: center;
            vertical-align: middle;
        }
        .title-cell h1 {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 4px;
        }
        .title-cell .subtitle {
            font-size: 11px;
            color: #333;
        }
        .date-right {
            text-align: right;
            font-size: 12px;
            margin-bottom: 25px;
        }
        .providencia-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 20px 0 25px 0;
            border-bottom: 1px solid #000;
            padding-bottom: 8px;
        }
        .section {
            margin-bottom: 18px;
        }
        .section-title {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
            text-decoration: underline;
        }
        .info-row {
            margin-bottom: 4px;
            padding-left: 20px;
        }
        .info-label {
            font-weight: bold;
        }
        .derivacion-box {
            border: 1px solid #000;
            padding: 12px 15px;
            margin-bottom: 18px;
        }
        .derivacion-box .deriv-row {
            margin-bottom: 4px;
        }
        .acciones-title {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .acciones-list {
            list-style: none;
            padding: 0;
            margin-left: 20px;
        }
        .acciones-list li {
            padding: 3px 0;
            font-size: 12px;
        }
        .acciones-list li:before {
            content: "\2713  ";
            font-weight: bold;
        }
        .observaciones-box {
            border: 1px solid #999;
            padding: 10px 15px;
            margin-top: 5px;
            min-height: 40px;
            font-style: italic;
        }
        .firma-area {
            margin-top: 80px;
            text-align: center;
        }
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
        {{-- Encabezado con logo y título --}}
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

        {{-- Fecha a la derecha --}}
        <div class="date-right">
            Puerto Williams, {{ $fecha }}
        </div>

        {{-- Título PROVIDENCIA --}}
        <div class="providencia-title">
            PROVIDENCIA N&ordm; {{ $folio }}
        </div>

        {{-- Datos del Documento --}}
        <div class="section">
            <div class="section-title">Datos del Documento</div>
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

        {{-- Derivación --}}
        <div class="section">
            <div class="section-title">Derivaci&oacute;n</div>
            <div class="derivacion-box">
                <div class="deriv-row">
                    <span class="info-label">De:</span> {{ $usuario_origen }} &mdash; {{ $departamento_origen }}
                </div>
                <div class="deriv-row">
                    <span class="info-label">Para:</span> {{ $departamento_destino }}
                </div>
                @if(!empty($usuario_destino))
                <div class="deriv-row">
                    <span class="info-label">Destinatario:</span> {{ $usuario_destino }}
                </div>
                @endif
            </div>
        </div>

        {{-- Acciones PARA --}}
        @if(!empty($acciones_para) && count($acciones_para) > 0)
        <div class="section">
            <div class="acciones-title">PARA:</div>
            <ul class="acciones-list">
                @foreach($acciones_para as $accion)
                    <li>{{ $accion }}</li>
                @endforeach
            </ul>
        </div>
        @endif

        {{-- Observaciones --}}
        @if(!empty($observaciones))
        <div class="section">
            <div class="section-title">Observaciones</div>
            <div class="observaciones-box">
                {{ $observaciones }}
            </div>
        </div>
        @endif

        {{-- Firma del Alcalde --}}
        <div class="firma-area">
            <div class="firma-linea">
                {{ $usuario_origen }}<br>
                Alcalde<br>
                Ilustre Municipalidad de Cabo de Hornos
            </div>
        </div>

        {{-- Pie de página --}}
        <div class="footer">
            Documento generado autom&aacute;ticamente por el Sistema de Correspondencia Municipal &mdash; {{ $folio }} &mdash; {{ $fecha }}
            @if(!empty($codigo_verificacion))
                <br/>Verifique en: <strong>{{ $verificar_url ?? '' }}</strong>
            @endif
        </div>

        {{-- QR fijo en esquina inferior derecha (no afecta flujo del documento) --}}
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
