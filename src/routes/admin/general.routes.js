const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // <-- Asegúrate de importar esto
const generalController = require('../../controllers/admin/general.controller.js');

// Importamos los middlewares de Multer
const { uploadLogo, upload } = require('../../config/multerconfig.js'); 
const { validateCsrf } = require('../../middlewares/csrf.js');

//Validacion de logo - crecion de empresa

const validateEmpresa = [
    body('nombre')
        .trim()
        .notEmpty().withMessage('El nombre de la empresa es obligatorio.')
        .isLength({ max: 150 }).withMessage('El nombre no puede exceder los 150 caracteres.'),
    body('direccion')
        .trim()
        .notEmpty().withMessage('La dirección es obligatoria.')
        .isLength({ max: 255 }).withMessage('La dirección no puede exceder los 255 caracteres.'),
    body('slug')
        .trim()
        .notEmpty().withMessage('El slug es obligatorio.')
        .isLength({ max: 50 }).withMessage('El slug no puede exceder los 50 caracteres.')
        .isSlug().withMessage('El slug contiene caracteres no válidos.'),

    // 2. Verificamos el resultado
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Si hay un error de validación, eliminamos el archivo que Multer pudo haber subido temporalmente
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Error al eliminar archivo temporal:", err);
                });
            }
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }
        next();
    }
];

const validateUserCreation = [
    body('nombres')
        .trim()
        .notEmpty().withMessage('El nombre completo es obligatorio.')
        .isLength({ max: 150 }).withMessage('El nombre no puede exceder los 150 caracteres.'),
    
    body('username')
        .trim()
        .notEmpty().withMessage('El username es obligatorio.')
        .isLength({ max: 50 }).withMessage('El username no puede exceder los 50 caracteres.')
        .isAlphanumeric().withMessage('El username solo puede contener letras y números.'),

    body('password')
        .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.'), // Simplificado para ser más claro
    
    body('tipo_usuario')
        .isIn(['Administrador', 'Cliente']).withMessage('El rol seleccionado no es válido.'),
    
    body('id_empresa_predeterminada').if(body('tipo_usuario').equals('Cliente'))
        .notEmpty().withMessage('Se debe seleccionar una empresa predeterminada para los clientes.'),
    
    body('empresas_asociadas').if(body('tipo_usuario').equals('Cliente'))
        .isArray({ min: 1 }).withMessage('Un cliente debe estar asociado al menos a una empresa.'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }
        next();
    }
];

// --- Rutas de Vistas (Renderizado de Páginas) ---
router.get("/menu", generalController.renderMenu);
router.get("/dashboard", generalController.renderDashboard);
router.get("/formularioempresa", generalController.renderFormularioEmpresa);
router.get("/administracioncon", generalController.renderAdministracionCon);
router.get("/valor_contrato", generalController.renderValorContrato);
router.get("/registroclie", generalController.renderRegistroClie);
router.get("/servicios", generalController.renderServicios);
router.get("/informescli", generalController.renderInformesCli);
router.get("/visualizarcontratos", generalController.renderVisualizarCons);
router.get("/visualizar_empresas", generalController.renderVisualizarEmpr);

// --- Rutas de API ---
router.get("/api/categorias/lista", generalController.getCategorias);

// === API: GESTIÓN DE EMPRESAS ===
router.get("/api/empresa/lista", generalController.getEmpresas);
router.get("/api/admin/companies", generalController.getCompaniesForAdminView);
router.post("/api/registrar-cliente", uploadLogo.single("logo"), validateCsrf, validateEmpresa,generalController.registrarCliente);
// === API: GESTIÓN DE USUARIOS ===
router.post("/api/register-user", validateCsrf, validateUserCreation, generalController.registrarUser);
router.get("/api/users", generalController.getUsers);
router.get("/api/users/sessions", generalController.getUserSessions);
router.put("/api/users/:id", validateCsrf, generalController.updateUserPassword);
router.delete("/api/users/:id", validateCsrf, generalController.deleteUser);
router.get('/api/user/:id/companies', generalController.getUserCompanyRelations);
router.post("/api/users/:id/logout", validateCsrf, generalController.forceLogoutUser);

