// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();

// ELIMINAMOS LA IMPORTACIÓN DE MULTER AQUÍ PORQUE NO SE USA
// const upload = require('../../src/config/multerConfig.js');

// Importamos los sub-routers
const generalRoutes = require('./admin/general.routes.js');
const soportesRoutes = require('./admin/soporteti.routes.js');
const castiRoutes = require('./admin/casti.routes.js'); 
const comercialRoutes = require('./admin/comercial.routes.js')
const informesRoutes = require('./admin/informes.routes.js');

router.use('/', generalRoutes);
router.use('/soporteti', soportesRoutes); 
router.use('/casti', castiRoutes);
router.use('/comercial', comercialRoutes )
router.use('/api/informes-de-campo', informesRoutes);

module.exports = router;