// src/controllers/admin/casti.controller.js

const db = require('../../../conexiondb');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const renderCastiMenu = (req, res) => {
    const menuItems = [
        { path: '/admin/casti/dashboard', icon: 'bi-grid-1x2-fill', label: 'Dashboard' },
        { path: '/admin/casti/registro-piezas', icon: 'bi-tools', label: 'Registrar Pedido' },
        { path: '/admin/casti/actualizar-ticket', icon: 'bi-pencil-square', label: 'Gestionar Tickets' },
        { path: '/admin/casti/consultar_info_ticket', icon: 'bi bi-info-circle-fill', label: 'Informacion Tickets' },
        { path: '/admin/casti/generar-reporte', icon: 'bi-file-earmark-excel-fill', label: 'Generar Reporte' },
        { path: '/admin/casti/vistas-tickets', icon: 'bi-grid-3x3-gap-fill', label: 'Vista General' },
        { path: '/admin/casti/visualizarinformes', icon: 'bi bi-collection', label: 'Informes Campo' },
    ];
    res.render("admins/cass", { user: req.session.user, menuItems: menuItems });
};


const renderRegistroPiezas = async (req, res) => {
    try {
        const [empresas] = await db.execute("SELECT id_empresa, nombre FROM Empresa ORDER BY nombre");
        const [piezas] = await db.execute("SELECT id_pieza, nombre_pieza FROM Catalogo_Piezas ORDER BY nombre_pieza");
        res.render('admins/casti/registro-piezas', { 
            user: req.session.user, 
            empresas: empresas,
            catalogoPiezas: piezas,
            csrfToken: req.session.csrfToken
        });
    } catch (error) {
        res.status(500).send("Error al cargar la página.");
    }
};

const renderCastiDashboard = (req, res) => { res.render('admins/casti/dashboard', { user: req.session.user });};
const renderVisualizarInformes = (req, res) => res.render('admins/casti/visualizarinformes', { user: req.session.user });
const renderActualizarTicket = (req, res) => res.render('admins/casti/actualizar-ticket', { user: req.session.user, csrfToken: req.session.csrfToken });


const renderGenerarReporte = (req, res) => res.render('admins/casti/generar-reporte', { user: req.session.user, csrfToken: req.session.csrfToken });
const renderVistasTickets = (req, res) => res.render('admins/casti/vistas-tickets', { user: req.session.user, tvToken: process.env.PUBLIC_VIEW_TOKEN });
const renderVistasTicketsTv = (req, res) => res.render('admins/casti/vistas-tickets-tv', { layout: false });


const renderconsultarInfoTicket = async (req, res) => { // La convertimos en async
    try {
        let empresas = [];
        // Si es admin, le pasamos la lista de empresas para el filtro
        if (req.session.user.tipo_usuario === 'Administrador') {
            const [listaEmpresas] = await db.execute("SELECT id_empresa, nombre FROM Empresa ORDER BY nombre");
            empresas = listaEmpresas;
        }
        res.render('admins/casti/consultar_info_ticket', { 
            user: req.session.user,
            empresas: empresas // Pasamos las empresas a la vista
        });
    } catch (error) {
        console.error("Error al renderizar la página de consulta:", error);
        res.status(500).send("Error al cargar la página de consulta.");
    }
};


// --- APIs PARA LA GESTIÓN DE TICKETS Y PIEZAS ---

// API PARA OBTENER FOTOS POR CÓDIGO DE TICKET


