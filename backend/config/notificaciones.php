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

    /**
     * Política de correo: reduce la fatiga de notificaciones para los roles que
     * trabajan dentro del sistema (revisan la campana a diario). A esos roles
     * solo se les envía email de eventos ACCIONABLES; los eventos meramente
     * informativos los ven únicamente en la campana / historial.
     *
     * Importante: esto NO afecta a los demás roles. Un funcionario, por ejemplo,
     * sigue recibiendo su correo cuando el alcalde le deriva una correspondencia,
     * porque el email suele ser su único aviso.
     */
    'email' => [
        // Roles que solo reciben email de eventos accionables. Vacío = todos
        // reciben email de todo (comportamiento anterior).
        'roles_solo_accionables' => ['alcalde'],

        // Tipos "informativos" (no accionables): NO generan email para los roles
        // de arriba. Cualquier tipo que no esté aquí (ej. firmas pendientes,
        // salidas por despachar) sigue enviando email a todos.
        'tipos_informativos' => [
            'correspondencia_recibida',          // nueva correspondencia en su bandeja
            'correspondencia_recibida_parcial',  // acuse de recibo parcial
            'correspondencia_en_gestion',        // acuse de recibo / en gestión
            'correspondencia_mensaje',           // nuevo mensaje en el hilo
        ],
    ],

];
