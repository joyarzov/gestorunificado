<?php

namespace Database\Seeders;

use App\Models\DocumentoPlantilla;
use App\Models\TipoDocumental;
use Illuminate\Database\Seeder;

class DocumentoPlantillaSeeder extends Seeder
{
    public function run(): void
    {
        // Obtener tipos documentales
        $tipoDecreto = TipoDocumental::where('codigo', 'DEC')->first();
        $tipoMemo = TipoDocumental::where('codigo', 'MEM')->first();
        $tipoOficio = TipoDocumental::where('codigo', 'OFI')->first();
        $tipoConvenio = TipoDocumental::where('codigo', 'CON')->first();
        $tipoResolucion = TipoDocumental::where('codigo', 'RES')->first();
        $tipoCertificado = TipoDocumental::where('codigo', 'CER')->first();

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
                    'referencia' => 'Referencia o materia del decreto',
                    'fecha' => 'Fecha de emisión (formato: 15 de enero de 2026)',
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
                    'para' => 'Destinatario',
                    'de' => 'Remitente',
                    'referencia' => 'Referencia o asunto',
                    'contenido' => 'Contenido del memorándum',
                    'fecha' => 'Fecha de emisión',
                    'firmas_html' => 'HTML generado de firmas',
                    'distribucion_html' => 'HTML generado de distribución'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        // Plantilla de Oficio
        DocumentoPlantilla::firstOrCreate(
            ['codigo' => 'PLT_OFICIO_001'],
            [
                'nombre' => 'Oficio Estándar',
                'descripcion' => 'Plantilla estándar para oficios externos',
                'tipo_documental_id' => $tipoOficio?->id,
                'contenido_html' => $this->getPlantillaOficio(),
                'variables_json' => [
                    'numero' => 'Número del oficio',
                    'anio' => 'Año',
                    'destinatario' => 'Nombre del destinatario',
                    'cargo_destinatario' => 'Cargo del destinatario',
                    'institucion' => 'Institución destinataria',
                    'materia' => 'Materia del oficio',
                    'contenido' => 'Contenido del oficio',
                    'fecha' => 'Fecha de emisión'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => true,
                'creado_por' => 1
            ]
        );

        // Plantilla de Convenio
        DocumentoPlantilla::firstOrCreate(
            ['codigo' => 'PLT_CONVENIO_001'],
            [
                'nombre' => 'Convenio Marco',
                'descripcion' => 'Plantilla para convenios y acuerdos',
                'tipo_documental_id' => $tipoConvenio?->id,
                'contenido_html' => $this->getPlantillaConvenio(),
                'variables_json' => [
                    'numero' => 'Número del convenio',
                    'parte1' => 'Primera parte (Municipalidad)',
                    'parte2' => 'Segunda parte (Otra entidad)',
                    'objeto' => 'Objeto del convenio',
                    'obligaciones' => 'Obligaciones de las partes',
                    'vigencia' => 'Vigencia del convenio',
                    'fecha' => 'Fecha de firma'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => true,
                'creado_por' => 1
            ]
        );

        // Plantilla de Resolución
        DocumentoPlantilla::firstOrCreate(
            ['codigo' => 'PLT_RESOLUCION_001'],
            [
                'nombre' => 'Resolución Estándar',
                'descripcion' => 'Plantilla estándar para resoluciones administrativas',
                'tipo_documental_id' => $tipoResolucion?->id,
                'contenido_html' => $this->getPlantillaResolucion(),
                'variables_json' => [
                    'numero' => 'Número de resolución',
                    'anio' => 'Año',
                    'materia' => 'Materia de la resolución',
                    'vistos' => 'Vistos',
                    'considerando' => 'Considerandos',
                    'resuelvo' => 'Se resuelve',
                    'fecha' => 'Fecha de emisión'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => true,
                'creado_por' => 1
            ]
        );

        // Plantilla de Certificado
        DocumentoPlantilla::firstOrCreate(
            ['codigo' => 'PLT_CERTIFICADO_001'],
            [
                'nombre' => 'Certificado de Residencia',
                'descripcion' => 'Certificado de residencia para ciudadanos',
                'tipo_documental_id' => $tipoCertificado?->id,
                'contenido_html' => $this->getPlantillaCertificado(),
                'variables_json' => [
                    'nombre_ciudadano' => 'Nombre del ciudadano',
                    'run' => 'RUN del ciudadano',
                    'direccion' => 'Dirección',
                    'comuna' => 'Comuna',
                    'fecha' => 'Fecha de emisión'
                ],
                'activo' => true,
                'requiere_firma' => true,
                'requiere_aprobacion' => false,
                'creado_por' => 1
            ]
        );

        $this->command->info('✅ Plantillas de documentos creadas exitosamente');
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
    <!-- Logo en la parte superior izquierda -->
    <div style="margin-bottom: 40px;">
        <div style="text-align: left; margin-bottom: 10px;">
            <img src="/logo.png" alt="Logo Municipalidad" style="max-width: 200px; height: auto;" />
        </div>
        <div style="text-align: center;">
            <h2 style="margin: 0;"><strong>MEMORÁNDUM Nº {{numero}}/{{anio}}</strong></h2>
        </div>
    </div>

    <!-- Referencia y Fecha alineados a la derecha (igual que decreto) -->
    <div style="margin-bottom: 50px; text-align: right;">
        <p><strong>Ref:</strong> {{referencia}}</p>
        <p><strong>Puerto Williams,</strong> {{fecha}}</p>
    </div>

    <!-- DE / PARA -->
    <div style="margin-bottom: 30px;">
        <p><strong>DE:</strong></p>
        <p style="margin-left: 20px; white-space: pre-line;">{{de}}</p>
        <p style="margin-top: 10px;"><strong>PARA:</strong></p>
        <p style="margin-left: 20px; white-space: pre-line;">{{para}}</p>
    </div>

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

    private function getPlantillaOficio(): string
    {
        return '
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="margin: 0;">REPÚBLICA DE CHILE</h1>
        <h2 style="margin: 5px 0;">MUNICIPALIDAD DE CABO DE HORNOS</h2>
        <h3 style="margin: 10px 0 0 0;">OFICIO N° {{numero}}/{{anio}}</h3>
    </div>

    <div style="margin-bottom: 30px;">
        <p><strong>ANT.:</strong> {{materia}}</p>
        <p><strong>MAT.:</strong> {{materia}}</p>
    </div>

    <div style="margin-bottom: 30px;">
        <p><strong>{{cargo_destinatario}}</strong></p>
        <p><strong>{{destinatario}}</strong></p>
        <p><strong>{{institucion}}</strong></p>
        <p>PRESENTE</p>
    </div>

    <div style="margin-top: 40px; text-align: justify;">
        <p>{{contenido}}</p>
    </div>

    <div style="margin-top: 40px;">
        <p>Saluda atentamente a usted,</p>
    </div>

    <div style="margin-top: 60px; text-align: center;">
        <p>___________________________</p>
        <p><strong>ALCALDE(SA)</strong></p>
        <p>MUNICIPALIDAD DE CABO DE HORNOS</p>
    </div>

    <div style="margin-top: 40px; font-size: 10pt; color: #666;">
        <p>Puerto Williams, {{fecha}}</p>
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

    private function getPlantillaResolucion(): string
    {
        return '
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="margin: 0;">REPÚBLICA DE CHILE</h1>
        <h2 style="margin: 5px 0;">MUNICIPALIDAD DE CABO DE HORNOS</h2>
        <h3 style="margin: 10px 0 0 0;">RESOLUCIÓN EXENTA N° {{numero}}/{{anio}}</h3>
    </div>

    <div style="margin-bottom: 20px; text-align: right;">
        <p><strong>MAT.:</strong> {{materia}}</p>
    </div>

    <div style="margin-bottom: 30px;">
        <p><strong>VISTOS:</strong></p>
        <p style="text-align: justify; margin-left: 20px;">{{vistos}}</p>

        <p style="margin-top: 20px;"><strong>CONSIDERANDO:</strong></p>
        <p style="text-align: justify; margin-left: 20px;">{{considerando}}</p>
    </div>

    <div style="margin-top: 40px;">
        <p style="text-align: center;"><strong>RESUELVO:</strong></p>
        <p style="text-align: justify; margin-top: 20px;">{{resuelvo}}</p>
    </div>

    <div style="margin-top: 40px; text-align: center;">
        <p>ANÓTESE Y COMUNÍQUESE</p>
    </div>

    <div style="margin-top: 60px; text-align: center;">
        <p>___________________________</p>
        <p><strong>ALCALDE(SA)</strong></p>
        <p>MUNICIPALIDAD DE CABO DE HORNOS</p>
    </div>

    <div style="margin-top: 40px; font-size: 10pt; color: #666;">
        <p>Puerto Williams, {{fecha}}</p>
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
