// src/controllers/public.controller.js

const db = require('../../conexiondb');
const bcrypt = require('bcrypt');

// --- Controladores para la Vista de TV ---

const showPublicView = (req, res) => {
    if (req.params.token !== process.env.PUBLIC_VIEW_TOKEN) {
        return res.status(403).send('Acceso no autorizado.');
    }
    res.render('admins/casti/vistas-tickets-tv', {
        token: req.params.token
    });
};

const getPublicTicketStatus = async (req, res) => {
    if (req.params.token !== process.env.PUBLIC_VIEW_TOKEN) {
        return res.status(403).json({ success: false, message: 'Acceso no autorizado.' });
    }
    try {
        const [tickets] = await db.execute(`
            SELECT 
                c.Id_cass, 
                c.Codigo_Aranda, 
                c.Fecha_Pedido, 
                c.LLegada_de_pieza, 
                c.Devolver_pieza, 
                c.ERDT, 
                c.Claim, 
                c.Observaciones,
                c.Estado,
                e.nombre AS nombre_empresa
            FROM CasTi c
            LEFT JOIN Empresa e ON c.id_empresa = e.id_empresa
            WHERE c.Claim IS NOT NULL OR c.ERDT IS NOT NULL OR c.LLegada_de_pieza IS NOT NULL OR c.Fecha_Pedido IS NOT NULL
            ORDER BY c.Id_cass DESC
        `);
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const ticketsConEstado = tickets.map(ticket => {
            let status = { text: 'Pendiente', color: 'light', icon: 'bi-question-circle', prioridad: 999 };
            
            if (ticket.Claim) {
                status = { text: 'Finalizado y Devuelto', color: 'success', icon: 'bi-check-circle-fill', prioridad: 6 };
            } else if (ticket.ERDT) {
                status = { text: 'Devolución Extendida', color: 'info', icon: 'bi-clock-history', prioridad: 5 };
            } else if (ticket.LLegada_de_pieza) {
                const devolucion = new Date(ticket.Devolver_pieza || ticket.ERDT);
                const diffDias = (devolucion - hoy) / (1000 * 60 * 60 * 24);
                
                if (diffDias < 0) {
                    status = { text: 'Devolución Vencida', color: 'danger', icon: 'bi-exclamation-triangle-fill', prioridad: 4 };
                } else if (diffDias < 3) {
                    status = { text: 'Próximo a Devolver', color: 'warning', icon: 'bi-alarm-fill', prioridad: 3 };
                } else {
                    status = { text: 'En Proceso de Reparación', color: 'primary', icon: 'bi-tools', prioridad: 2 };
                }
            } else if (ticket.Fecha_Pedido) {
                status = { text: 'En Espera de Pieza', color: 'secondary', icon: 'bi-box-seam', prioridad: 1 };
            }
            
            return { ...ticket, status };
        });
        
        // Filtrar solo tickets con estados válidos (prioridad < 999) y ordenar por prioridad
        const ticketsValidos = ticketsConEstado
            .filter(t => t.status.prioridad < 999)
            .sort((a, b) => a.status.prioridad - b.status.prioridad);
        
        res.json({ success: true, data: ticketsValidos });
    } catch (error) {
        console.error('Error al obtener tickets:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};


// --- Controladores para el Portal de Técnicos ---

const showTecnicoLogin = (req, res) => {
    res.render('public_tecnico/logintecnico', { csrfToken: req.session.csrfToken });
};


// 2. Procesa el formulario de login
const processTecnicoLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const ip = req.ip || req.connection.remoteAddress;

        if (!username || !password) {
            return res.render('public_tecnico/logintecnico', { 
                error: 'Username y contraseña son obligatorios.',
                csrfToken: req.session.csrfToken
            });
        }

        // 1. VERIFICAR SI ESTÁ BLOQUEADO POR INTENTOS FALLIDOS
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const [[failedAttempts]] = await db.execute(
            `SELECT COUNT(*) as total FROM LoginAttempts 
             WHERE username = ? AND success = FALSE AND attempt_time > ? 
             LIMIT 6`,
            [username, fiveMinutesAgo]
        );

        if (failedAttempts.total >= 6) {
            // Bloqueado temporalmente
            await db.execute(
                'INSERT INTO LoginAttempts (username, ip_address, success) VALUES (?, ?, FALSE)',
                [username, ip]
            );
            
            return res.render('public_tecnico/logintecnico', { 
                error: '❌ Cuenta bloqueada por excesivos intentos fallidos. Intenta de nuevo en 5 minutos.',
                csrfToken: req.session.csrfToken,
                blocked: true
            });
        }

        // 2. INTENTAR AUTENTICACIÓN
        const sql = `
            SELECT id_usuario, password, nombre
            FROM Login 
            WHERE username = ? AND tipo_usuario = 'Cliente' AND id_empresa_predeterminada = 1`;
            
        const [usuarios] = await db.execute(sql, [username]);
        
        if (usuarios.length === 0) {
            // Usuario no existe o no es Cliente de empresa 1
            await db.execute(
                'INSERT INTO LoginAttempts (username, ip_address, success) VALUES (?, ?, FALSE)',
                [username, ip]
            );
            
            return res.render('public_tecnico/logintecnico', { 
                error: '❌ Usuario o contraseña incorrectos.',
                csrfToken: req.session.csrfToken
            });
        }
        
        const usuario = usuarios[0];
        const match = await bcrypt.compare(password, usuario.password);

        if (match) {
            // ✅ LOGIN EXITOSO
            // Registrar intento exitoso
            await db.execute(
                'INSERT INTO LoginAttempts (username, ip_address, success) VALUES (?, ?, TRUE)',
                [username, ip]
            );
            
            // Limpiar intentos fallidos anteriores
            await db.execute(
                'DELETE FROM LoginAttempts WHERE username = ? AND success = FALSE AND attempt_time < ?',
                [username, fiveMinutesAgo]
            );
            
            // Crear sesión
            req.session.usuarioTecnicoId = usuario.id_usuario;
            req.session.usuarioTecnicoNombre = usuario.nombre;  // ✅ AGREGAR NOMBRE A SESIÓN
            res.redirect('/menu-central');
        } else {
            // ❌ CONTRASEÑA INCORRECTA
            const [[newFailedCount]] = await db.execute(
                `SELECT COUNT(*) as total FROM LoginAttempts 
                 WHERE username = ? AND success = FALSE AND attempt_time > ? 
                 LIMIT 6`,
                [username, fiveMinutesAgo]
            );
            
            await db.execute(
                'INSERT INTO LoginAttempts (username, ip_address, success) VALUES (?, ?, FALSE)',
                [username, ip]
            );
            
            const intentosRestantes = 6 - (newFailedCount.total + 1);
            let mensaje = '❌ Usuario o contraseña incorrectos.';
            
            if (intentosRestantes > 0) {
                mensaje += ` Intentos restantes: ${intentosRestantes}.`;
            } else {
                mensaje = '❌ Cuenta bloqueada por excesivos intentos fallidos. Intenta de nuevo en 5 minutos.';
            }
            
            return res.render('public_tecnico/logintecnico', { 
                error: mensaje,
                csrfToken: req.session.csrfToken
            });
        }
    } catch (error) {
        console.error("Error en el login del técnico:", error);
        res.render('public_tecnico/logintecnico', { 
            error: '❌ Ocurrió un error en el servidor.',
            csrfToken: req.session.csrfToken
        });
    }
};

const showMenuCentral = (req, res) => {
    res.render('public_tecnico/menucentral');
};


const showInformeCampo = (req, res) => {
    res.render('public_tecnico/informecampo', { csrfToken: req.session.csrfToken });
};


const processTecnicoLogout = (req, res) => {
    const sessionId = req.sessionID;
    req.session.destroy(async err => {
        if (err) {
            console.error("Error al cerrar sesión:", err);
            return res.redirect('/');
        }
        try {
            await db.execute('DELETE FROM sessions WHERE session_id = ?', [sessionId]);
        } catch (dbError) {
            console.error("Error al eliminar la sesión de la BD:", dbError);
        }
        res.clearCookie('connect.sid');
        res.redirect('/acceso-tecnico');
    });
};


// --- Controladores para las APIs Públicas ---


const buscarEquipoPorSerie = async (req, res) => {
    try {
        const { serie } = req.params;
        const sql = `
            SELECT 
                eq.id_equipo, eq.num_serie, eq.modelo, eq.part_number,
                c.id_contrato, c.nombre_contrato,
                e.id_empresa, e.nombre AS nombre_empresa
            FROM Equipo eq
            JOIN Contrato c ON eq.id_contrato = c.id_contrato
            JOIN Empresa e ON c.id_empresa = e.id_empresa
            WHERE eq.num_serie = ?`;
        const [equipos] = await db.execute(sql, [serie]);
        if (equipos.length === 0) {
            return res.status(404).json({ success: false, message: 'Equipo no encontrado.' });
        }
        res.json({ success: true, data: equipos[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }
};


const buscarCasTI = async (req, res) => {

    try {
        const { codigo } = req.query;
        if (!codigo) {
            return res.status(400).json({ success: false, message: 'Se requiere un código de ticket.' });
        }
        
        // --- CORRECCIÓN AQUÍ: Usamos TRIM() para ignorar espacios ---
        const sql = `
            SELECT Id_cass, Codigo_Aranda, Numero_Pedido 
            FROM CasTi 
            WHERE TRIM(Codigo_Aranda) = ? 
            LIMIT 1`;
            
        const [tickets] = await db.execute(sql, [codigo.trim()]); // También limpiamos el input
        
        if (tickets.length === 0) {
            return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
        }
        
        res.json({ success: true, data: tickets[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error interno del servidor.' });
    }

}; 



const buscarTI_empresa = async (req, res) => {

    try {
        const { empresaId } = req.params;
        const [contactos] = await db.execute("SELECT id_ti_usuario, Nombre, Correo, Cel FROM Client_Ti WHERE id_empresa = ?", [empresaId]);
        res.json({ success: true, data: contactos });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener contactos.' });
    }

};



const guardarInforme = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const fs = require('fs');
        const path = require('path');
        const STORAGE_PATH = path.join(__dirname, '..', '..', 'storage');
        
        await connection.beginTransaction();
        const data = req.body;

        // 1. GUARDAR FIRMAS EN CARPETAS RESPECTIVAS
        let rutaFirmaUsuario = null;
        let rutaFirmaTecnico = null;

        // Procesar firma del usuario/cliente (Base64 Canvas)
        if (data.firma_usuario && data.firma_usuario.startsWith('data:image')) {
            try {
                const base64Data = data.firma_usuario.replace(/^data:image\/\w+;base64,/, '');
                const bufferFirma = Buffer.from(base64Data, 'base64');
                const nombreFirmaCliente = `firma-cliente-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
                const rutaClienteFirmas = path.join(STORAGE_PATH, 'firmas', 'clientes');
                fs.mkdirSync(rutaClienteFirmas, { recursive: true });
                const rutaCompleta = path.join(rutaClienteFirmas, nombreFirmaCliente);
                fs.writeFileSync(rutaCompleta, bufferFirma);
                rutaFirmaUsuario = `firmas/clientes/${nombreFirmaCliente}`;
            } catch (err) {
                console.error('Error guardando firma cliente:', err);
            }
        }

        // Procesar firma del técnico (puede ser Base64 Canvas O ruta del archivo PNG guardado)
        if (data.firma_tecnico) {
            if (data.firma_tecnico.startsWith('data:image')) {
                // Es un dibujo de canvas (Base64)
                try {
                    const base64Data = data.firma_tecnico.replace(/^data:image\/\w+;base64,/, '');
                    const bufferFirma = Buffer.from(base64Data, 'base64');
                    const nombreFirmaTecnico = `firma-tecnico-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
                    const rutaTecnicoFirmas = path.join(STORAGE_PATH, 'firmas', 'tecnicos');
                    fs.mkdirSync(rutaTecnicoFirmas, { recursive: true });
                    const rutaCompleta = path.join(rutaTecnicoFirmas, nombreFirmaTecnico);
                    fs.writeFileSync(rutaCompleta, bufferFirma);
                    rutaFirmaTecnico = `firmas/tecnicos/${nombreFirmaTecnico}`;
                } catch (err) {
                    console.error('Error guardando firma técnico:', err);
                }
            } else {
                // Ya es una ruta (viene del perfil del técnico)
                rutaFirmaTecnico = data.firma_tecnico;
            }
        }

        // 2. Insertar datos del informe
        const sqlInforme = `
            INSERT INTO InformeCampo (
                tipo_informe, id_equipo, id_casti, ticket_manual, numero_pedido_manual,
                firmante_id, firmante_type, id_tecnico, 
                usuario_cliente_manual, direccion_manual, sede_manual, nombre_equipo_manual, 
                fecha_servicio, incidente_reportado, revision_inicial, acciones_realizadas, 
                estado_equipo, observaciones, hora_inicio, hora_finalizacion, 
                firma_usuario, firma_tecnico
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const [informeResult] = await connection.execute(sqlInforme, [
            data.tipo_informe || 'Visita Técnica', 
            data.id_equipo, 
            data.id_casti || null, 
            data.ticket_manual || null,
            data.numero_pedido_manual || null,
            data.firmante_id || null, 
            data.firmante_type || null, 
            data.id_tecnico,
            data.usuario_cliente_manual, data.direccion_manual, data.sede_manual, data.nombre_equipo_manual,
            data.fecha_servicio, data.incidente_reportado, data.revision_inicial, data.acciones_realizadas,
            data.estado_equipo, data.observaciones, data.hora_inicio, data.hora_finalizacion,
            rutaFirmaUsuario, rutaFirmaTecnico
        ]);

        const newInformeId = informeResult.insertId;

        // 2. LÓGICA FLEXIBLE DE FOTOS
        if (req.files && req.files.length > 0) {
            
            // Diccionario: Nombre del Input HTML -> Valor para la Base de Datos (columna tipo_foto)
            const mapaDeTipos = {
                'foto_general': 'general',
                'foto_uefi': 'uefi',
                'foto_pieza1': 'reemplazada1',
                'foto_pieza2': 'reemplazada2',
                'foto_extra': 'otra'
                // Si mañana creas un informe nuevo con input name="foto_guia", agregas aqui: 'foto_guia': 'guia'
            };

            const fotosSql = 'INSERT INTO InformeFotos (id_informe, tipo_foto, ruta_archivo) VALUES ?';
            
            // Filtramos y mapeamos solo los archivos conocidos
            const fotosValues = [];
            
            req.files.forEach(file => {
                // file.fieldname es el 'name' del input en el HTML
                const tipoBd = mapaDeTipos[file.fieldname];

                if (tipoBd) {
                    // Solo si el nombre del input está en nuestro mapa, lo guardamos
                    fotosValues.push([ 
                        newInformeId, 
                        tipoBd, 
                        `informes/${file.filename}` 
                    ]);
                }
            });

            if (fotosValues.length > 0) {
                await connection.query(fotosSql, [fotosValues]);
            }
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Informe guardado con éxito.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error al guardar informe:", error);
        res.status(500).json({ success: false, message: 'Error al guardar el informe.' });
    } finally {
        connection.release();
    }
};


const PublicTecnicos = async (req, res) => {
     try {
        const [tecnicos] = await db.execute("SELECT id_tecnico, nombre, apellido FROM Tecnicos ORDER BY nombre");
        res.json({ success: true, data: tecnicos });
    } catch (error) {
        console.error("Error al obtener la lista pública de técnicos:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const getTecnicoFirma = async (req, res) => {
    try {
        const { id } = req.params;
        const [tecnico] = await db.execute(
            "SELECT id_tecnico, nombre, apellido, firma_path FROM Tecnicos WHERE id_tecnico = ?",
            [id]
        );
        
        if (tecnico.length === 0) {
            return res.status(404).json({ success: false, message: 'Técnico no encontrado.' });
        }
        
        const tech = tecnico[0];
        res.json({ 
            success: true, 
            data: {
                id_tecnico: tech.id_tecnico,
                nombre: tech.nombre,
                apellido: tech.apellido,
                firma_path: tech.firma_path
            }
        });
    } catch (error) {
        console.error("Error al obtener firma del técnico:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};


const PublicUsuarioFinal = async (req, res) => {

    try {
        const { nombre, cel, correo, id_empresa } = req.body;
        if (!nombre || !id_empresa) {
            return res.status(400).json({ success: false, message: 'Nombre y empresa son requeridos.' });
        }
        const sql = 'INSERT INTO Usuario_final (nombre, cel, correo, id_empresa) VALUES (?, ?, ?, ?)';
        const [result] = await db.execute(sql, [nombre, cel, correo, id_empresa]);
        
        // Devolvemos el nuevo usuario con su ID para usarlo en el frontend
        res.status(201).json({ 
            success: true, 
            message: 'Usuario final registrado.',
            data: { id: result.insertId, nombre: nombre }
        });
    } catch (error) {
        console.error("Error al registrar usuario final:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }


};

const listarUsuariosFinales = async (req, res) => {
    try {
        const { empresaId } = req.params;
        if (!empresaId) {
            return res.status(400).json({ success: false, message: 'ID de empresa requerido.' });
        }
        
        const sql = 'SELECT id_usuario_final, nombre, cel, correo FROM Usuario_final WHERE id_empresa = ? ORDER BY nombre ASC';
        const [usuarios] = await db.execute(sql, [empresaId]);
        
        res.json({ 
            success: true, 
            data: usuarios
        });
    } catch (error) {
        console.error("Error al listar usuarios finales:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const redirectToWhatsapp = (req, res) => {
    res.render('public_tecnico/enlacebot');
};

// --- Generar PDF del Informe para Técnicos ---

const generarInformePdfTecnico = async (req, res) => {
    try {
        const { id } = req.params;

        // OBTENER DATOS DEL INFORME
        const sql = `SELECT ic.*, 
                            eq.modelo, eq.num_serie, eq.part_number, 
                            em.nombre as empresa_nombre, em.logo as empresa_logo, em.direccion as empresa_direccion, 
                            ct.nombre_contrato, 
                            tec.nombre as tecnico_nombre, tec.apellido as tecnico_apellido, 
                            COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda,
                            COALESCE(ic.numero_pedido_manual, cas.Numero_Pedido) as Numero_Pedido,
                            uf.nombre as uf_nombre, uf.cel as uf_cel, uf.correo as uf_correo, 
                            cti.Nombre as cti_nombre, cti.Cel as cti_cel, cti.Correo as cti_correo
                     FROM InformeCampo ic
                     LEFT JOIN Equipo eq   ON ic.id_equipo = eq.id_equipo
                     LEFT JOIN Tecnicos tec ON ic.id_tecnico = tec.id_tecnico
                     LEFT JOIN Contrato ct  ON eq.id_contrato = ct.id_contrato
                     LEFT JOIN Empresa em   ON ct.id_empresa = em.id_empresa
                     LEFT JOIN CasTi cas    ON ic.id_casti = cas.Id_cass
                     LEFT JOIN Usuario_final uf ON ic.firmante_id = uf.id_usuario_final AND ic.firmante_type = 'Usuario_final'
                     LEFT JOIN Client_Ti cti  ON ic.firmante_id = cti.id_ti_usuario AND ic.firmante_type = 'Client_Ti'
                     WHERE ic.id_informe = ?`;
        const [[informe]] = await db.execute(sql, [id]);
        if (!informe) return res.status(404).send('Informe no encontrado');

        // CARGAR FOTOS
        const [fotosDB] = await db.execute('SELECT ruta_archivo FROM InformeFotos WHERE id_informe = ?', [id]);
        const path = require('path');
        const fs = require('fs');
        const projectRoot = path.join(__dirname, '../../');

        const imageToBase64 = (filePath) => {
            if (!filePath || !fs.existsSync(filePath)) return null;
            const img = fs.readFileSync(filePath);
            return `data:image/jpeg;base64,${Buffer.from(img).toString('base64')}`;
        };

        const imageToPngBase64 = (filePath) => {
            if (!filePath || !fs.existsSync(filePath)) return null;
            const img = fs.readFileSync(filePath);
            return `data:image/png;base64,${Buffer.from(img).toString('base64')}`;
        };

        const logo386Base64 = imageToBase64(path.join(projectRoot, 'public/img/logo_cliente/logo386azul.png'));
        const clienteLogoBase64 = imageToBase64(
            informe.empresa_logo ? path.join(projectRoot, 'public/img/logo_cliente', informe.empresa_logo) : null
        );
        
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

        // CONVERTIR FIRMAS A BASE64
        // Firmas están almacenadas como rutas relativas: 'firmas/clientes/...' o 'firmas/tecnicos/...'
        let firmaUsuarioBase64 = null;
        let firmaTecnicoBase64 = null;

        if (informe.firma_usuario) {
            let firmaPath;
            if (informe.firma_usuario.includes('/storage/')) {
                // Si tiene /storage/ prefix, removerlo
                const relativePath = informe.firma_usuario.replace(/^\/storage\//, '');
                firmaPath = path.join(projectRoot, 'storage', relativePath);
            } else {
                // Si no, asumir que es ruta relativa desde storage
                firmaPath = path.join(projectRoot, 'storage', informe.firma_usuario);
            }
            firmaUsuarioBase64 = imageToPngBase64(firmaPath);
        }

        if (informe.firma_tecnico) {
            let firmaPath;
            if (informe.firma_tecnico.includes('/storage/')) {
                // Si tiene /storage/ prefix, removerlo
                const relativePath = informe.firma_tecnico.replace(/^\/storage\//, '');
                firmaPath = path.join(projectRoot, 'storage', relativePath);
            } else {
                // Si no, asumir que es ruta relativa desde storage
                firmaPath = path.join(projectRoot, 'storage', informe.firma_tecnico);
            }
            firmaTecnicoBase64 = imageToPngBase64(firmaPath);
        }

        // Reemplazar firmas en informe con versiones Base64
        informe.firma_usuario = firmaUsuarioBase64;
        informe.firma_tecnico = firmaTecnicoBase64;

        // GENERAR DEFINICIÓN DEL PDF
        const { generateInformePdfDefinition } = require('../../src/helpers/pdf-informe-generator.js');
        const docDefinition = generateInformePdfDefinition(informe, fotosBase64, {
            logo386Base64,
            clienteLogoBase64,
            firmaUsuarioBase64,
            firmaTecnicoBase64
        });

        // CREAR Y ENVIAR PDF
        const pdfHelper = require('../../src/helpers/pdfmake-helper.js');
        const pdfBuffer = await pdfHelper.createPdf(docDefinition);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="CVT-${String(informe.id_informe).padStart(4, '0')}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar el PDF:', error);
        res.status(500).send('Error al generar el PDF.');
    }
};

// --- Controladores para Mis Informes (Descarga y Vista Previa) ---

const showMisInformes = async (req, res) => {
    try {
        const id_usuario = req.session.usuarioTecnicoId;
        
        // Obtener datos del usuario desde la tabla Login
        const sql = `SELECT id_usuario, nombre FROM Login WHERE id_usuario = ?`;
        
        const [[usuario]] = await db.execute(sql, [id_usuario]);
        
        if (!usuario) {
            return res.status(404).send('Usuario no encontrado');
        }

        res.render('public_tecnico/mis-informes', {
            user: {
                nombre: usuario.nombre || 'Técnico'
            }
        });
    } catch (error) {
        console.error('Error en showMisInformes:', error);
        res.status(500).send('Error al cargar los informes');
    }
};

const getMisInformes = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        // Construir WHERE con filtros simples: empresa, serie, ticket
        let whereConditions = [];
        let params = [];

        // Filtro por empresa
        if (req.query.empresa) {
            whereConditions.push('em.id_empresa = ?');
            params.push(req.query.empresa);
        }

        // Filtro por número de serie (búsqueda parcial)
        if (req.query.serie) {
            whereConditions.push('eq.num_serie LIKE ?');
            params.push(`%${req.query.serie}%`);
        }

        // Filtro por ticket/Codigo Aranda (búsqueda parcial) - incluye tickets manuales
        if (req.query.ticket) {
            whereConditions.push('(COALESCE(ic.ticket_manual, cas.Codigo_Aranda) LIKE ?)');
            params.push(`%${req.query.ticket}%`);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Obtener total de informes
        const countSql = `SELECT COUNT(*) as total FROM InformeCampo ic 
                          LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
                          LEFT JOIN Contrato co ON eq.id_contrato = co.id_contrato
                          LEFT JOIN Empresa em ON co.id_empresa = em.id_empresa
                          LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
                          ${whereClause}`;
        
        const [[{ total }]] = await db.execute(countSql, params);
        const totalPages = Math.ceil(total / limit);

        // Obtener informes paginados - COALESCE para mostrar ticket manual o CasTi
        const sql = `
            SELECT 
                ic.id_informe, ic.fecha_servicio, eq.num_serie, em.nombre as empresa_nombre,
                ic.tipo_informe, ic.estado_equipo, 
                COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda,
                tec.nombre as tecnico_nombre, tec.apellido as tecnico_apellido
            FROM InformeCampo ic
            LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            LEFT JOIN Contrato co ON eq.id_contrato = co.id_contrato
            LEFT JOIN Empresa em ON co.id_empresa = em.id_empresa
            LEFT JOIN Tecnicos tec ON ic.id_tecnico = tec.id_tecnico
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            ${whereClause}
            ORDER BY ic.fecha_servicio DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [informes] = await db.execute(sql, params);

        res.json({
            success: true,
            data: informes,
            pagination: {
                totalRecords: total,
                totalPages: totalPages,
                currentPage: page
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener informes:', error);
        res.status(500).json({ success: false, message: 'Error al obtener los informes.' });
    }
};

const getEmpresasList = async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT em.id_empresa, em.nombre
            FROM InformeCampo ic
            LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            LEFT JOIN Contrato co ON eq.id_contrato = co.id_contrato
            LEFT JOIN Empresa em ON co.id_empresa = em.id_empresa
            WHERE em.id_empresa IS NOT NULL
            ORDER BY em.nombre ASC
        `;

        const [empresas] = await db.execute(sql);

        res.json({
            success: true,
            data: empresas
        });

    } catch (error) {
        console.error('Error al obtener empresas:', error);
        res.status(500).json({ success: false, message: 'Error al obtener las empresas.' });
    }
};

const getInformeDetalleParaPrevia = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener informe completo
        const [informes] = await db.execute('SELECT * FROM InformeCampo WHERE id_informe = ?', [id]);
        if (informes.length === 0) {
            return res.status(404).json({ success: false, message: 'Informe no encontrado.' });
        }

        const informe = informes[0];

        // Obtener datos relacionados
        const sql_base = `
            SELECT 
                eq.modelo, eq.num_serie, eq.part_number,
                em.nombre as empresa_nombre, em.logo as empresa_logo, em.direccion as empresa_direccion,
                ct.nombre_contrato,
                tec.nombre as tecnico_nombre, tec.apellido as tecnico_apellido,
                COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda,
                COALESCE(ic.numero_pedido_manual, cas.Numero_Pedido) as Numero_Pedido
            FROM InformeCampo ic
            LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            LEFT JOIN Tecnicos tec ON ic.id_tecnico = tec.id_tecnico
            LEFT JOIN Contrato ct ON eq.id_contrato = ct.id_contrato
            LEFT JOIN Empresa em ON ct.id_empresa = em.id_empresa
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            WHERE ic.id_informe = ?
        `;

        const [[baseData]] = await db.execute(sql_base, [id]);

        // Obtener datos del firmante
        let firmanteData = {};
        if (informe.firmante_type === 'Client_Ti') {
            const [[firmante]] = await db.execute('SELECT Nombre, Cel, Correo FROM Client_Ti WHERE id_ti_usuario = ?', [informe.firmante_id]);
            firmanteData = firmante || {};
        } else if (informe.firmante_type === 'Usuario_final') {
            const [[firmante]] = await db.execute('SELECT nombre as Nombre, cel as Cel, correo as Correo FROM Usuario_final WHERE id_usuario_final = ?', [informe.firmante_id]);
            firmanteData = firmante || {};
        }

        // Obtener fotos
        const [fotosDB] = await db.execute('SELECT ruta_archivo FROM InformeFotos WHERE id_informe = ?', [id]);
        const fotos = fotosDB.map(foto => {
            let ruta = foto.ruta_archivo;
            if (!ruta.startsWith('/storage') && !ruta.startsWith('http')) {
                ruta = `/storage/${ruta}`;
            }
            return { ruta_archivo: ruta };
        });

        // Procesar firmas (igual que en admin)
        let firma_usuario_procesada = informe.firma_usuario;
        let firma_tecnico_procesada = informe.firma_tecnico;

        if (informe.firma_usuario) {
            if (informe.firma_usuario.startsWith('firmas/')) {
                firma_usuario_procesada = `/storage/${informe.firma_usuario}`;
            } else if (!informe.firma_usuario.startsWith('data:image')) {
                firma_usuario_procesada = `/storage/firmas/clientes/${informe.firma_usuario}`;
            }
        }

        if (informe.firma_tecnico) {
            if (informe.firma_tecnico.startsWith('firmas/')) {
                firma_tecnico_procesada = `/storage/${informe.firma_tecnico}`;
            } else if (!informe.firma_tecnico.startsWith('data:image')) {
                firma_tecnico_procesada = `/storage/firmas/tecnicos/${informe.firma_tecnico}`;
            }
        }

        const informeCompleto = {
            ...informe,
            ...baseData,
            firmante: firmanteData,
            fotos,
            firma_usuario: firma_usuario_procesada,
            firma_tecnico: firma_tecnico_procesada
        };

        res.json({ success: true, data: informeCompleto });

    } catch (error) {
        console.error('Error al obtener detalle de informe:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

module.exports = {
   
    showPublicView,
    getPublicTicketStatus,
    showTecnicoLogin,
    processTecnicoLogin,
    showMenuCentral,
    showInformeCampo,
    processTecnicoLogout,
    buscarEquipoPorSerie,
    buscarCasTI,
    buscarTI_empresa,
    guardarInforme,
    PublicTecnicos,
    getTecnicoFirma,
    PublicUsuarioFinal,
    listarUsuariosFinales,
    redirectToWhatsapp,
    generarInformePdfTecnico,
    showMisInformes,
    getMisInformes,
    getEmpresasList,
    getInformeDetalleParaPrevia
};
