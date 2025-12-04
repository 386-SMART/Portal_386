// =================================================================
// ARCHIVO: server.js
// =================================================================
require("dotenv").config();

// ===============================================
// 1) MÓDULOS REQUERIDOS
// ===============================================
const express = require("express");
const path = require("path");
const session = require("express-session");
const rateLimit = require('express-rate-limit');
const db = require("./conexiondb"); // Solo si lo necesitas para alguna función que quede aquí
const MySQLStore = require('express-mysql-session')(session); 

const app = express();
app.set('trust proxy', 1);

// CREAMOS EL ALMACÉN PASÁNDOLE DIRECTAMENTE TU POOL DE CONEXIONES
const sessionStore = new MySQLStore({}, db); // El primer objeto puede estar vacío





// ===============================================
// 2) CONFIGURACIÓN Y MIDDLEWARES GLOBALES
// ===============================================

// Configuración del motor de vistas
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middlewares
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1d',
  etag: true
}));
app.use("/storage", express.static(path.join(__dirname, "storage"), {
  maxAge: '7d',
  etag: true
}));
// Límite de 50MB para coincidir con Nginx y soportar PDFs/imágenes grandes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: sessionStore, // <-- Usamos el almacén que creamos con tu pool
    cookie: { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8 // 8 horas
    },
  })
);

// CSRF Protection
const { generateCsrf, validateCsrf } = require('./src/middlewares/csrf.js');
app.use(generateCsrf);

// ===============================================
// 3) MIDDLEWARES PERSONALIZADOS (si aplican a múltiples routers)
// ===============================================
// (Es mejor moverlos a sus propios archivos en src/middlewares, 
//  pero por ahora está bien dejarlos aquí si funcionan)
async function loadTenant(req, res, next) { 

    const slug = req.params.slug;
  try {
    const [rows] = await db.execute(
      "SELECT id_empresa, nombre, logo, slug FROM Empresa WHERE slug = ?",
      [slug]
    );
    if (!rows.length)
      return res.status(404).render("shared/simplemessage", {
        title: "No Encontrado",
        message: "La empresa o página que buscas no existe.",
      });
    req.tenant = rows[0];
    req.empresaId = rows[0].id_empresa;
    next();
  } catch (err) {
    console.error("Error cargando tenant:", err);
    res.status(500).send("Error interno del servidor.");
  }
}

function ensureTenant(req, res, next) {
    // CORRECCIÓN: Usamos req.session.active_tenant para la validación
    if (!req.session.user || !req.session.active_tenant || req.session.active_tenant.id_empresa !== req.empresaId) {
        // Si el tenant activo en la sesión no coincide con el de la URL, lo redirigimos
        return res.redirect("/");
    }
    next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.tipo_usuario === "Administrador") return next();
  res.status(403).render("shared/simplemessage", {
    title: "Acceso Denegado",
    message: "No tienes los permisos necesarios para acceder a esta página.",
  });

 };


// ===============================================
// 4) RUTAS
// ===============================================

// --- Limitador de velocidad para el Login ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Demasiados intentos de inicio de sesión.' },
    standardHeaders: true,
    legacyHeaders: false, 
});
app.use('/api/login', loginLimiter);

// --- Carga de Routers Modulares ---
const authRoutes = require('./src/routes/auth.routes.js');
const publicRoutes = require('./src/routes/public.routes.js');
const adminRoutes = require('./src/routes/admin.routes.js');
const clientRoutes = require('./src/routes/client.routes.js');


// En server.js

// REEMPLAZA ESTA RUTA:
app.get("/", (req, res) => {
    if (req.session.user) {
        const user = req.session.user;
        const specialUsernames = ["SoporteTI", "CasTI", "Comercial"];

        if (user.tipo_usuario === "Administrador") {
            if (specialUsernames.includes(user.username)) {
                return res.redirect(`/admin/${user.username.toLowerCase()}`);
            } else {
                return res.redirect("/admin/menu");
            }
        } else {
            // CORRECCIÓN: Usamos req.session.active_tenant.slug en lugar de user.slug
            if (req.session.active_tenant && req.session.active_tenant.slug) {
                return res.redirect(`/${req.session.active_tenant.slug}/menu`);
            } else {
                // Caso de seguridad: si un cliente no tiene tenant activo, lo mandamos al login
                return res.redirect("/"); 
            }
        }
    }
    // Si no hay sesión, renderiza el login
    res.render("auth/login");
});


app.use('/api', authRoutes);
app.use('/', publicRoutes);
app.use('/admin', requireAdmin, adminRoutes);
app.use('/:slug', loadTenant, ensureTenant, clientRoutes);


const handleMulterError = require('./src/middlewares/handleMulterError.js');
app.use(handleMulterError);


// ===============================================
// 5) MANEJO DE 404 Y ARRANQUE DEL SERVIDOR
// ===============================================
app.use((req, res) => {
  res.status(404).render("shared/simplemessage", {
    title: "Página no Encontrada",
    message: "La ruta a la que intentas acceder no existe.",
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});