const { randomBytes } = require('crypto');

// Middleware to generate and attach CSRF token
function generateCsrf(req, res, next) {
    if (req.session.csrfToken) {
        res.locals.csrfToken = req.session.csrfToken;
    } else {
        const token = randomBytes(32).toString('hex');
        req.session.csrfToken = token;
        res.locals.csrfToken = token;
    }
    next();
}

// Middleware to validate CSRF token
function validateCsrf(req, res, next) {
    // We only validate for non-GET/HEAD/OPTIONS methods
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }

    // Support token in different locations:
    // 1. req.body._csrf (object with _csrf property)
    // 2. req.body[0]._csrf (array of objects with _csrf property)
    // 3. x-csrf-token header (always works)
    let bodyToken = null;
    
    if (req.body) {
        if (typeof req.body === 'object' && !Array.isArray(req.body)) {
            // Es un objeto: busca _csrf
            bodyToken = req.body._csrf;
        } else if (Array.isArray(req.body) && req.body[0] && req.body[0]._csrf) {
            // Es un array: busca en primer elemento
            bodyToken = req.body[0]._csrf;
        }
    }
    
    const headerToken = req.headers['x-csrf-token'];
    
    const tokenFromRequest = bodyToken || headerToken;
    const tokenFromSession = req.session.csrfToken;

    if (!tokenFromRequest || !tokenFromSession || tokenFromRequest !== tokenFromSession) {
        console.warn('Invalid CSRF token received.');
        console.warn('Token from request:', tokenFromRequest);
        console.warn('Token from session:', tokenFromSession);
        console.warn('Headers:', req.headers);
        return res.status(403).send('Acceso denegado: Token CSRF inválido o ausente.');
    }

    next();
}

module.exports = { generateCsrf, validateCsrf };