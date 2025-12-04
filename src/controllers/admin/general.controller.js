// src/controllers/admin/general.controller.js

const db = require('../../../conexiondb'); // ruta ajustada db
const bcrypt = require('bcrypt');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const upload = require('../../config/multerconfig'); // Asegúrate de que la ruta es correcta
const exceljs = require('exceljs');
const STORAGE_PATH = path.join(__dirname, '..', '..', '..', 'storage');


const renderMenu = (req, res) => {
  const menuItems = [
    { label: "Panel", path: "/admin/dashboard", icon: "bi bi-speedometer2" },
    { label: "Empresa", path: "/admin/visualizar_empresas", icon: "bi bi-building-add" },
    { label: "Contratos", path: "/admin/visualizarcontratos", icon: "bi bi-clipboard-fill" },
    { label: "Finanzas", path: "/admin/valor_contrato", icon: "bi bi-coin" },
    { label: "Usuarios", path: "/admin/registroclie", icon: "bi bi-person-fill-add" },
    { label: "Servicios", path: "/admin/servicios", icon: "bi bi-journal-bookmark-fill" },
    { label: "Informes", path: "/admin/informescli", icon: "bi bi-clipboard2-data" },

  ];
  res.render("admins/menu", {
    user: req.session.user,
    menuItems,
    isAdmin: true,
  });
};

// En tu archivo: src/controllers/admin/general.controller.js

const renderDashboard = async (req, res) => {
  try {
    // 1. Obtener KPIs (sin cambios)
    const [[{ totalEmpresas }]] = await db.execute("SELECT COUNT(*) AS totalEmpresas FROM Empresa");
    const [[{ totalUsuarios }]] = await db.execute("SELECT COUNT(*) AS totalUsuarios FROM Login");
    const [[{ totalContratos }]] = await db.execute("SELECT COUNT(*) AS totalContratos FROM Contrato");

    // 2. Obtener contratos a vencer (sin cambios)
    const [proximosContratosDB] = await db.execute(`
            SELECT c.nombre_contrato, c.fecha_fin, e.nombre AS empresa 
            FROM Contrato c
            JOIN Empresa e ON c.id_empresa = e.id_empresa 
            WHERE c.fecha_fin IS NOT NULL
            AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 45 DAY)
            ORDER BY c.fecha_fin ASC
        `);

    // 3. Calcular los días restantes para cada contrato (sin cambios)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const proximosContratos = proximosContratosDB.map(c => {
      const fechaFin = new Date(c.fecha_fin);
      const diffTime = fechaFin.getTime() - hoy.getTime();
      const dias_restantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { ...c, dias_restantes: dias_restantes >= 0 ? dias_restantes : 0 };
    });

    // 4. Renderizar la vista (ya no se pasa 'nuevasEmpresasPorMes')
    res.render("admins/dashboard", {
      user: req.session.user,
      totalEmpresas: totalEmpresas || 0,
      totalUsuarios: totalUsuarios || 0,
      totalContratos: totalContratos || 0,
      proximosContratos // Pasar la lista de contratos mejorada
    });

  } catch (err) {
    console.error("Error cargando datos de Dashboard:", err);
    res.status(500).send("Error interno al cargar el Dashboard");
  }
};

// Funciones genéricas para renderizar páginas simples
const renderFormularioEmpresa = (req, res) => res.render("admins/formularioempresa", { user: req.session.user });
const renderAdministracionCon = (req, res) => res.render("admins/administracioncon", { user: req.session.user });
const renderValorContrato = (req, res) => res.render("admins/valor_contrato", { user: req.session.user });
const renderRegistroClie = (req, res) => res.render("admins/registroclie", { user: req.session.user });
const renderServicios = (req, res) => res.render("admins/servicios", { user: req.session.user });
const renderVisualizarCons = (req, res) => res.render("admins/visualizarcontratos", { user: req.session.user });
const renderVisualizarEmpr = (req, res) => res.render("admins/visualizar_empresas", { user: req.session.user });





const renderInformesCli = (req, res) => {
  // Construir URL automáticamente desde el request
  let host = req.hostname;
  let protocol = req.protocol;
  
  // Respetar X-Forwarded-Proto si viene de un proxy (ngrok, etc)
  if (req.get('X-Forwarded-Proto')) {
    protocol = req.get('X-Forwarded-Proto');
  }
  
  // Respetar X-Forwarded-Host si viene de un proxy
  if (req.get('X-Forwarded-Host')) {
    host = req.get('X-Forwarded-Host');
  }
  
  const tecnicoLink = `${protocol}://${host}/acceso-tecnico`;

  res.render("admins/informescli", {
    user: req.session.user,
    tecnicoLink: tecnicoLink
  });
};
// apis

const getCategorias = async (req, res) => {
  try {
    const [categorias] = await db.execute(
      "SELECT id_categoria, nombre FROM Categoria ORDER BY nombre"
    );
    res.json({ success: true, data: categorias });
  } catch (err) {
    console.error("Error en /api/categorias/lista:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener las categorías." });
  }
};

const getEmpresas = async (req, res) => {
  try {
    const [empresas] = await db.execute(
      "SELECT id_empresa, nombre FROM Empresa ORDER BY nombre"
    );
    res.json({ success: true, data: empresas });
  } catch (err) {
    console.error("Error en /api/empresa/lista:", err);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener la lista de empresas.",
    });
  }
};
// === API: GESTIÓN DE USUARIOS ===

// En src/controllers/admin/general.controller.js
// Reemplaza esta función completa:

const registrarCliente = async (req, res) => {
  const { nombre, direccion, slug } = req.body;

  if (!nombre || !direccion || !slug || !req.file) {
    return res.status(400).json({
      success: false,
      message: "Todos los campos son obligatorios, incluyendo el logo.",
    });
  }

  try {
    const slugLimpio = slug.replace(/\s+/g, '_');
    const fileName = `${slugLimpio}-${Date.now()}.png`; // Siempre guardamos como PNG
    const filePath = path.join(__dirname, `../../../public/img/logo_cliente/${fileName}`);

    // --- INICIO DE LA MEJORA CON SHARP ---
    // Vamos a forzar un tamaño específico y añadir relleno transparente si es necesario.
    await sharp(req.file.buffer)
      .resize({
        width: 400,
        height: 400,
        fit: 'cover'
      })
      .png({ quality: 90 }) // Forzamos el formato a PNG
      .toFile(filePath);
    // --- FIN DE LA MEJORA ---

    // Guardamos la referencia en la base de datos
    await db.execute(
      "INSERT INTO Empresa (nombre, direccion, logo, slug) VALUES (?, ?, ?, ?)",
      [nombre, direccion, fileName, slug]
    );

    res.json({ success: true, message: "Empresa registrada con éxito." });

  } catch (err) {
    console.error("Error registrando cliente:", err);
    res.status(500).json({ success: false, message: "Error al crear la empresa." });
  }
};


// En src/controllers/admin/general.controller.js

