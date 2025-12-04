// src/controllers/auth.controller.js
const db = require("../../conexiondb");
const bcrypt = require("bcrypt");

const checkSession = (req, res) => {
    // Esta lógica se simplifica, ahora solo depende de la sesión activa
    if (req.session.user && req.session.active_tenant) {
        const user = req.session.user;
        let redirectPath;

        if (user.tipo_usuario === "Administrador") {
            redirectPath = "/admin/menu"; // Los admins siempre van al menú de admin
        } else {
            redirectPath = `/${req.session.active_tenant.slug}/menu`;
        }
        res.json({ success: true, redirectPath: redirectPath });
    } else {
        res.json({ success: false });
    }
};

// En src/controllers/auth.controller.js

const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.execute(
            `SELECT u.id_usuario, u.nombre, u.password, u.tipo_usuario, u.username, 
                    e.id_empresa, e.logo, e.slug, e.nombre AS empresaName
             FROM Login u 
             JOIN Empresa e ON u.id_empresa_predeterminada = e.id_empresa 
             WHERE u.username = ?`,
            [username]
        );

        if (!rows.length)
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });

        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ success: false, message: "Credenciales incorrectas" });

        // Store user data to be saved in the new session
        const userData = {
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            tipo_usuario: user.tipo_usuario,
            username: user.username,
        };

        const activeTenantData = {
            id_empresa: user.id_empresa,
            logo: user.logo,
            slug: user.slug,
            empresaName: user.empresaName,
        };

        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
            if (err) {
                console.error("Error regenerating session:", err);
                return res.status(500).json({ success: false, message: "Error interno del servidor." });
            }

            // Set session data on the new session
            req.session.user = userData;
            req.session.active_tenant = activeTenantData;
            
            // --- INICIO DE LA CORRECCIÓN ---
            // Volvemos a añadir la lógica completa para redirigir a cada tipo de usuario
            let redirectPath;
            const specialUsernames = ["SoporteTI", "CasTI", "Comercial"];

            if (user.tipo_usuario === "Administrador") {
                if (specialUsernames.includes(user.username)) {
                    // Es un admin especial
                    redirectPath = `/admin/${user.username.toLowerCase()}`;
                } else {
                    // Es un admin normal
                    redirectPath = "/admin/menu";
                }
            } else {
                // Es un cliente
                redirectPath = `/${req.session.active_tenant.slug}/menu`;
            }
            // --- FIN DE LA CORRECCIÓN ---

            res.json({ success: true, redirectPath });
        });

    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
};


const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err)
            return res.status(500).json({ success: false, message: "Error al cerrar sesión." });
        
        res.clearCookie("connect.sid");
        // No es necesario borrar la sesión de la tabla 'sessions' manualmente, express-mysql-session lo hace.
        res.json({ success: true });
    });
};

module.exports = {
    checkSession,
    login,
    logout,
};