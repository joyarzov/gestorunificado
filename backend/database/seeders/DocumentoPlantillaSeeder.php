<?php

namespace Database\Seeders;

use App\Models\DocumentoPlantilla;
use App\Models\TipoDocumental;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;

class DocumentoPlantillaSeeder extends Seeder
{
    public function run(): void
    {
        // Asegurar tipos documentales requeridos (ORD, CIR, CAR no existen en DatabaseSeeder)
        TipoDocumental::firstOrCreate(['codigo' => 'ORD'], [
            'nombre' => 'Ordinario',
            'descripcion' => 'Comunicación oficial interna entre departamentos',
            'requiere_firma' => true,
            'genera_correlativo' => true,
            'prefijo_correlativo' => 'ORD',
            'activo' => true,
        ]);
        TipoDocumental::firstOrCreate(['codigo' => 'CIR'], [
            'nombre' => 'Circular',
            'descripcion' => 'Instrucción interna a múltiples destinatarios',
            'requiere_firma' => true,
            'genera_correlativo' => true,
            'prefijo_correlativo' => 'CIR',
            'activo' => true,
        ]);
        TipoDocumental::firstOrCreate(['codigo' => 'CAR'], [
            'nombre' => 'Carta',
            'descripcion' => 'Comunicación formal',
            'requiere_firma' => true,
            'genera_correlativo' => true,
            'prefijo_correlativo' => 'CAR',
            'activo' => true,
        ]);

        // Obtener tipos documentales
        $tipoDecreto    = TipoDocumental::where('codigo', 'DEC')->first();
        $tipoMemo       = TipoDocumental::where('codigo', 'MEM')->first();
        $tipoOficio     = TipoDocumental::where('codigo', 'OFI')->first();
        $tipoConvenio   = TipoDocumental::where('codigo', 'CON')->first();
        $tipoResolucion = TipoDocumental::where('codigo', 'RES')->first();
        $tipoCertificado = TipoDocumental::where('codigo', 'CER')->first();
        $tipoOrdinario  = TipoDocumental::where('codigo', 'ORD')->first();
        $tipoCircular   = TipoDocumental::where('codigo', 'CIR')->first();
        $tipoCarta      = TipoDocumental::where('codigo', 'CAR')->first();
        $tipoActa       = TipoDocumental::where('codigo', 'ACT')->first();
        $tipoInforme    = TipoDocumental::where('codigo', 'INF')->first();

        // Plantilla de Decreto Alcaldicio
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_DECRETO_001'],
            [
                'nombre' => 'Decreto Alcaldicio Estándar',
                'descripcion' => 'Plantilla estándar para decretos alcaldicios con artículos dinámicos',
                'tipo_documental_id' => $tipoDecreto?->id,
                'contenido_html' => $this->getPlantillaDecreto(),
                'variables_json' => [
                    'numero' => 'Número de decreto',
                    'fecha' => 'Fecha de emisión (formato: 15 de enero de 2026)',
                    'referencia' => 'Referencia o materia del decreto',
                    'vistos' => 'VISTOS Y CONSIDERANDO (texto completo)',
                    'texto_decreto' => 'DECRETO',
                    'articulos_html' => 'HTML generado de artículos dinámicos',
                    'firmas_html' => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => true,
                'creado_por' => 1
            ]
        );

        // Plantilla de Memorándum
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_MEMO_001'],
            [
                'nombre' => 'Memorándum Estándar',
                'descripcion' => 'Plantilla estándar para memorándums internos',
                'tipo_documental_id' => $tipoMemo?->id,
                'contenido_html' => $this->getPlantillaMemorandum(),
                'variables_json' => [
                    'numero' => 'Número del memorándum',
                    'anio' => 'Año',
                    'fecha' => 'Fecha de emisión',
                    'referencia' => 'Referencia o asunto',
                    'de' => 'Remitente',
                    'para' => 'Destinatario',
                    'contenido' => 'Contenido del memorándum',
                    'firmas_html' => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Oficio (rewrite con patrón decreto/memo)
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_OFICIO_001'],
            [
                'nombre' => 'Oficio Estándar',
                'descripcion' => 'Oficio formal externo (entre instituciones)',
                'tipo_documental_id' => $tipoOficio?->id,
                'contenido_html' => $this->getPlantillaOficio(),
                'variables_json' => [
                    'numero'             => 'Número del oficio',
                    'anio'               => 'Año',
                    'fecha'              => 'Fecha de emisión',
                    'antecedentes'       => 'Antecedentes (ANT)',
                    'materia'            => 'Materia (MAT)',
                    'destinatario'       => 'Nombre del destinatario',
                    'cargo_destinatario' => 'Cargo del destinatario',
                    'institucion'        => 'Institución destinataria',
                    'contenido'          => 'Contenido del oficio',
                    'firmas_html'        => 'HTML generado de firmas',
                    'distribucion_html'  => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => true,
                'creado_por' => 1
            ]
        );

        // Plantilla de Ordinario (interno)
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_ORDINARIO_001'],
            [
                'nombre' => 'Ordinario Estándar',
                'descripcion' => 'Comunicación oficial interna entre departamentos',
                'tipo_documental_id' => $tipoOrdinario?->id,
                'contenido_html' => $this->getPlantillaOrdinario(),
                'variables_json' => [
                    'numero'        => 'Número del ordinario',
                    'anio'          => 'Año',
                    'fecha'         => 'Fecha de emisión',
                    'antecedentes'  => 'Antecedentes (ANT)',
                    'materia'       => 'Materia (MAT)',
                    'de'            => 'Remitente',
                    'para'          => 'Destinatario',
                    'contenido'     => 'Contenido del ordinario',
                    'firmas_html'   => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Circular
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_CIRCULAR_001'],
            [
                'nombre' => 'Circular Estándar',
                'descripcion' => 'Instrucción interna a múltiples destinatarios',
                'tipo_documental_id' => $tipoCircular?->id,
                'contenido_html' => $this->getPlantillaCircular(),
                'variables_json' => [
                    'numero'      => 'Número de la circular',
                    'anio'        => 'Año',
                    'fecha'       => 'Fecha de emisión',
                    'materia'     => 'Materia',
                    'dirigida_a'  => 'Dirigida a (ej: Todos los Directores)',
                    'contenido'   => 'Contenido de la circular',
                    'firmas_html' => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Carta
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_CARTA_001'],
            [
                'nombre' => 'Carta Estándar',
                'descripcion' => 'Comunicación formal en formato carta',
                'tipo_documental_id' => $tipoCarta?->id,
                'contenido_html' => $this->getPlantillaCarta(),
                'variables_json' => [
                    'numero'             => 'Número de la carta',
                    'anio'               => 'Año',
                    'fecha'              => 'Fecha de emisión',
                    'destinatario'       => 'Nombre del destinatario',
                    'cargo_destinatario' => 'Cargo del destinatario (opcional)',
                    'institucion'        => 'Institución / dirección (opcional)',
                    'saludo'             => 'Saludo (ej: Estimado/a Sr./Sra.)',
                    'contenido'          => 'Cuerpo de la carta',
                    'despedida'          => 'Despedida (ej: Atentamente)',
                    'firmas_html'        => 'HTML generado de firmas',
                    'distribucion_html'  => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Acta
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_ACTA_001'],
            [
                'nombre' => 'Acta de Reunión',
                'descripcion' => 'Acta para reuniones (asistentes, temas, acuerdos)',
                'tipo_documental_id' => $tipoActa?->id,
                'contenido_html' => $this->getPlantillaActa(),
                'variables_json' => [
                    'numero'         => 'Número del acta',
                    'anio'           => 'Año',
                    'tipo_reunion'   => 'Tipo de reunión',
                    'fecha'          => 'Fecha de la reunión',
                    'hora'           => 'Hora de inicio',
                    'lugar'          => 'Lugar',
                    'asistentes'     => 'Asistentes (uno por línea)',
                    'temas_tratados' => 'Temas tratados',
                    'acuerdos'       => 'Acuerdos adoptados',
                    'firmas_html'    => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Informe Técnico
        DocumentoPlantilla::updateOrCreate(
            ['codigo' => 'PLT_INFORME_001'],
            [
                'nombre' => 'Informe Técnico',
                'descripcion' => 'Informe técnico con antecedentes, desarrollo, conclusiones',
                'tipo_documental_id' => $tipoInforme?->id,
                'contenido_html' => $this->getPlantillaInforme(),
                'variables_json' => [
                    'numero'         => 'Número del informe',
                    'anio'           => 'Año',
                    'fecha'          => 'Fecha de emisión',
                    'asunto'         => 'Asunto del informe',
                    'antecedentes'   => 'I. Antecedentes',
                    'desarrollo'     => 'II. Desarrollo',
                    'conclusiones'   => 'III. Conclusiones',
                    'recomendaciones' => 'IV. Recomendaciones',
                    'firmas_html'    => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución',
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantillas legacy descartadas por decisión de producto.
        // Se desactivan (no se borran) para preservar documentos ya creados con ellas.
        // No-op si las filas no existen (BD fresca).
        DocumentoPlantilla::whereIn('codigo', [
            'PLT_RESOLUCION_001',
            'PLT_CONVENIO_001',
            'PLT_CERTIFICADO_001',
        ])->update(['activo' => false]);

        // Invalidar cache de plantillas activas (DocumentoController@getPlantillas tiene TTL 1h).
        Cache::forget('plantillas_activas');

        $this->command->info('✅ Plantillas de documentos sincronizadas');
    }

    private function getPlantillaDecreto(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo en la parte superior izquierda -->
    <div style="margin-bottom: 40px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>DECRETO ALCALDICIO Nº {{numero}}</strong></h2>
        </div>
    </div>

    <!-- Encabezado -->
    <div style="margin-bottom: 50px; text-align: right;">
        <p><strong>Ref:</strong> {{referencia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- VISTOS Y CONSIDERANDO -->
    <div style="margin-bottom: 30px;">
        <p><strong>VISTOS Y CONSIDERANDO:</strong></p>
        <p style="margin-left: 20px;">{{vistos}}</p>
    </div>

    <!-- Artículos dinámicos -->
    {{articulos_html}}

    <!-- DECRETO centrado con texto -->
    <div style="text-align: center; margin: 50px 0;">
        <p><strong>DECRETO:</strong></p>
        <p style="text-align: left; margin-top: 20px;">{{texto_decreto}}</p>
    </div>

    <!-- Cierre centrado -->
    <div style="text-align: center; margin: 50px 0;">
        <p>De acuerdo a los VISTOS Y CONSIDERANDO, ANÓTESE, COMUNIQUESE Y ARCHIVESE.</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaMemorandum(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Encabezado -->
    <div style="margin-bottom: 20px;">
        <div style="text-align: left;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <h2 style="margin: 10px 0 0 0; text-align: center;"><strong>MEMORÁNDUM Nº {{numero}}/{{anio}}</strong></h2>
    </div>

    <!-- Referencia y Fecha alineados a la derecha (igual que decreto) -->
    <div style="margin-bottom: 50px; text-align: right;">
        <p><strong>Ref:</strong> {{referencia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- DE / PARA -->
    <table style="margin-bottom: 30px; border-collapse: collapse;">
        <tr>
            <td style="vertical-align: top; padding: 0 10px 5px 0; white-space: nowrap;"><strong>DE:</strong></td>
            <td style="vertical-align: top; padding: 0 0 5px 0; white-space: pre-line;">{{de}}</td>
        </tr>
        <tr>
            <td style="vertical-align: top; padding: 0 10px 0 0; white-space: nowrap;"><strong>PARA:</strong></td>
            <td style="vertical-align: top; padding: 0; white-space: pre-line;">{{para}}</td>
        </tr>
    </table>

    <!-- Contenido -->
    <div style="margin-bottom: 30px; text-align: justify;">
        {{contenido}}
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaResolucion(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 40px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>RESOLUCIÓN EXENTA Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- Materia y Fecha -->
    <div style="margin-bottom: 40px; text-align: right;">
        <p><strong>Mat:</strong> {{materia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- VISTOS -->
    <div style="margin-bottom: 30px;">
        <p><strong>VISTOS:</strong></p>
        <p style="margin-left: 20px; text-align: justify;">{{vistos}}</p>
    </div>

    <!-- CONSIDERANDO -->
    <div style="margin-bottom: 30px;">
        <p><strong>CONSIDERANDO:</strong></p>
        <p style="margin-left: 20px; text-align: justify;">{{considerando}}</p>
    </div>

    <!-- RESUELVO -->
    <div style="margin: 40px 0;">
        <p style="text-align: center;"><strong>RESUELVO:</strong></p>
        <p style="text-align: justify; margin-top: 20px;">{{resuelvo}}</p>
    </div>

    <!-- Cierre centrado -->
    <div style="text-align: center; margin: 40px 0;">
        <p>ANÓTESE Y COMUNÍQUESE</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaOficio(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>OFICIO Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- ANT / MAT / Fecha -->
    <div style="margin-bottom: 30px; text-align: right;">
        <p><strong>ANT:</strong> {{antecedentes}}</p>
        <p><strong>MAT:</strong> {{materia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <hr style="border: 0; border-top: 1px solid #000; margin-bottom: 30px;" />

    <!-- Destinatario -->
    <div style="margin-bottom: 30px;">
        <p><strong>A:</strong> {{destinatario}}</p>
        <p style="margin-left: 30px;">{{cargo_destinatario}}</p>
        <p style="margin-left: 30px;">{{institucion}}</p>
        <p style="margin-left: 30px;"><strong>PRESENTE</strong></p>
    </div>

    <!-- Contenido -->
    <div style="margin-bottom: 30px; text-align: justify;">
        {{contenido}}
    </div>

    <!-- Despedida -->
    <div style="margin-top: 40px;">
        <p>Saluda atentamente a usted,</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaOrdinario(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>ORDINARIO Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- ANT / MAT / Fecha -->
    <div style="margin-bottom: 30px; text-align: right;">
        <p><strong>ANT:</strong> {{antecedentes}}</p>
        <p><strong>MAT:</strong> {{materia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- DE / PARA -->
    <table style="margin-bottom: 30px; border-collapse: collapse;">
        <tr>
            <td style="vertical-align: top; padding: 0 10px 5px 0; white-space: nowrap;"><strong>DE:</strong></td>
            <td style="vertical-align: top; padding: 0 0 5px 0; white-space: pre-line;">{{de}}</td>
        </tr>
        <tr>
            <td style="vertical-align: top; padding: 0 10px 0 0; white-space: nowrap;"><strong>PARA:</strong></td>
            <td style="vertical-align: top; padding: 0; white-space: pre-line;">{{para}}</td>
        </tr>
    </table>

    <!-- Contenido -->
    <div style="margin-bottom: 30px; text-align: justify;">
        {{contenido}}
    </div>

    <!-- Despedida -->
    <div style="margin-top: 40px;">
        <p>Saluda atentamente,</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaCircular(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>CIRCULAR Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- Materia / Fecha -->
    <div style="margin-bottom: 30px; text-align: right;">
        <p><strong>MAT:</strong> {{materia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- Dirigida a -->
    <div style="margin-bottom: 30px;">
        <p><strong>DIRIGIDA A:</strong> {{dirigida_a}}</p>
    </div>

    <!-- Contenido -->
    <div style="margin-bottom: 30px; text-align: justify;">
        {{contenido}}
    </div>

    <!-- Despedida -->
    <div style="margin-top: 40px;">
        <p>Saluda atentamente,</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaCarta(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Numeración -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: right; font-size: 11pt;">
            <p style="margin: 0;"><strong>Carta Nº {{numero}}/{{anio}}</strong></p>
            <p style="margin: 0;">Puerto Williams, {{fecha}}</p>
        </div>
    </div>

    <!-- Destinatario -->
    <div style="margin-bottom: 30px;">
        <p style="margin: 0;"><strong>{{destinatario}}</strong></p>
        <p style="margin: 0;">{{cargo_destinatario}}</p>
        <p style="margin: 0;">{{institucion}}</p>
        <p style="margin: 0;"><strong>PRESENTE</strong></p>
    </div>

    <!-- Saludo -->
    <div style="margin-bottom: 20px;">
        <p>{{saludo}}</p>
    </div>

    <!-- Contenido -->
    <div style="margin-bottom: 30px; text-align: justify;">
        {{contenido}}
    </div>

    <!-- Despedida -->
    <div style="margin-top: 40px;">
        <p>{{despedida}}</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaActa(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>ACTA Nº {{numero}}/{{anio}}</strong></h2>
            <p style="margin: 4px 0 0 0; font-size: 11pt;">{{tipo_reunion}}</p>
        </div>
    </div>

    <!-- Datos de la reunión -->
    <table style="margin-bottom: 30px; border-collapse: collapse;">
        <tr>
            <td style="vertical-align: top; padding: 0 10px 5px 0; white-space: nowrap;"><strong>Fecha:</strong></td>
            <td style="vertical-align: top; padding: 0 0 5px 0;">{{fecha}}</td>
        </tr>
        <tr>
            <td style="vertical-align: top; padding: 0 10px 5px 0; white-space: nowrap;"><strong>Hora:</strong></td>
            <td style="vertical-align: top; padding: 0 0 5px 0;">{{hora}}</td>
        </tr>
        <tr>
            <td style="vertical-align: top; padding: 0 10px 5px 0; white-space: nowrap;"><strong>Lugar:</strong></td>
            <td style="vertical-align: top; padding: 0 0 5px 0;">{{lugar}}</td>
        </tr>
    </table>

    <!-- Asistentes -->
    <div style="margin-bottom: 25px;">
        <p><strong>ASISTENTES:</strong></p>
        <div style="margin-left: 20px; white-space: pre-line;">{{asistentes}}</div>
    </div>

    <!-- Temas tratados -->
    <div style="margin-bottom: 25px;">
        <p><strong>TEMAS TRATADOS:</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{temas_tratados}}</div>
    </div>

    <!-- Acuerdos -->
    <div style="margin-bottom: 25px;">
        <p><strong>ACUERDOS:</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{acuerdos}}</div>
    </div>

    <!-- Cierre -->
    <div style="margin-top: 30px;">
        <p>Sin otro asunto que tratar, se levanta la sesión.</p>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaInforme(): string
    {
        return '
<div style="font-family: Times New Roman, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6;">
    <!-- Logo + Título -->
    <div style="margin-bottom: 30px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>INFORME TÉCNICO Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- Asunto / Fecha -->
    <div style="margin-bottom: 40px; text-align: right;">
        <p><strong>Asunto:</strong> {{asunto}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- I. ANTECEDENTES -->
    <div style="margin-bottom: 25px;">
        <p><strong>I. ANTECEDENTES</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{antecedentes}}</div>
    </div>

    <!-- II. DESARROLLO -->
    <div style="margin-bottom: 25px;">
        <p><strong>II. DESARROLLO</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{desarrollo}}</div>
    </div>

    <!-- III. CONCLUSIONES -->
    <div style="margin-bottom: 25px;">
        <p><strong>III. CONCLUSIONES</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{conclusiones}}</div>
    </div>

    <!-- IV. RECOMENDACIONES -->
    <div style="margin-bottom: 25px;">
        <p><strong>IV. RECOMENDACIONES</strong></p>
        <div style="margin-left: 20px; text-align: justify;">{{recomendaciones}}</div>
    </div>

    <!-- Firmas -->
    <div style="margin-top: 80px;">
        {{firmas_html}}
    </div>

    <!-- Distribución -->
    <div style="margin-top: 40px; font-size: 8pt; font-style: italic;">
        <p><strong>DISTRIBUCIÓN:</strong></p>
        {{distribucion_html}}
    </div>
</div>';
    }

    private function getPlantillaConvenio(): string
    {
        return '
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0;">CONVENIO MARCO N° {{numero}}</h1>
    </div>

    <div style="margin-bottom: 30px; text-align: justify;">
        <p>En Puerto Williams, a {{fecha}}, comparecen por una parte,</p>
        <p style="margin: 20px 0;"><strong>{{parte1}}</strong>, en adelante "la Municipalidad",</p>
        <p>y por otra,</p>
        <p style="margin: 20px 0;"><strong>{{parte2}}</strong>, en adelante "la Contraparte",</p>
        <p>quienes acuerdan celebrar el presente convenio:</p>
    </div>

    <div style="margin-top: 40px;">
        <h2 style="border-bottom: 1px solid #000; padding-bottom: 5px;">PRIMERO: OBJETO DEL CONVENIO</h2>
        <p style="text-align: justify;">{{objeto}}</p>

        <h2 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px;">SEGUNDO: OBLIGACIONES DE LAS PARTES</h2>
        <p style="text-align: justify;">{{obligaciones}}</p>

        <h2 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px;">TERCERO: VIGENCIA</h2>
        <p style="text-align: justify;">{{vigencia}}</p>
    </div>

    <div style="margin-top: 80px; display: flex; justify-content: space-between;">
        <div style="text-align: center; width: 45%;">
            <p>____________________</p>
            <p><strong>{{parte1}}</strong></p>
        </div>
        <div style="text-align: center; width: 45%;">
            <p>____________________</p>
            <p><strong>{{parte2}}</strong></p>
        </div>
    </div>
</div>';
    }

    private function getPlantillaCertificado(): string
    {
        return '
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="margin: 0;">MUNICIPALIDAD DE CABO DE HORNOS</h1>
        <h2 style="margin: 10px 0 0 0;">CERTIFICADO DE RESIDENCIA</h2>
    </div>

    <div style="margin-top: 40px; text-align: justify;">
        <p>Por medio de la presente, la Ilustre Municipalidad de Cabo de Hornos certifica que:</p>

        <div style="margin: 30px 0; padding: 20px; border: 1px solid #ccc; background: #f9f9f9;">
            <p style="font-size: 16px; margin: 10px 0;">
                <strong>Don(a):</strong> {{nombre_ciudadano}}
            </p>
            <p style="font-size: 16px; margin: 10px 0;">
                <strong>RUN:</strong> {{run}}
            </p>
        </div>

        <p style="margin: 20px 0; font-size: 15px;">
            Tiene su domicilio registrado en la siguiente dirección:
        </p>

        <div style="margin: 20px 0; padding: 20px; border: 1px solid #ccc; background: #f9f9f9;">
            <p style="font-size: 16px; margin: 10px 0;">
                <strong>Dirección:</strong> {{direccion}}
            </p>
            <p style="font-size: 16px; margin: 10px 0;">
                <strong>Comuna:</strong> {{comuna}}
            </p>
        </div>

        <p style="margin-top: 40px;">
            Se extiende el presente certificado a petición del interesado(a), para los fines que estime conveniente.
        </p>
    </div>

    <div style="margin-top: 80px; text-align: center;">
        <p>___________________________</p>
        <p><strong>ALCALDE(SA)</strong></p>
        <p>MUNICIPALIDAD DE CABO DE HORNOS</p>
    </div>

    <div style="margin-top: 40px; font-size: 10pt; color: #666; text-align: center;">
        <p>Puerto Williams, {{fecha}}</p>
    </div>
</div>';
    }
}