const registrarUser = async (req, res) => {
  // 1. Obtenemos los nuevos datos del body
  const {
    username, nombres, password, tipo_usuario,
    empresas_asociadas, id_empresa_predeterminada
  } = req.body;

  // 2. Validación inicial
  if (!username || !nombres || !password || !tipo_usuario) {
    return res.status(400).json({ success: false, message: "Los campos de usuario y contraseña son obligatorios." });
  }

  if (tipo_usuario === 'Cliente' && (!empresas_asociadas || empresas_asociadas.length === 0 || !id_empresa_predeterminada)) {
    return res.status(400).json({ success: false, message: "Un usuario 'Cliente' debe tener al menos una empresa asociada y una predeterminada." });
  }

  const connection = await db.getConnection(); // Usamos una conexión para la transacción

  try {
    await connection.beginTransaction(); // ¡Iniciamos una transacción!

    const hash = await bcrypt.hash(password, 10);

    // 3. Insertamos el usuario en la tabla Login
    // Si es admin, id_empresa_predeterminada es 1 (la de 386 SMART), si no, la que se seleccionó.
    const defaultCompanyId = tipo_usuario === 'Administrador' ? 1 : id_empresa_predeterminada;

    const [result] = await connection.execute(
      `INSERT INTO Login (username, password, nombre, tipo_usuario, id_empresa_predeterminada) VALUES (?, ?, ?, ?, ?)`,
      [username, hash, nombres, tipo_usuario, defaultCompanyId]
    );
    const newUserId = result.insertId;

    // 4. Si es un Cliente, insertamos sus relaciones en la tabla Usuario_Empresas
    if (tipo_usuario === 'Cliente' && empresas_asociadas.length > 0) {
      const values = empresas_asociadas.map(empresaId => [newUserId, empresaId]);
      await connection.query(
        'INSERT INTO Usuario_Empresas (id_usuario, id_empresa) VALUES ?',
        [values]
      );
    } else if (tipo_usuario === 'Administrador') {
      // Un admin siempre tiene acceso a la empresa principal (ID 1)
      await connection.execute(
        'INSERT INTO Usuario_Empresas (id_usuario, id_empresa) VALUES (?, ?)',
        [newUserId, 1]
      );
    }

    await connection.commit(); // Si todo fue bien, confirmamos los cambios
    res.status(201).json({ success: true, message: "Usuario creado con éxito." });

  } catch (err) {
    await connection.rollback(); // Si algo falló, revertimos todo
    console.error("Error al crear usuario:", err);
    // Manejo de error para usuario duplicado
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: "El nombre de usuario ya existe." });
    }
    res.status(500).json({ success: false, message: "Error interno al crear el usuario." });
  } finally {
    connection.release(); // Siempre liberamos la conexión
  }
};

// VERSIÓN CORREGIDA
// En src/controllers/admin/general.controller.js
// REEMPLAZA esta función completa

const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Puedes ajustar cuántos usuarios mostrar por página
    const offset = (page - 1) * limit;
    const { search, company } = req.query;

    let whereClauses = [];
    let params = [];

    if (company) {
      whereClauses.push("e.nombre = ?");
      params.push(company);
    }
    if (search) {
      whereClauses.push("(u.username LIKE ? OR u.nombre LIKE ?)");
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query para contar el total de resultados con los filtros aplicados
    const countSql = `SELECT COUNT(*) as total FROM Login u JOIN Empresa e ON u.id_empresa_predeterminada = e.id_empresa ${whereSql}`;
    const [[{ total }]] = await db.execute(countSql, params);
    const totalPages = Math.ceil(total / limit);

    // Query para obtener los datos de la página actual con filtros
    const dataSql = `
            SELECT u.id_usuario, u.username, u.nombre, u.tipo_usuario, e.nombre AS empresa
            FROM Login u 
            JOIN Empresa e ON u.id_empresa_predeterminada = e.id_empresa
            ${whereSql}
            ORDER BY u.nombre
            LIMIT ${limit} OFFSET ${offset}`;
    const [users] = await db.execute(dataSql, params);

    res.json({
      success: true,
      data: {
        users: users,
        totalPages,
        currentPage: page
      }
    });

  } catch (err) {
    console.error("Error en /api/users:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};

const getUserSessions = async (req, res) => {
  try {
    // --- CONSULTA CORREGIDA ---
    // Le decimos a MySQL que extraiga el user_id de la columna 'data' que está en formato JSON
    const sql = `
            SELECT 
                JSON_EXTRACT(data, '$.user.id_usuario') AS user_id, 
                COUNT(session_id) AS session_count 
            FROM sessions 
            WHERE JSON_EXTRACT(data, '$.user.id_usuario') IS NOT NULL 
            GROUP BY user_id
        `;
    const [sessions] = await db.execute(sql);

    res.json(sessions);
  } catch (err) {
    console.error("Error en /api/users/sessions:", err);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

const updateUserPassword = async (req, res) => {

  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "La contraseña es requerida." });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.execute("UPDATE Login SET password = ? WHERE id_usuario = ?", [
      hash,
      id,
    ]);
    res.json({ success: true, message: "Contraseña actualizada." });
  } catch (err) {
    console.error("Error en PUT /api/users/:id :", err);
    res.status(500).json({ message: "Error interno del servidor." });
  }

};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute("DELETE FROM Login WHERE id_usuario = ?", [id]);
    res.json({ success: true, message: "Usuario eliminado." });
  } catch (err) {
    console.error("Error en DELETE /api/users/:id :", err);
    res.status(500).json({ message: "Error interno del servidor." });
  }
};

// === API: GESTIÓN DE CONTRATOS ===

const getContratosPorEmpresa = async (req, res) => {
  try {
    const { id } = req.params;
    const [contratos] = await db.execute(
      'SELECT id_contrato, nombre_contrato FROM Contrato WHERE id_empresa = ? ORDER BY nombre_contrato',
      [id]
    );
    res.json({ success: true, data: contratos });
  } catch (err) {
    console.error("Error en /api/contratos/empresa/:id:", err);
    res.status(500).json({ success: false, message: 'Error al obtener los contratos de la empresa.' });
  }
};

const getContratos = async (req, res) => {
  try {
    // Consulta MEJORADA que ya incluye el nombre de la empresa
    const [contratos] = await db.execute(
      `SELECT 
                c.id_contrato, c.nombre_contrato, c.id_empresa, c.fecha_inicio,
                e.nombre as empresa_nombre 
             FROM Contrato c
             JOIN Empresa e ON c.id_empresa = e.id_empresa
             ORDER BY c.nombre_contrato`
    );
    res.json({ success: true, data: contratos });
  } catch (err) {
    console.error("Error en /api/contratos/lista:", err);
    res.status(500).json({
      success: false,
      message: "Error al obtener la lista de contratos.",
    });
  }
};

