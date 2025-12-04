// src/controllers/client.controller.js 

const db = require('../../conexiondb');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const pdfHelper = require('../helpers/pdfmake-helper.js');
const { generateInformePdfDefinition } = require('../helpers/pdf-informe-generator.js');
const sharp = require('sharp');


const ejs = require('ejs');
const MAX_TI_CONTACTS = 10;

const Contract = require('../models/contract.model.js');




// --- Controladores para renderizar vistas ---

const renderMenu = async (req, res) => {
    const base = `/${req.tenant.slug}`;
    const menuItems = [
        { label: "Inicio", path: `${base}/inicio`, icon: "bi bi-speedometer2" },
        { label: "Acuerdos", path: `${base}/contratos`, icon: "bi bi-file-earmark-text-fill" },
        { label: "Reportes", path: `${base}/informes`, icon: "bi bi-clipboard2-data" },
        { label: "Incidencias", path: `${base}/incidencias`, icon: "bi bi-exclamation-diamond" },
        { label: "Mantenimiento", path: `${base}/mantenimiento`, icon: "bi bi-clipboard-pulse" },
        { label: "Implementación", path: `${base}/implementacion`, icon: "bi bi-box-arrow-in-right" },
        { label: "Devolución", path: `${base}/devolucion`, icon: "bi bi-box-arrow-in-left" },
        { label: "Mi Perfil", path: `${base}/perfil`, icon: "bi bi-person-circle" },
        { label: "Contactos TI", path: `${base}/contactos-ti`, icon: "bi bi-person-rolodex" },

    ];
    const [userCompanies] = await db.execute(`
        SELECT e.id_empresa, e.nombre, e.slug 
        FROM Usuario_Empresas ue
        JOIN Empresa e ON ue.id_empresa = e.id_empresa
        WHERE ue.id_usuario = ?
        ORDER BY e.nombre ASC
    `, [req.session.user.id_usuario]);

    res.render("clients/menu", {
        user: req.session.user, 
        menuItems: menuItems, 
        tenant: req.tenant, 
        isAdmin: false,
        userCompanies: userCompanies, // <-- Pasamos la lista a la vista
        activeTenant: req.session.active_tenant // <-- Pasamos la empresa activa
    });
};


const renderInicio = (req, res) => {
    const csrfToken = res.locals.csrfToken || req.session.csrfToken || '';
    console.log('[renderInicio] CSRF Token being sent to view:', csrfToken);
    res.render("clients/inicio", { tenant: req.tenant, user: req.session.user, csrfToken });
};
const renderMantenimiento = (req, res) => res.render("clients/mantenimiento", { tenant: req.tenant, user: req.session.user });
const renderImplementacion = (req, res) => res.render("clients/implementacion", { tenant: req.tenant, user: req.session.user });
const renderDevolucion = (req, res) => res.render("clients/devolucion", { tenant: req.tenant, user: req.session.user });




const renderInformes = async (req, res) => {
    try {
        const [informes] = await db.execute(
            "SELECT Url_Informe, fecha_creacion FROM Informes WHERE id_empresa = ? ORDER BY fecha_creacion DESC",
            [req.empresaId]
        );
        res.render("clients/informes", {
            informes: informes,
            tenant: req.tenant,
            user: req.session.user,
        });
    } catch (err) {
        console.error("Error al cargar los informes del cliente:", err);
        res.status(500).send("Error al cargar la página de informes.");
    }
};



const renderPerfil = (req, res) => {
    res.render("clients/perfil", { 
        user: req.session.user, 
        tenant: req.tenant, // tenant sigue siendo útil aquí
        activeTenant: req.session.active_tenant // <-- ¡ASEGÚRATE DE PASAR ESTO!
    });
};
const renderIncidencias = (req, res) => res.render("clients/incidencias", { user: req.session.user, tenant: req.tenant });

const renderContratos = async (req, res) => {
  try {
    const contratos = await Contract.getContractsByCompany(req.empresaId);

    // Calcular estado del contrato
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const contratosConEstado = contratos.map(contrato => {
      let estado = { texto: 'Vigente', color: 'success' };
      if (contrato.fecha_fin) {
        const fechaFin = new Date(contrato.fecha_fin);
        const diffDias = (fechaFin - hoy) / (1000 * 60 * 60 * 24);
        if (diffDias < 0) {
          estado = { texto: 'Vencido', color: 'danger' };
        } else if (diffDias <= 45) {
          estado = { texto: 'Próximo a Vencer', color: 'warning' };
        }
      }
      return { ...contrato, estado };
    });

    res.render("clients/contratos", { 
      contratos: contratosConEstado, 
      tenant: req.tenant, 
      user: req.session.user 
    });
  } catch (err) {
    console.error("Error al cargar contratos del cliente:", err);
    res.status(500).send("Error al cargar la página.");
  }
};


const renderContactosTi = async (req, res) => {
    try {
        const [contacts] = await db.execute("SELECT * FROM Client_Ti WHERE id_empresa = ?", [req.empresaId]);
        res.render("clients/contactos-ti", {
            contacts: contacts,
            limit: 10, // MAX_TI_CONTACTS
            user: req.session.user,
            tenant: req.tenant,
            csrfToken: req.session.csrfToken,
        });
    } catch (error) {
        res.status(500).send("Error al cargar la página.");
    }
};