const getDashboardSummary = async (req, res) => {
    try {
        // 1. Obtener el resumen de Tipos de Garantía
        const [garantias] = await db.execute(`
            SELECT Tipo_garantia, COUNT(*) as cantidad 
            FROM CasTi 
            WHERE Tipo_garantia IS NOT NULL AND Tipo_garantia != ''
            GROUP BY Tipo_garantia 
            ORDER BY cantidad DESC
        `);

        // 2. Obtener el resumen de Piezas Solicitadas
        const [piezas] = await db.execute(`
            SELECT COALESCE(cp.nombre_pieza, tps.nombre_pieza_manual) as pieza, COUNT(*) as cantidad
            FROM Ticket_Piezas_Solicitadas tps
            LEFT JOIN Catalogo_Piezas cp ON tps.id_pieza = cp.id_pieza
            WHERE COALESCE(cp.nombre_pieza, tps.nombre_pieza_manual) IS NOT NULL
            GROUP BY pieza 
            ORDER BY cantidad DESC
        `);

        // 3. Obtener todos los tickets para calcular los estados dinámicos
        const [tickets] = await db.execute(`
            SELECT LLegada_de_pieza, Devolver_pieza, ERDT, Claim, Fecha_Pedido 
            FROM CasTi
        `);

        // Lógica para calcular los estados
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        let estados = {
            'En Espera de Pieza': 0,
            'En Proceso de Reparación': 0,
            'Próximo a Devolver': 0,
            'Devolución Vencida': 0,
            'Devolución Extendida': 0,
            'Finalizado y Devuelto': 0
        };

        tickets.forEach(ticket => {
            if (ticket.Claim) {
                estados['Finalizado y Devuelto']++;
            } else if (ticket.ERDT) {
                estados['Devolución Extendida']++;
            } else if (ticket.LLegada_de_pieza) {
                const devolucion = new Date(ticket.Devolver_pieza || ticket.ERDT);
                const diffDias = (devolucion - hoy) / (1000 * 60 * 60 * 24);
                if (diffDias < 0) {
                    estados['Devolución Vencida']++;
                } else if (diffDias < 3) {
                    estados['Próximo a Devolver']++;
                } else {
                    estados['En Proceso de Reparación']++;
                }
            } else if (ticket.Fecha_Pedido) {
                estados['En Espera de Pieza']++;
            }
        });
        
        res.json({
            success: true,
            data: { garantias, piezas, estados }
        });

    } catch (error) {
        console.error("Error al generar resumen para el dashboard de CasTI:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const getFotosPorTicket = async (req, res) => {
    try {
        const { codigo } = req.params;
        const sql = `SELECT f.id_foto, f.ruta_archivo FROM InformeFotos f
                     JOIN InformeCampo ic ON f.id_informe = ic.id_informe
                     JOIN CasTi cas ON ic.id_casti = cas.Id_cass
                     WHERE cas.Codigo_Aranda = ?`;
        const [fotos] = await db.execute(sql, [codigo]);
        
        // Convertir rutas a URLs accesibles
        const fotosConUrls = fotos.map(foto => ({
            id_foto: foto.id_foto,
            ruta_archivo: `/admin/casti/imagen/${encodeURIComponent(foto.ruta_archivo)}`
        }));
        
        res.json({ success: true, data: fotosConUrls });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Nuevo endpoint para servir imágenes desde storage/informes/
const obtenerImagen = async (req, res) => {
    try {
        const { ruta } = req.params;
        
        // Decodificar la ruta (que viene URL-encoded)
        const rutaDecodificada = decodeURIComponent(ruta);
        
        // Validación de seguridad: solo permitir rutas que comiencen con "informes/"
        if (!rutaDecodificada.startsWith('informes/')) {
            return res.status(403).json({ success: false, message: 'Acceso denegado.' });
        }
        
        // Construir la ruta completa del archivo
        const filePath = path.join(__dirname, '../../..', 'storage', rutaDecodificada);
        
        // Validar que el archivo existe
        if (!fs.existsSync(filePath)) {
            console.warn(`Imagen no encontrada: ${filePath}`);
            return res.status(404).json({ success: false, message: 'Imagen no encontrada.' });
        }
        
        // Obtener la extensión para el MIME type
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        const contentType = mimeTypes[ext] || 'image/jpeg';
        
        // Enviar el archivo con los headers correctos
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 24 horas
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error al obtener imagen:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

const createTicket = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { standardParts, otherPart, ...ticketData } = req.body;

        if (!ticketData.Numero_Pedido || !ticketData.Tipo_garantia || !ticketData.Fecha_Pedido) {
            return res.status(400).json({ success: false, message: 'Número de Pedido, Tipo de Garantía y Fecha de Pedido son campos obligatorios.' });
        }

        const sqlTicket = `INSERT INTO CasTi (id_empresa, Codigo_Aranda, Ubicacion, Modelo_equipo, Numero_serie, Numero_Pedido, Hp_Orden_Number, Tipo_garantia, Fecha_Pedido, LLegada_de_pieza, Estado, Devolver_pieza, Claim, Ticket_Claim, ERDT, Ticket_ERDT, Observaciones) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
        const [result] = await connection.execute(sqlTicket, [
            ticketData.id_empresa, ticketData.Codigo_Aranda, ticketData.Ubicacion, ticketData.Modelo_equipo, ticketData.Numero_serie,
            ticketData.Numero_Pedido, ticketData.Hp_Orden_Number, ticketData.Tipo_garantia, ticketData.Fecha_Pedido,
            ticketData.LLegada_de_pieza || null, ticketData.Estado, ticketData.Devolver_pieza || null, ticketData.Claim || null,
            ticketData.Ticket_Claim, ticketData.ERDT || null, ticketData.Ticket_ERDT, ticketData.Observaciones
        ]);
        const newTicketId = result.insertId;

        if (standardParts && standardParts.length > 0) {
            const piezasValues = standardParts.map(id_pieza => [newTicketId, id_pieza]);
            await connection.query("INSERT INTO Ticket_Piezas_Solicitadas (id_cass, id_pieza) VALUES ?", [piezasValues]);
        }
        if (otherPart) {
            await connection.execute("INSERT INTO Ticket_Piezas_Solicitadas (id_cass, nombre_pieza_manual) VALUES (?, ?)", [newTicketId, otherPart]);
        }

        await connection.commit();
        res.status(201).json({ success: true, message: 'Ticket de piezas registrado con éxito.' });
    } catch (error) {
        await connection.rollback();
        console.error("Error al registrar ticket de piezas:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor al guardar el ticket.' });
    } finally {
        connection.release();
    }
};


const buscarTickets = async (req, res) => {

    try {
        const { searchTerm } = req.query;
        const [tickets] = await db.execute(
            `SELECT Id_cass, Codigo_Aranda, Numero_serie, Hp_Orden_Number, Fecha_Pedido FROM CasTi WHERE Codigo_Aranda LIKE ? OR Numero_serie LIKE ? OR Hp_Orden_Number LIKE ? LIMIT 10`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
        );
        res.json({ success: true, data: tickets });
    } catch (error) {
        console.error("Error al buscar tickets:", error);
        res.status(500).json({ success: false, message: 'Error al buscar tickets.' });
    }

};

const DetalleTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const [[ticket]] = await db.execute("SELECT * FROM CasTi WHERE Id_cass = ?", [id]);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
        }
        const [piezas] = await db.execute("SELECT * FROM CasTi_Piezas WHERE id_cass = ?", [id]);
        ticket.piezas_nuevas = piezas.filter(p => p.tipo_pieza === 'NUEVA');
        ticket.piezas_dañadas = piezas.filter(p => p.tipo_pieza === 'DAÑADA');
        res.json({ success: true, data: ticket });
    } catch (error) {
        console.error("Error al obtener detalle del ticket:", error);
        res.status(500).json({ success: false, message: 'Error al obtener el detalle del ticket.' });
    }
};

const AgregarPieza = async (req, res) => {
    try {
        const { id_cass, tipo_pieza, part_number, descripcion, ct } = req.body;
        await db.execute(
            "INSERT INTO CasTi_Piezas (id_cass, tipo_pieza, part_number, descripcion, ct) VALUES (?, ?, ?, ?, ?)",
            [id_cass, tipo_pieza, part_number, descripcion, ct]
        );
        res.status(201).json({ success: true, message: 'Pieza añadida con éxito.' });
    } catch (error) {
        console.error("Error al añadir pieza:", error);
        res.status(500).json({ success: false, message: 'Error al guardar la pieza.' });
    }
};

const ActualizarTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const camposPermitidos = [
            'Claim', 'Ticket_Claim', 'ERDT', 'Ticket_ERDT', 
            'Devolver_pieza', 'LLegada_de_pieza',
            'Hp_Orden_Number', 'Numero_Pedido', 'Tipo_garantia', 
            'Observaciones', 'Estado'
        ];

        // Construir UPDATE dinámico solo con los campos que vienen en el body
        const setClauses = [];
        const values = [];

        camposPermitidos.forEach(campo => {
            if (req.body.hasOwnProperty(campo)) {
                setClauses.push(`${campo} = ?`);
                values.push(req.body[campo] || null);
            }
        });

        if (setClauses.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No se proporcionaron campos para actualizar.' 
            });
        }

        // Agregar el ID al final de los valores
        values.push(id);

        const sql = `UPDATE CasTi SET ${setClauses.join(', ')} WHERE Id_cass = ?`;
        
        await db.execute(sql, values);
        
        res.json({ success: true, message: 'Ticket actualizado con éxito.' });
    } catch (error) {
        console.error("Error al actualizar ticket:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar el ticket.' });
    }
};

const FiltroEquiposPorEmpresa = async (req, res) => {

    const { empresaId, serie } = req.query;
    if (!empresaId || !serie) {
        return res.json([]);
    }
    
    try {
        // Se une con la tabla Contrato para poder filtrar por el id_empresa
        const [equipos] = await db.execute(
            `SELECT eq.num_serie, eq.modelo 
             FROM Equipo eq
             JOIN Contrato c ON eq.id_contrato = c.id_contrato
             WHERE c.id_empresa = ? AND eq.num_serie LIKE ?
             LIMIT 10`,
            [empresaId, `%${serie}%`]
        );
        res.json(equipos);
    } catch (error) {
        console.error("Error buscando equipo por serie:", error);
        res.status(500).json([]); // Devolver un array vacío en caso de error
    }

};


const GenerarExcel = async (req, res) => {

     const { ticketIds, manualData } = req.body;

    if (!ticketIds || ticketIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No se seleccionó ningún ticket para el reporte.' });
    }

    try {
        // ... (La parte de obtener datos de la BD no cambia) ...
        let allPiezasDañadas = [];
        await Promise.all(ticketIds.map(async (ticketId) => {
            const [[ticketInfo]] = await db.execute("SELECT Numero_Pedido, Hp_Orden_Number FROM CasTi WHERE Id_cass = ?", [ticketId]);
            const [piezas] = await db.execute("SELECT * FROM CasTi_Piezas WHERE id_cass = ? AND tipo_pieza = 'DAÑADA'", [ticketId]);
            piezas.forEach(p => {
                allPiezasDañadas.push({ ...p, ...ticketInfo });
            });
        }));
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte de Devolucion');

        // --- Estilos ---
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0080FF' } },
            alignment: { vertical: 'middle', horizontal: 'center' },
            border: { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
        };
        const boldStyle = { font: { bold: true } };
        
        // --- INICIO DE LA CORRECCIÓN ---
        // 1. Definir un nuevo estilo para el ajuste de texto
        const wrapTextStyle = { alignment: { wrapText: true, vertical: 'top' } };
        // --- FIN DE LA CORRECCIÓN ---

        // --- Cabeceras de dirección ---
        worksheet.addRow(["386 SMART S.A.C", null, null, "RUC", "20601001285"]);
        worksheet.addRow(["Av. Guardia Civil, Surquillo, Lima - Perú"]);
        worksheet.addRow([]);
        worksheet.addRow([manualData.destinatarioNombre, null, null, "RUC", manualData.destinatarioRUC]);
        
        // 2. Añadir la fila de la dirección
        const direccionRow = worksheet.addRow([manualData.destinatarioDireccion]);
        
        // 3. Obtener la celda de la dirección y aplicarle el estilo
        direccionRow.getCell(1).style = wrapTextStyle;
        
        worksheet.addRow([]);
        worksheet.addRow([null, null, null, null, null, null,null]);
        worksheet.addRow([]);
        
        const headers = ["FECHA DE SOLICITUD", "CANTIDAD", "No.PARTE", "DESCRIPCION", "CASO", "HP ORDER NUMBER", "ESTADO", "DIMENSIONES"];
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell(cell => cell.style = headerStyle);
        
        // ... (El resto del código para añadir las piezas y el pie de página no cambia) ...
        allPiezasDañadas.forEach(pieza => {
            worksheet.addRow([
                manualData.fechaSolicitud, 1, pieza.part_number, pieza.descripcion,
                pieza.Numero_Pedido, pieza.Hp_Orden_Number, manualData.estadoPiezas,
                manualData.dimensiones
            ]);
        });

        worksheet.addRow([]); 
        worksheet.addRow([]); 
        const rowKilos = worksheet.addRow([null, null, null, null, null, null, "Kilos Aprox. (kg)", manualData.kilos]);
        const rowCantidad = worksheet.addRow([null, null, null, null, null, null, "Cantidad de Piezas (und)", allPiezasDañadas.length]);
        const rowBulto = worksheet.addRow([null, null, null, null, null, null, "Bulto", manualData.bulto]);

        rowKilos.getCell(7).style = boldStyle;
        rowCantidad.getCell(7).style = boldStyle;
        rowBulto.getCell(7).style = boldStyle;

        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                let columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) { maxLength = columnLength; }
            });
            column.width = maxLength < 12 ? 12 : maxLength + 2;
        });

        res.setHeader('Content-Disposition', `attachment; filename="Reporte_Devolucion_Consolidado.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        const buffer = await workbook.xlsx.writeBuffer();
        res.send(buffer);

    } catch (error) {
        console.error("Error generando el Excel:", error);
        res.status(500).json({ success: false, message: 'No se pudo generar el archivo Excel.' });
    }

};


const estadoTickets = async (req, res) => {
    try {
        const [tickets] = await db.execute(`
            SELECT 
                c.Id_cass, 
                c.Codigo_Aranda, 
                c.Hp_Orden_Number, 
                c.Fecha_Pedido, 
                c.LLegada_de_pieza, 
                c.Devolver_pieza, 
                c.ERDT, 
                c.Claim,
                c.Estado,
                e.nombre AS nombre_empresa
            FROM CasTi c
            LEFT JOIN Empresa e ON c.id_empresa = e.id_empresa
            ORDER BY c.Id_cass DESC
        `);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const ticketsConEstado = tickets.map(ticket => {
            let status = { text: 'Pendiente', color: 'light', icon: 'bi-question-circle' };
            
            if (ticket.Fecha_Pedido && !ticket.LLegada_de_pieza) {
                status = { text: 'En Espera de Pieza', color: 'secondary', icon: 'bi-box-seam' };
            }
            if (ticket.LLegada_de_pieza) {
                const devolucion = new Date(ticket.Devolver_pieza || ticket.ERDT);
                const diffDias = (devolucion - hoy) / (1000 * 60 * 60 * 24);

                if (diffDias >= 3) {
                    status = { text: 'En Proceso de Reparación', color: 'primary', icon: 'bi-tools' };
                }
                if (diffDias < 3 && diffDias >= 0) {
                    status = { text: 'Próximo a Devolver', color: 'warning', icon: 'bi-alarm-fill' };
                }
                if (diffDias < 0) {
                    status = { text: 'Devolución Vencida', color: 'danger', icon: 'bi-exclamation-triangle-fill' };
                }
            }
            if (ticket.ERDT) {
                status = { text: 'Devolución Extendida', color: 'info', icon: 'bi-clock-history' };
            }
            if (ticket.Claim) {
                status = { text: 'Finalizado y Devuelto', color: 'success', icon: 'bi-check-circle-fill' };
            }
            return { ...ticket, status };
        });

        res.json({ success: true, data: ticketsConEstado });
    } catch (error) {
        console.error("Error al obtener el estado de los tickets:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};

// Listar todos los tickets con paginación y filtros
const listarTicketsPaginados = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        // Filtro por ticket (Codigo_Aranda)
        if (req.query.ticket) {
            whereConditions.push('c.Codigo_Aranda LIKE ?');
            params.push(`%${req.query.ticket}%`);
        }

        // Filtro por empresa
        if (req.query.empresa) {
            whereConditions.push('e.id_empresa = ?');
            params.push(req.query.empresa);
        }

        // Filtro por serie
        if (req.query.serie) {
            whereConditions.push('c.Numero_serie LIKE ?');
            params.push(`%${req.query.serie}%`);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Obtener total
        const countSql = `SELECT COUNT(*) as total FROM CasTi c 
                          LEFT JOIN Empresa e ON c.id_empresa = e.id_empresa
                          ${whereClause}`;
        const [[{ total }]] = await db.execute(countSql, params);
        const totalPages = Math.ceil(total / limit);

        // Obtener tickets paginados
        const sql = `
            SELECT c.Id_cass, c.Codigo_Aranda, c.Numero_serie, c.Modelo_equipo, c.Fecha_Pedido,
                   c.Estado, c.Tipo_garantia, c.Numero_Pedido, c.Hp_Orden_Number,
                   e.nombre as empresa_nombre
            FROM CasTi c
            LEFT JOIN Empresa e ON c.id_empresa = e.id_empresa
            ${whereClause}
            ORDER BY c.Fecha_Pedido DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [tickets] = await db.execute(sql, params);

        res.json({
            success: true,
            data: tickets,
            pagination: {
                totalRecords: total,
                totalPages: totalPages,
                currentPage: page
            }
        });
    } catch (error) {
        console.error('Error al listar tickets:', error);
        res.status(500).json({ success: false, message: 'Error al obtener los tickets.' });
    }
};

// Eliminar ticket completo
const eliminarTicket = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;

        await connection.beginTransaction();

        // Verificar si está vinculado a un informe de campo
        const [[informe]] = await connection.execute(
            'SELECT COUNT(*) as count FROM InformeCampo WHERE id_casti = ?',
            [id]
        );

        if (informe.count > 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'No se puede eliminar. Este ticket está vinculado a un informe de campo.' 
            });
        }

        // Eliminar piezas asociadas
        await connection.execute('DELETE FROM CasTi_Piezas WHERE id_cass = ?', [id]);
        await connection.execute('DELETE FROM Ticket_Piezas_Solicitadas WHERE id_cass = ?', [id]);

        // Eliminar ticket
        await connection.execute('DELETE FROM CasTi WHERE Id_cass = ?', [id]);

        await connection.commit();
        res.json({ success: true, message: 'Ticket eliminado con éxito.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar ticket:', error);
        res.status(500).json({ success: false, message: 'Error al eliminar el ticket.' });
    } finally {
        connection.release();
    }
};

// Obtener lista de empresas para filtros
const getEmpresasConTickets = async (req, res) => {
    try {
        const [empresas] = await db.execute(`
            SELECT DISTINCT e.id_empresa, e.nombre
            FROM CasTi c
            INNER JOIN Empresa e ON c.id_empresa = e.id_empresa
            WHERE e.id_empresa IS NOT NULL
            ORDER BY e.nombre ASC
        `);
        res.json({ success: true, data: empresas });
    } catch (error) {
        console.error('Error al obtener empresas:', error);
        res.status(500).json({ success: false, message: 'Error al obtener empresas.' });
    }
};


// src/controllers/admin/casti.controller.js



module.exports = {
    renderCastiMenu, // <-- Faltaba esta
    renderCastiDashboard, // <-- Faltaba esta
    getDashboardSummary,
    renderRegistroPiezas,
    renderVisualizarInformes,
    renderActualizarTicket,
    renderGenerarReporte,
    renderVistasTickets,
    renderVistasTicketsTv,
    getFotosPorTicket,
    obtenerImagen,
    createTicket,
    buscarTickets,
    DetalleTicket,
    AgregarPieza,
    ActualizarTicket,
    FiltroEquiposPorEmpresa,
    GenerarExcel,
    estadoTickets,
    renderconsultarInfoTicket,
    listarTicketsPaginados,
    eliminarTicket,
    getEmpresasConTickets
};