const registrarContrato = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id_empresa, nombre_contrato, categoria, descripcion, moneda, fecha_inicio, fecha_fin, ...alcance } = req.body;

    if (!id_empresa || !nombre_contrato || !fecha_inicio || !categoria || !moneda) {
      return res.status(400).json({ success: false, message: "Campos principales (Empresa, Nombre, Categoría, Moneda, Fecha Inicio) son requeridos." });
    }

    const sqlContrato = `
    INSERT INTO Contrato (id_empresa, nombre_contrato, categoria, descripcion, moneda, fecha_inicio, fecha_fin, implementacion, mantenimiento, devolucion_de_equipos, preparacion_de_imagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

    const [result] = await connection.execute(sqlContrato, [
      id_empresa, nombre_contrato, categoria, descripcion || null, moneda,
      fecha_inicio, fecha_fin || null,
      alcance.implementacion === 'true', alcance.mantenimiento === 'true',
      alcance.devolucion_de_equipos === 'true', alcance.preparacion_de_imagen === 'true'
    ]);


    const newContractId = result.insertId;
    await guardarDocumentos(connection, newContractId, req.files);
    await connection.commit();
    res.status(201).json({ success: true, message: "Contrato y documentos registrados con éxito." });
  } catch (err) {
    await connection.rollback();
    console.error("Error al registrar el contrato:", err);
    res.status(500).json({ success: false, message: "Error interno al guardar el contrato." });
  } finally {
    connection.release();
  }
};




const getContratoById = async (req, res) => {

  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      "SELECT * FROM Contrato WHERE id_contrato = ?",
      [id]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Contrato no encontrado." });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error en GET /api/contratos/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener el contrato." });
  }
};

const updateContrato = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { nombre_contrato, categoria, id_relacion, descripcion, moneda, fecha_inicio, fecha_fin, ...alcance } = req.body;

    if (!nombre_contrato || !fecha_inicio || !categoria || !moneda) {
      return res.status(400).json({ success: false, message: "Nombre, Categoría, Moneda y Fecha de Inicio son requeridos." });
    }

    const sqlUpdate = `
    UPDATE Contrato 
    SET nombre_contrato = ?, categoria = ?, id_relacion = ?, descripcion = ?, moneda = ?, fecha_inicio = ?, fecha_fin = ?, 
        implementacion = ?, mantenimiento = ?, devolucion_de_equipos = ?, preparacion_de_imagen = ?
    WHERE id_contrato = ?
`;

    await connection.execute(sqlUpdate, [
      nombre_contrato, categoria, id_relacion || null, descripcion || null, moneda,
      fecha_inicio, fecha_fin || null,
      alcance.implementacion === 'true', alcance.mantenimiento === 'true',
      alcance.devolucion_de_equipos === 'true', alcance.preparacion_de_imagen === 'true',
      id
    ]);


    await guardarDocumentos(connection, id, req.files);
    await connection.commit();
    res.json({ success: true, message: "Contrato actualizado con éxito." });
  } catch (err) {
    await connection.rollback();
    console.error("Error en PUT /api/contratos/:id:", err);
    res.status(500).json({ success: false, message: "Error al actualizar el contrato." });
  } finally {
    connection.release();
  }
};


const updateContratoServicios = async (req, res) => {
  const { id } = req.params;
  const { id_servicios } = req.body; // Un array de IDs de los servicios seleccionados

  if (!Array.isArray(id_servicios)) {
    return res.status(400).json({
      success: false,
      message: "Se esperaba un array de IDs de servicios.",
    });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Borramos todas las asociaciones de servicios anteriores para este contrato
    await connection.execute(
      "DELETE FROM Contrato_Servicios WHERE id_contrato = ?",
      [id]
    );

    // 2. Si hay nuevos servicios para agregar, los insertamos
    if (id_servicios.length > 0) {
      const values = id_servicios.map((id_servicio) => [id, id_servicio]);
      await connection.query(
        "INSERT INTO Contrato_Servicios (id_contrato, id_servicio) VALUES ?",
        [values]
      );
    }

    await connection.commit();
    res.json({
      success: true,
      message: "Servicios del contrato actualizados.",
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error en POST /api/contratos/:id/servicios:", err);
    res.status(500).json({
      success: false,
      message: "Error al guardar los servicios del contrato.",
    });
  } finally {
    connection.release();
  }
};

const getContratoServicios = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      `
            SELECT s.id_servicio, s.nombre_servicio FROM Contrato_Servicios cs
            JOIN Servicios s ON cs.id_servicio = s.id_servicio WHERE cs.id_contrato = ?`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error interno" });
  }
};

// === API: GESTIÓN DE CATÁLOGO DE SERVICIOS ===

const getServicios = async (req, res) => {

  try {
    const [servicios] = await db.execute(
      "SELECT * FROM Servicios ORDER BY categoria_servicio, nombre_servicio"
    );
    res.json({ success: true, data: servicios });
  } catch (err) {
    console.error("Error en /api/servicios:", err);
    res.status(500).json({
      success: false,
      message: "Error al obtener el catálogo de servicios.",
    });
  }


};

const registrarServicio = async (req, res) => {
  try {
    const { nombre_servicio, categoria_servicio } = req.body;
    if (!nombre_servicio || !categoria_servicio) {
      return res.status(400).json({
        success: false,
        message: "Nombre y categoría son requeridos.",
      });
    }
    await db.execute(
      "INSERT INTO Servicios (nombre_servicio, categoria_servicio) VALUES (?, ?)",
      [nombre_servicio, categoria_servicio]
    );
    res
      .status(201)
      .json({ success: true, message: "Servicio creado en el catálogo." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Ese servicio ya existe en esa categoría.",
      });
    }
    console.error("Error en POST /api/servicios:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al crear el servicio." });
  }
};



// ===================== ALERTAS (ADMIN) =====================

// ===== ALERTAS (ADMIN) =====
const getMissingCompaniesByCategory = async (req, res) => {
  try {
    const { categoria } = req.params;
    // Empresas que NO tienen ningún servicio de esa categoría en sus contratos
    const [rows] = await db.execute(`
      SELECT e.id_empresa, e.nombre
      FROM Empresa e
      WHERE e.id_empresa NOT IN (
        SELECT DISTINCT c.id_empresa
        FROM Contrato c
        JOIN Contrato_Servicios cs ON cs.id_contrato = c.id_contrato
        JOIN Servicios s ON s.id_servicio = cs.id_servicio
        WHERE s.categoria_servicio = ?
      )
      ORDER BY e.nombre
    `, [categoria]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getMissingCompaniesByCategory', err);
    res.status(500).json({ success: false, message: 'Error al calcular empresas.' });
  }
};

const createAlert = async (req, res) => {
  const {
    categoria_servicio, severity, title, message,
    cta_label, cta_url, start_at, end_at, company_ids
  } = req.body;

  if (!categoria_servicio || !severity || !title || !message) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios.' });
  }
  if (!Array.isArray(company_ids) || company_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'Debes seleccionar al menos una empresa.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.execute(`
      INSERT INTO Marketing_Alert
        (categoria_servicio, severity, title, message, cta_label, cta_url, start_at, end_at)
      VALUES (?,?,?,?,?,?,?,?)
    `, [categoria_servicio, severity, title, message, cta_label, cta_url, start_at, end_at]);

    const id_alerta = r.insertId;
    const values = company_ids.map(idEmp => [id_alerta, idEmp]);
    await conn.query(`INSERT INTO Marketing_Alert_Target (id_alerta, id_empresa) VALUES ?`, [values]);

    await conn.commit();
    res.json({ success: true, id_alerta });
  } catch (err) {
    await conn.rollback();
    console.error('createAlert', err);
    res.status(500).json({ success: false, message: 'No se pudo crear la alerta.' });
  } finally {
    conn.release();
  }
};

const listAlerts = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT a.*,
             (SELECT COUNT(*) FROM Marketing_Alert_Target t WHERE t.id_alerta = a.id_alerta) AS empresas_objetivo
      FROM Marketing_Alert a
      ORDER BY a.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listAlerts', err);
    res.status(500).json({ success: false, message: 'Error al listar alertas.' });
  }
};

const getAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const [[alerta]] = await db.execute(`SELECT * FROM Marketing_Alert WHERE id_alerta = ?`, [id]);
    if (!alerta) return res.status(404).json({ success: false, message: 'No existe' });
    const [targets] = await db.execute(`SELECT id_empresa FROM Marketing_Alert_Target WHERE id_alerta = ?`, [id]);
    res.json({ success: true, data: { alerta, targets: targets.map(t => t.id_empresa) } });
  } catch (err) {
    console.error('getAlert', err);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const updateAlert = async (req, res) => {
  const { id } = req.params;
  const {
    categoria_servicio, severity, title, message,
    cta_label, cta_url, start_at, end_at, active, company_ids
  } = req.body;
  const activeParam = (active === undefined || active === null) ? null : (active ? 1 : 0);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(`
  UPDATE Marketing_Alert
  SET categoria_servicio=?, severity=?, title=?, message=?, cta_label=?, cta_url=?, start_at=?, end_at=?, active=IFNULL(?, active)
  WHERE id_alerta=?
