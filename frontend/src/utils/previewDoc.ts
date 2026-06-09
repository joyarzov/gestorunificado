// Utilidad compartida para la vista previa de documentos (mantenedor y creación).
// Envuelve el HTML en una hoja con el tamaño/márgenes reales de impresión y la
// escala para caber en el panel, de modo que la previa sea proporcional al PDF.

export type PapelKey = 'carta' | 'oficio'

// Tamaños de papel en cm (carta = US letter; oficio = formato chileno 21,6 × 33).
export const PAPELES = {
  carta: { w: 21.59, h: 27.94, label: 'Carta' },
  oficio: { w: 21.6, h: 33.0, label: 'Oficio' },
} as const

export function buildPreviewDoc(html: string, papel: PapelKey, full = false): string {
  const p = PAPELES[papel]

  // Motor por bloques: `html` ya es un documento completo. Le inyectamos el
  // aspecto de hoja (ancho real + sombra) y el ajuste de escala, reusando su CSS.
  if (full) {
    const inject =
      `<style>html{background:#eceff1;margin:0;padding:0;}` +
      `body{width:${p.w}cm;min-height:${p.h}cm;margin:14px auto;background:#fff;` +
      `box-shadow:0 1px 12px rgba(0,0,0,.22);box-sizing:border-box;}</style>` +
      `<script>(function(){function fit(){var b=document.body;if(!b)return;b.style.zoom=1;` +
      `var a=document.documentElement.clientWidth-28;var w=b.offsetWidth;if(w>a)b.style.zoom=a/w;}` +
      `['load','resize'].forEach(function(e){window.addEventListener(e,fit);});` +
      `setTimeout(fit,60);setTimeout(fit,300);fit();})();<\/script>`
    return html.includes('</head>') ? html.replace('</head>', inject + '</head>') : inject + html
  }

  // Motor legacy: `html` es un fragmento; lo envolvemos en una hoja.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#eceff1;}
    #wrap{padding:14px;text-align:center;}
    /* inline-block conserva el ancho fijo de la hoja (no se encoge como flex) */
    #sheet{
      display:inline-block;text-align:left;vertical-align:top;
      width:${p.w}cm;min-height:${p.h}cm;background:#fff;box-sizing:border-box;
      padding:1.2cm 2cm 1.5cm 2.5cm;
      box-shadow:0 1px 12px rgba(0,0,0,.22);
      font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#1a1a1a;
    }
    #sheet > div{max-width:100% !important;padding:0 !important;margin:0 !important;}
    img{max-width:100%;height:auto;}
  </style></head><body>
    <div id="wrap"><div id="sheet">${html}</div></div>
    <script>
      function fit(){
        var s=document.getElementById('sheet');if(!s)return;
        s.style.zoom=1;
        var avail=document.documentElement.clientWidth-28;
        var w=s.offsetWidth;
        if(w>avail){ s.style.zoom=avail/w; }
      }
      ['load','resize'].forEach(function(e){window.addEventListener(e,fit);});
      document.addEventListener('DOMContentLoaded',fit);
      setTimeout(fit,60);setTimeout(fit,300);fit();
    </script>
  </body></html>`
}
