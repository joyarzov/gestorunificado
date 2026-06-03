<?php

/**
 * Configuración de notificaciones. Para incorporar un módulo futuro, basta
 * agregar una entrada aquí y llamar a NotificacionService::enviar() con su clave.
 */
return [

    'modulos' => [
        'cero_papel' => [
            'label' => 'Cero Papel',
            'color' => '#0071BC',
        ],
        'correspondencia' => [
            'label' => 'Correspondencia',
            'color' => '#28A9E3',
        ],
        'oirs' => [
            'label' => 'OIRS',
            'color' => '#EB1B78',
        ],
        // 'fondos' => ['label' => 'Fondos Concursables', 'color' => '#8AC53E'],
    ],

    // Módulo por defecto si no se reconoce la clave
    'default' => [
        'label' => 'Notificación',
        'color' => '#0071BC',
    ],

];