`, [categoria_servicio, severity, title, message, cta_label, cta_url, start_at, end_at, activeParam, id]);
    if (Array.isArray(company_ids)) {
      await conn.execute(`DELETE FROM Marketing_Alert_Target WHERE id_alerta=?`, [id]);
      if (company_ids.length) {
        const values = company_ids.map(e => [id, e]);
        await conn.query(`INSERT INTO Marketing_Alert_Target (id_alerta, id_empresa) VALUES ?`, [values]);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('updateAlert', err);
    res.status(500).json({ success: false, message: 'No se pudo actualizar.' });
  } finally {
    conn.release();
  }
};

const toggleAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await db.execute(`UPDATE Marketing_Alert SET active=? WHERE id_alerta=?`, [active ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('toggleAlert', err);
    res.status(500).json({ success: false, message: 'Error' });
  }
};

const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute(`DELETE FROM Marketing_Alert WHERE id_alerta=?`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAlert', err);
    res.status(500).json({ success: false, message: 'Error' });
  }
};




















//INFORMES POWER BI

const getInformes = async (req, res) => {

  try {
    const [informes] = await db.execute(`
            SELECT i.id_informe, i.Url_Informe, i.fecha_creacion, e.nombre AS empresa
            FROM Informes i
            JOIN Empresa e ON i.id_empresa = e.id_empresa
            ORDER BY i.fecha_creacion DESC
        `);
    res.json({ success: true, data: informes });
  } catch (err) {
    console.error("Error en /api/informes:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener los informes." });
  }

};

const registrarInforme = async (req, res) => {
  try {
    const { id_empresa, Url_Informe, fecha_creacion } = req.body;
    if (!id_empresa || !Url_Informe || !fecha_creacion) {
      return res
        .status(400)
        .json({ success: false, message: "Todos los campos son requeridos." });
    }
    await db.execute(
      "INSERT INTO Informes (id_empresa, Url_Informe, fecha_creacion) VALUES (?, ?, ?)",
      [id_empresa, Url_Informe, fecha_creacion]
    );
    res
      .status(201)
      .json({ success: true, message: "Informe creado con éxito." });
  } catch (err) {
    console.error("Error en POST /api/informes:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al crear el informe." });
  }
};

const updateInforme = async (req, res) => {

  try {
    const { id } = req.params;
    const { id_empresa, Url_Informe, fecha_creacion } = req.body;
    if (!id_empresa || !Url_Informe || !fecha_creacion) {
      return res
        .status(400)
        .json({ success: false, message: "Todos los campos son requeridos." });
    }
    await db.execute(
      "UPDATE Informes SET id_empresa = ?, Url_Informe = ?, fecha_creacion = ? WHERE id_informe = ?",
      [id_empresa, Url_Informe, fecha_creacion, id]
    );
    res.json({ success: true, message: "Informe actualizado con éxito." });
  } catch (err) {
    console.error("Error en PUT /api/informes/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar el informe." });
  }
};

const deleteInforme = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute("DELETE FROM Informes WHERE id_informe = ?", [id]);
    res.json({ success: true, message: "Informe eliminado con éxito." });
  } catch (err) {
    console.error("Error en DELETE /api/informes/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al eliminar el informe." });
  }
};


const forceLogoutUser = async (req, res) => {
  try {
    const id = req.params.id; // ID del usuario como string desde la URL
    const userIdAsNumber = parseInt(id, 10); // <-- INICIO DE LA CORRECCIÓN: Convertimos a número

    if (isNaN(userIdAsNumber)) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
    }

    const sql = `
            SELECT session_id 
            FROM sessions 
            WHERE JSON_EXTRACT(data, '$.user.id_usuario') = ?
        `;
    const [sessions] = await db.execute(sql, [userIdAsNumber]); // <-- Usamos el número en la consulta

    // --- FIN DE LA CORRECCIÓN ---

    if (sessions.length === 0) {
      return res.json({ success: true, message: 'El usuario no tenía sesiones activas.' });
    }

    const promises = sessions.map(s => new Promise((resolve, reject) => {
      req.sessionStore.destroy(s.session_id, (err) => {
        if (err) return reject(err);
        resolve();
      });
    }));

    await Promise.all(promises);

    res.json({ success: true, message: 'Todas las sesiones del usuario han sido terminadas.' });

  } catch (err) {
    console.error("Error al forzar cierre de sesión:", err);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

//funciones para registrar documentos.


// REEMPLAZA ESTA FUNCIÓN COMPLETA
const guardarDocumentos = async (connection, id_contrato, files) => {
  if (!files || Object.keys(files).length === 0) {
    return; // No hay archivos para guardar
  }

  const docPromises = [];

  // 1. Mapeo de fieldname a tipo de DB y nombre de carpeta
  const tipos = {
    contratos_pdf: { db: 'Contrato', folder: 'contratos' },
    guias_pdf: { db: 'Guia', folder: 'guias' },
    propuestas_pdf: { db: 'Propuesta', folder: 'propuestas' }
  };

  for (const fieldname in files) {
    const fileArray = files[fieldname];
    const tipoInfo = tipos[fieldname];

    if (!tipoInfo) continue;

    fileArray.forEach(file => {
      // --- INICIO DE LA MODIFICACIÓN CLAVE ---
      // 2. Creamos la ruta relativa que se guardará en la BD
      const rutaRelativa = `${tipoInfo.folder}/${file.filename}`;
      // --- FIN DE LA MODIFICACIÓN CLAVE ---

      const docData = {
        id_contrato,
        tipo_documento: tipoInfo.db,
        nombre_original: file.originalname,
        nombre_almacenado: file.filename,
        ruta_archivo: rutaRelativa, // 3. Usamos la nueva ruta relativa
        tamano_bytes: file.size
      };

      docPromises.push(
        connection.execute(
          'INSERT INTO Documentos_Contrato (id_contrato, tipo_documento, nombre_original, nombre_almacenado, ruta_archivo, tamano_bytes) VALUES (?, ?, ?, ?, ?, ?)',
          Object.values(docData)
        )
      );
    });
  }

  await Promise.all(docPromises);
};

// Obtener la lista de documentos de un contrato
const getDocumentosPorContrato = async (req, res) => {
  try {
    const { id } = req.params;
    const [docs] = await db.execute(
      'SELECT id_documento, tipo_documento, nombre_original, ruta_archivo, tamano_bytes FROM Documentos_Contrato WHERE id_contrato = ?',
      [id]
    );
    res.json({ success: true, data: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener documentos.' });
  }
};

// Eliminar un documento específico
// REEMPLAZA ESTA FUNCIÓN COMPLETA
const eliminarDocumento = async (req, res) => {
  const { id_doc } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener la ruta del archivo (que ahora es 'contratos/archivo.pdf')
    const [rows] = await connection.execute('SELECT ruta_archivo FROM Documentos_Contrato WHERE id_documento = ?', [id_doc]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
    }

    // --- INICIO DE LA MODIFICACIÓN CLAVE ---
    // 2. Construir la ruta física completa usando STORAGE_PATH
    const filePath = path.join(STORAGE_PATH, rows[0].ruta_archivo);
    // --- FIN DE LA MODIFICACIÓN CLAVE ---

    // 3. Eliminar el registro de la base de datos
    await connection.execute('DELETE FROM Documentos_Contrato WHERE id_documento = ?', [id_doc]);

    // 4. Eliminar el archivo físico del servidor
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await connection.commit();
    res.json({ success: true, message: 'Documento eliminado.' });
  } catch (err) {
    await connection.rollback();
    console.error("Error al eliminar documento:", err);
    res.status(500).json({ success: false, message: 'Error al eliminar el documento.' });
  } finally {
    connection.release();
  }
};

//FUNCIONES PARA GENERAR DESCARGA DE PLANTILLA.

const downloadContractTemplate = async (req, res) => {
  try {
    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Plantilla Contratos");

    // Añadimos la nueva columna 'descripcion'
    worksheet.columns = [
      { header: 'id_empresa', key: 'id_empresa', width: 15 },
      { header: 'nombre_contrato', key: 'nombre_contrato', width: 40 },
      { header: 'categoria', key: 'categoria', width: 20 }, // <-- NUEVA COLUMNA
      { header: 'moneda', key: 'moneda', width: 10 }, // <--- NUEVA COLUMNA
      { header: 'id_relacion', key: 'id_relacion', width: 15 }, // <-- NUEVA COLUMNA
      { header: 'descripcion', key: 'descripcion', width: 50 }, // <-- NUEVA COLUMNA
      { header: 'fecha_inicio (dd/mm/aaaa)', key: 'fecha_inicio', width: 25 },
      { header: 'fecha_fin (dd/mm/aaaa)', key: 'fecha_fin', width: 25 },
      { header: 'implementacion (1=Sí, 0=No)', key: 'implementacion', width: 30 },
      { header: 'mantenimiento (1=Sí, 0=No)', key: 'mantenimiento', width: 30 },
      { header: 'devolucion_de_equipos (1=Sí, 0=No)', key: 'devolucion_de_equipos', width: 40 },
      { header: 'preparacion_de_imagen (1=Sí, 0=No)', key: 'preparacion_de_imagen', width: 40 }
    ];

    // Añadimos la descripción a la fila de ejemplo
    worksheet.addRow({
      id_empresa: 2,
      nombre_contrato: "Ej: Contrato de Soporte Anual",
      categoria: "Venta / Leasing", // <-- DATO DE EJEMPLO
      moneda: "USD", // <-- DATO DE EJEMPLO
      id_relacion: 5, // <-- DATO DE EJEMPLO
      descripcion: "Soporte técnico para 50 equipos de oficina.", // <-- DATO DE EJEMPLO
      fecha_inicio: "15/01/2025",
      fecha_fin: "14/01/2026",
      implementacion: 1,
      mantenimiento: 1,
      devolucion_de_equipos: 0,
      preparacion_de_imagen: 1
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D6EFD' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_contratos.xlsx"');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error al generar la plantilla de Excel:", error);
    res.status(500).send("Error al generar la plantilla.");
  }
};

const bulkInsertContracts = async (req, res) => {
  const contracts = req.body.contracts;
  if (!contracts || !Array.isArray(contracts) || contracts.length === 0) {
    return res.status(400).json({ success: false, message: "No se proporcionaron datos de contratos." });
  }

  const connection = await db.getConnection();
  const parseDate = (dateInput) => {
    // Si el campo es nulo, indefinido o una cadena vacía, simplemente devuelve null.
    if (dateInput === null || typeof dateInput === 'undefined' || dateInput === '') {
      return null;
    }

    // Opción 1: El dato es un número de serie de Excel
    if (typeof dateInput === 'number') {
      const date = new Date((dateInput - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Opción 2: El dato es un string 'dd/mm/aaaa'
    if (typeof dateInput === 'string') {
      const parts = dateInput.split('/');
      if (parts.length !== 3) return null;
      const date = new Date(Date.UTC(parts[2], parts[1] - 1, parts[0]));
      return date.toISOString().split('T')[0];
    }

    return null; // Formato no reconocido
  };
  try {
    await connection.beginTransaction();

    const values = contracts.map(c => {
      const fechaInicio = parseDate(c['fecha_inicio (dd/mm/aaaa)']);
      const fechaFin = parseDate(c['fecha_fin (dd/mm/aaaa)']);

      if (!c.id_empresa || !c.nombre_contrato || !fechaInicio) {
        const rowIdentifier = c.nombre_contrato || JSON.stringify(c);
        throw new Error(`Fila inválida o con datos obligatorios faltantes cerca de '${rowIdentifier}'.`);
      }

      return [
        c.id_empresa,
        c.nombre_contrato,
        c.categoria || null, // <-- AÑADIMOS EL CAMPO CATEGORÍA
        c.moneda || null, // <-- AÑADIMOS EL CAMPO MONEDA
        c.id_relacion || null, // <-- AÑADIMOS EL CAMPO ID_RELACION
        c.descripcion || null, // <-- AÑADIMOS EL CAMPO DESCRIPCIÓN
        fechaInicio,
        fechaFin,
        c['implementacion (1=Sí, 0=No)'] == 1,
        c['mantenimiento (1=Sí, 0=No)'] == 1,
        c['devolucion_de_equipos (1=Sí, 0=No)'] == 1,
        c['preparacion_de_imagen (1=Sí, 0=No)'] == 1,
      ];
    });

    // Actualizamos la consulta SQL para incluir la nueva columna
    const sql = `INSERT INTO Contrato (
    id_empresa, nombre_contrato, categoria, moneda, id_relacion, descripcion, fecha_inicio, fecha_fin,
    implementacion, mantenimiento, devolucion_de_equipos, preparacion_de_imagen
) VALUES ?`;

    await connection.query(sql, [values]);

    await connection.commit();
    res.status(201).json({ success: true, message: `${contracts.length} contratos han sido importados con éxito.` });

  } catch (error) {
    await connection.rollback();
    console.error("Error en la inserción masiva de contratos:", error);
    res.status(500).json({ success: false, message: `Error en el servidor: ${error.message}` });
  } finally {
    connection.release();
  }
};


//PARA VISUALIZACION DE CONTRATOS.
const getContractsForAdminView = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Contratos por página
    const offset = (page - 1) * limit;
    const { search, empresaId } = req.query;

    let whereClauses = [];
    let params = [];

    if (empresaId) {
      whereClauses.push("c.id_empresa = ?");
      params.push(empresaId);
    }
    if (search) {
      whereClauses.push("(c.nombre_contrato LIKE ? OR e.nombre LIKE ?)");
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query para contar el total de resultados
    const countSql = `SELECT COUNT(*) as total FROM Contrato c JOIN Empresa e ON c.id_empresa = e.id_empresa ${whereSql}`;
    const [[{ total }]] = await db.execute(countSql, params);
    const totalPages = Math.ceil(total / limit);

    // Query para obtener los datos de la página actual
    const dataSql = `
            SELECT c.*, e.nombre AS empresa_nombre 
            FROM Contrato c 
            JOIN Empresa e ON c.id_empresa = e.id_empresa 
            ${whereSql}
            ORDER BY c.fecha_inicio DESC
            LIMIT ${limit} OFFSET ${offset}
        `;
    const [contracts] = await db.execute(dataSql, params);

    // Añadir estado a cada contrato
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const contractsWithStatus = contracts.map(c => {
      let estado = { texto: 'Vigente', color: 'success' };
      if (c.fecha_fin) {
        const fechaFin = new Date(c.fecha_fin);
        const diffDias = (fechaFin - hoy) / (1000 * 60 * 60 * 24);
        if (diffDias < 0) estado = { texto: 'Vencido', color: 'danger' };
        else if (diffDias <= 30) estado = { texto: 'Próximo a Vencer', color: 'warning' };
      }
      return { ...c, estado };
    });

    res.json({
      success: true,
      data: {
        contracts: contractsWithStatus,
        totalPages,
        currentPage: page
      }
    });
  } catch (error) {
    console.error("Error al obtener contratos para la vista de admin:", error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
}

const renderContractDetailView = async (req, res) => {
  const { id } = req.params;
  try {
    // Usamos Promise.all para hacer todas las consultas en paralelo
    const [
      [[contrato]],
      [servicios],
      [documentos],
      [equipos]
    ] = await Promise.all([
      db.execute(`
                SELECT c.*, e.nombre as empresa_nombre 
                FROM Contrato c 
                JOIN Empresa e ON c.id_empresa = e.id_empresa 
                WHERE c.id_contrato = ?`, [id]),
      db.execute(`
                SELECT s.nombre_servicio 
                FROM Contrato_Servicios cs 
                JOIN Servicios s ON cs.id_servicio = s.id_servicio 
                WHERE cs.id_contrato = ?`, [id]),
      db.execute(`
                SELECT * FROM Documentos_Contrato 
                WHERE id_contrato = ?`, [id]),
      db.execute(`
                SELECT eq.*, cat.nombre as categoria_nombre 
                FROM Equipo eq 
                LEFT JOIN Categoria cat ON eq.id_categoria = cat.id_categoria 
                WHERE eq.id_contrato = ?`, [id])
    ]);

    if (!contrato) {
      return res.status(404).render("shared/simplemessage", { title: "Error", message: "Contrato no encontrado." });
    }

    // Renderizamos la nueva vista y le pasamos todos los datos
    res.render('admins/admincontractdetail', {
      user: req.session.user,
      contrato,
      servicios,
      documentos,
      equipos
    });

  } catch (error) {
    console.error("Error al cargar la vista de detalle del contrato:", error);
    res.status(500).render("shared/simplemessage", { title: "Error", message: "Error al cargar los datos del contrato." });
  }
};

const getCompaniesForAdminView = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Empresas por página
    const offset = (page - 1) * limit;
    const { search } = req.query; // Obtenemos el término de búsqueda

    let whereClauses = [];
    let params = [];

    // Si hay un término de búsqueda, lo añadimos a la consulta
    if (search) {
      whereClauses.push(" (nombre LIKE ? OR slug LIKE ?) ");
      params.push(`%${search}%`);
      params.push(`%${search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query para contar el total de resultados (con el filtro aplicado)
    const countSql = `SELECT COUNT(*) as total FROM Empresa ${whereSql}`;
    const [[{ total }]] = await db.execute(countSql, params);
    const totalPages = Math.ceil(total / limit);

    // Query para obtener los datos de la página actual (con el filtro aplicado)
    // AHORA (Agregado 'logo')
    const dataSql = `
    SELECT id_empresa, nombre, direccion, slug, logo
    FROM Empresa 
    ${whereSql}
    ORDER BY nombre ASC 
    LIMIT ${limit} OFFSET ${offset}
`;
    const [companies] = await db.execute(dataSql, params);

    res.json({
      success: true,
      data: {
        companies: companies,
        totalPages,
        currentPage: page
      }
    });
  } catch (error) {
    console.error("Error al obtener las empresas:", error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
};

//actualización de dashboard admin

const getDashboardCharts = async (req, res) => {
  try {
    // Consulta para equipos por categoría
    const [equiposPorCategoria] = await db.execute(`
            SELECT cat.nombre, COUNT(eq.id_equipo) as cantidad 
            FROM Equipo eq 
            JOIN Categoria cat ON eq.id_categoria = cat.id_categoria 
            GROUP BY cat.nombre 
            ORDER BY cantidad DESC
        `);

    // Consulta para equipos por modelo (Top 10 para no saturar el gráfico)
    const [equiposPorModelo] = await db.execute(`
            SELECT modelo, COUNT(id_equipo) as cantidad 
            FROM Equipo 
            WHERE modelo IS NOT NULL AND modelo != '' 
            GROUP BY modelo 
            ORDER BY cantidad DESC 
            LIMIT 10
        `);

    res.json({
      success: true,
      data: {
        equiposPorCategoria,
        equiposPorModelo
      }
    });
  } catch (error) {
    console.error("Error al obtener datos para los gráficos del dashboard:", error);
    res.status(500).json({ success: false, message: 'Error en el servidor.' });
  }
};

// === GESTIÓN DE VALORES DE CONTRATOS ===============CORREGIR DESDE AQUI ===

const getContractValues = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        c.id_contrato, 
        c.nombre_contrato, 
        e.nombre AS empresa_nombre, 
        c.moneda,
        IFNULL(pc.valor_total_equipos, 0) AS valor_total_equipos,
        IFNULL(pc.valor_total_servicios, 0) AS valor_total_servicios
      FROM Contrato c
      JOIN Empresa e ON c.id_empresa = e.id_empresa
      LEFT JOIN Precio_Contrato pc ON c.id_contrato = pc.id_contrato
      ORDER BY c.fecha_inicio DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error en getContractValues:", err);
    res.status(500).json({ success: false, message: "Error al obtener los valores de contratos." });
  }
};

