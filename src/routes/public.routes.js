// src/routes/public.routes.js

const express = require('express');
const router = express.Router();

// --- 1. IMPORTAMOS TODO LO QUE NECESITAMOS ---

// Importamos los controladores con la lógica
const publicController = require('../controllers/public.controller.js');

// Importamos los middlewares de autenticación para técnicos
const { requireTecnicoAuth, redirectIfTecnicoAuth } = require('../middlewares/tecnicoAuth.middleware.js');

// Importamos la configuración de Multer para la subida de archivos
const { informeUploads } = require('../config/multerconfig.js');
const { validateCsrf } = require('../middlewares/csrf.js');


// --- 2. DEFINIMOS LAS RUTAS Y LAS CONECTAMOS ---

// Grupo A: Rutas para la Vista de TV pública
router.get('/public-view/:token', publicController.showPublicView);
router.get('/public-api/all-tickets-status/:token', publicController.getPublicTicketStatus);
//routas para redirigir a whatsapp
router.get('/whatsapp', publicController.redirectToWhatsapp);

// Grupo B: Rutas para el Portal de Técnicos
router.get('/acceso-tecnico', redirectIfTecnicoAuth, publicController.showTecnicoLogin);
router.post('/acceso-tecnico', validateCsrf, publicController.processTecnicoLogin);
router.get('/menu-central', requireTecnicoAuth, publicController.showMenuCentral);
router.get('/informe-de-campo', requireTecnicoAuth, publicController.showInformeCampo);
router.get('/mis-informes', requireTecnicoAuth, publicController.showMisInformes);
router.get('/logout-tecnico', publicController.processTecnicoLogout);


// Grupo C: Rutas para la API Pública de apoyo al formulario de informe
router.get('/api/public/buscar-equipo/:serie', publicController.buscarEquipoPorSerie);
router.get('/api/public/buscar-casti', publicController.buscarCasTI);
router.get('/api/public/contactos-ti/:empresaId', publicController.buscarTI_empresa);
router.get('/api/public/usuarios-finales/:empresaId', publicController.listarUsuariosFinales);
router.get('/api/public/tecnicos', publicController.PublicTecnicos);
router.get('/api/public/tecnico/:id/firma', publicController.getTecnicoFirma);
router.get('/api/public/mis-informes', requireTecnicoAuth, publicController.getMisInformes);
router.get('/api/public/empresas', requireTecnicoAuth, publicController.getEmpresasList);
router.get('/api/public/informe/:id/previa', requireTecnicoAuth, publicController.getInformeDetalleParaPrevia);
router.post('/api/public/usuario-final', validateCsrf, publicController.PublicUsuarioFinal);

// --- CAMBIO CLAVE AQUÍ ---
// Cambiamos .array('fotos', 5) por .any()
// Esto permite recibir 'foto_general', 'foto_uefi', 'foto_pieza1', etc. sin errores.
router.post('/api/public/guardar-informe', informeUploads.any(), validateCsrf, publicController.guardarInforme);
router.get('/api/public/informe/:id/pdf', requireTecnicoAuth, publicController.generarInformePdfTecnico);

//routas para redirigir a whatsapp
router.get('/whatsapp', publicController.redirectToWhatsapp);


// --- 3. EXPORTAMOS EL ROUTER ---
module.exports = router;