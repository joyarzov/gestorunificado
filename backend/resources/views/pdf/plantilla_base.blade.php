<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Documento</title>
    <style>
        @page { size: {{ $estilo['papel'] }} {{ $estilo['orientacion'] }}; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body {
            font-family: {{ $estilo['fuente_familia'] }};
            font-size: {{ $estilo['fuente_tamano'] }};
            color: {{ $estilo['color_texto'] }};
            line-height: {{ $estilo['line_height'] }};
        }
        /* Márgenes ópticos vía padding (DomPDF ignora @page margin). El
           padding-bottom reserva el espacio del pie fijo (QR + verificación). */
        .page-content {
            padding: {{ $estilo['margenes']['top'] }} {{ $estilo['margenes']['right'] }} {{ $estilo['margenes']['bottom'] }} {{ $estilo['margenes']['left'] }};
        }

        .color-bar { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .color-bar td { height: 6px; line-height: 6px; font-size: 0; padding: 0; }

        .membrete { width: 100%; border-collapse: collapse; }
        .membrete td { vertical-align: middle; padding: 0; }
        .membrete-logo { width: 120px; }
        .membrete-logo img { height: auto; }
        .inst-nombre { font-size: 12.5pt; font-weight: bold; color: {{ $estilo['membrete']['color'] }}; line-height: 1.2; }
        .inst-sub { font-size: 8.5pt; color: #666; margin-top: 3px; line-height: 1.3; }
        .regla-azul { border-bottom: 2px solid {{ $estilo['membrete']['color'] }}; margin-top: 10px; }

        .doc-titulo { text-align: center; font-size: 15pt; font-weight: bold; color: {{ $estilo['membrete']['color'] }}; letter-spacing: 0.5px; margin: 16px 0 4px 0; }
        .doc-titulo.left { text-align: left; }
        .doc-titulo.right { text-align: right; }

        .ref-fecha { margin: 0 0 22px 0; text-align: right; font-size: 10.5pt; color: #333; }
        .ref-fecha p { margin: 3px 0; }

        .bloque { margin-bottom: 16px; }
        .bloque.small { font-size: 8.5pt; font-style: italic; }
        .seccion-titulo { font-weight: bold; font-size: 10pt; color: {{ $estilo['membrete']['color'] }}; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 9px; padding-bottom: 3px; border-bottom: 1px solid #d9e6f0; }
        .seccion-titulo.center { text-align: center; }
        .seccion-cuerpo.indent { margin-left: 20px; }
        .seccion-cuerpo.justify { text-align: justify; }

        .parrafo { margin: 10px 0; }
        .parrafo.center { text-align: center; }
        .parrafo.right { text-align: right; }
        .parrafo.justify { text-align: justify; }

        .pie { position: fixed; bottom: {{ $estilo['pie']['bottom'] ?? '1.2cm' }}; left: {{ $estilo['margenes']['left'] }}; width: 17cm; border-top: 1px solid #ccc; padding-top: 7px; }
        .pie-table { width: 100%; border-collapse: collapse; }
        .pie-table td { padding: 0; vertical-align: bottom; }
        .pie-qr img { width: 56px; height: 56px; }
        .pie-cod { font-size: 7pt; color: #666; margin-top: 2px; }
        .pie-verif { text-align: right; font-size: 8pt; color: #666; line-height: 1.35; }

        img { max-width: 100%; }
    </style>
</head>
<body>
<div class="page-content">
    @foreach($bloques as $b)
        @includeIf('pdf.bloques.' . ($b['tipo'] ?? '_desconocido'), ['props' => $b['props'] ?? []])
    @endforeach
</div>
</body>
</html>
