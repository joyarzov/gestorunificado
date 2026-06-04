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
            color: #1a1a1a;
            line-height: 1.4;
        }
        /* Wrapper que crea los márgenes "ópticos" del documento, ya que
           DomPDF ignora consistentemente @page margin. Mantiene el pie
           (position: fixed) anclado a la página real.
           Mismos márgenes que el memorándum: izq 2.5cm, der 2cm.
           El padding-bottom amplio reserva el espacio del pie fijo (QR + verif). */
        .page-content {
            padding: 1cm 2cm 3.2cm 2.5cm;
        }

        /* ---- Membrete corporativo ---- */
        /* Barra de 5 colores institucionales como acento superior. */
        .color-bar {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
        }
        .color-bar td {
            height: 6px;
            line-height: 6px;
            font-size: 0;
            padding: 0;
        }
        .membrete {
            width: 100%;
            border-collapse: collapse;
        }
        .membrete td {
            vertical-align: middle;
            padding: 0;
        }
        .membrete-logo {
            width: 120px;
        }
        .membrete-logo img {
            max-width: 110px;
            height: auto;
        }
        .inst-nombre {
            font-size: 12.5pt;
            font-weight: bold;
            color: #0071BC;
            line-height: 1.2;
        }
        .inst-sub {
            font-size: 8.5pt;
            color: #666;
            margin-top: 3px;
            line-height: 1.3;
        }
        /* Regla azul que cierra el membrete. */
        .regla-azul {
            border-bottom: 2px solid #0071BC;
            margin-top: 10px;
        }

        /* ---- Título del documento ---- */
        .doc-titulo {
            text-align: center;
            font-size: 15pt;
            font-weight: bold;
            color: #0071BC;
            letter-spacing: 0.5px;
            margin: 16px 0 4px 0;
        }

        /* ---- Ref + fecha ---- */
        .ref-fecha {
            margin-top: 0;
            margin-bottom: 22px;
            text-align: right;
            font-size: 10.5pt;
            color: #333;
        }
        .ref-fecha p {
            margin: 3px 0;
        }

        /* ---- DE / PARA ---- */
        .de-para {
            margin-bottom: 22px;
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
            color: #0071BC;
        }

        /* ---- Secciones ---- */
        .seccion {
            margin-bottom: 18px;
        }
        .seccion-titulo {
            font-weight: bold;
            font-size: 10pt;
            color: #0071BC;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 9px;
            padding-bottom: 3px;
            border-bottom: 1px solid #d9e6f0;
        }
        .datos-doc {
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
            margin: 0 0 0 4px;
        }
        .acciones-list li {
            padding: 2px 0;
            font-size: 11pt;
        }
        .acciones-list li:before {
            content: "\2022  ";
            color: #0071BC;
            font-weight: bold;
        }
        .observaciones {
            text-align: justify;
            margin-left: 4px;
        }

        /* ---- Firma (fluye tras el contenido) ---- */
        .firma-area {
            margin-top: 52px;
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

        /* ---- Pie unificado (QR + verificación) anclado a la página ---- */
        .pie {
            position: fixed;
            bottom: 1.2cm;
            left: 2.5cm;
            width: 17cm;
            border-top: 1px solid #ccc;
            padding-top: 7px;
        }
        .pie-table {
            width: 100%;
            border-collapse: collapse;
        }
        .pie-table td {
            padding: 0;
            vertical-align: bottom;
        }
        .pie-qr img {
            width: 56px;
            height: 56px;
        }
        .pie-cod {
            font-size: 7pt;
            color: #666;
            margin-top: 2px;
        }
        .pie-verif {
            text-align: right;
            font-size: 8pt;
            color: #666;
            line-height: 1.35;
        }
    </style>
</head>
<body>
<div class="page-content">
    {{-- Barra de 5 colores institucionales --}}
    <table class="color-bar">
        <tr>
            <td style="background-color:#2DC700;"></td>
            <td style="background-color:#8AC53E;"></td>
            <td style="background-color:#EB1B78;"></td>
            <td style="background-color:#28A9E3;"></td>
            <td style="background-color:#EE5825;"></td>
        </tr>
    </table>

    {{-- Membrete: logo + identificación institucional --}}
    <table class="membrete">
        <tr>
            <td class="membrete-logo">
                @if(!empty($logo_base64))
                    <img src="{{ $logo_base64 }}" alt="Logo Municipalidad" />
                @endif
            </td>
            <td>
                <div class="inst-nombre">Ilustre Municipalidad de Cabo de Hornos</div>
                <div class="inst-sub">Puerto Williams &middot; Provincia Ant&aacute;rtica Chilena &middot; Regi&oacute;n de Magallanes</div>
            </td>
        </tr>
    </table>
    <div class="regla-azul"></div>

    {{-- Título del documento --}}
    <div class="doc-titulo">PROVIDENCIA N&ordm; {{ $folio }}</div>

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
        <div class="seccion-titulo">Se solicita</div>
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

{{-- Pie unificado: QR a la izquierda, verificación a la derecha, con línea divisoria --}}
@if(!empty($codigo_verificacion))
<div class="pie">
    <table class="pie-table">
        <tr>
            <td class="pie-qr" style="width: 70px;">
                @if(!empty($qr_data_uri))
                    <img src="{{ $qr_data_uri }}" alt="QR de verificación" />
                    <div class="pie-cod">{{ $codigo_verificacion }}</div>
                @endif
            </td>
            <td class="pie-verif">
                Verifique la autenticidad de este documento en<br/>
                {{ $verificar_url ?? '' }}<br/>
                C&oacute;digo: <strong>{{ $codigo_verificacion }}</strong>
            </td>
        </tr>
    </table>
</div>
@endif
</body>
</html>