// ---/////////////////////// Controladores de API ---

const getEquiposPorModelo = async (req, res) => { 
    const { empresaId } = req; // Obtenido del middleware
    const { modelo } = req.query;

    if (!modelo) {
        return res.status(400).json({ success: false, message: 'El modelo es requerido.' });
    }

    try {
        const [equipos] = await db.execute(`
            SELECT eq.num_serie, eq.estado, eq.caracteristicas 
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            WHERE c.id_empresa = ? AND eq.modelo = ?
        `, [empresaId, modelo]);
        
        res.json({ success: true, data: equipos });

    } catch (error) {
        console.error("Error obteniendo equipos por modelo:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};
// --- FUNCIÓN DE API COMPLETAMENTE CORREGIDA ---

// --- Reemplaza tu función de API con esta versión corregida ---

// Reemplaza esta función completa en tu archivo: src/controllers/client.controller.js

const getDashboardSummary = async (req, res) => {
    try {
        const { empresaId } = req;
        console.log('>>> [Dashboard API] ID de Empresa:', empresaId);

        // --- KPIs (Sin cambios) ---
        const [[{ totalContratos }]] = await db.execute(`SELECT COUNT(*) as totalContratos FROM Contrato WHERE id_empresa = ?`, [empresaId]);
        const [[{ totalInventario }]] = await db.execute(`SELECT COUNT(eq.id_equipo) as totalInventario FROM Equipo eq JOIN Contrato c ON eq.id_contrato = c.id_contrato WHERE c.id_empresa = ?`, [empresaId]);
        const [[{ totalEquipos }]] = await db.execute(`SELECT COUNT(eq.id_equipo) as totalEquipos FROM Equipo eq JOIN Contrato c ON eq.id_contrato = c.id_contrato JOIN Categoria cat ON eq.id_categoria = cat.id_categoria WHERE c.id_empresa = ? AND cat.nombre NOT IN ('PERIFERICOS', 'ACCESORIOS', 'BACKUP')`, [empresaId]);
        const [[{ count: visitasUltimos30d }]] = await db.execute(`SELECT COUNT(ic.id_informe) as count FROM InformeCampo ic JOIN Equipo eq ON ic.id_equipo = eq.id_equipo JOIN Contrato c ON eq.id_contrato = c.id_contrato WHERE c.id_empresa = ? AND ic.fecha_servicio >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, [empresaId]);
        const [[{ count: visitasPeriodoAnterior }]] = await db.execute(`SELECT COUNT(ic.id_informe) as count FROM InformeCampo ic JOIN Equipo eq ON ic.id_equipo = eq.id_equipo JOIN Contrato c ON eq.id_contrato = c.id_contrato WHERE c.id_empresa = ? AND ic.fecha_servicio BETWEEN DATE_SUB(NOW(), INTERVAL 60 DAY) AND DATE_SUB(NOW(), INTERVAL 31 DAY)`, [empresaId]);
        const diferenciaVisitas = visitasUltimos30d - visitasPeriodoAnterior;

        // --- Gráficos ---

        // ===== INICIO DE LA ACTUALIZACIÓN =====
        const [resumenModelos] = await db.execute(`
            SELECT 
                eq.modelo, 
                COUNT(eq.id_equipo) as cantidad 
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Categoria cat ON eq.id_categoria = cat.id_categoria -- 1. Unimos con la tabla Categoria
            WHERE c.id_empresa = ? 
              AND eq.modelo IS NOT NULL AND eq.modelo != '' 
              AND cat.nombre NOT IN ('PERIFERICOS', 'ACCESORIOS') -- 2. Excluimos las categorías no deseadas
            GROUP BY eq.modelo 
            ORDER BY cantidad DESC 
            LIMIT 7
        `, [empresaId]);
        // ===== FIN DE LA ACTUALIZACIÓN =====

        const [visitasPorMes] = await db.execute(`SELECT DATE_FORMAT(ic.fecha_servicio, '%Y-%m') as mes, COUNT(ic.id_informe) as cantidad FROM InformeCampo ic JOIN Equipo eq ON ic.id_equipo = eq.id_equipo JOIN Contrato c ON eq.id_contrato = c.id_contrato WHERE c.id_empresa = ? AND ic.fecha_servicio >= DATE_SUB(NOW(), INTERVAL 12 MONTH) GROUP BY mes ORDER BY mes ASC`, [empresaId]);

        const crearTendencia = (dif) => {
            if (dif > 0) return { tendenciaTexto: `+${dif} vs periodo anterior`, tendenciaClase: 'text-success', tendenciaIcono: 'bi-arrow-up-right' };
            if (dif < 0) return { tendenciaTexto: `${dif} vs periodo anterior`, tendenciaClase: 'text-danger', tendenciaIcono: 'bi-arrow-down-right' };
            return { tendenciaTexto: 'Estable', tendenciaClase: 'text-secondary', tendenciaIcono: null };
        };

        // --- RESPUESTA (Sin cambios) ---
        res.json({
            success: true,
            data: {
                kpiContratos: { valor: totalContratos },
                kpiInventario: { valor: totalInventario },
                kpiEquipos: { valor: totalEquipos },
                kpiVisitas: { valor: visitasUltimos30d, ...crearTendencia(diferenciaVisitas) },
                resumenModelos,
                visitasPorMes
            },
        });

    } catch (error) {
        console.error("Error en getDashboardSummary:", error);
        res.status(500).json({ success: false, message: 'Error al obtener los datos.' });
    }
};


const getContractDashboard = async (req, res) => {
    const { id } = req.params;
    const { empresaId } = req; // Get the company ID from the request object
     
    try {
        // --- INICIO DE LA ACTUALIZACIÓN ---
        
        // 1. Obtenemos el contrato principal y VALIDAMOS la pertenencia
        const [[contrato]] = await db.execute(`
  SELECT c.*, cr.nombre_contrato AS nombre_contrato_relacionado
  FROM Contrato c
  LEFT JOIN Contrato cr ON c.id_relacion = cr.id_contrato
  WHERE c.id_contrato = ? AND c.id_empresa = ?
`, [id, empresaId]);

        if (!contrato) {
            return res.status(404).json({ success: false, message: 'Contrato no encontrado o no pertenece a su empresa.' });
        }

        // 2. Hacemos las consultas para el dashboard que ya tenías
        const [
  [[{ total_inventario }]],
  [[{ total_equipos }]],
  [[{ total_visitas }]],
  [categorias],
  [modelos],
  [lista_equipos]
] = await Promise.all([
  // TOTAL INVENTARIO
  db.execute("SELECT COUNT(*) as total_inventario FROM Equipo WHERE id_contrato = ?", [id]),
  
  // TOTAL EQUIPOS (excluyendo categorías)
  db.execute(`
    SELECT COUNT(eq.id_equipo) as total_equipos
    FROM Equipo eq
    LEFT JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
    WHERE eq.id_contrato = ?
    AND cat.nombre NOT IN ('PERIFERICOS', 'ACCESORIOS', 'BACKUP')
  `, [id]),

  // VISITAS TÉCNICAS (totales)
  db.execute(`
    SELECT COUNT(ic.id_informe) as total_visitas
    FROM InformeCampo ic
    JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
    WHERE eq.id_contrato = ?
  `, [id]),

  // Gráficos
  db.execute("SELECT cat.nombre, COUNT(eq.id_equipo) as cantidad FROM Equipo eq JOIN Categoria cat ON eq.id_categoria = cat.id_categoria WHERE eq.id_contrato = ? GROUP BY cat.nombre", [id]),
  db.execute("SELECT modelo, COUNT(id_equipo) as cantidad FROM Equipo WHERE id_contrato = ? AND modelo IS NOT NULL AND modelo != '' GROUP BY modelo", [id]),
  db.execute(`SELECT eq.*, cat.nombre as categoria_nombre FROM Equipo eq LEFT JOIN Categoria cat ON eq.id_categoria = cat.id_categoria WHERE eq.id_contrato = ?`, [id])
]);

      


        // 3. Buscamos los servicios adicionales asociados
        const [serviciosAsociados] = await db.execute(`
            SELECT s.nombre_servicio 
            FROM Contrato_Servicios cs 
            JOIN Servicios s ON cs.id_servicio = s.id_servicio 
            WHERE cs.id_contrato = ?
        `, [id]);

        const [documentos] = await db.execute(`
            SELECT tipo_documento, nombre_original, ruta_archivo, tamano_bytes 
            FROM Documentos_Contrato 
            WHERE id_contrato = ? 
            ORDER BY tipo_documento, nombre_original
        `, [id]);

        // 4. Combinamos todos los servicios en una sola lista
        const serviciosIncluidos = [];
        if (contrato.implementacion) serviciosIncluidos.push("Implementación de Equipos");
        if (contrato.mantenimiento) serviciosIncluidos.push("Mantenimiento Preventivo/Correctivo");
        if (contrato.devolucion_de_equipos) serviciosIncluidos.push("Devolución de Equipos");
        if (contrato.preparacion_de_imagen) serviciosIncluidos.push("Preparación de Imagen");
        
        serviciosAsociados.forEach(s => serviciosIncluidos.push(s.nombre_servicio));
        
        
        // --- FIN DE LA ACTUALIZACIÓN ---

        res.json({
  success: true,
  data: {
    contrato,
    kpis: { 
      totalInventario: total_inventario, 
      totalEquipos: total_equipos, 
      totalVisitas: total_visitas 
    },
    graficoCategorias: categorias,
    graficoModelos: modelos,
    listaEquipos: lista_equipos,
    serviciosIncluidos,
    documentos
  }
});

    } catch (error) {
        console.error("Error al obtener datos del dashboard de contrato:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};





// === NUEVA FUNCIÓN: Gráfico de Equipos por Categoría ===
const getEquiposPorCategoria = async (req, res) => {
  try {
    const { empresaId } = req;

    const [categorias] = await db.execute(`
      SELECT cat.nombre AS categoria, COUNT(eq.id_equipo) AS cantidad
      FROM Equipo eq
      JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
      JOIN Contrato c ON eq.id_contrato = c.id_contrato
      WHERE c.id_empresa = ?
      GROUP BY cat.nombre
      ORDER BY cantidad DESC
    `, [empresaId]);

    res.json({ success: true, data: categorias });
  } catch (error) {
    console.error("Error al obtener equipos por categoría:", error);
    res.status(500).json({ success: false, message: "Error al obtener los datos." });
  }
};





// =================================================================
// --- VERSIÓN FINAL CORREGIDA PARA KPIs DE INCIDENCIAS ---
// =================================================================
const getIncidenciasKpis = async (req, res) => {
    try {
        const { empresaId } = req;

        // KPI 1: Contar tickets de servicio únicos
        const [[{ totalIncidencias }]] = await db.execute(
            `SELECT COUNT(DISTINCT cas.Codigo_Aranda) as totalIncidencias 
             FROM InformeCampo ic
             JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
             JOIN Contrato c ON eq.id_contrato = c.id_contrato
             LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass 
             WHERE c.id_empresa = ?`, 
            [empresaId]
        );

        // KPI 2: Contar técnicos distintos
        const [[{ tecnicosActivos }]] = await db.execute(
            `SELECT COUNT(DISTINCT ic.id_tecnico) as tecnicosActivos 
             FROM InformeCampo ic
             JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
             JOIN Contrato c ON eq.id_contrato = c.id_contrato 
             WHERE c.id_empresa = ?`, 
            [empresaId]
        );

        // KPI 3: Contar el total de piezas solicitadas (Consulta Corregida)
        // Se cambia COUNT(tps.id_ticket_pieza) por COUNT(*)
        const [[{ piezasSolicitadas }]] = await db.execute(
            `SELECT COUNT(*) as piezasSolicitadas 
             FROM Ticket_Piezas_Solicitadas tps
             JOIN CasTi cas ON tps.id_cass = cas.Id_cass
             WHERE cas.id_empresa = ?`, 
            [empresaId]
        );

        res.json({
            success: true,
            data: { 
                totalIncidencias: totalIncidencias || 0, 
                tecnicosActivos: tecnicosActivos || 0, 
                piezasSolicitadas: piezasSolicitadas || 0 
            }
        });

    } catch (error) {
        console.error("Error al generar KPIs de incidencias:", error);
        res.status(500).json({ success: false, message: 'Error al obtener los datos.' });
    }
};

const updateProfileName = async (req, res) => { 
    const { nombre } = req.body;
    if (!nombre) {
        return res.status(400).json({ success: false, message: 'El nombre es requerido.' });
    }
    try {
        await db.execute("UPDATE Login SET nombre = ? WHERE id_usuario = ?", [nombre, req.session.user.id_usuario]);
        req.session.user.nombre = nombre; // Actualizar la sesión
        res.json({ success: true, message: 'Nombre actualizado con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
 };

const updateProfilePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Todos los campos son requeridos.' });
    }
    try {
        const [[user]] = await db.execute("SELECT password FROM Login WHERE id_usuario = ?", [req.session.user.id_usuario]);
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(403).json({ success: false, message: 'La contraseña actual es incorrecta.' });
        }
        const newHash = await bcrypt.hash(newPassword, 10);
        await db.execute("UPDATE Login SET password = ? WHERE id_usuario = ?", [newHash, req.session.user.id_usuario]);
        res.json({ success: true, message: 'Contraseña cambiada con éxito.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// En src/controllers/client.controller.js
// Reemplaza esta función completa:

const updateProfileLogo = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se ha seleccionado ningún archivo.' });
    }

    try {
        const slugLimpio = req.params.slug.replace(/\s+/g, '_');
        const fileName = `${slugLimpio}-${Date.now()}.png`;
        const filePath = path.join(__dirname, `../../public/img/logo_cliente/${fileName}`);
        
        await sharp(req.file.buffer)
            .resize({ width: 400, height: 400, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png({ quality: 90 })
            .toFile(filePath);
            
        // --- INICIO DE LA CORRECCIÓN ---
        // Obtenemos el ID de la empresa desde 'active_tenant', no desde 'user'
        const empresaId = req.session.active_tenant.id_empresa;

        await db.execute("UPDATE Empresa SET logo = ? WHERE id_empresa = ?", [fileName, empresaId]);
        
        // Actualizamos también el logo en la sesión activa
        req.session.active_tenant.logo = fileName;
        // --- FIN DE LA CORRECCIÓN ---
        
        res.json({ success: true, message: 'Logo actualizado con éxito.', newLogo: fileName });
    } catch (error) {
        console.error("Error actualizando logo:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const updateProfileDetails = async (req, res) => {
    const { nombre, username } = req.body;
    const { id_usuario } = req.session.user;

    if (!nombre || !username) {
        return res.status(400).json({ success: false, message: 'El nombre y el nombre de usuario son requeridos.' });
    }

    try {
        // Verificar si el nuevo username ya está en uso por OTRO usuario
        const [existingUser] = await db.execute(
            "SELECT id_usuario FROM Login WHERE username = ? AND id_usuario != ?",
            [username, id_usuario]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ success: false, message: 'Ese nombre de usuario ya está en uso. Por favor, elige otro.' });
        }

        // Si está disponible, actualizar los datos
        await db.execute("UPDATE Login SET nombre = ?, username = ? WHERE id_usuario = ?", [nombre, username, id_usuario]);
        
        // Actualizar la sesión
        req.session.user.nombre = nombre;
        req.session.user.username = username;
        
        res.json({ success: true, message: 'Datos actualizados con éxito.' });

    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
 };

const getContactosTi = async (req, res) => { 
  const [contacts] = await db.execute("SELECT * FROM Client_Ti WHERE id_empresa = ?", [req.empresaId]);
    res.json({ success: true, data: contacts, count: contacts.length, limit: MAX_TI_CONTACTS });
 };

const createContactoTi = async (req, res) => { 
    const [[{ count }]] = await db.execute("SELECT COUNT(*) as count FROM Client_Ti WHERE id_empresa = ?", [req.empresaId]);
    if (count >= MAX_TI_CONTACTS) {
        return res.status(403).json({ success: false, message: `Límite de ${MAX_TI_CONTACTS} contactos alcanzado.` });
    }
    const { Nombre, Cel, Correo } = req.body;
    await db.execute("INSERT INTO Client_Ti (id_empresa, Nombre, Cel, Correo) VALUES (?, ?, ?, ?)", [req.empresaId, Nombre, Cel, Correo]);
    res.status(201).json({ success: true, message: 'Contacto creado con éxito.' });
};

const updateContactoTi = async (req, res) => {
    const { Nombre, Cel, Correo } = req.body;
    await db.execute("UPDATE Client_Ti SET Nombre = ?, Cel = ?, Correo = ? WHERE id_ti_usuario = ? AND id_empresa = ?", [Nombre, Cel, Correo, req.params.id, req.empresaId]);
    res.json({ success: true, message: 'Contacto actualizado con éxito.' });
 };

const deleteContactoTi = async (req, res) => {
    await db.execute("DELETE FROM Client_Ti WHERE id_ti_usuario = ? AND id_empresa = ?", [req.params.id, req.empresaId]);
    res.json({ success: true, message: 'Contacto eliminado con éxito.' });
 };

const getInformesDeCampo = async (req, res) => {
    try {
        const { empresaId } = req;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        
        // Filtros opcionales
        const { serie, ticket, fecha } = req.query;
        
        let whereConditions = ['c.id_empresa = ?'];
        let params = [empresaId];
        
        if (serie) {
            whereConditions.push('eq.num_serie LIKE ?');
            params.push(`%${serie}%`);
        }
        
        if (ticket) {
            whereConditions.push('cas.Codigo_Aranda LIKE ?');
            params.push(`%${ticket}%`);
        }
        
        if (fecha) {
            whereConditions.push('DATE(ic.fecha_servicio) = ?');
            params.push(fecha);
        }
        
        const whereClause = whereConditions.join(' AND ');

        const countSql = `
            SELECT COUNT(*) as total 
            FROM InformeCampo ic
            JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            WHERE ${whereClause}`;
        const [[{ total }]] = await db.execute(countSql, params);
        const totalPages = Math.ceil(total / limit);

        const sql = `
            SELECT 
                ic.id_informe, ic.fecha_servicio, eq.num_serie, 
                CONCAT(tec.nombre, ' ', tec.apellido) as tecnico_nombre,
                COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda
            FROM InformeCampo ic
            JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            JOIN Tecnicos tec ON ic.id_tecnico = tec.id_tecnico
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            WHERE ${whereClause}
            ORDER BY ic.fecha_servicio DESC 
            LIMIT ${limit} OFFSET ${offset}`;
        
        const [informes] = await db.execute(sql, params);

        res.json({
            success: true, 
            data: informes,
            pagination: { totalPages, currentPage: page }
        });
    } catch (error) {
        console.error("Error al obtener informes para el cliente:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
 };

const getPiezasSolicitadas = async (req, res) => { 
    try {
        const { empresaId } = req;
        const sql = `
            SELECT 
                COALESCE(cp.nombre_pieza, tps.nombre_pieza_manual) as pieza,
                COUNT(*) as cantidad
            FROM Ticket_Piezas_Solicitadas tps
            JOIN CasTi cas ON tps.id_cass = cas.Id_cass
            LEFT JOIN Catalogo_Piezas cp ON tps.id_pieza = cp.id_pieza
            WHERE cas.id_empresa = ? AND COALESCE(cp.nombre_pieza, tps.nombre_pieza_manual) IS NOT NULL
            GROUP BY pieza
            ORDER BY cantidad DESC;
        `;
        const [piezas] = await db.execute(sql, [empresaId]);
        res.json({ success: true, data: piezas });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
 };

const generateInformePdf = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) OBTENER DATOS
    const sql = `
      SELECT ic.*, 
             eq.modelo, eq.num_serie, eq.part_number, 
             em.id_empresa, em.nombre as empresa_nombre, em.logo as empresa_logo, em.direccion as empresa_direccion, 
             ct.nombre_contrato, 
             tec.nombre as tecnico_nombre, tec.apellido as tecnico_apellido, 
             COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda, 
             COALESCE(ic.numero_pedido_manual, cas.Numero_Pedido) as Numero_Pedido, 
             uf.nombre as uf_nombre, uf.cel as uf_cel, uf.correo as uf_correo, 
             cti.Nombre as cti_nombre, cti.Cel as cti_cel, cti.Correo as cti_correo
      FROM InformeCampo ic
      LEFT JOIN Equipo eq       ON ic.id_equipo = eq.id_equipo
      LEFT JOIN Tecnicos tec    ON ic.id_tecnico = tec.id_tecnico
      LEFT JOIN Contrato ct     ON eq.id_contrato = ct.id_contrato
      LEFT JOIN Empresa em      ON ct.id_empresa = em.id_empresa
      LEFT JOIN CasTi cas       ON ic.id_casti = cas.Id_cass
      LEFT JOIN Usuario_final uf ON ic.firmante_id = uf.id_usuario_final AND ic.firmante_type = 'Usuario_final'
      LEFT JOIN Client_Ti cti    ON ic.firmante_id = cti.id_ti_usuario AND ic.firmante_type = 'Client_Ti'
      WHERE ic.id_informe = ?`;
    const [[informe]] = await db.execute(sql, [id]);
    if (!informe) return res.status(404).send('Informe no encontrado');

    // 2) SEGURIDAD POR EMPRESA (El cliente solo ve sus propios informes)
    if (parseInt(req.empresaId, 10) !== parseInt(informe.id_empresa, 10)) {
      return res.status(403).send('Acceso denegado. No tiene permiso para ver este informe.');
    }

    // 4) OBTENER FOTOS
    const [fotosDB] = await db.execute('SELECT ruta_archivo FROM InformeFotos WHERE id_informe = ?', [id]);
    const projectRoot = path.join(__dirname, '../../');

    const imageToBase64 = (filePath) => {
      if (!filePath || !fs.existsSync(filePath)) {
        console.warn(`Imagen no encontrada: ${filePath}`);
        return null;
      }
      const img = fs.readFileSync(filePath);
      return `data:image/jpeg;base64,${Buffer.from(img).toString('base64')}`;
    };

    const logo386Base64 = imageToBase64(path.join(projectRoot, 'public/img/logo_cliente/logo386azul.png'));
    const clienteLogoBase64 = imageToBase64(
      informe.empresa_logo ? path.join(projectRoot, 'public/img/logo_cliente', informe.empresa_logo) : null
    );

    // Convertir firmas a Base64
    let firmaUsuarioBase64 = null;
    let firmaTecnicoBase64 = null;
    
    if (informe.firma_usuario) {
      let firmaPath = null;
      
      // Si es Base64, usarlo directamente
      if (informe.firma_usuario.startsWith('data:image')) {
        firmaUsuarioBase64 = informe.firma_usuario;
      } else {
        // Construir la ruta completa desde storage
        firmaPath = path.join(projectRoot, 'storage', informe.firma_usuario);
        
        if (fs.existsSync(firmaPath)) {
          firmaUsuarioBase64 = imageToBase64(firmaPath);
        } else {
          console.warn(`⚠️ Firma usuario no encontrada: ${firmaPath}`);
        }
      }
    }
    
    if (informe.firma_tecnico) {
      let firmaPath = null;
      
      // Si es Base64, usarlo directamente
      if (informe.firma_tecnico.startsWith('data:image')) {
        firmaTecnicoBase64 = informe.firma_tecnico;
      } else {
        // Construir la ruta completa desde storage
        firmaPath = path.join(projectRoot, 'storage', informe.firma_tecnico);
        
        if (fs.existsSync(firmaPath)) {
          firmaTecnicoBase64 = imageToBase64(firmaPath);
        } else {
          console.warn(`⚠️ Firma técnico no encontrada: ${firmaPath}`);
        }
      }
    }

    const fotosBase64 = fotosDB
      .map(f => {
        let filePath;
        if (f.ruta_archivo.includes('uploads')) {
          const fileName = path.basename(f.ruta_archivo);
          filePath = path.join(projectRoot, 'storage/informes', fileName);
        } else {
          filePath = path.join(projectRoot, 'storage', f.ruta_archivo);
        }
        return imageToBase64(filePath);
      })
      .filter(Boolean);

    // 5) GENERAR DEFINICIÓN DEL PDF USANDO EL HELPER (AHORA CON FIRMAS)
    const docDefinition = generateInformePdfDefinition(informe, fotosBase64, {
      logo386Base64,
      clienteLogoBase64,
      firmaUsuarioBase64,      // ← AGREGADO
      firmaTecnicoBase64       // ← AGREGADO
    });

    // 6) GENERAR Y DESCARGAR PDF
    const pdfBuffer = await pdfHelper.createPdf(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CVT-${String(informe.id_informe).padStart(4, '0')}.pdf"`);
    res.send(pdfBuffer);  } catch (error) {
    console.error('Error al generar el PDF para el cliente:', error);
    res.status(500).send('Error al generar el PDF.');
  }
};

// BOT LOCAL FUNCIONES

// REEMPLAZA ESTA FUNCIÓN COMPLETA EN TU ARCHIVO client.controller.js

const executeIntent = async (intent, payload, empresaId, slug) => {
    let responseMessage = "No he podido entender tu solicitud. Por favor, intenta con otra opción.";
    let isHtml = false;

    switch (intent) {
        case 'GET_CONTRACT_COUNT': {
            const [[{ total }]] = await db.execute("SELECT COUNT(*) as total FROM Contrato WHERE id_empresa = ?", [empresaId]);
            responseMessage = `📋 Actualmente tienes <strong>${total}</strong> contrato(s) activo(s).`;
            isHtml = true;
            break;
        }
        case 'GET_EXPIRING_CONTRACTS': {
            const [contratos] = await db.execute(`SELECT nombre_contrato, fecha_fin FROM Contrato WHERE id_empresa = ? AND fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) ORDER BY fecha_fin ASC`, [empresaId]);
            if (contratos.length > 0) {
                isHtml = true;
                responseMessage = '<strong>⚠️ Contratos próximos a vencer (60 días):</strong><ul>' + contratos.map(c => `<li><strong>${c.nombre_contrato}</strong><br><small>Vence: ${new Date(c.fecha_fin).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</small></li>`).join('') + '</ul>';
            } else {
                responseMessage = "✅ ¡Buenas noticias! Ninguno de tus contratos vence en los próximos 60 días.";
            }
            break;
        }
        case 'GET_TOTAL_EQUIPMENT': {
            const [[{ total }]] = await db.execute(`SELECT COUNT(eq.id_equipo) as total FROM Equipo eq JOIN Contrato c ON eq.id_contrato = c.id_contrato WHERE c.id_empresa = ?`, [empresaId]);
            responseMessage = `💻 Tienes un total de <strong>${total}</strong> equipos registrados en tus contratos.`;
            isHtml = true;
            break;
        }
        case 'GET_LAST_VISITS': {
            const [visitas] = await db.execute(`
                SELECT ic.id_informe, ic.fecha_servicio, eq.modelo, eq.num_serie
                FROM InformeCampo ic
                JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
                JOIN Contrato c ON eq.id_contrato = c.id_contrato
                WHERE c.id_empresa = ?
                ORDER BY ic.fecha_servicio DESC
                LIMIT 5
            `, [empresaId]);

            if (visitas.length > 0) {
                isHtml = true;
                responseMessage = '<strong>🔧 Últimas 5 visitas técnicas:</strong><ul>' + visitas.map(v => `<li><strong>Informe #${v.id_informe}</strong><br><small>${new Date(v.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} • ${v.modelo || 'Modelo N/A'}</small></li>`).join('') + '</ul>';
            } else {
                responseMessage = "📭 No se han registrado visitas técnicas recientemente.";
            }
            break;
        }
        case 'SEARCH_REPORT_BY_SERIAL': {
            const serial = payload.serial;
            if (!serial) {
                responseMessage = "⚠️ Por favor, proporciona un número de serie para realizar la búsqueda.";
                break;
            }

            const [[equipo]] = await db.execute(`
                SELECT e.id_equipo 
                FROM Equipo e
                JOIN Contrato c ON e.id_contrato = c.id_contrato
                WHERE e.num_serie = ? AND c.id_empresa = ?
            `, [serial, empresaId]);

            if (!equipo) {
                responseMessage = `❌ No se encontró ningún equipo con el número de serie "<strong>${serial}</strong>" en tu inventario.`;
                isHtml = true;
                break;
            }

            const [informes] = await db.execute(`
                SELECT ic.id_informe, ic.fecha_servicio, ic.estado_equipo 
                FROM InformeCampo ic 
                WHERE ic.id_equipo = ?
                ORDER BY ic.fecha_servicio DESC
            `, [equipo.id_equipo]);
            
            if (informes.length > 0) {
                isHtml = true;
                const listaInformes = informes.map(i => 
                    `<li><a href="/${slug}/api/informes-de-campo/${i.id_informe}/pdf" target="_blank">📄 Informe #${i.id_informe}</a><br><small>${new Date(i.fecha_servicio).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} • Estado: ${i.estado_equipo}</small></li>`
                ).join('');
                responseMessage = `<strong>🔍 Informe(s) encontrado(s) para N/S ${serial}:</strong><ul>${listaInformes}</ul>`;
            } else {
                responseMessage = `⚠️ El equipo con N/S "<strong>${serial}</strong>" existe en tu inventario, pero aún no tiene informes de servicio registrados.`;
                isHtml = true;
            }
            break;
        }
    }
    return { message: responseMessage, isHtml };
};

// La función handleAssistantQueryButtons se mantiene casi igual, solo le quitamos la dependencia de la otra función
// Reemplaza esta función completa
const handleAssistantQueryButtons = async (req, res) => {
    const { intent, payload } = req.body;
    const { empresaId } = req;
    try {
        console.log(`[Asistente] Usando botón de acción rápida: ${intent}`);
        // Le pasamos el slug del tenant activo a la función executeIntent
        const finalResponse = await executeIntent(intent, payload, empresaId, req.tenant.slug); // <-- AÑADE req.tenant.slug
        res.json({ success: true, ...finalResponse });
    } catch (error) {
        console.error(`Error en el asistente para el intent '${intent}':`, error);
        res.status(500).json({ success: false, message: 'Hubo un error al procesar tu solicitud.' });
    }
};











//nuevas funciones login... 

const switchTenant = async (req, res) => {
    const { new_empresa_id } = req.body;
    const { id_usuario } = req.session.user;

    if (!new_empresa_id) {
        return res.status(400).json({ success: false, message: 'ID de empresa no proporcionado.' });
    }

    try {
        // 1. Verificación de seguridad: ¿Tiene el usuario acceso a esta empresa?
        const [[access]] = await db.execute(
            'SELECT COUNT(*) as count FROM Usuario_Empresas WHERE id_usuario = ? AND id_empresa = ?',
            [id_usuario, new_empresa_id]
        );

        if (access.count === 0) {
            return res.status(403).json({ success: false, message: 'Acceso denegado a esta empresa.' });
        }

        // 2. Obtener los datos de la nueva empresa
        const [[newTenant]] = await db.execute(
            'SELECT id_empresa, logo, slug, nombre AS empresaName FROM Empresa WHERE id_empresa = ?',
            [new_empresa_id]
        );
        
        if (!newTenant) {
            return res.status(404).json({ success: false, message: 'La empresa seleccionada no existe.' });
        }

        // 3. Actualizar la sesión con la nueva empresa activa
        req.session.active_tenant = {
            id_empresa: newTenant.id_empresa,
            logo: newTenant.logo,
            slug: newTenant.slug,
            empresaName: newTenant.empresaName,
        };

        // 4. Responder con éxito y el nuevo slug para la redirección
        res.json({ success: true, new_slug: newTenant.slug });

    } catch (error) {
        console.error('Error al cambiar de empresa:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};


// === CLIENTE: Alertas activas dirigidas a su empresa ===
const getMarketingAlerts = async (req, res) => {
  try {
    const { empresaId } = req;
    const [rows] = await db.execute(`
      SELECT a.id_alerta, a.categoria_servicio, a.severity, a.title, a.message,
             a.cta_label, a.cta_url, a.start_at, a.end_at, a.created_at
      FROM Marketing_Alert a
      JOIN Marketing_Alert_Target t ON t.id_alerta = a.id_alerta
      WHERE t.id_empresa = ?
        AND a.active = 1
        AND (a.start_at IS NULL OR a.start_at <= NOW())
        AND (a.end_at   IS NULL OR a.end_at   >= NOW())
      ORDER BY FIELD(a.severity,'danger','warning','info'), a.created_at DESC
    `, [empresaId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getMarketingAlerts', err);
    res.status(500).json({ success: false, message: 'No se pudieron obtener las alertas.' });
  }
};

// src/controllers/client.controller.js
// src/controllers/client.controller.js
const getActiveAlertsForCompany = async (req, res) => {
  try {
    const { empresaId } = req;

    // Categorías que YA tiene contratadas la empresa (para filtrar si quisieras)
    const [catsCliente] = await db.execute(`
      SELECT DISTINCT s.categoria_servicio
      FROM Contrato c
      JOIN Contrato_Servicios cs ON cs.id_contrato = c.id_contrato
      JOIN Servicios s ON s.id_servicio = cs.id_servicio
      WHERE c.id_empresa = ?
    `, [empresaId]);
    const tiene = new Set(catsCliente.map(x => x.categoria_servicio));

    // Alertas activas y vigentes que fueron dirigidas a esta empresa
    const [alerts] = await db.execute(`
      SELECT a.*
      FROM Marketing_Alert a
      JOIN Marketing_Alert_Target t ON t.id_alerta = a.id_alerta
      WHERE t.id_empresa = ?
        AND a.active = 1
        AND (a.start_at IS NULL OR a.start_at <= NOW())
        AND (a.end_at   IS NULL OR a.end_at   >= NOW())
      ORDER BY a.created_at DESC
    `, [empresaId]);

    // (Opcional) Si quieres además ocultar categorías que el cliente YA tiene, descomenta:
    // const data = alerts.filter(a => !tiene.has(a.categoria_servicio));
    const data = alerts;

    res.json({ success: true, data });
  } catch (e) {
    console.error('getActiveAlertsForCompany', e);
    res.status(500).json({ success: false });
  }
};




///////////// GRAFICO INTERACTIVO PARA EQUIPOS POR CATEGORIA /////////////

// NUEVA FUNCIÓN DE API PARA EL DETALLE DE CATEGORÍAS
// NUEVA FUNCIÓN DE API PARA EL DETALLE DE CATEGORÍAS
const getEquiposPorCategoriaDetalle = async (req, res) => {
    const { empresaId } = req;
    const { categoria } = req.query;

    if (!categoria) {
        return res.status(400).json({ success: false, message: 'La categoría es requerida.' });
    }

    try {
        const [equipos] = await db.execute(`
            SELECT eq.modelo, eq.num_serie, eq.estado, eq.caracteristicas 
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
            WHERE c.id_empresa = ? AND cat.nombre = ?
            ORDER BY eq.modelo, eq.num_serie
        `, [empresaId, categoria]);
        
        res.json({ success: true, data: equipos });

    } catch (error) {
        console.error("Error obteniendo equipos por categoría (detalle):", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};



// --- EXPORTACIONES ---

module.exports = {
    renderMenu,
    renderInformes,
    renderInicio,
    renderPerfil,
    renderIncidencias,
    renderContratos,
    renderContactosTi,
    getEquiposPorModelo,
    getDashboardSummary,
    getContractDashboard,
    getIncidenciasKpis, // <--- AÑADE ESTA LÍNEA
    updateProfileName,
    updateProfilePassword,
    updateProfileLogo,
    updateProfileDetails,
    getContactosTi,
    createContactoTi,
    updateContactoTi,
    deleteContactoTi,
    getInformesDeCampo,
    getPiezasSolicitadas,
    generateInformePdf,
    switchTenant,
    renderImplementacion,
    renderMantenimiento,
    renderDevolucion,
    getEquiposPorCategoria,
    getEquiposPorCategoria,
    getEquiposPorCategoriaDetalle,

    // Funciones del Asistente
  
   handleAssistantQueryButtons,
    getMarketingAlerts,
    getActiveAlertsForCompany
};