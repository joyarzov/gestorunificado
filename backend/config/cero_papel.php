<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Documentos estancados en firma
    |--------------------------------------------------------------------------
    |
    | Un documento en "pendiente de firma" no avanza solo: si el firmante en
    | turno se ausenta sin dejar subrogancia, o simplemente lo olvida, el
    | documento se queda ahí sin que nadie se entere. Estos umbrales definen
    | cuándo se recuerda al firmante y cuándo se escala al emisor.
    |
    */
    'estancados' => [
        // Días sin avance tras los cuales se recuerda al firmante en turno.
        'dias_aviso' => (int) env('CERO_PAPEL_ESTANCADO_AVISO', 3),

        // Días sin avance tras los cuales se avisa también a quien lo emitió.
        'dias_escalamiento' => (int) env('CERO_PAPEL_ESTANCADO_ESCALAMIENTO', 7),
    ],
];