// === API: GESTIÓN DE CONTRATOS ===
// Rutas específicas (sin parámetros) van PRIMERO
router.get("/api/contratos/lista", generalController.getContratos);
router.get("/api/contratos/template", generalController.downloadContractTemplate);

// Rutas genéricas (con parámetros como :id) van DESPUÉS
router.get("/api/contratos/empresa/:id", generalController.getContratosPorEmpresa);
router.get("/api/contratos/:id", generalController.getContratoById);
router.get('/api/contratos/:id/documentos', generalController.getDocumentosPorContrato);
router.get("/api/contratos/:id/servicios", generalController.getContratoServicios);

// Rutas POST, PUT, DELETE
router.post('/api/contratos', upload.fields([
    { name: 'contratos_pdf', maxCount: 10 },
    { name: 'guias_pdf', maxCount: 10 },
    { name: 'propuestas_pdf', maxCount: 10 }
]), validateCsrf, generalController.registrarContrato);
router.put('/api/contratos/:id', upload.fields([
    { name: 'contratos_pdf', maxCount: 10 },
    { name: 'guias_pdf', maxCount: 10 },
    { name: 'propuestas_pdf', maxCount: 10 }
]), validateCsrf, generalController.updateContrato);
router.post("/api/contratos/:id/servicios", validateCsrf, generalController.updateContratoServicios);
router.delete('/api/documentos/:id_doc', validateCsrf, generalController.eliminarDocumento);

// === API: IMPORTACIÓN MASIVA DE CONTRATOS ===
router.post("/api/contratos/bulk-insert", validateCsrf, generalController.bulkInsertContracts);

// === API: GESTIÓN DE SERVICIOS ===
router.get("/api/servicios", generalController.getServicios);
router.post("/api/servicios", validateCsrf, generalController.registrarServicio);

// === API: GESTIÓN DE INFORMES BI ===
router.get("/api/informes", generalController.getInformes);
router.post("/api/informes", validateCsrf, generalController.registrarInforme);
router.put("/api/informes/:id", validateCsrf, generalController.updateInforme);
router.delete("/api/informes/:id", validateCsrf, generalController.deleteInforme);

// == API: GESTION CONTRATOS PAGINA VISUALIZAR CONTRATOS == 
router.get("/api/admin/contracts", generalController.getContractsForAdminView);
router.get("/api/contratos/empresa/:id", generalController.getContratosPorEmpresa);
router.get("/contrato/:id", generalController.renderContractDetailView);
router.get("/api/contratos/:id", generalController.getContratoById);

// === API: DASHBOARD CHARTS ===
router.get("/api/dashboard-charts", generalController.getDashboardCharts);

// === API: VALORIZACIÓN DE CONTRATOS ===
router.get('/api/valorizacion/contratos', generalController.getContratosParaValorizar);
router.get('/api/valorizacion/contratos/:id', generalController.getDetallesParaValorizar);
router.post('/api/valorizacion/guardar', validateCsrf, generalController.guardarValorizacion);


// === API: ALERTAS MARKETING / COBERTURA ===
// ===== ALERTAS (ADMIN) =====
router.get('/api/alerts/missing-companies/:categoria', generalController.getMissingCompaniesByCategory);
router.post('/api/alerts', validateCsrf, generalController.createAlert);
router.get('/api/alerts', generalController.listAlerts);
router.get('/api/alerts/:id', generalController.getAlert);
router.put('/api/alerts/:id', validateCsrf, generalController.updateAlert);
router.put('/api/alerts/:id/toggle', validateCsrf, generalController.toggleAlert);
router.delete('/api/alerts/:id', validateCsrf, generalController.deleteAlert);

router.get('/api/documentos/descargar/:id_doc', generalController.descargarDocumento);


// Validated user creation route

module.exports = router;