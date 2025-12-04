// En src/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // <-- 1. Importa las herramientas

// 2. Importamos el controlador
const authController = require('../controllers/auth.controller.js');
const { validateCsrf } = require('../middlewares/csrf.js');

// 3. Creamos el middleware de validación
const validateLogin = [
    // Validación para el campo 'username'
    body('username')
        .trim() // Elimina espacios en blanco al inicio y al final
        .notEmpty().withMessage('El nombre de usuario no puede estar vacío.')
        .isLength({ max: 50 }).withMessage('El nombre de usuario no puede exceder los 50 caracteres.'),

    // Validación para el campo 'password'
    body('password')
        .isLength({ max: 100 }).withMessage('La contraseña no puede exceder los 100 caracteres.'),
    
    // Función que procesa los resultados de la validación
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Si hay errores, enviamos una respuesta 400 (Bad Request) con los errores.
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }
        next(); // Si no hay errores, continuamos al controlador.
    }
];

// 4. Aplicamos el middleware a la ruta de login
router.post("/login", validateLogin, validateCsrf, authController.login); // <-- Se añade 'validateLogin' aquí

// El resto de tus rutas (check-session, logout) no cambian
router.get("/check-session", authController.checkSession);
router.get("/logout", authController.logout);

module.exports = router;