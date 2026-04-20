<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CorrespondenciaController;
use App\Http\Controllers\DerivacionController;
use App\Http\Controllers\AdjuntoController;
use App\Http\Controllers\DepartamentoController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\NotificacionController;
use App\Http\Controllers\PlantillaController;
use App\Http\Controllers\OirsSolicitudController;
use App\Http\Controllers\OirsPublicoController;
use App\Http\Controllers\OirsFuncionarioController;
use App\Http\Controllers\ExpedienteController;
use App\Http\Controllers\DocumentoController;
use App\Http\Controllers\CorrelativoController;
use App\Http\Controllers\TipoDocumentalController;
use App\Http\Controllers\DocumentoEnvioController;
use App\Http\Controllers\VerificacionDocumentoController;
use App\Http\Controllers\FondoPublicoController;
use App\Http\Controllers\FondoConcursableController;
use App\Http\Controllers\FirmaSelloController;
use App\Http\Controllers\ConfiguracionController;
use App\Http\Controllers\OrganigramaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Rutas públicas de autenticación
Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
});

// Rutas públicas OIRS
Route::prefix('oirs-publico')->group(function () {
    Route::post('/', [OirsPublicoController::class, 'crear']);
    Route::get('/consultar', [OirsPublicoController::class, 'consultar']);
    Route::post('/adjuntar', [OirsPublicoController::class, 'adjuntar']);
});

// Verificación pública de documentos
Route::get('/verificar-documento/{codigo}', [VerificacionDocumentoController::class, 'verificar']);

// Hora Oficial de Chile - sincronizada con ntp.shoa.cl (America/Punta_Arenas UTC-3)
Route::get('/hora-oficial', function () {
    $now = now();
    return response()->json([
        'success' => true,
        'data' => [
            'timestamp' => $now->toIso8601String(),
            'unix' => $now->getTimestamp() * 1000,
            'timezone' => config('app.timezone'),
            'formatted' => $now->format('H:i:s'),
            'fecha' => $now->format('d/m/Y'),
        ],
    ]);
});

