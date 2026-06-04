<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Providencia {{ $folio }}</title>
    <style>
        @page { size: letter portrait; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11pt;
            color: #000;
            line-height: 1.4;
        }
        /* Wrapper que crea los márgenes "ópticos" del documento, ya que
           DomPDF ignora consistentemente @page margin. Mantiene footer y
           qr-box (position: fixed) anclados a la página real. */
        /* Mismos márgenes que el memorándum (DocumentoController): izq 2.5cm, der 2cm.
           El margen izquierdo de 2.5cm además alinea las columnas del sello de firma. */
        .page-content {
            padding: 1.2cm 2cm 1.5cm 2.5cm;
        }
        /* Header en tabla: logo a la izquierda, título centrado en la misma franja.
           DomPDF no soporta bien flex/grid; tabla es la opción confiable. */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        .header-table td {
            vertical-align: middle;
            padding: 0;
        }
        .header-logo {
            width: 120px;
        }
        .header-logo img {
            max-width: 110px;
            height: auto;
        }
        .header-titulo {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            white-space: nowrap;
        }
        .header-spacer {
            width: 120px;
        }
        .ref-fecha {
            margin-top: 0;
            margin-bottom: 20px;
            text-align: right;
            font-size: 11pt;
        }
        .ref-fecha p {
            margin: 3px 0;
        }
        .de-para {
            margin-bottom: 20px;
            border-collapse: collapse;
        }
        .de-para td {
            vertical-align: top;
            padding: 0 0 9px 0;
        }
        .de-para td.label {
            padding-right: 14px;
            white-space: nowrap;
            font-weight: bold;
        }
        .seccion {
            margin-bottom: 16px;
        }
        .seccion-titulo {
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 11pt;
        }
        .datos-doc {
            margin-bottom: 14px;
            border-collapse: collapse;
        }
        .datos-doc td {
            vertical-align: top;
            padding: 0 0 5px 0;
            font-size: 11pt;
        }
        .datos-doc td.label {
            padding-right: 14px;
            white-space: nowrap;
            font-weight: bold;
        }
        .acciones-list {
            list-style: none;
            padding: 0;
            margin-left: 16px;
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
            margin-left: 16px;
        }
        /* Bloque de firma estilo memo Cero Papel: alineado a la izquierda,
           línea horizontal sobre el nombre, RUT en gris, cargo/leyenda debajo. */
        /* Bloque de firma anclado cerca del fondo, justo arriba del QR.
           Posición fija => siempre en el mismo lugar, sin importar el largo del texto,
           y el sello de FirmaGob cae siempre sobre la línea. */
        .firma-area {
            position: fixed;
            bottom: 4cm;
            left: 2.5cm;
            page-break-inside: avoid;
        }
        .firma-bloque {
            width: 320px;
            page-break-inside: avoid;
        }
        .firma-linea-top {
            border-top: 1px solid #000;
            width: 220px;
            margin-bottom: 6px;
        }
        .firma-nombre {
            font-weight: bold;
            font-size: 11pt;
        }
        .firma-rut {
            font-size: 9.5pt;
            color: #555;
            margin-top: 1px;
        }
        .firma-cargo {
            font-size: 10.5pt;
            margin-top: 2px;
        }
        .firma-leyenda {
            font-size: 9.5pt;
            font-style: italic;
            color: #555;
            margin-top: 4px;
            line-height: 1.4;
        }
        .footer {
            position: fixed;
            bottom: 1.5cm;
            right: 2cm;
            text-align: right;
            font-size: 8pt;
            color: #666;
            line-height: 1.3;
        }
        .qr-box {
            position: fixed;
            bottom: 1.5cm;
            left: 2.5cm;
            text-align: center;
        }
        .qr-box img {
            width: 60px;
            height: 60px;
        }
        .qr-box .cod {
            font-size: 7pt;
            color: #666;
            margin-top: 2px;
        }
    </style>
</head>
<body>
<div class="page-content">
    {{-- Encabezado: logo a la izquierda + título centrado en la misma franja --}}
    <table class="header-table">
        <tr>
            <td class="header-logo">
                @if(!empty($logo_base64))
                    <img src="{{ $logo_base64 }}" alt="Logo Municipalidad" />
                @endif
            </td>
            <td class="header-titulo">PROVIDENCIA N&ordm; {{ $folio }}</td>
            <td class="header-spacer"></td>
        </tr>
    </table>

    {{-- Referencia + fecha derecha --}}
    <div class="ref-fecha">
        <p><strong>Ref:</strong> {{ $numero_documento ?? 'Sin n&uacute;mero' }}{{ !empty($remitente) ? ' — ' . $remitente : '' }}</p>
        <p><strong>Puerto Williams,</strong> {{ $fecha }}</p>
    </div>

    {{-- DE / PARA estilo memo: nombre arriba, cargo/depto debajo en 2 líneas --}}
    <table class="de-para">
        <tr>
            <td class="label">DE:</td>
            <td>
                {{ $usuario_origen }}<br/>
                {{ $cargo_titular ?? 'Alcalde' }}
            </td>
        </tr>
        <tr>
            <td class="label">PARA:</td>
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
        <div class="seccion-titulo">DOCUMENTO DE ORIGEN</div>
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
        <div class="seccion-titulo">SE SOLICITA:</div>
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
        <div class="seccion-titulo">OBSERVACIONES</div>
        <div class="observaciones">{{ $observaciones }}</div>
    </div>
    @endif

    {{-- Firma estilo memo: línea horizontal, nombre, RUT gris, cargo, leyenda subrogancia --}}
    <div class="firma-area">
        <div class="firma-bloque">
            <div class="firma-linea-top"></div>
            @if(!empty($subrogante_nombre))
                <div class="firma-nombre">{{ $subrogante_nombre }}</div>
                @if(!empty($subrogante_rut))
                    <div class="firma-rut">{{ $subrogante_rut }}</div>
                @endif
                <div class="firma-cargo">{{ $subrogante_cargo ?? 'Funcionario' }} (S)</div>
                <div class="firma-leyenda">
                    Subrogante del {{ $cargo_titular ?? 'Alcalde' }} {{ $usuario_origen }}.
                </div>
            @else
                <div class="firma-nombre">{{ $usuario_origen }}</div>
                @if(!empty($titular_rut))
                    <div class="firma-rut">{{ $titular_rut }}</div>
                @endif
                <div class="firma-cargo">{{ $cargo_titular ?? 'Alcalde' }}</div>
            @endif
        </div>
    </div>

    </div> {{-- /.page-content --}}

    {{-- Pie compacto a la derecha (estilo memo) --}}
    @if(!empty($codigo_verificacion))
    <div class="footer">
        Verifique este documento<br/>
        C&oacute;d: <strong>{{ $codigo_verificacion }}</strong>
    </div>
    @endif

    {{-- QR en esquina inferior izquierda --}}
    @if(!empty($codigo_verificacion) && !empty($qr_data_uri))
    <div class="qr-box">
        <img src="{{ $qr_data_uri }}" alt="QR de verificación" />
        <div class="cod">{{ $codigo_verificacion }}</div>
    </div>
    @endif
</body>
</html>
