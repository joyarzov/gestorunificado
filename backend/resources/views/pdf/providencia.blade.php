<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Providencia {{ $folio }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 1.2cm 2cm 1.5cm 2.5cm; }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            color: #000;
            line-height: 1.6;
        }
        .header {
            margin-bottom: 20px;
        }
        .header img {
            max-width: 200px;
            height: auto;
        }
        .titulo {
            margin: 10px 0 0 0;
            text-align: center;
            font-size: 14pt;
        }
        .ref-fecha {
            margin-bottom: 50px;
            margin-top: 30px;
            text-align: right;
            font-size: 11pt;
        }
        .ref-fecha p {
            margin: 2px 0;
        }
        .de-para {
            margin-bottom: 30px;
            border-collapse: collapse;
        }
        .de-para td {
            vertical-align: top;
            padding: 0 0 5px 0;
        }
        .de-para td.label {
            padding-right: 10px;
            white-space: nowrap;
        }
        .datos-doc {
            margin-bottom: 25px;
            border-collapse: collapse;
        }
        .datos-doc td {
            vertical-align: top;
            padding: 0 0 4px 0;
            font-size: 11pt;
        }
        .datos-doc td.label {
            padding-right: 10px;
            white-space: nowrap;
            font-weight: bold;
        }
        .seccion {
            margin-bottom: 22px;
        }
        .seccion-titulo {
            font-weight: bold;
            margin-bottom: 8px;
        }
        .acciones-list {
            list-style: none;
            padding: 0;
            margin-left: 20px;
        }
        .acciones-list li {
            padding: 2px 0;
            font-size: 11pt;
        }
        .acciones-list li:before {
            content: "\2022  ";
            font-weight: bold;
        }
        .observaciones {
            text-align: justify;
            font-style: italic;
            margin-left: 20px;
        }
        .firma-area {
            margin-top: 80px;
            text-align: center;
        }
        .firma-linea {
            border-top: 1px solid #000;
            width: 320px;
            margin: 0 auto;
            padding-top: 6px;
            font-size: 11pt;
            line-height: 1.5;
        }
        .firma-leyenda {
            font-size: 10pt;
            font-style: italic;
            color: #444;
            margin-top: 6px;
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
    {{-- Encabezado: logo a la izquierda + título centrado (estilo memo) --}}
    <div class="header">
        @if(!empty($logo_base64))
            <img src="{{ $logo_base64 }}" alt="Logo Municipalidad" />
        @endif
        <h2 class="titulo"><strong>PROVIDENCIA N&ordm; {{ $folio }}</strong></h2>
    </div>

    {{-- Referencia + fecha derecha --}}
    <div class="ref-fecha">
        <p><strong>Ref:</strong> {{ $numero_documento ?? 'Sin n&uacute;mero' }}{{ !empty($remitente) ? ' — ' . $remitente : '' }}</p>
        <p><strong>Puerto Williams,</strong> {{ $fecha }}</p>
    </div>

    {{-- DE / PARA (estilo memo) --}}
    <table class="de-para">
        <tr>
            <td class="label"><strong>DE:</strong></td>
            <td>{{ $usuario_origen }}{{ !empty($departamento_origen) ? ' — ' . $departamento_origen : '' }}</td>
        </tr>
        <tr>
            <td class="label"><strong>PARA:</strong></td>
            <td>
                {{ $departamento_destino }}
                @if(!empty($usuario_destino))
                    <br/>{{ $usuario_destino }}
                @endif
            </td>
        </tr>
    </table>

    {{-- Datos de la correspondencia original --}}
    <div class="seccion">
        <div class="seccion-titulo">Documento de origen</div>
        <table class="datos-doc">
            <tr>
                <td class="label">Fecha recepci&oacute;n:</td>
                <td>{{ $fecha_recepcion }}</td>
            </tr>
            @if(!empty($descripcion))
            <tr>
                <td class="label">Descripci&oacute;n:</td>
                <td>{{ $descripcion }}</td>
            </tr>
            @endif
        </table>
    </div>

    {{-- Acciones PARA --}}
    @if(!empty($acciones_para) && count($acciones_para) > 0)
    <div class="seccion">
        <div class="seccion-titulo">Se solicita:</div>
        <ul class="acciones-list">
            @foreach($acciones_para as $accion)
                <li>{{ $accion }}</li>
            @endforeach
        </ul>
    </div>
    @endif

    {{-- Observaciones --}}
    @if(!empty($observaciones))
    <div class="seccion">
        <div class="seccion-titulo">Observaciones</div>
        <div class="observaciones">{{ $observaciones }}</div>
    </div>
    @endif

    {{-- Firma del Alcalde (con leyenda de subrogancia si aplica) --}}
    <div class="firma-area">
        <div class="firma-linea">
            @if(!empty($subrogante_nombre))
                {{-- Caso subrogancia: línea principal con nombre+cargo del firmante real (subrogante), leyenda abajo --}}
                <strong>{{ $subrogante_nombre }}</strong><br>
                {{ $subrogante_cargo ?? 'Funcionario subrogante' }}<br>
                Ilustre Municipalidad de Cabo de Hornos
                <div class="firma-leyenda">
                    Por orden de <strong>{{ $usuario_origen }}</strong>,
                    {{ $cargo_titular ?? 'Alcalde' }}, en calidad de subrogante legal.
                </div>
            @else
                <strong>{{ $usuario_origen }}</strong><br>
                {{ $cargo_titular ?? 'Alcalde' }}<br>
                Ilustre Municipalidad de Cabo de Hornos
            @endif
        </div>
    </div>

    {{-- Pie de página --}}
    <div class="footer">
        Documento generado autom&aacute;ticamente por el Sistema de Correspondencia Municipal — {{ $folio }} — {{ $fecha }}
        @if(!empty($codigo_verificacion))
            <br/>Verifique en: <strong>{{ $verificar_url ?? '' }}</strong>
        @endif
    </div>

    {{-- QR fijo en esquina inferior derecha --}}
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
</body>
</html>