const getContractDetailsForPricing = async (req, res) => {
  try {
    const { id } = req.params;

    const [[contrato]] = await db.execute(`
      SELECT c.id_contrato, c.nombre_contrato, c.moneda, e.nombre AS empresa_nombre
      FROM Contrato c
      JOIN Empresa e ON c.id_empresa = e.id_empresa
      WHERE c.id_contrato = ?
    `, [id]);

    if (!contrato) {
      return res.status(404).json({ success: false, message: "Contrato no encontrado." });
    }

    const [categorias] = await db.execute(`
      SELECT DISTINCT cat.id_categoria, cat.nombre 
      FROM Equipo eq
      JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
      WHERE eq.id_contrato = ?
    `, [id]);

    const [servicios] = await db.execute(`
      SELECT s.id_servicio, s.nombre_servicio
      FROM Contrato_Servicios cs
      JOIN Servicios s ON cs.id_servicio = s.id_servicio
      WHERE cs.id_contrato = ?
    `, [id]);

    const [categoriasConPrecio] = await db.execute(`
      SELECT id_categoria, valor 
      FROM Contrato_Categoria_Precios
      WHERE id_contrato = ?
    `, [id]);

    const [[totales]] = await db.execute(`
      SELECT valor_total_equipos, valor_total_servicios
      FROM Precio_Contrato WHERE id_contrato = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        contrato,
        categorias,
        servicios,
        categoriasConPrecio,
        totales
      }
    });

  } catch (err) {
    console.error("Error en getContractDetailsForPricing:", err);
    res.status(500).json({ success: false, message: "Error al cargar los detalles del contrato." });
  }
};

const saveContractPrices = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id_contrato, precios_categorias, valor_total_equipos, valor_total_servicios } = req.body;

    await connection.execute(`
      INSERT INTO Precio_Contrato (id_contrato, valor_total_equipos, valor_total_servicios)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      valor_total_equipos = VALUES(valor_total_equipos),
      valor_total_servicios = VALUES(valor_total_servicios)
    `, [id_contrato, valor_total_equipos, valor_total_servicios]);

    if (Array.isArray(precios_categorias)) {
      for (const { id_categoria, valor } of precios_categorias) {
        await connection.execute(`
          INSERT INTO Contrato_Categoria_Precios (id_contrato, id_categoria, valor)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE valor = VALUES(valor)
        `, [id_contrato, id_categoria, valor]);
      }
    }

    await connection.commit();
    res.json({ success: true, message: "Valores de contrato guardados correctamente." });
  } catch (err) {
    await connection.rollback();
    console.error("Error en saveContractPrices:", err);
    res.status(500).json({ success: false, message: "Error al guardar los valores del contrato." });
  } finally {
    connection.release();
  }
};

// === NUEVAS FUNCIONES: GESTIÓN DE PRECIOS POR EQUIPO ===

// REEMPLAZA TODAS LAS FUNCIONES DE VALORIZACIÓN ANTERIORES POR ESTAS DOS:

/**
 * 🔹 Obtiene la lista de contratos para la vista principal de valorización.
 */
const getContratosParaValorizar = async (req, res) => {
  try {
    const [rows] = await db.execute(`
            SELECT 
                c.id_contrato, 
                c.nombre_contrato, 
                e.nombre AS empresa_nombre, 
                c.moneda,
                IFNULL(pc.valor_total_equipos, 0.00) AS valor_total_equipos,
                IFNULL(pc.valor_total_servicios, 0.00) AS valor_total_servicios
            FROM Contrato c
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            LEFT JOIN Precio_Contrato pc ON c.id_contrato = pc.id_contrato
            ORDER BY c.nombre_contrato
        `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error en getContratosParaValorizar:", err);
    res.status(500).json({ success: false, message: "Error al obtener la lista de contratos." });
  }
};

// En: src/controllers/admin/general.controller.js

// src/controllers/admin/general.controller.js
const getDetallesParaValorizar = async (req, res) => {
  const connection = await db.getConnection(); // Usamos conexión directa para configurar sesión
  try {
    const { id } = req.params;

    // 1. IMPORTANTE: Aumentar el límite de GROUP_CONCAT para evitar IDs cortados
    await connection.query("SET SESSION group_concat_max_len = 100000;");

    // 2. Obtener Contrato
    const [[contrato]] = await connection.execute(`
      SELECT c.id_contrato, c.nombre_contrato, c.moneda, e.nombre AS empresa_nombre
      FROM Contrato c
      JOIN Empresa e ON c.id_empresa = e.id_empresa
      WHERE c.id_contrato = ?
    `, [id]);

    if (!contrato) {
      return res.status(404).json({ success: false, message: "Contrato no encontrado." });
    }

    // 3. Obtener Grupos de Equipos (Con IDs completos gracias al paso 1)
    const [grupos] = await connection.execute(`
      SELECT 
        eq.id_categoria,
        cat.nombre AS categoria_nombre,
        eq.marca,
        eq.modelo,
        COUNT(eq.id_equipo) AS cantidad,
        GROUP_CONCAT(eq.id_equipo) AS equipos_ids,
        ANY_VALUE(cep.precio_unitario) AS precio_unitario_grupo
      FROM Equipo eq
      JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
      LEFT JOIN Contrato_Equipo_Precios cep 
        ON cep.id_equipo = eq.id_equipo AND cep.id_contrato = eq.id_contrato
      WHERE eq.id_contrato = ?
      GROUP BY eq.id_categoria, cat.nombre, eq.marca, eq.modelo
      ORDER BY cat.nombre, eq.marca, eq.modelo
    `, [id]);

    // 4. Obtener Servicios
    const [servicios] = await connection.execute(`
      SELECT s.id_servicio, s.nombre_servicio
      FROM Contrato_Servicios cs
      JOIN Servicios s ON cs.id_servicio = s.id_servicio
      WHERE cs.id_contrato = ?
    `, [id]);

    // 5. Obtener Totales Guardados
    const [[rowServicios]] = await connection.execute(`
      SELECT valor_total_servicios
      FROM Precio_Contrato WHERE id_contrato = ?
    `, [id]);

    res.json({
      success: true,
      data: {
        contrato,
        gruposDeEquipos: grupos,
        servicios,
        valorServiciosGuardado: rowServicios ? rowServicios.valor_total_servicios : 0.00
      }
    });
  } catch (err) {
    console.error("Error en getDetallesParaValorizar:", err);
    res.status(500).json({ success: false, message: "Error al cargar los detalles." });
  } finally {
    connection.release();
  }
};


const guardarValorizacion = async (req, res, next) => {
    const connection = await db.getConnection();
    try {
        const { id_contrato, precios_equipos, valor_total_servicios } = req.body;

        if (!id_contrato || !Array.isArray(precios_equipos)) {
            return res.status(400).json({ success: false, message: "Datos para guardar inválidos." });
        }

        await connection.beginTransaction();

        for (const grupo of precios_equipos) {
            const { ids, precio_unitario, id_categoria } = grupo;

            // 1. Validación estricta: Asegurar que hay IDs y el precio es válido
            if (!ids || ids.length === 0) continue;
            
            // 2. Sanitización: Convertir a enteros y filtrar inválidos
            const cleanIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);

            if (cleanIds.length === 0) continue;

            // 3. Preparar inserción masiva
            const values = cleanIds.map(id_equipo => [id_contrato, id_categoria, id_equipo, precio_unitario]);

            await connection.query(`
                INSERT INTO Contrato_Equipo_Precios (id_contrato, id_categoria, id_equipo, precio_unitario)
                VALUES ?
                ON DUPLICATE KEY UPDATE precio_unitario = VALUES(precio_unitario)
            `, [values]);
        }

        // Recalcular totales
        const [[{ nuevo_total_equipos }]] = await connection.execute(`
            SELECT SUM(precio_unitario) AS nuevo_total_equipos
            FROM Contrato_Equipo_Precios
            WHERE id_contrato = ?
        `, [id_contrato]);

        await connection.execute(`
            INSERT INTO Precio_Contrato (id_contrato, valor_total_equipos, valor_total_servicios)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                valor_total_equipos = VALUES(valor_total_equipos),
                valor_total_servicios = VALUES(valor_total_servicios)
        `, [id_contrato, nuevo_total_equipos || 0.00, valor_total_servicios || 0.00]);

        await connection.commit();
        res.json({ success: true, message: "Valorización guardada con éxito." });

    } catch (err) {
        await connection.rollback();
        // Loguear el error específico para debug
        console.error("Error en guardarValorizacion:", err.message); 
        // Pasar el error al middleware o responder
        res.status(500).json({ success: false, message: "Error al guardar en base de datos: " + err.message });
    } finally {
        connection.release();
    }
};



//NUEVA API PARA REGISTRO DE USUARIO 
// En src/controllers/admin/general.controller.js
// En src/controllers/admin/general.controller.js

const getUserCompanyRelations = async (req, res) => {
    try {
        const { id } = req.params;
        // CORRECCIÓN AQUÍ: Agregamos 'e.id_empresa' al SELECT
        const [relations] = await db.execute(`
            SELECT e.id_empresa, e.nombre 
            FROM Usuario_Empresas ue
            JOIN Empresa e ON ue.id_empresa = e.id_empresa
            WHERE ue.id_usuario = ?
            ORDER BY e.nombre ASC
        `, [id]);
        
        // Nota: No necesitamos cambiar nada más, el JS ya espera 'id_empresa'
        res.json({ success: true, data: relations });
    } catch (error) {
        console.error("Error al obtener relaciones de usuario:", error);
        res.status(500).json({ success: false, message: "Error en el servidor." });
    }
};

// AÑADE ESTA FUNCIÓN NUEVA
const descargarDocumento = async (req, res) => {
  try {
    const { id_doc } = req.params;
    const user = req.session.user; // Obtiene el usuario de la sesión

    // 1. Verificar que el usuario esté logueado
    if (!user) {
      // Si no hay sesión, puedes enviar un error o redirigir al login
      // Usaremos 'render' ya que parece que tienes vistas de error
      return res.status(401).render("shared/simplemessage", { title: "Error", message: "No autorizado. Por favor, inicie sesión." });
    }

    // 2. Obtener info del documento de la BD
    const [rows] = await db.execute(
      'SELECT * FROM Documentos_Contrato WHERE id_documento = ?',
      [id_doc]
    );

    if (rows.length === 0) {
      return res.status(404).render("shared/simplemessage", { title: "Error", message: "Documento no encontrado." });
    }
    const documento = rows[0];

    // 3. Verificar Autorización (¡La parte de seguridad!)
    // Obtenemos la empresa dueña del contrato al que pertenece el documento
    const [[contrato]] = await db.execute(
      'SELECT id_empresa FROM Contrato WHERE id_contrato = ?',
      [documento.id_contrato]
    );

    let tienePermiso = false;
    if (user.tipo_usuario === 'Administrador') {
      // El Admin puede ver todo
      tienePermiso = true;
    } else {
      // Es Cliente. Revisamos si tiene acceso a esa empresa
      const [empresasUsuario] = await db.execute(
        'SELECT id_empresa FROM Usuario_Empresas WHERE id_usuario = ?',
        [user.id_usuario]
      );
      // 'some' revisa si al menos una de las empresas del usuario coincide
      tienePermiso = empresasUsuario.some(e => e.id_empresa === contrato.id_empresa);
    }

    if (!tienePermiso) {
      return res.status(403).render("shared/simplemessage", { title: "Error", message: "Acceso denegado. No tiene permisos para ver este documento." });
    }

    // 4. Servir el archivo de forma segura
    // (documento.ruta_archivo es 'contratos/file.pdf')
    const filePath = path.join(STORAGE_PATH, documento.ruta_archivo);

    // Usamos res.download() que maneja los headers y usa el 'nombre_original'
    res.download(filePath, documento.nombre_original, (err) => {
      if (err) {
        // Maneja errores, ej: si el archivo no se encuentra en el disco
        console.error("Error al descargar archivo:", err);
        if (!res.headersSent) {
          res.status(404).send('El archivo ya no existe en el servidor.');
        }
      }
    });

  } catch (error) {
    console.error("Error en descargarDocumento:", error);
    res.status(500).send('Error interno del servidor.');
  }
};



///

module.exports = {
  renderMenu,
  renderDashboard,
  renderFormularioEmpresa,
  renderAdministracionCon,
  renderRegistroClie,
  renderServicios,
  renderInformesCli,
  renderVisualizarCons,
  renderVisualizarEmpr,
  renderValorContrato,

  // APIs
  getCategorias,
  getEmpresas,
  registrarCliente,
  registrarUser,
  getUsers,
  getUserSessions,
  updateUserPassword,
  deleteUser,
  getContratos,
  registrarContrato,
  getContratoById,
  updateContrato,
  updateContratoServicios,
  getDocumentosPorContrato,
  eliminarDocumento,
  getContratoServicios,
  getServicios,
  registrarServicio,
  getInformes,
  registrarInforme,
  updateInforme,
  deleteInforme,
  forceLogoutUser,
  getContratosPorEmpresa,
  downloadContractTemplate,
  bulkInsertContracts,
  getContractsForAdminView,
  renderContractDetailView,
  getCompaniesForAdminView,
  getDashboardCharts,
  descargarDocumento,

  ///exportando funcion nueva registor usuario
  getUserCompanyRelations,


  //APIS PARA MARKETIN SERVICIOS. 

  getMissingCompaniesByCategory,
  createAlert,
  listAlerts,
  getAlert,
  updateAlert,
  toggleAlert,
  deleteAlert,

  // APIs de Valorización (Las únicas 3 que necesitas)
  getContratosParaValorizar,
  getDetallesParaValorizar,
  guardarValorizacion
};
