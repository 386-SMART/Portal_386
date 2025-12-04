const express = require('express');
const router = express.Router();
const comercialController = require('../../controllers/admin/comercial.controller');

// --- Rutas de Vistas Principales ---
router.get('/', comercialController.rendercomercialMenu);




module.exports = router;