// Rutas públicas Fondos Concursables
Route::prefix('fondos-publico')->group(function () {
    Route::get('/activo', [FondoPublicoController::class, 'activo']);
    Route::get('/{fondo}/bases', [FondoPublicoController::class, 'descargarBases']);
    Route::post('/postular', [FondoPublicoController::class, 'postular']);
    Route::put('/postulacion/{codigo}', [FondoPublicoController::class, 'guardarBorrador']);
    Route::post('/postulacion/{codigo}/enviar', [FondoPublicoController::class, 'enviar']);
    Route::post('/postulacion/{codigo}/adjunto', [FondoPublicoController::class, 'subirAdjunto']);
    Route::delete('/postulacion/{codigo}/adjunto/{id}', [FondoPublicoController::class, 'eliminarAdjunto']);
    Route::get('/consultar', [FondoPublicoController::class, 'consultar']);
});

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    // Dashboard
    Route::get('/dashboard/resumen', [DashboardController::class, 'resumen']);

    // Departamentos
    Route::apiResource('departamentos', DepartamentoController::class);

    // Organigrama
    Route::prefix('organigrama')->group(function () {
        // Visible para cualquier autenticado
        Route::get('/', [OrganigramaController::class, 'index']);
        Route::patch('/mi-subrogante', [OrganigramaController::class, 'actualizarMiSubrogante']);

        // Mutaciones estructurales: solo admin
        Route::middleware('role:admin')->group(function () {
            Route::post('/departamentos', [OrganigramaController::class, 'crearDepartamento']);
            Route::patch('/departamentos/{departamento}', [OrganigramaController::class, 'actualizarDepartamento']);
            Route::patch('/departamentos/{departamento}/parent', [OrganigramaController::class, 'actualizarParent']);
            Route::patch('/departamentos/{departamento}/jefe', [OrganigramaController::class, 'actualizarJefe']);
            Route::patch('/usuarios/{user}/departamento', [OrganigramaController::class, 'moverUsuarioDepartamento']);
        });
    });

    // Usuarios
    Route::prefix('users')->group(function () {
        Route::get('/funcionarios', [UserController::class, 'funcionarios']);
        Route::post('/{user}/activate', [UserController::class, 'activar']);
        Route::post('/{user}/change-password', [UserController::class, 'cambiarPassword']);
    });
    Route::apiResource('users', UserController::class);

    // Notificaciones
    Route::prefix('notificaciones')->group(function () {
        Route::get('/', [NotificacionController::class, 'index']);
        Route::get('/no-leidas', [NotificacionController::class, 'noLeidas']);
        Route::post('/{notificacion}/leer', [NotificacionController::class, 'marcarLeida']);
        Route::post('/leer-todas', [NotificacionController::class, 'marcarTodasLeidas']);
    });

    // =====================================================
    // MÓDULO CORRESPONDENCIA
    // =====================================================
    Route::prefix('correspondencia')->group(function () {
        Route::get('/alcalde-info', [CorrespondenciaController::class, 'getAlcaldeInfo']);
        Route::get('/estadisticas', [CorrespondenciaController::class, 'estadisticas']);
        Route::get('/bandeja', [CorrespondenciaController::class, 'bandeja']);
        Route::get('/search', [CorrespondenciaController::class, 'search']);
        Route::get('/{correspondencia}/providencia', [CorrespondenciaController::class, 'descargarProvidencia']);
    });
    Route::apiResource('correspondencia', CorrespondenciaController::class)
        ->parameters(['correspondencia' => 'correspondencia']);

    // Derivaciones
    Route::prefix('derivaciones')->group(function () {
        Route::get('/pendientes', [DerivacionController::class, 'pendientes']);
        Route::post('/{derivacion}/recibir', [DerivacionController::class, 'recibir']);
        Route::get('/{derivacion}/pdf', [DerivacionController::class, 'pdf']);
        Route::post('/{derivacion}/archivar', [DerivacionController::class, 'archivar']);
    });
    Route::apiResource('derivaciones', DerivacionController::class)->only(['index', 'store', 'show']);

    // Adjuntos
    Route::prefix('adjuntos')->group(function () {
        Route::post('/correspondencia/{correspondencia}', [AdjuntoController::class, 'subirCorrespondencia']);
        Route::delete('/{adjunto}', [AdjuntoController::class, 'eliminar']);
        Route::get('/{adjunto}/descargar', [AdjuntoController::class, 'descargar']);
    });

    // Plantillas de providencia
    Route::apiResource('plantillas', PlantillaController::class);

    // =====================================================
    // MÓDULO OIRS - Funcionarios (cualquier usuario autenticado)
    // Para funcionarios que tienen solicitudes asignadas
    // =====================================================
    Route::prefix('oirs-funcionario')->group(function () {
        Route::get('/mis-asignadas', [OirsFuncionarioController::class, 'misAsignadas']);
        Route::get('/estadisticas', [OirsFuncionarioController::class, 'estadisticas']);
        Route::get('/{oir}', [OirsFuncionarioController::class, 'show']);
        Route::post('/{oir}/responder', [OirsFuncionarioController::class, 'responderInterno']);
    });

    // =====================================================
    // MÓDULO OIRS (Admin) - Requiere rol 'admin' o 'oirs'
    // =====================================================
    Route::middleware('role:admin,oirs')->group(function () {
        Route::prefix('oirs')->group(function () {
            Route::get('/estadisticas', [OirsSolicitudController::class, 'estadisticas']);
            Route::get('/mis-asignadas', [OirsSolicitudController::class, 'misAsignadas']);
            Route::post('/{oir}/asignar', [OirsSolicitudController::class, 'asignar']);
            Route::post('/{oir}/responder', [OirsSolicitudController::class, 'responder']);
            Route::post('/{oir}/derivar', [OirsSolicitudController::class, 'derivar']);
            Route::post('/{oir}/cerrar', [OirsSolicitudController::class, 'cerrar']);
        });
        Route::apiResource('oirs', OirsSolicitudController::class);
    });

    // =====================================================
    // MÓDULO GESTOR DOCUMENTAL
    // =====================================================

    // Tipos documentales
    Route::apiResource('tipos-documentales', TipoDocumentalController::class);

    // Correlativos
    Route::prefix('correlativos')->group(function () {
        Route::get('/', [CorrelativoController::class, 'index']);
        Route::get('/{tipo}', [CorrelativoController::class, 'show']);
        Route::get('/{tipo}/siguiente', [CorrelativoController::class, 'siguiente']);
        Route::post('/{tipo}/reset', [CorrelativoController::class, 'reset']);
        Route::post('/', [CorrelativoController::class, 'crear']);
    });

    // Expedientes
    Route::prefix('expedientes')->group(function () {
        Route::get('/estadisticas', [ExpedienteController::class, 'estadisticas']);
        Route::get('/mis-expedientes', [ExpedienteController::class, 'misExpedientes']);
        Route::post('/{expediente}/cerrar', [ExpedienteController::class, 'cerrar']);
        Route::post('/{expediente}/reabrir', [ExpedienteController::class, 'reabrir']);
        Route::get('/{expediente}/indice-electronico', [ExpedienteController::class, 'indiceElectronico']);
        Route::get('/{expediente}/actividades', [ExpedienteController::class, 'actividades']);
        Route::post('/{expediente}/asociar-documento', [ExpedienteController::class, 'asociarDocumento']);
        Route::post('/{expediente}/subir-documento', [ExpedienteController::class, 'subirDocumento']);
        Route::put('/{expediente}/reordenar-documentos', [ExpedienteController::class, 'reordenarDocumentos']);
    });
    Route::apiResource('expedientes', ExpedienteController::class);

    // Documentos
    Route::prefix('documentos')->group(function () {
        Route::get('/estadisticas', [DocumentoController::class, 'estadisticas']);
        Route::get('/firma-config', [DocumentoController::class, 'firmaConfig']);
        Route::get('/pendientes-firma', [DocumentoController::class, 'pendientesFirma']);
        Route::get('/plantillas', [DocumentoController::class, 'getPlantillas']);
        Route::post('/previsualizar', [DocumentoController::class, 'previsualizarPlantilla']);
        Route::get('/proximo-correlativo', [DocumentoController::class, 'obtenerProximoCorrelativo']);
        Route::get('/{documento}/descargar', [DocumentoController::class, 'descargar']);
        Route::post('/{documento}/enviar-firma', [DocumentoController::class, 'enviarAFirma']);
        Route::post('/{documento}/firmar', [DocumentoController::class, 'firmar']);
        Route::post('/{documento}/rechazar-firma', [DocumentoController::class, 'rechazarFirma']);
        Route::post('/{documento}/agregar-firmante', [DocumentoController::class, 'agregarFirmante']);
        Route::get('/{documento}/trazabilidad', [DocumentoController::class, 'trazabilidad']);
    });
    Route::apiResource('documentos', DocumentoController::class);

    // Envíos de documentos
    Route::prefix('documento-envios')->group(function () {
        Route::get('/recibidos', [DocumentoEnvioController::class, 'recibidos']);
        Route::get('/enviados', [DocumentoEnvioController::class, 'enviados']);
        Route::post('/{envio}/acusar-recibo', [DocumentoEnvioController::class, 'acusarRecibo']);
    });
    Route::post('/documentos/{documento}/enviar', [DocumentoEnvioController::class, 'enviar']);
    Route::get('/documentos/{documento}/envios', [DocumentoEnvioController::class, 'estadoEnvio']);

    // Tipos documentales - endpoint adicional
    Route::get('tipos-documentales-activos', [TipoDocumentalController::class, 'activos']);

    // =====================================================
    // MÓDULO FONDOS CONCURSABLES (admin, fomento_productivo)
    // =====================================================
    Route::middleware('role:admin,fomento_productivo')->group(function () {
        Route::prefix('fondos-concursables')->group(function () {
            Route::get('/', [FondoConcursableController::class, 'index']);
            Route::post('/', [FondoConcursableController::class, 'store']);
            Route::get('/{fondoConcursable}', [FondoConcursableController::class, 'show']);
            Route::put('/{fondoConcursable}', [FondoConcursableController::class, 'update']);
            Route::post('/{fondoConcursable}/bases', [FondoConcursableController::class, 'subirBases']);
            Route::patch('/{fondoConcursable}/toggle-activo', [FondoConcursableController::class, 'toggleActivo']);
            Route::get('/{id}/postulaciones', [FondoConcursableController::class, 'postulaciones']);
            Route::get('/{id}/estadisticas', [FondoConcursableController::class, 'estadisticas']);
        });

        Route::prefix('postulaciones')->group(function () {
            Route::get('/{id}', [FondoConcursableController::class, 'showPostulacion']);
            Route::post('/{id}/evaluar', [FondoConcursableController::class, 'evaluar']);
            Route::post('/{id}/aprobar', [FondoConcursableController::class, 'aprobar']);
            Route::post('/{id}/rechazar', [FondoConcursableController::class, 'rechazar']);
            Route::get('/{id}/ficha', [FondoConcursableController::class, 'ficha']);
        });

        Route::get('/postulacion-adjuntos/{id}/descargar', [FondoConcursableController::class, 'descargarAdjunto']);
    });

    // =====================================================
    // =====================================================
    // ESTADO FIRMAGOB (cualquier usuario autenticado)
    // =====================================================
    Route::get('/firmagob/estado', [ConfiguracionController::class, 'firmagobEstado']);

    // =====================================================
    // CONFIGURACIÓN DEL SISTEMA (solo admin)
    // =====================================================
    Route::middleware('role:admin')->group(function () {
        Route::get('/configuracion', [ConfiguracionController::class, 'index']);
        Route::patch('/configuracion/{clave}', [ConfiguracionController::class, 'update']);
    });

    // MÓDULO SELLO DE FIRMA (admin)
    // =====================================================
    Route::middleware('role:admin')->group(function () {
        Route::prefix('firma-sellos')->group(function () {
            Route::get('/', [FirmaSelloController::class, 'index']);
            Route::post('/', [FirmaSelloController::class, 'store']);
            Route::post('/preview', [FirmaSelloController::class, 'preview']);
            Route::get('/{firmaSello}', [FirmaSelloController::class, 'show']);
            Route::put('/{firmaSello}', [FirmaSelloController::class, 'update']);
            Route::delete('/{firmaSello}', [FirmaSelloController::class, 'destroy']);
            Route::post('/{firmaSello}/logo', [FirmaSelloController::class, 'subirLogo']);
            Route::patch('/{firmaSello}/activar', [FirmaSelloController::class, 'activar']);
        });
    });
});
