// src/middlewares/tecnicoAuth.middleware.js

// Middleware para proteger rutas que requieren autenticación de técnico
function requireTecnicoAuth(req, res, next) {
    if (req.session.usuarioTecnicoId) {
        next(); // El usuario tiene sesión, puede continuar.
    } else {
        res.redirect('/acceso-tecnico'); // No tiene sesión, se va al login.
    }
}

// Middleware para la página de login
function redirectIfTecnicoAuth(req, res, next) {
    if (req.session.usuarioTecnicoId) {
        // Si ya está logueado, lo mandamos al menú central.
        res.redirect('/menu-central');
    } else {
        next(); // No está logueado, puede ver la página de login.
    }
}

module.exports = {
    requireTecnicoAuth,
    redirectIfTecnicoAuth
};