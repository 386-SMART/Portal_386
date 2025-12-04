// src/routes/admin/soporteti.routes.js

const express = require('express');
const router = express.Router();
const soportesController = require('../../controllers/admin/soporteti.controller.js');
const { uploadXlsx, uploadFirma } = require('../../config/multerconfig.js');
const { validateCsrf } = require('../../middlewares/csrf.js');

// --- Rutas para Renderizar Vistas ---
router.get("/", soportesController.renderSoporteMenu);
router.get("/soportedashboard", soportesController.renderSoporteDashboard);
router.get("/soporteregistroequi", soportesController.renderSoporteRegistroEqui);
router.get("/soportesubida_dat", soportesController.renderSoporteSubida_Dat);
router.get("/soportemigracion", soportesController.renderSoporteMigracion);
router.get("/soportevisitati", soportesController.renderSoporteVisitaTi);
router.get("/soportedevolucion", soportesController.renderSoporteDevolucion);
router.get("/soporteimplementacion", soportesController.renderSoporteImplementacion);
router.get("/soportemantenimiento", soportesController.renderSoporteMantenimiento);
router.get('/gestion-tecnicos', soportesController.renderGestionTecnicos);
router.get('/inventario', soportesController.renderInventarioGeneral);

// --- Rutas de API de Soporte TI ---

// API para Equipos Temporales

router.post('/temporal-equipos', validateCsrf, soportesController.registrarEquipoTemporal);
router.post('/temporal-equipos/bulk', validateCsrf, soportesController.registroMasivoTemporal);
router.get('/temporal-equipos/summary', soportesController.getResumenTemporal);

// API para Carga Masiva (Excel)
router.get('/template/equipos', soportesController.generarPlantillaEquipos);
router.post('/upload/validate', uploadXlsx.single('archivoExcel'), soportesController.validarExcel);

// API para Migración de Equipos
router.post('/equipos/migrate', validateCsrf, soportesController.migrarEquipos);
router.get('/empresas-con-temporales', soportesController.getEmpresasConTemporales);
router.get('/contratos-con-temporales/:empresaId', soportesController.getContratosConTemporales);

// API para Gestión de Técnicos (CRUD)
// ⚠️ IMPORTANTE: multer DEBE ejecutarse ANTES de validateCsrf
router.get('/tecnicos', soportesController.getTecnicos);
router.post('/tecnicos', 
    uploadFirma.single('firma_tecnico'),  // Primero procesa el archivo
    validateCsrf,                          // Luego valida CSRF
    soportesController.createTecnico       // Finalmente el controlador
);
router.patch('/tecnicos/:id', 
    uploadFirma.single('firma_tecnico'),  // Primero procesa el archivo
    validateCsrf,                          // Luego valida CSRF
    soportesController.updateTecnico       // Finalmente el controlador
);
router.delete('/tecnicos/:id', validateCsrf, soportesController.deleteTecnico);

// API para Gestión de Usuarios Cliente (PARA TÉCNICOS)
router.get('/usuarios-cliente', soportesController.getUsuariosCliente);
router.post('/usuarios-cliente', validateCsrf, soportesController.createUsuarioCliente);
router.patch('/usuarios-cliente/:id', validateCsrf, soportesController.updateUsuarioCliente);
router.delete('/usuarios-cliente/:id', validateCsrf, soportesController.deleteUsuarioCliente);





// API para Dashboard de Soporte
router.get('/dashboard-summary', soportesController.getSoporteSummary);

// === API para Inventario General ===
router.get('/api/inventario/lista', soportesController.getInventarioPaginado);
router.get('/api/inventario/estadisticas', soportesController.getEstadisticasInventario);
router.get('/api/inventario/graficos', soportesController.getGraficosInventario);
router.get('/api/inventario/empresas', soportesController.getEmpresasInventario);
router.get('/api/inventario/detalle/:id', soportesController.getDetalleEquipo);

module.exports = router;