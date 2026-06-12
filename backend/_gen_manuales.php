<?php
// Generador de los manuales PDF de /manuales (uno por rol).
// Uso: docker compose exec -T backend php /var/www/html/_gen_manuales.php
//      y luego copiar backend/storage/app/manuales/*.pdf a frontend/public/manuales/
// Registro formal (trato de usted) según lineamiento institucional.
require "/var/www/html/vendor/autoload.php";
$app = require "/var/www/html/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Barryvdh\DomPDF\Facade\Pdf;

$logo = file_exists(storage_path('app/public/logo.png'))
    ? 'data:image/png;base64,' . base64_encode(file_get_contents(storage_path('app/public/logo.png')))
    : '';

$css = <<<CSS
@page { size: letter portrait; margin: 3.1cm 2cm 2.1cm 2.2cm; }
* { box-sizing: border-box; }
body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #2a2a2a; line-height: 1.55; margin: 0; }
/* Cabecera corporativa repetida en todas las páginas */
.cabecera { position: fixed; top: -2.5cm; left: 0; width: 100%; }
.color-bar { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.color-bar td { height: 6px; line-height: 6px; font-size: 0; padding: 0; }
.membrete { width: 100%; border-collapse: collapse; }
.membrete td { vertical-align: middle; padding: 0; }
.membrete-logo { width: 96px; }
.membrete-logo img { max-width: 88px; height: auto; }
.inst-nombre { font-size: 11pt; font-weight: bold; color: #0071BC; }
.inst-sub { font-size: 7.5pt; color: #666; margin-top: 1px; }
.regla-azul { border-bottom: 2px solid #0071BC; margin-top: 6px; }
.pie { position: fixed; bottom: -1.5cm; left: 0; width: 100%; border-top: 0.75pt solid #ccc; padding-top: 5px; font-size: 7.5pt; color: #999; }
.portada { text-align: center; margin-top: 150px; }
.portada .tit { font-size: 25pt; font-weight: bold; color: #0071BC; line-height: 1.25; }
.portada .sub { font-size: 14pt; color: #4D4D4D; margin-top: 14px; font-weight: bold; }
.portada .ver { font-size: 9.5pt; color: #888; margin-top: 26px; line-height: 1.7; }
.salto { page-break-before: always; }
h1 { font-size: 14.5pt; color: #0071BC; margin: 16px 0 6px 0; border-bottom: 1.5px solid #0071BC; padding-bottom: 3px; }
h2 { font-size: 11.5pt; color: #005a96; margin: 13px 0 4px 0; }
p { margin: 5px 0; text-align: justify; }
ul, ol { margin: 5px 0 8px 20px; padding: 0; }
li { margin-bottom: 5px; text-align: justify; }
table.t { border-collapse: collapse; width: 100%; margin: 8px 0; }
table.t th { background: #0071BC; color: #fff; font-size: 9pt; text-align: left; padding: 5px 8px; }
table.t td { font-size: 9.5pt; padding: 5px 8px; border: 0.5pt solid #ccd6e0; vertical-align: top; }
table.t tr:nth-child(even) td { background: #f3f7fa; }
.tip { background: #f0faf0; border-left: 3px solid #2DC700; padding: 8px 12px; margin: 9px 0; font-size: 9.5pt; }
.ojo { background: #fff7e6; border-left: 3px solid #EE5825; padding: 8px 12px; margin: 9px 0; font-size: 9.5pt; }
.paso { background: #f3f7fa; border: 0.5pt solid #dbe3ea; border-left: 3px solid #0071BC; padding: 8px 12px; margin: 7px 0; font-size: 9.5pt; }
.paso b.n { color: #0071BC; }
.kbd { background: #eef3f8; border: 0.5pt solid #d7e3ee; border-radius: 3px; padding: 0 5px; font-size: 9pt; color: #005a96; }
.faq dt { font-weight: bold; color: #005a96; margin-top: 9px; }
.faq dd { margin: 2px 0 0 0; text-align: justify; }
CSS;

$cab = '<div class="cabecera">'
    . '<table class="color-bar"><tr>'
    . '<td style="background:#2DC700"></td><td style="background:#8AC53E"></td><td style="background:#EB1B78"></td>'
    . '<td style="background:#28A9E3"></td><td style="background:#EE5825"></td></tr></table>'
    . '<table class="membrete"><tr>'
    . '<td class="membrete-logo">' . ($logo ? "<img src=\"$logo\"/>" : '') . '</td>'
    . '<td><div class="inst-nombre">Ilustre Municipalidad de Cabo de Hornos</div>'
    . '<div class="inst-sub">Plataforma de Gestión Documental Municipal · Módulo de Correspondencia</div></td>'
    . '</tr></table><div class="regla-azul"></div></div>';

$pie = '<div class="pie">Ilustre Municipalidad de Cabo de Hornos · Manual de usuario · Módulo de Correspondencia · Junio 2026</div>';

// ==================== BLOQUES COMPARTIDOS ====================

$acceso = <<<HTML
<h1>1. Cómo ingresar a la plataforma</h1>
<p>La plataforma opera dentro de la red municipal: no requiere instalar ningún programa. Basta con
abrir el navegador en su computador de trabajo y escribir <strong>https://docmunicipal.local</strong>
(si por algún motivo no responde, la dirección alternativa es <span class="kbd">http://192.168.0.106:3001</span>).</p>
<p>Para iniciar sesión utilice su <strong>RUT con guión y sin puntos</strong> (por ejemplo <span class="kbd">12345678-9</span>)
y la contraseña entregada por Informática. Si su cuenta tiene más de un perfil —por ejemplo, es
Oficial de Partes y además usuario común— la plataforma le preguntará con cuál desea ingresar:
lo que puede ver y hacer depende del perfil elegido, y es posible cambiarlo en cualquier momento
desde el menú de su nombre.</p>
<h2>Si olvidó su contraseña</h2>
<p>No es necesario llamar a nadie: en la pantalla de inicio pulse el enlace <strong>"¿Olvidaste tu
contraseña?"</strong>, escriba su RUT, y recibirá un enlace en su correo institucional. El enlace
tiene una vigencia de 60 minutos y sirve una sola vez; con él podrá definir su nueva contraseña
(mínimo 8 caracteres). Por seguridad, al cambiarla se cierran todas sus sesiones abiertas.</p>
<h2>Información útil</h2>
<ul>
<li>Su sesión dura <strong>12 horas</strong>: si ingresó en la mañana, en la noche deberá iniciar sesión nuevamente.</li>
<li>Solo puede haber <strong>una sesión activa</strong> por persona: si ingresa desde otro computador, la primera sesión se cierra automáticamente.</li>
<li>La primera vez en cada equipo se recomienda instalar el <strong>certificado de seguridad</strong> para que el navegador
muestre el candado: descárguelo desde <span class="kbd">/certificado-municipal.crt</span>, ábralo con doble clic,
elija "Instalar certificado" → "Equipo local" → "Entidades de certificación raíz de confianza", y reinicie el navegador.</li>
</ul>
HTML;

$estados = <<<HTML
<h1>Los estados: cómo leer la plataforma de un vistazo</h1>
<p>Cada correspondencia muestra una etiqueta de color que indica en qué parte del camino se encuentra.
Esta es la traducción de cada una:</p>
<table class="t">
<tr><th style="width:165px">Estado</th><th>Qué significa en la práctica</th></tr>
<tr><td><b>Pendiente</b></td><td>Oficina de Partes la registró, pero todavía no inicia su recorrido.</td></tr>
<tr><td><b>Derivada a Alcaldía</b></td><td>Está en el escritorio (digital) del Alcalde, a la espera de su revisión.</td></tr>
<tr><td><b>Derivada a Funcionario</b></td><td>El Alcalde ya dio instrucciones y la envió; falta que el o los destinatarios confirmen su recepción.</td></tr>
<tr><td><b>Recibida por destinatarios</b></td><td>Todos quienes debían recibirla ya acusaron recibo. Importante: significa que la recepción terminó, no necesariamente el trabajo de fondo.</td></tr>
<tr><td><b>Respondida</b> (chip verde adicional)</td><td>Ya se despachó una respuesta formal al remitente externo, y el chip muestra el número del oficio con que salió.</td></tr>
<tr><td><b>Archivada</b></td><td>El Alcalde dio por terminado el proceso. Queda de solo lectura: nadie puede escribir ni modificar nada, a menos que él la desarchive.</td></tr>
</table>
<p>En su <strong>Bandeja de Entrada</strong> existe otra etiqueta, referida a SU tarea (no al documento):
<b>"Por recibir"</b> significa que le llegó algo y debe acusar recibo;
<b>"Recibida"</b>, que ya lo hizo; y <b>"Derivada a Funcionario"</b>, que usted la derivó y va en camino.</p>
HTML;

$conversacion = <<<HTML
<h1>La Conversación: la historia completa, en un solo lugar</h1>
<p>Al abrir cualquier correspondencia encontrará la sección <strong>Conversación</strong>: una línea
de tiempo, ordenada por día, donde queda registrado todo lo que ha ocurrido con ese documento. Cada
tipo de registro tiene su propio ícono para reconocerlo de un vistazo:</p>
<ul>
<li><b>Flecha azul</b> — una derivación: quién la envió, a quién, con qué cargo, y si actuó como subrogante de alguien. Incluye las observaciones y el estado.</li>
<li><b>Visto verde</b> — un acuse de recibo, con la fecha y hora exactas en que el destinatario confirmó la recepción.</li>
<li><b>Globo celeste</b> — un mensaje de un participante: la conversación funciona como un chat formal entre quienes están involucrados.</li>
<li><b>Archivo gris / naranjo</b> — el Alcalde cerró (o reabrió) el proceso.</li>
</ul>
<p>En los mensajes es posible <strong>adjuntar archivos</strong> (PDF, imágenes, Word, Excel, PowerPoint o RAR,
de hasta 20 MB cada uno). Los PDF y las imágenes se abren directamente en pantalla con un clic;
los demás formatos se descargan al computador.</p>
<div class="tip">Si el hilo es largo, la plataforma muestra lo más reciente y deja un botón
<em>"Ver registros anteriores"</em> arriba para retroceder en la historia. Nada se borra nunca:
la trazabilidad completa es la garantía de todos.</div>
HTML;

// ==================== MANUAL OFICINA DE PARTES ====================

$mPartes = <<<HTML
<h1>2. La labor diaria: recibir lo que llega al municipio</h1>
<p>La Oficina de Partes es la puerta de entrada de la correspondencia municipal. Cuando llega un
documento —un oficio de un ministerio, una carta de un vecino, cualquiera sea— su tarea es
registrarlo para que comience su recorrido digital con respaldo y trazabilidad.</p>
<div class="paso"><b class="n">Paso 1.</b> En el menú <b>Ingresar correspondencia</b>, complete los datos:
remitente, fechas, materia y departamento si corresponde. El "N° Documento" es el número que trae
el documento de origen (el "Ord. N° 658" que le asignó quien lo envió) — si viene sin número, como una
carta de un vecino, puede dejarlo vacío.</div>
<div class="paso"><b class="n">Paso 2.</b> Al guardar, el sistema le asigna automáticamente su
<b>folio de ingreso</b> (por ejemplo <span class="kbd">ING-2026-00045</span>): el número municipal
correlativo, sin huecos, que la identificará para siempre. Usted no tiene que llevar la cuenta.</div>
<div class="paso"><b class="n">Paso 3.</b> <b>Adjunte el documento escaneado</b> (PDF) y sus anexos.
Ese expediente digital es el respaldo oficial: quien la reciba después verá exactamente lo que llegó.</div>
<div class="paso"><b class="n">Paso 4.</b> Desde el detalle, pulse <b>Derivar a Alcalde</b>. La
correspondencia pasa al despacho del Alcalde y a él le llega la notificación. La etapa de ingreso terminó.</div>
<div class="tip">¿Hubo un error en algún dato? La correspondencia puede editarse solo mientras está
<em>Pendiente</em>. Una vez derivada pasa a formar parte de la trazabilidad y ya no se modifica.</div>

<h1>3. Las salidas: lo que el municipio envía hacia afuera</h1>
<p>El menú <b>Salidas</b> es exclusivo de su rol (solo Oficina de Partes y administradores lo ven).
Aquí se maneja todo documento que el municipio despacha a un externo: oficios, ordinarios, circulares
y cartas. La lógica imita lo que siempre se ha hecho, pero sin llamadas telefónicas ni cuadernos:</p>
<h2>Reservar el número (antes de imprimir)</h2>
<p>El número del documento existe <strong>antes</strong> de que el documento se imprima y firme
— porque el papel sale con su número puesto. Con el botón <b>Reservar número</b> elija el tipo
(Oficio, Ordinario, Circular o Carta), escriba la materia, y el sistema le entregará al instante el
siguiente de la serie (por ejemplo <span class="kbd">OF-2026-00012</span>). Cada tipo lleva su
propia numeración anual.</p>
<p>El Alcalde también puede reservar números, pero solo como <em>respuesta</em> a una correspondencia
de entrada: su solicitud llegará a la cola de despacho para que usted la gestione.</p>
<h2>La cola "Por despachar"</h2>
<p>Cuando alguien sube el PDF firmado de su documento, este cae en la pestaña <b>Por despachar</b> y
usted recibe una notificación. Ahí corresponde decidir:</p>
<ul>
<li><b>Despachar</b> — si está todo en orden: registre el medio de envío (correo electrónico, carta
certificada, entrega en mano…), la fecha y una referencia si la hay (número de seguimiento, correo
de destino). Con eso queda en el registro histórico y, si era respuesta a una entrada, esa entrada
se marca "Respondida".</li>
<li><b>Devolver con motivo</b> — si algo está mal (PDF ilegible, falta una firma, destinatario
incompleto): escriba el motivo y el documento vuelve a quien lo solicitó, quien corrige y lo re-sube
<strong>con el mismo número</strong>. Su revisión es el control de calidad del municipio.</li>
</ul>
<h2>Cuando un número no se va a usar</h2>
<p>Si una reserva quedó obsoleta (se reservó por error, se desistió de enviar), se <b>anula con
motivo</b>. El número NO vuelve a usarse: queda para siempre en la pestaña "Anuladas" con su
explicación. Así, cuando alguien revise el libro y pregunte "¿y el oficio N° 12?", la respuesta estará
escrita. Solo se anulan reservas o devueltas — lo que ya se despachó no se toca.</p>

<h1>4. El Libro de Correspondencia: su documento oficial</h1>
<p>El libro foliado de toda la vida, pero firmado electrónicamente. En el menú
<b>Libro de Correspondencia</b>:</p>
<div class="paso"><b class="n">Paso 1.</b> Elija el <b>tipo de libro</b> — Entradas (todo lo que llegó,
por folio ING-) o Salidas (todo lo emitido, con despacho y firmante) — y el período (desde / hasta).</div>
<div class="paso"><b class="n">Paso 2.</b> Pulse <b>Generar y firmar</b>: verá la vista previa del PDF
con el membrete municipal y todos los registros del período. Revísela con calma.</div>
<div class="paso"><b class="n">Paso 3.</b> Elija la posición de su sello e ingrese su <b>clave OTP</b>
(la misma firma electrónica avanzada de las providencias). El libro queda emitido con su propio folio
(<span class="kbd">LIBRO-E-2026-001</span> o <span class="kbd">LIBRO-S-2026-001</span>) y un código QR
que cualquiera puede verificar.</div>
<p>Cada libro emitido queda en el historial y se descarga <strong>exactamente como se firmó</strong>
— nunca se regenera. Eso es lo que lo convierte en documento oficial: lo que se envió a Contraloría
hoy será idéntico si alguien lo descarga en cinco años.</p>
<div class="tip">Para trabajo interno rápido (planillas, conteos) dispone además del botón
<b>Exportar</b> en "Todas las correspondencias": genera un CSV que se abre en Excel con los filtros
aplicados. Es una herramienta de trabajo; el libro firmado es el documento oficial.</div>

<h1>5. Supervisión: ver todo, intervenir en lo propio</h1>
<p>Con su perfil usted ve <strong>todas</strong> las correspondencias del municipio, en cualquier estado
— es su rol de supervisión. En las gestiones que corresponden a otros (por ejemplo, acusar un
recibo del Alcalde) verá la etiqueta <em>"Solo lectura"</em>: puede mirar, no intervenir. La
<b>Búsqueda avanzada</b> permite encontrar cualquier documento por número, remitente, fechas o estado.</p>

$estados
$conversacion

<h1>Preguntas frecuentes</h1>
<dl class="faq">
<dt>Llegó una carta sin número de documento, ¿qué se registra?</dt>
<dd>Nada: deje el campo vacío. El folio de ingreso ING- que asigna el sistema es suficiente para identificarla.</dd>
<dt>Derivé al Alcalde por error una correspondencia incompleta.</dt>
<dd>Ya no podrá editarla (dejó de estar Pendiente), pero puede explicarlo en la Conversación y adjuntar ahí lo que faltó: todos los participantes lo verán.</dd>
<dt>Me subieron una salida con el PDF mal escaneado.</dt>
<dd>Devuélvala con el motivo. El solicitante recibe la notificación, corrige, y la re-sube con el mismo folio. Usted la verá de vuelta en "Por despachar".</dd>
<dt>¿Se puede despachar sin revisar?</dt>
<dd>Poder, se puede — pero el sentido de que el despacho pase por la Oficina de Partes es justamente su revisión. Lo que se despacha queda con su nombre en el registro.</dd>
<dt>¿Cada cuánto se emite el libro?</dt>
<dd>Lo define el municipio: típicamente mensual. El sistema no obliga a una frecuencia; usted elige el período cada vez.</dd>
</dl>
HTML;

// ==================== MANUAL ALCALDE ====================

$mAlcalde = <<<HTML
<h1>2. El despacho digital: la Bandeja de Entrada</h1>
<p>Su bandeja tiene tres pestañas que ordenan el trabajo:</p>
<ul>
<li><b>Activas</b> — lo que requiere atención o está en gestión: correspondencia <em>por recibir</em> (a la espera de su acuse) y la que ya derivó y va en camino.</li>
<li><b>Recibidas</b> — el historial de lo que ya acusó.</li>
<li><b>Archivadas</b> — los procesos que usted cerró. Desde aquí puede entrar a cualquiera y desarchivarla si hace falta.</li>
</ul>
<p>Cuando Oficina de Partes le deriva algo, le avisa la campana de la plataforma y un correo a su
casilla institucional, siempre con el folio para identificar de qué se trata.</p>

<h1>3. Acusar recibo: la primera firma</h1>
<p>Al abrir una correspondencia nueva y pulsar <b>Marcar como recibida</b>, no se trata de un simple
clic: el sistema genera la <strong>providencia de recepción</strong> — el acto formal de que su
despacho tomó conocimiento. Verá la vista previa del documento, elegirá dónde va su sello, ingresará
su <b>clave OTP</b> de FirmaGob, y quedará firmada con valor legal, con su folio
(<span class="kbd">PROV-2026-00012</span>) y código QR verificable.</p>

<h1>4. Derivar con instrucciones: la providencia de derivación</h1>
<p>Cuando decide quién debe hacerse cargo, pulse <b>Derivar a Funcionario</b> y elija el destino
entre tres modalidades:</p>
<ul>
<li><b>Funcionario(s)</b> — escriba los nombres y selecciónelos, uno o varios, sin importar de qué departamento sean. Cada uno la recibirá en su propia bandeja.</li>
<li><b>Departamento</b> — la correspondencia llega a la bandeja de todos los funcionarios de esa unidad.</li>
<li><b>Todos</b> — llega a todos los funcionarios activos del municipio (útil para circulares).</li>
</ul>
<p>Marque las instrucciones (<em>PARA: tramitar, responder, informar, coordinar…</em>), agregue
observaciones si lo estima ("responder antes del viernes"), revise la providencia y fírmela con su
OTP. Cada destinatario recibe su notificación, y usted recibirá los avisos de vuelta a medida que
vayan acusando recibo — y el aviso final cuando todos lo hayan hecho.</p>

<h1>5. Responder al remitente: Preparar respuesta</h1>
<p>Cuando corresponde responder formalmente a quien envió el documento (el ministerio, el vecino),
el circuito es el siguiente — disponible una vez generada la providencia:</p>
<div class="paso"><b class="n">Paso 1.</b> En el detalle de la entrada, pulse <b>Preparar respuesta</b>:
elija el tipo de documento (Oficio, Ordinario…) y la materia. El sistema le <b>reserva el número</b>
al instante (por ejemplo <span class="kbd">OF-2026-00012</span>).</div>
<div class="paso"><b class="n">Paso 2.</b> Redacte el documento fuera del sistema (Word), con ese
número, y fírmelo como siempre. Escanéelo o expórtelo a PDF.</div>
<div class="paso"><b class="n">Paso 3.</b> De vuelta en el detalle, en la sección <b>Respuestas</b>,
pulse <b>Subir PDF</b>: confirme el destinatario y el firmante, y el documento queda en la cola
de Oficina de Partes, que se encarga del despacho físico o electrónico.</div>
<div class="paso"><b class="n">Paso 4.</b> Cuando Partes lo despacha, le llega el aviso y la entrada
queda marcada <b>"Respondida"</b> con el folio del oficio. El ciclo quedó completo y documentado.</div>
<p>Si Partes encuentra un problema (una página ilegible, por ejemplo), se la <b>devuelve con el
motivo</b>: corrija y vuelva a subir el PDF — el número se conserva, porque el documento impreso
ya lo lleva. Y si reservó un número que no utilizará, anúlelo <b>con motivo</b> desde la misma
sección: el folio queda en acta y el siguiente documento toma un número nuevo.</p>

<h1>6. Cerrar el proceso: la palabra final es suya</h1>
<p>Cuando una correspondencia ya cumplió su ciclo —todos acusaron recibo, se respondió lo que había
que responder— puede darle el cierre formal con el botón <b>Cerrar proceso</b>. ¿Qué significa?</p>
<ul>
<li>Pasa al estado <b>Archivada</b> y a la pestaña Archivadas de su bandeja.</li>
<li>Queda de <strong>solo lectura total</strong>: nadie puede escribir mensajes, derivar, ni preparar respuestas sobre ella.</li>
<li>El cierre queda registrado en la Conversación con su nombre, fecha y hora.</li>
</ul>
<p>¿Apareció algo nuevo sobre un tema cerrado? Solo usted puede <b>Desarchivar</b>: ingrese al detalle
desde la pestaña Archivadas, pulse el botón, y el proceso vuelve a estar operativo. La reapertura
también queda registrada — la historia nunca se pierde.</p>

<h1>7. Durante sus ausencias: la subrogancia</h1>
<p>Antes de ausentarse (vacaciones, cometido), asegúrese de tener definido su <b>subrogante</b> en su
perfil. Con la subrogancia activa, el subrogante puede <em>"Actuar como"</em> usted: ve su bandeja,
acusa recibos y deriva en su nombre — con tres resguardos que protegen a ambos:</p>
<ul>
<li>Un <b>banner naranjo</b> permanente le recuerda (a él y a cualquiera que mire) que está actuando en nombre de otra autoridad.</li>
<li>La trazabilidad registra la dualidad: <em>"Juan Pérez, como subrogante de [su nombre], derivó a…"</em>, y las firmas llevan el sufijo <b>(S)</b>.</li>
<li>Sus notificaciones también le llegan al subrogante mientras dura la subrogancia, para que nada quede sin ver.</li>
</ul>

$estados
$conversacion

<h1>Preguntas frecuentes</h1>
<dl class="faq">
<dt>Derivé a un funcionario equivocado, ¿puedo deshacerlo?</dt>
<dd>La derivación firmada no se deshace (es un acto formal), pero puede derivar nuevamente al correcto y aclararlo en la Conversación. Todo queda trazado.</dd>
<dt>¿Por qué no aparece el botón "Preparar respuesta"?</dt>
<dd>Aparece solo después de generada la providencia (al derivar o al acusar recibo). Sin providencia no existe el acto que respalde una respuesta.</dd>
<dt>Cerré un proceso y un funcionario necesita agregar un informe.</dt>
<dd>Desarchívela desde la pestaña Archivadas, permita que agregue lo suyo, y vuelva a cerrarla. Ambos movimientos quedan en la historia.</dd>
<dt>¿Qué pasa si un funcionario nunca acusa recibo?</dt>
<dd>La correspondencia queda en "Derivada a Funcionario" y usted lo ve en el detalle (quién acusó y quién no). Un recordatorio por la Conversación suele bastar.</dd>
<dt>Mi clave OTP no funciona.</dt>
<dd>El OTP es el código dinámico de su firma electrónica avanzada (FirmaGob/SEGPRES). Verifique la hora de su dispositivo generador; si persiste, contacte a Informática.</dd>
</dl>
HTML;

// ==================== MANUAL FUNCIONARIOS ====================

$mFunc = <<<HTML
<h1>2. Cómo enterarse: las notificaciones</h1>
<p>No es necesario estar revisando la plataforma todo el día. Cuando algo le involucra —le derivan una
correspondencia, alguien escribe en una conversación donde participa— recibe el aviso por dos vías:</p>
<ul>
<li>La <b>campana</b> arriba a la derecha (el número rojo son sus avisos sin leer; cada uno lo lleva directo al documento), y</li>
<li>un <b>correo</b> a su casilla institucional, con un botón directo a la plataforma.</li>
</ul>
<p>Los avisos siempre mencionan el <b>folio</b> (por ejemplo <span class="kbd">ING-2026-00045</span>),
de modo que sepa exactamente de qué documento se trata.</p>

<h1>3. Le llegó una correspondencia: ¿qué corresponde hacer?</h1>
<div class="paso"><b class="n">Paso 1.</b> Ingrese a su <b>Bandeja de Entrada</b>. En la pestaña
<b>Activas</b> verá el documento con la etiqueta naranja <em>"Por recibir"</em>.</div>
<div class="paso"><b class="n">Paso 2.</b> Pulse el <b>botón verde ✓</b> para acusar recibo. Es su
constancia formal — como firmar el libro cuando se entregaba el papel — y queda con fecha y hora.
Hágalo apenas lo revise: mientras no acuse, para el sistema el documento "no le ha llegado".</div>
<div class="paso"><b class="n">Paso 3.</b> Abra el detalle (el ícono del ojo) y revise:
los <b>adjuntos</b> (el documento original escaneado), y la <b>providencia del Alcalde</b> con sus
instrucciones — el <em>"PARA: responder, tramitar, informar…"</em> indica qué se espera de usted, y
las observaciones suelen señalar el plazo.</div>
<div class="paso"><b class="n">Paso 4.</b> Trabaje el encargo y utilice la <b>Conversación</b> para
todo lo demás: informar su avance, hacer consultas al Alcalde o a otros participantes, y adjuntar
su informe o respuesta cuando esté lista. Todos los involucrados reciben aviso de cada mensaje.</div>
<div class="tip">Acusar recibo NO bloquea nada: después del acuse puede seguir escribiendo,
adjuntando y gestionando con normalidad. Son dos cosas distintas: el acuse confirma que recibió;
la Conversación es donde ocurre el trabajo.</div>

<h1>4. Los archivos: ver y compartir documentos</h1>
<ul>
<li>En la Conversación puede adjuntar <b>PDF, imágenes (JPG/PNG), Word, Excel, PowerPoint y RAR</b>, de hasta 20 MB cada uno.</li>
<li>Los <b>PDF e imágenes se abren en pantalla</b> con un clic (con botón para descargarlos); Word, Excel y RAR se descargan al computador.</li>
<li>La <b>providencia firmada</b> del Alcalde también se abre desde el detalle, y su código QR permite verificar su autenticidad.</li>
</ul>

<h1>5. Si encuentra un proceso "Archivada"</h1>
<p>Significa que el <b>Alcalde cerró formalmente ese proceso</b>: quedó de solo lectura y no admite
mensajes ni cambios. Si necesita agregar algo importante a un tema cerrado, solicite al Alcalde
que lo desarchive — es el único que puede hacerlo, y tanto el cierre como la reapertura quedan
registrados en la historia del documento.</p>

$estados
$conversacion

<h1>Preguntas frecuentes</h1>
<dl class="faq">
<dt>Acusé recibo por error antes de leer el documento.</dt>
<dd>No hay problema: el acuse solo confirma que lo recibió, no que terminó el trabajo. Siga gestionando con normalidad.</dd>
<dt>Me llegó algo que no me corresponde.</dt>
<dd>Indíquelo en la Conversación: el Alcalde y los demás participantes lo verán y podrán re-derivarla a quien corresponda.</dd>
<dt>¿Cómo se responde formalmente al ministerio que envió el oficio?</dt>
<dd>La respuesta formal (el oficio de vuelta) la canalizan el Alcalde y Oficina de Partes. Su parte es preparar el contenido y subirlo a la Conversación, o entregárselo al Alcalde según acuerden.</dd>
<dt>Estaré de vacaciones dos semanas.</dt>
<dd>Defina su subrogante en su perfil antes de salir. Mientras dure su ausencia, este verá su bandeja, podrá actuar en su nombre (todo queda registrado como subrogancia) y recibirá sus notificaciones.</dd>
<dt>No me llegan los correos de aviso.</dt>
<dd>Revise que su correo institucional esté bien escrito en su ficha (puede verlo en su perfil) y mire la carpeta de spam. Si sigue fallando, avise a Informática.</dd>
</dl>
HTML;

$manuales = [
    ['archivo' => 'manual-oficina-de-partes.pdf', 'rol' => 'Oficina de Partes', 'cuerpo' => $mPartes],
    ['archivo' => 'manual-alcalde.pdf', 'rol' => 'Alcalde y Subrogante', 'cuerpo' => $mAlcalde],
    ['archivo' => 'manual-funcionarios.pdf', 'rol' => 'Funcionarios Municipales', 'cuerpo' => $mFunc],
];

@mkdir(storage_path('app/manuales'), 0775, true);
foreach ($manuales as $m) {
    $html = "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><style>$css</style></head><body>"
        . $cab . $pie
        . "<div class=\"portada\"><div class=\"tit\">Manual de Usuario<br/>Módulo de Correspondencia</div>"
        . "<div class=\"sub\">{$m['rol']}</div>"
        . "<div class=\"ver\">Plataforma de Gestión Documental Municipal · Versión Junio 2026<br/>"
        . "https://docmunicipal.local · Manuales: /manuales</div></div>"
        . "<div class=\"salto\"></div>"
        . $acceso
        . $m['cuerpo']
        . "</body></html>";

    $pdf = Pdf::loadHTML($html);
    $pdf->setOption('isHtml5ParserEnabled', true);
    $pdf->setOption('isFontSubsettingEnabled', true);
    $out = $pdf->output();
    file_put_contents(storage_path('app/manuales/' . $m['archivo']), $out);
    echo "MARCA|" . $m['archivo'] . " " . round(strlen($out) / 1024) . "KB\n";
}
