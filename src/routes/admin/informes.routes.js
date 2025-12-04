// src/routes/admin/informes.routes.js

const express = require('express');
const router = express.Router();
const informesController = require('../../controllers/admin/informes.controller.js');

router.get('/', informesController.getInformesPaginados);
router.get('/stats', informesController.getInformeStats);
router.get('/empresas', informesController.getEmpresas);
router.get('/:id', informesController.getInformeDetalle);
router.get('/:id/pdf', informesController.generarInformePdf);

module.exports = router;