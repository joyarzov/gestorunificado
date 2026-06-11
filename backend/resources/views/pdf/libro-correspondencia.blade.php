<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Libro de Correspondencia {{ $folio }}</title>
    <style>
        @page { size: letter landscape; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            color: #1a1a1a;
            line-height: 1.35;
        }
        /* DomPDF ignora @page margin: el wrapper crea los márgenes ópticos.
           padding-bottom amplio reserva el espacio del pie fijo (QR + verif). */
        .page-content {
            padding: 0.9cm 1.6cm 2.6cm 1.6cm;
        }

        .color-bar { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .color-bar td { height: 6px; line-height: 6px; font-size: 0; padding: 0; }

        .membrete { width: 100%; border-collapse: collapse; }
        .membrete td { vertical-align: middle; padding: 0; }
        .membrete-logo { width: 110px; }
        .membrete-logo img { max-width: 100px; height: auto; }
        .inst-nombre { font-size: 12pt; font-weight: bold; color: #0071BC; line-height: 1.2; }
        .inst-sub { font-size: 8pt; color: #666; margin-top: 3px; }
        .regla-azul { border-bottom: 2px solid #0071BC; margin-top: 8px; }

        .doc-titulo {
            text-align: center; font-size: 14pt; font-weight: bold; color: #0071BC;
            letter-spacing: 0.5px; margin: 14px 0 2px 0;
        }
        .doc-sub { text-align: center; font-size: 9.5pt; color: #444; margin-bottom: 14px; }
        .doc-sub strong { color: #0071BC; }

        table.registros { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        table.registros th {
            background: #0071BC; color: #fff; font-size: 8pt; text-align: left;
            padding: 5px 6px; border: 0.5pt solid #005a96;
        }
        table.registros td {
            font-size: 8pt; padding: 4px 6px; border: 0.5pt solid #ccd6e0;
            vertical-align: top;
        }
        table.registros tr:nth-child(even) td { background: #f3f7fa; }

        .resumen { margin: 6px 0 18px 0; font-size: 8.5pt; color: #444; }
        .resumen strong { color: #0071BC; }

        .firma-bloque {
            margin-top: 26px; width: 100%; border-collapse: collapse;
        }
        .firma-celda {
            width: 300px; text-align: center; font-size: 9pt; color: #333;
            padding-top: 50px; border-top: 0; }
        .firma-linea { border-top: 1px solid #555; padding-top: 5px; }
        .firma-cargo { color: #666; font-size: 8.5pt; }

        .pie {
            position: fixed; bottom: 1cm; left: 1.6cm; width: 24.7cm;
            border-top: 1px solid #ccc; padding-top: 6px;
        }
        .pie-table { width: 100%; border-collapse: collapse; }
        .pie-table td { padding: 0; vertical-align: bottom; }
        .pie-qr img { width: 52px; height: 52px; }
        .pie-cod { font-size: 7pt; color: #666; margin-top: 2px; }
        .pie-verif { text-align: right; font-size: 7.5pt; color: #666; line-height: 1.35; }
    </style>
</head>
<body>
<div class="page-content">
    <table class="color-bar">
        <tr>
            <td style="background-color:#2DC700;"></td>
            <td style="background-color:#8AC53E;"></td>
            <td style="background-color:#EB1B78;"></td>
            <td style="background-color:#28A9E3;"></td>
            <td style="background-color:#EE5825;"></td>
        </tr>
    </table>

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
            <td style="text-align:right; font-size:9pt; color:#444;">
                <strong style="color:#0071BC;">{{ $folio }}</strong><br/>
                Emitido el {{ $fecha_emision }}
            </td>
        </tr>
    </table>
    <div class="regla-azul"></div>

    <div class="doc-titulo">LIBRO DE CORRESPONDENCIA — {{ ($tipo ?? 'entradas') === 'salidas' ? 'SALIDAS' : 'ENTRADAS' }}</div>
    <div class="doc-sub">
        Per&iacute;odo: <strong>{{ $fecha_desde }}</strong> al <strong>{{ $fecha_hasta }}</strong>
        &middot; {{ $total }} {{ $total === 1 ? 'registro' : 'registros' }}
    </div>

    @if(($tipo ?? 'entradas') === 'salidas')
    <table class="registros">
        <thead>
            <tr>
                <th style="width:88px;">Folio</th>
                <th style="width:62px;">Tipo</th>
                <th>Destinatario</th>
                <th>Materia</th>
                <th style="width:66px;">F. Doc.</th>
                <th style="width:80px;">Estado</th>
                <th style="width:135px;">Despacho</th>
                <th style="width:120px;">Firmante</th>
                <th style="width:88px;">Responde a</th>
            </tr>
        </thead>
        <tbody>
            @forelse($registros as $r)
            <tr>
                <td>{{ $r['folio'] }}</td>
                <td>{{ $r['tipo_doc'] ?: '—' }}</td>
                <td>{{ $r['destinatario'] }}</td>
                <td>{{ $r['materia'] ?: '—' }}</td>
                <td>{{ $r['fecha_documento'] ?: '—' }}</td>
                <td>{{ $r['estado'] }}</td>
                <td>{{ $r['despacho'] ?: '—' }}</td>
                <td>{{ $r['firmante'] ?: '—' }}</td>
                <td>{{ $r['responde_a'] ?: '—' }}</td>
            </tr>
            @empty
            <tr><td colspan="9" style="text-align:center; color:#888; padding:14px;">Sin registros en el per&iacute;odo seleccionado</td></tr>
            @endforelse
        </tbody>
    </table>
    @else
    <table class="registros">
        <thead>
            <tr>
                <th style="width:78px;">Folio</th>
                <th style="width:72px;">N&deg; Documento</th>
                <th style="width:62px;">F. Recibo</th>
                <th>Remitente</th>
                <th>Materia</th>
                <th style="width:105px;">Departamento</th>
                <th style="width:92px;">Estado</th>
                <th style="width:120px;">Derivada a</th>
                <th style="width:95px;">Folio Providencia</th>
            </tr>
        </thead>
        <tbody>
            @forelse($registros as $i => $r)
            <tr>
                <td>{{ $r['folio'] ?? ($i + 1) }}</td>
                <td>{{ $r['numero_documento'] ?: '—' }}</td>
                <td>{{ $r['fecha_recibo'] }}</td>
                <td>{{ $r['remitente'] }}</td>
                <td>{{ $r['materia'] ?: '—' }}</td>
                <td>{{ $r['departamento'] ?: '—' }}</td>
                <td>{{ $r['estado'] }}</td>
                <td>{{ $r['derivada_a'] ?: '—' }}</td>
                <td>{{ $r['folios'] ?: '—' }}</td>
            </tr>
            @empty
            <tr><td colspan="9" style="text-align:center; color:#888; padding:14px;">Sin registros en el per&iacute;odo seleccionado</td></tr>
            @endforelse
        </tbody>
    </table>
    @endif

    <div class="resumen">
        <strong>Resumen del per&iacute;odo:</strong>
        @foreach($resumen as $estado => $n)
            {{ $estado }}: <strong>{{ $n }}</strong>@if(!$loop->last) &middot; @endif
        @endforeach
    </div>

    <table class="firma-bloque">
        <tr>
            <td></td>
            <td class="firma-celda">
                <div class="firma-linea">
                    <strong>{{ $firmante_nombre }}</strong><br/>
                    <span class="firma-cargo">{{ $firmante_cargo }}</span><br/>
                    <span class="firma-cargo">Ilustre Municipalidad de Cabo de Hornos</span>
                </div>
            </td>
        </tr>
    </table>
</div>

<div class="pie">
    <table class="pie-table">
        <tr>
            <td class="pie-qr" style="width: 64px;">
                @if(!empty($qr_data_uri))
                    <img src="{{ $qr_data_uri }}" alt="QR de verificación" />
                    <div class="pie-cod">{{ $codigo_verificacion }}</div>
                @endif
            </td>
            <td class="pie-verif">
                Documento generado y firmado electr&oacute;nicamente en la Plataforma de Gesti&oacute;n Documental Municipal.<br/>
                Verifique su autenticidad en {{ $verificar_url }}<br/>
                C&oacute;digo: <strong>{{ $codigo_verificacion }}</strong>
            </td>
        </tr>
    </table>
</div>
</body>
</html>
