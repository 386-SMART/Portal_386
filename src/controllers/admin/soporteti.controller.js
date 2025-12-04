// src/controllers/admin/soporteti.controller.js
const XLSX = require('xlsx'); 
const db = require('../../../conexiondb'); // Ajusta la ruta a tu conexión


// Renderiza la página principal de Soporte TI con su menú
const renderSoporteMenu = (req, res) => {
    const soporteMenuItems = [
        {path: "/admin/soporteti/soportedashboard",icon: "bi-grid-1x2-fill", label: "PANEL",},
        {path: "/admin/soporteti/inventario",icon: "bi-hdd-rack-fill",label: "Inventario General",},
        {path: "/admin/soporteti/soporteregistroequi",icon: "bi-hdd-stack-fill",label: "Registrar Equipos",},
        {path: "/admin/soporteti/soportesubida_dat",icon: "bi-cloud-arrow-up-fill",label: "Importar Equipos",},
        {path: "/admin/soporteti/soportemigracion",icon: "bi-truck",label: "Migrar Equipos",},
        {path: "/admin/soporteti/gestion-tecnicos",icon: "bi bi-person-badge-fill",label: "Gestion Tecnicos",},
        {path: "/admin/soporteti/soportevisitati",icon: "bi-clipboard2-check-fill",label: "Visita Tecnica",},
        {path: "/admin/soporteti/soportedevolucion",icon: "bi-box-arrow-left",label: "Devolución",},
        {path: "/admin/soporteti/soporteimplementacion",icon: "bi-box-arrow-in-right",label: "Implementación",},
        {path: "/admin/soporteti/soportemantenimiento",icon: "bi-wrench-adjustable-circle-fill",label: "Mantenimiento",},
    ];
    res.render("admins/soporte", {user: req.session.user, menuItems: soporteMenuItems });
};

// Renderiza las sub-páginas de Soporte TI
const renderSoporteDashboard = (req, res) => res.render("admins/soporteti/soportedashboard", { user: req.session.user });
const renderSoporteRegistroEqui = (req, res) => res.render("admins/soporteti/soporteregistroequi", { user: req.session.user, csrfToken: req.session.csrfToken });
const renderSoporteSubida_Dat = (req, res) => res.render("admins/soporteti/soportesubida_dat", { user: req.session.user, csrfToken: req.session.csrfToken });
const renderSoporteMigracion = (req, res) => res.render("admins/soporteti/soportemigracion", { user: req.session.user, csrfToken: req.session.csrfToken });
// En src/controllers/admin/soporteti.controller.js

// En src/controllers/admin/soporteti.controller.js

const renderSoporteVisitaTi = (req, res) => {
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

    res.render("admins/soporteti/soportevisitati", { 
        user: req.session.user,
        tecnicoLink: tecnicoLink 
    });
};

const renderSoporteDevolucion = (req, res) => res.render("admins/soporteti/soportedevolucion", { user: req.session.user });
const renderSoporteImplementacion = (req, res) => res.render("admins/soporteti/soporteimplementacion", { user: req.session.user });
const renderSoporteMantenimiento = (req, res) => res.render("admins/soporteti/soportemantenimiento", { user: req.session.user });

// Renderiza la página de gestión de técnicos con datos de la BD
const renderGestionTecnicos = async (req, res) => {
    try {
        const [tecnicos] = await db.execute("SELECT * FROM Tecnicos ORDER BY apellido, nombre");
        res.render('admins/soporteti/gestion-tecnicos', { 
            user: req.session.user,
            tecnicos: tecnicos,
            csrfToken: req.session.csrfToken
        });
    } catch (error) {
        res.status(500).send("Error al cargar la página de gestión de técnicos.");
    }
};




