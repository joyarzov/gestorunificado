<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\CorrespondenciaController;
use App\Http\Controllers\DerivacionController;
use App\Http\Controllers\AdjuntoController;
use App\Http\Controllers\DepartamentoController;
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

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    // Departamentos
    Route::apiResource('departamentos', DepartamentoController::class);

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
        Route::get('/estadisticas', [CorrespondenciaController::class, 'estadisticas']);
        Route::get('/bandeja', [CorrespondenciaController::class, 'bandeja']);
        Route::get('/search', [CorrespondenciaController::class, 'search']);
    });
    Route::apiResource('correspondencia', CorrespondenciaController::class);

    // Derivaciones
    Route::prefix('derivaciones')->group(function () {
        Route::get('/pendientes', [DerivacionController::class, 'pendientes']);
        Route::post('/{derivacion}/recibir', [DerivacionController::class, 'recibir']);
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
    });
    Route::apiResource('expedientes', ExpedienteController::class);

    // Documentos
    Route::prefix('documentos')->group(function () {
        Route::get('/estadisticas', [DocumentoController::class, 'estadisticas']);
        Route::get('/pendientes-firma', [DocumentoController::class, 'pendientesFirma']);
        Route::get('/plantillas', [DocumentoController::class, 'getPlantillas']);
        Route::post('/previsualizar', [DocumentoController::class, 'previsualizarPlantilla']);
        Route::get('/proximo-correlativo', [DocumentoController::class, 'obtenerProximoCorrelativo']);
        Route::get('/{documento}/descargar', [DocumentoController::class, 'descargar']);
        Route::post('/{documento}/enviar-firma', [DocumentoController::class, 'enviarAFirma']);
        Route::post('/{documento}/firmar', [DocumentoController::class, 'firmar']);
        Route::post('/{documento}/rechazar-firma', [DocumentoController::class, 'rechazarFirma']);
        Route::post('/{documento}/agregar-firmante', [DocumentoController::class, 'agregarFirmante']);
    });
    Route::apiResource('documentos', DocumentoController::class);

    // Tipos documentales - endpoint adicional
    Route::get('tipos-documentales-activos', [TipoDocumentalController::class, 'activos']);
});
