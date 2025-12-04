const express = require('express');
const router = express.Router();
const castiController = require('../../controllers/admin/casti.controller.js');
const { validateCsrf } = require('../../middlewares/csrf.js');

// --- Rutas de Vistas Principales ---
router.get('/', castiController.renderCastiMenu);
router.get('/dashboard', castiController.renderCastiDashboard);
router.get('/registro-piezas', castiController.renderRegistroPiezas);
router.get('/visualizarinformes', castiController.renderVisualizarInformes);
router.get('/actualizar-ticket', castiController.renderActualizarTicket);
router.get('/generar-reporte', castiController.renderGenerarReporte);
router.get('/vistas-tickets', castiController.renderVistasTickets);
router.get('/vistas-tickets-tv', castiController.renderVistasTicketsTv);
router.get('/consultar_info_ticket', castiController.renderconsultarInfoTicket);


// --- Rutas de API ---
// Nota: Estas rutas ahora serán /admin/casti/api/...
// Si quieres que sean /admin/api/..., tendríamos que crear un router de API separado.
// Por ahora, esta estructura es más simple y funciona bien.
router.get('/dashboard-summary', castiController.getDashboardSummary);
router.get('/fotos-por-ticket/:codigo', castiController.getFotosPorTicket);
router.get('/imagen/:ruta', castiController.obtenerImagen);  // ← Nuevo endpoint para servir imágenes
router.get('/casti-tickets', castiController.buscarTickets);
router.post('/casti-tickets', validateCsrf, castiController.createTicket);
router.get('/casti-tickets/lista', castiController.listarTicketsPaginados);
router.get('/casti-tickets/:id', castiController.DetalleTicket);
router.patch('/casti-tickets/:id', validateCsrf, castiController.ActualizarTicket);
router.delete('/casti-tickets/:id', validateCsrf, castiController.eliminarTicket);
router.get('/empresas-tickets', castiController.getEmpresasConTickets);
router.post('/casti-piezas', validateCsrf, castiController.AgregarPieza);
router.get('/equipos-por-empresa', castiController.FiltroEquiposPorEmpresa);
router.post('/generate-excel', validateCsrf, castiController.GenerarExcel);
router.get('/all-tickets-status', castiController.estadoTickets);

module.exports = router;