const registrarEquipoTemporal = async (req, res) => { try {
        const {
            id_contrato,
            id_categoria,
            marca,
            modelo,
            part_number,
            num_serie,
            caracteristicas,
            ct_cargador,
            ct_teclado,
            ct_mouse,
            estado
        } = req.body;

        // Validación básica
        if (!id_contrato || !id_categoria || !num_serie) {
            return res.status(400).json({ success: false, message: 'Contrato, Categoría y Número de Serie son obligatorios.' });
        }

        const sql = `
            INSERT INTO Temporal_Equipos 
            (id_contrato, id_categoria, marca, modelo, part_number, num_serie, caracteristicas, ct_cargador, ct_teclado, ct_mouse, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.execute(sql, [
            id_contrato, id_categoria, marca || null, modelo || null, part_number || null,
            num_serie, caracteristicas || null, ct_cargador || null, ct_teclado || null,
            ct_mouse || null, estado
        ]);

        res.status(201).json({ success: true, message: 'Equipo registrado en temporal correctamente.' });

    } catch (err) {
        console.error("Error en POST /api/temporal-equipos:", err);
        // Manejar error de duplicado de número de serie si lo tuvieras como UNIQUE
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'El número de serie ya existe.' });
        }
        res.status(500).json({ success: false, message: 'Error interno al registrar el equipo.' });
    }
};

const generarPlantillaEquipos = (req, res) => {
    const headers = [
        "id_contrato", 
        "id_categoria", 
        "marca", 
        "modelo", 
        "part_number", 
        "num_serie", 
        "caracteristicas", 
        "ct_cargador", 
        "ct_teclado", 
        "ct_mouse", 
        "estado"
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "PlantillaEquipos");

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Carga_Equipos.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
};



const validarExcel = (req, res) => {
    console.log('DEBUG validarExcel:', {
        hasFile: !!req.file,
        hasFiles: !!req.files,
        body: req.body,
        fieldname: req.file?.fieldname
    });

    if (!req.file) {
            return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo.' });
        }
    
        try {
            // Leer el archivo desde el buffer en memoria
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
    
            // Convertir la hoja de cálculo a un array de objetos JSON
            const data = XLSX.utils.sheet_to_json(worksheet);
    
            res.json({ success: true, data: data, recordCount: data.length });
        } catch (error) {
            console.error("Error procesando el archivo Excel:", error);
            res.status(500).json({ success: false, message: 'Error al procesar el archivo.' });
        }
};

const registroMasivoTemporal = async (req, res) => {
    let equipos = req.body; // Se espera un array de objetos

    console.log('DEBUG registroMasivoTemporal - raw body:', {
        isArray: Array.isArray(equipos),
        length: equipos?.length
    });

    if (!equipos || !Array.isArray(equipos) || equipos.length === 0) {
        return res.status(400).json({ success: false, message: 'No se recibieron datos de equipos para guardar.' });
    }

    // Remove CSRF tokens from array items
    equipos = equipos.map(item => {
        const { _csrf, ...cleanItem } = item;
        return cleanItem;
    });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const values = equipos.map(e => [
    e.id_contrato, 
    e.id_categoria, 
    e.marca || null, 
    e.modelo || null, 
    e.part_number || null, 
    e.num_serie, 
    e.caracteristicas || null, 
    e.ct_cargador || null, 
    e.ct_teclado || null, 
    e.ct_mouse || null, 
    e.estado || 'En Almacén'
]);

const sql = `
    INSERT INTO Temporal_Equipos (
        id_contrato, id_categoria, marca, modelo, part_number, 
        num_serie, caracteristicas, ct_cargador, ct_teclado, ct_mouse, estado
    )
    VALUES ?
`;


        await connection.query(sql, [values]);
        await connection.commit();
        
        res.status(201).json({ success: true, message: `${equipos.length} equipos han sido registrados con éxito.` });

    } catch (error) {
        await connection.rollback();
        console.error("Error en la inserción masiva:", error);
        res.status(500).json({ success: false, message: 'Error en la base de datos al guardar los equipos.' });
    } finally {
        connection.release();
    }
 };

const getResumenTemporal = async (req, res) => { 
    const { contratoId } = req.query;
    if (!contratoId) {
        return res.status(400).json({ success: false, message: 'Se requiere un ID de contrato.' });
    }

    try {
        // Query 1: Obtener el conteo total de equipos para el contrato
        const [[{ total }]] = await db.execute(
            'SELECT COUNT(*) as total FROM Temporal_Equipos WHERE id_contrato = ?',
            [contratoId]
        );

        // Query 2: Obtener el resumen por categoría
        const [categorias] = await db.execute(`
            SELECT cat.nombre as categoria_nombre, COUNT(tmp.id_temp) as cantidad
            FROM Temporal_Equipos tmp
            JOIN Categoria cat ON tmp.id_categoria = cat.id_categoria
            WHERE tmp.id_contrato = ?
            GROUP BY cat.nombre
            ORDER BY cantidad DESC
        `, [contratoId]);

        res.json({ 
            success: true, 
            summary: {
                totalEquipos: total,
                resumenPorCategoria: categorias
            }
        });

    } catch (error) {
        console.error("Error obteniendo el resumen de equipos temporales:", error);
        res.status(500).json({ success: false, message: 'Error al obtener el resumen.' });
    }
 };

const migrarEquipos = async (req, res) => {
    const { contratoId } = req.body;
    if (!contratoId) {
        return res.status(400).json({ success: false, message: 'Se requiere un ID de contrato.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Paso 1: Copiar los datos de Temporal_Equipos a Equipo
        // Nos aseguramos de que las columnas coincidan en orden y nombre
        const [result] = await connection.execute(`
    INSERT INTO Equipo (
        id_contrato, id_categoria, id_reemplazo, marca, modelo, part_number, 
        num_serie, caracteristicas, ct_cargador, ct_teclado, ct_mouse, estado
    )
    SELECT 
        id_contrato, id_categoria, id_reemplazo, marca, modelo, part_number, 
        num_serie, caracteristicas, ct_cargador, ct_teclado, ct_mouse, estado
    FROM Temporal_Equipos
    WHERE id_contrato = ?
`, [contratoId]);

        // Paso 2: Eliminar los registros migrados de la tabla temporal
        await connection.execute(
            'DELETE FROM Temporal_Equipos WHERE id_contrato = ?',
            [contratoId]
        );

        await connection.commit();
        
        res.json({ success: true, message: `${result.affectedRows} equipos han sido migrados con éxito al inventario principal.` });

    } catch (error) {
        await connection.rollback();
        console.error("Error durante la migración de equipos:", error);
        // El error ER_DUP_ENTRY es común si un num_serie ya existe en la tabla final 'Equipo'
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'Error: Se encontró un número de serie duplicado. No se migró ningún equipo.' });
        }
        res.status(500).json({ success: false, message: 'Ocurrió un error en la base de datos durante la migración.' });
    } finally {
        connection.release();
    }
};

const getEmpresasConTemporales = async (req, res) => { 
try {
        const [empresas] = await db.execute(`
            SELECT DISTINCT e.id_empresa, e.nombre 
            FROM Empresa e
            JOIN Contrato c ON e.id_empresa = c.id_empresa
            JOIN Temporal_Equipos tmp ON c.id_contrato = tmp.id_contrato
            ORDER BY e.nombre
        `);
        res.json({ success: true, data: empresas });
    } catch (error) {
        console.error("Error obteniendo empresas con equipos temporales:", error);
        res.status(500).json({ success: false, message: 'Error al obtener las empresas.' });
    }

};

const getContratosConTemporales = async (req, res) => {
    try {
        const { empresaId } = req.params;
        const [contratos] = await db.execute(`
            SELECT DISTINCT c.id_contrato, c.nombre_contrato
            FROM Contrato c
            JOIN Temporal_Equipos tmp ON c.id_contrato = tmp.id_contrato
            WHERE c.id_empresa = ?
            ORDER BY c.nombre_contrato
        `, [empresaId]);
        res.json({ success: true, data: contratos });
    } catch (error) {
        console.error("Error obteniendo contratos con equipos temporales:", error);
        res.status(500).json({ success: false, message: 'Error al obtener los contratos.' });
    }
};


// --- APIs DE GESTIÓN DE TÉCNICOS ---
const getTecnicos = async (req, res) => {
     try {
        const [tecnicos] = await db.execute("SELECT id_tecnico, nombre, apellido, dni FROM Tecnicos ORDER BY apellido, nombre");
        res.json({ success: true, data: tecnicos });
    } catch (error) {
        console.error("Error al obtener la lista de técnicos:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const createTecnico = async (req, res) => {
    try {
        const { nombre, apellido, dni } = req.body;
        
        // 1. Verificar si se subió un archivo
        // Multer nos da req.file.filename. Construimos la ruta relativa para la BD.
        const firmaPath = req.file ? `firmas/tecnicos/${req.file.filename}` : null;

        if (!nombre || !apellido || !dni) {
            return res.status(400).json({ success: false, message: 'Nombre, apellido y DNI son requeridos.' });
        }

        const sql = 'INSERT INTO Tecnicos (nombre, apellido, dni, firma_path) VALUES (?, ?, ?, ?)';
        await db.execute(sql, [nombre, apellido, dni, firmaPath]);
        
        res.status(201).json({ success: true, message: 'Técnico creado con éxito.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'El DNI ingresado ya existe.' });
        }
        console.error("Error al crear técnico:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};


const updateTecnico = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, dni } = req.body;
        
        let sql;
        let params;

        // 2. Lógica de actualización
        if (req.file) {
            // SI el usuario subió una nueva firma, actualizamos todo INCLUYENDO la ruta
            const nuevaFirmaPath = `firmas/tecnicos/${req.file.filename}`;
            sql = 'UPDATE Tecnicos SET nombre = ?, apellido = ?, dni = ?, firma_path = ? WHERE id_tecnico = ?';
            params = [nombre, apellido, dni, nuevaFirmaPath, id];
        } else {
            // SI NO subió firma, solo actualizamos los datos de texto (mantenemos la firma vieja)
            sql = 'UPDATE Tecnicos SET nombre = ?, apellido = ?, dni = ? WHERE id_tecnico = ?';
            params = [nombre, apellido, dni, id];
        }

        await db.execute(sql, params);
        res.json({ success: true, message: 'Técnico actualizado con éxito.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: 'El DNI ingresado ya pertenece a otro técnico.' });
        }
        console.error("Error al actualizar técnico:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};


const deleteTecnico = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar si el técnico tiene informes asociados
        const [[informesAsociados]] = await db.execute(
            'SELECT COUNT(*) as total FROM InformeCampo WHERE id_tecnico = ?',
            [id]
        );
        
        if (informesAsociados.total > 0) {
            return res.status(409).json({ 
                success: false, 
                message: `No se puede eliminar este técnico porque tiene ${informesAsociados.total} informe(s) asociado(s). Elimine los informes primero.` 
            });
        }
        
        await db.execute('DELETE FROM Tecnicos WHERE id_tecnico = ?', [id]);
        res.json({ success: true, message: 'Técnico eliminado con éxito.' });
    } catch (error) {
        console.error("Error al eliminar técnico:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};


// --- API DASHBOARD SOPORTE ---
const getSoporteSummary = async (req, res) => {
    try {
        // 1. Equipos en preparación (tabla temporal)
        const [[{ en_preparacion }]] = await db.execute('SELECT COUNT(*) as en_preparacion FROM Temporal_Equipos');
        
        // 2. Equipos en inventario principal (tabla final)
        const [[{ en_inventario }]] = await db.execute('SELECT COUNT(*) as en_inventario FROM Equipo');

        // 3. Resumen de estados del inventario principal (para el gráfico)
        const [estados] = await db.execute('SELECT estado, COUNT(*) as cantidad FROM Equipo GROUP BY estado');

        // 4. Top 5 contratos con más equipos en preparación
        const [top_contratos] = await db.execute(`
            SELECT c.nombre_contrato, e.nombre as nombre_empresa, COUNT(tmp.id_temp) as cantidad
            FROM Temporal_Equipos tmp
            JOIN Contrato c ON tmp.id_contrato = c.id_contrato
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            GROUP BY c.id_contrato
            ORDER BY cantidad DESC
            LIMIT 5
        `);

        res.json({
            success: true,
            kpis: {
                enPreparacion: en_preparacion,
                enInventario: en_inventario,
            },
            graficoEstados: estados,
            topContratosPendientes: top_contratos
        });

    } catch (error) {
        console.error("Error generando el resumen del dashboard de soporte:", error);
        res.status(500).json({ success: false, message: 'Error al obtener los datos del dashboard.' });
    }
};

// --- GESTIÓN DE USUARIOS CLIENTE (PARA TÉCNICOS) ---
const getUsuariosCliente = async (req, res) => {
    try {
        // Obtener todos los usuarios tipo 'Cliente' de la empresa 386 SMART S.A.C (id_empresa_predeterminada = 1)
        const sql = `
            SELECT l.id_usuario, l.nombre, l.username, l.tipo_usuario, l.created_at
            FROM Login l
            WHERE l.tipo_usuario = 'Cliente' AND l.id_empresa_predeterminada = 1
            ORDER BY l.nombre ASC
        `;
        const [usuarios] = await db.execute(sql);
        res.json({ success: true, data: usuarios });
    } catch (error) {
        console.error("Error al obtener usuarios cliente:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const createUsuarioCliente = async (req, res) => {
    try {
        const { nombre, username, password, confirmPassword } = req.body;

        // Validaciones
        if (!nombre || !username || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        // Verificar que el username no exista
        const [[existeUsername]] = await db.execute('SELECT id_usuario FROM Login WHERE username = ?', [username]);
        if (existeUsername) {
            return res.status(409).json({ success: false, message: 'El usuario (username) ya existe en el sistema.' });
        }

        // Cifrar contraseña
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar usuario con empresa predeterminada 386 SMART S.A.C (id_empresa_predeterminada = 1)
        const sql = `
            INSERT INTO Login (nombre, username, password, tipo_usuario, id_empresa_predeterminada, created_at)
            VALUES (?, ?, ?, 'Cliente', 1, NOW())
        `;
        await db.execute(sql, [nombre, username, hashedPassword]);

        res.status(201).json({ success: true, message: 'Usuario cliente creado con éxito.' });
    } catch (error) {
        console.error("Error al crear usuario cliente:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const updateUsuarioCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, username, password, confirmPassword } = req.body;

        if (!nombre || !username) {
            return res.status(400).json({ success: false, message: 'Nombre y usuario (username) son obligatorios.' });
        }

        // Verificar que el username no esté en uso por otro usuario
        const [[otroUsername]] = await db.execute(
            'SELECT id_usuario FROM Login WHERE username = ? AND id_usuario != ?',
            [username, id]
        );
        if (otroUsername) {
            return res.status(409).json({ success: false, message: 'El usuario (username) ya está en uso por otro usuario.' });
        }

        // Verificar si se proporciona contraseña para actualizar
        let sql;
        let params;

        if (password) {
            // Validar contraseña si se proporciona
            if (password !== confirmPassword) {
                return res.status(400).json({ success: false, message: 'Las contraseñas no coinciden.' });
            }
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
            }

            // Cifrar la nueva contraseña
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);

            // Actualizar nombre, username y contraseña
            sql = 'UPDATE Login SET nombre = ?, username = ?, password = ? WHERE id_usuario = ? AND id_empresa_predeterminada = 1';
            params = [nombre, username, hashedPassword, id];
        } else {
            // Actualizar solo nombre y username
            sql = 'UPDATE Login SET nombre = ?, username = ? WHERE id_usuario = ? AND id_empresa_predeterminada = 1';
            params = [nombre, username, id];
        }

        await db.execute(sql, params);

        res.json({ success: true, message: 'Usuario actualizado con éxito.' });
    } catch (error) {
        console.error("Error al actualizar usuario cliente:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const deleteUsuarioCliente = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar que el usuario pertenece a empresa 386 SMART (id_empresa_predeterminada = 1)
        const [[usuario]] = await db.execute(
            'SELECT id_usuario FROM Login WHERE id_usuario = ? AND id_empresa_predeterminada = 1',
            [id]
        );
        
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }

        await db.execute('DELETE FROM Login WHERE id_usuario = ?', [id]);
        res.json({ success: true, message: 'Usuario eliminado con éxito.' });
    } catch (error) {
        console.error("Error al eliminar usuario cliente:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// ============== INVENTARIO GENERAL ==============

// Renderiza la página de Inventario General
const renderInventarioGeneral = async (req, res) => {
    try {
        res.render('admins/soporteti/inventario', { 
            user: req.session.user,
            csrfToken: req.session.csrfToken 
        });
    } catch (error) {
        console.error("Error al renderizar inventario:", error);
        res.status(500).send("Error al cargar la página de inventario.");
    }
};

// Obtiene equipos paginados con información de empresa y contrato
const getInventarioPaginado = async (req, res) => {
    try {
        const { page = 1, limit = 20, empresa = '', estado = '', busqueda = '' } = req.query;
        const pageInt = parseInt(page) || 1;
        const limitInt = parseInt(limit) || 20;
        const offset = (pageInt - 1) * limitInt;

        // Array de parámetros para WHERE
        let whereConditions = [];
        let whereParams = [];

        if (empresa && empresa.trim()) {
            whereConditions.push('e.id_empresa = ?');
            whereParams.push(empresa);
        }

        if (estado && estado.trim()) {
            whereConditions.push('eq.estado = ?');
            whereParams.push(estado);
        }

        if (busqueda && busqueda.trim()) {
            whereConditions.push('(eq.num_serie LIKE ? OR eq.marca LIKE ? OR eq.modelo LIKE ? OR e.nombre LIKE ?)');
            whereParams.push(`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`);
        }

        // Construir WHERE clause
        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : 'WHERE 1=1';

        // Query para contar total de registros
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            ${whereClause}
        `;

        const [countResult] = await db.execute(countQuery, whereParams);
        const total = countResult[0]?.total || 0;

        // Query para obtener equipos con paginación
        const query = `
            SELECT 
                eq.id_equipo,
                eq.id_contrato,
                eq.marca,
                eq.modelo,
                eq.part_number,
                eq.num_serie,
                eq.caracteristicas,
                eq.estado,
                e.nombre as nombre_empresa,
                e.id_empresa,
                c.id_contrato,
                c.fecha_inicio,
                c.fecha_fin,
                cat.nombre as categoria_nombre
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            LEFT JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
            ${whereClause}
            ORDER BY eq.id_equipo DESC
            LIMIT ${limitInt} OFFSET ${offset}
        `;

        const [equipos] = await db.execute(query, whereParams);

        res.json({
            success: true,
            data: equipos,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total: total,
                pages: Math.ceil(total / limitInt)
            }
        });
    } catch (error) {
        console.error("Error al obtener inventario paginado:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Obtiene estadísticas del inventario (solo gráficos)
const getEstadisticasInventario = async (req, res) => {
    try {
        // Total de equipos por estado (para gráfico pastel)
        const [equiposPorEstado] = await db.execute(`
            SELECT 
                estado,
                COUNT(*) as cantidad
            FROM Equipo
            GROUP BY estado
            ORDER BY cantidad DESC
        `);

        res.json({
            success: true,
            equiposPorEstado: equiposPorEstado
        });
    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Obtiene datos específicos para gráficos
const getGraficosInventario = async (req, res) => {
    try {
        // Datos para gráfico de estado
        const [estadoData] = await db.execute(`
            SELECT 
                estado,
                COUNT(*) as cantidad
            FROM Equipo
            GROUP BY estado
        `);

        // Datos para gráfico de empresa
        const [empresaData] = await db.execute(`
            SELECT 
                e.id_empresa,
                e.nombre,
                COUNT(eq.id_equipo) as cantidad
            FROM Empresa e
            LEFT JOIN Contrato c ON e.id_empresa = c.id_empresa
            LEFT JOIN Equipo eq ON c.id_contrato = eq.id_contrato
            GROUP BY e.id_empresa, e.nombre
            HAVING cantidad > 0
            ORDER BY cantidad DESC
            LIMIT 10
        `);

        // Datos para gráfico de categoría
        const [categoriaData] = await db.execute(`
            SELECT 
                cat.nombre as categoria,
                COUNT(eq.id_equipo) as cantidad
            FROM Categoria cat
            LEFT JOIN Equipo eq ON cat.id_categoria = eq.id_categoria
            GROUP BY cat.id_categoria, cat.nombre
            HAVING cantidad > 0
            ORDER BY cantidad DESC
        `);

        res.json({
            success: true,
            estado: estadoData,
            empresa: empresaData,
            categoria: categoriaData
        });
    } catch (error) {
        console.error("Error al obtener datos de gráficos:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Obtiene detalles completos de un equipo específico
const getDetalleEquipo = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener detalles del equipo y contrato
        const [detalle] = await db.execute(`
            SELECT 
                eq.*,
                e.id_empresa,
                e.nombre as nombre_empresa,
                e.direccion,
                e.slug,
                c.id_contrato,
                c.nombre_contrato,
                c.fecha_inicio,
                c.fecha_fin,
                c.implementacion,
                c.mantenimiento,
                c.devolucion_de_equipos,
                c.preparacion_de_imagen,
                cat.nombre as categoria_nombre
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            LEFT JOIN Categoria cat ON eq.id_categoria = cat.id_categoria
            WHERE eq.id_equipo = ?
        `, [id]);

        if (detalle.length === 0) {
            return res.status(404).json({ success: false, message: 'Equipo no encontrado.' });
        }

        res.json({
            success: true,
            data: detalle[0]
        });
    } catch (error) {
        console.error("Error al obtener detalle de equipo:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Obtiene lista de empresas con equipos para el filtro
const getEmpresasInventario = async (req, res) => {
    try {
        const [empresas] = await db.execute(`
            SELECT DISTINCT 
                e.id_empresa,
                e.nombre,
                COUNT(eq.id_equipo) as cantidad_equipos
            FROM Empresa e
            INNER JOIN Contrato c ON e.id_empresa = c.id_empresa
            INNER JOIN Equipo eq ON c.id_contrato = eq.id_contrato
            GROUP BY e.id_empresa, e.nombre
            ORDER BY e.nombre ASC
        `);

        res.json({
            success: true,
            data: empresas
        });
    } catch (error) {
        console.error("Error al obtener empresas del inventario:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

module.exports = {
    renderSoporteMenu,
    renderSoporteDashboard,
    renderSoporteRegistroEqui,
    renderSoporteSubida_Dat,
    renderSoporteMigracion,
    renderSoporteVisitaTi,
    renderSoporteDevolucion,
    renderSoporteImplementacion,
    renderSoporteMantenimiento,
    renderGestionTecnicos,

    registrarEquipoTemporal,
    generarPlantillaEquipos,
    validarExcel,
    registroMasivoTemporal,
    getResumenTemporal,
    migrarEquipos,
    getEmpresasConTemporales,
    getContratosConTemporales,
    getTecnicos,
    createTecnico,
    updateTecnico,
    deleteTecnico,
    getSoporteSummary,
    getUsuariosCliente,
    createUsuarioCliente,
    updateUsuarioCliente,
    deleteUsuarioCliente,
    renderInventarioGeneral,
    getInventarioPaginado,
    getEstadisticasInventario,
    getGraficosInventario,
    getDetalleEquipo,
    getEmpresasInventario
};


