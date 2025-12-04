const express = require('express');
const clientController = require('../controllers/client.controller.js');
const { uploadLogo } = require('../config/multerconfig.js');
const { validateCsrf } = require('../middlewares/csrf.js');

// ¡MUY IMPORTANTE! mergeParams: true permite que este router
// acceda a los parámetros de la ruta padre, en este caso el ':slug'.
const router = express.Router({ mergeParams: true });

// --- Rutas de Vistas ---
router.get("/menu", clientController.renderMenu);
router.get("/informes", clientController.renderInformes);
router.get("/inicio", clientController.renderInicio);
router.get("/perfil", clientController.renderPerfil);
router.get("/incidencias", clientController.renderIncidencias);
router.get("/contratos", clientController.renderContratos);
router.get("/contactos-ti", clientController.renderContactosTi);
router.get("/implementacion", clientController.renderImplementacion);
router.get("/mantenimiento", clientController.renderMantenimiento);
router.get("/devolucion", clientController.renderDevolucion);

// --- Rutas de API ---
router.get('/api/equipos-por-modelo', clientController.getEquiposPorModelo);
router.get('/api/dashboard-summary', clientController.getDashboardSummary);
router.get('/api/contract-dashboard/:id', clientController.getContractDashboard);
router.patch('/api/profile/name', validateCsrf, clientController.updateProfileName);
router.patch('/api/profile/password', validateCsrf, clientController.updateProfilePassword);
router.post('/api/profile/logo', uploadLogo.single('logo'), validateCsrf, clientController.updateProfileLogo);
router.patch('/api/profile/details', validateCsrf, clientController.updateProfileDetails);
router.get("/api/contactos-ti", clientController.getContactosTi);
router.post("/api/contactos-ti", validateCsrf, clientController.createContactoTi);
router.patch("/api/contactos-ti/:id", validateCsrf, clientController.updateContactoTi);
router.delete("/api/contactos-ti/:id", validateCsrf, clientController.deleteContactoTi);
router.get('/api/informes-de-campo', clientController.getInformesDeCampo);
router.get('/api/piezas-solicitadas', clientController.getPiezasSolicitadas);
router.get('/api/informes-de-campo/:id/pdf', clientController.generateInformePdf);

router.post('/api/asistente/action', clientController.handleAssistantQueryButtons);

router.get('/api/incidencias-kpis', clientController.getIncidenciasKpis);
router.post('/api/switch-tenant', validateCsrf, clientController.switchTenant);
router.get('/api/equipos-por-categoria',clientController.getEquiposPorCategoria);

router.get('/api/marketing-alerts', clientController.getMarketingAlerts);
router.get('/api/alerts', clientController.getActiveAlertsForCompany);


// para grafico interactivo equipos por categoria detalle
router.get('/api/equipos-por-categoria', clientController.getEquiposPorCategoria);
router.get('/api/equipos-por-categoria-detalle', clientController.getEquiposPorCategoriaDetalle); // <--- AÑADE ESTA LÍNEA


module.exports = router;