// src/controllers/admin/informes.controller.js

const db = require('../../../conexiondb');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const pdfHelper = require('../../helpers/pdfmake-helper.js');
const { generateInformePdfDefinition } = require('../../helpers/pdf-informe-generator.js');

const getInformesPaginados = async (req, res) => {
     try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        // Filtros opcionales
        const { empresa, serie, ticket } = req.query;
        
        let whereConditions = [];
        let params = [];
        
        if (empresa) {
            whereConditions.push('em.id_empresa = ?');
            params.push(empresa);
        }
        
        if (serie) {
            whereConditions.push('eq.num_serie LIKE ?');
            params.push(`%${serie}%`);
        }
        
        if (ticket) {
            whereConditions.push('cas.Codigo_Aranda LIKE ?');
            params.push(`%${ticket}%`);
        }
        
        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        // Contar total con filtros
        const countSql = `SELECT COUNT(*) as total FROM InformeCampo ic
            LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            LEFT JOIN Contrato co ON eq.id_contrato = co.id_contrato
            LEFT JOIN Empresa em ON co.id_empresa = em.id_empresa
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            ${whereClause}`;
        
        const [[{ total }]] = await db.execute(countSql, params);
        const totalPages = Math.ceil(total / limit);

        const sql = `
            SELECT 
                ic.id_informe, ic.fecha_servicio, eq.num_serie, em.nombre as empresa_nombre,
                t.nombre as tecnico_nombre, t.apellido as tecnico_apellido,
                ic.estado_equipo, 
                COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda
            FROM InformeCampo ic
            LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo
            LEFT JOIN Tecnicos t ON ic.id_tecnico = t.id_tecnico
            LEFT JOIN Contrato co ON eq.id_contrato = co.id_contrato
            LEFT JOIN Empresa em ON co.id_empresa = em.id_empresa
            LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass
            ${whereClause}
            ORDER BY ic.fecha_servicio DESC 
            LIMIT ${limit} OFFSET ${offset}`;        const [informes] = await db.execute(sql, params);
        
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
        console.error("Error al obtener informes paginados:", error);
        res.status(500).json({ success: false, message: 'Error al obtener los informes.' });
    }
};

const getInformeStats = async (req, res) => {
    try {
        const sql = `
            SELECT 
                t.nombre,
                t.apellido,
                COUNT(ic.id_informe) as total_informes
            FROM InformeCampo ic
            JOIN Tecnicos t ON ic.id_tecnico = t.id_tecnico
            GROUP BY t.id_tecnico
            ORDER BY total_informes DESC;
        `;
        const [stats] = await db.execute(sql);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener las estadísticas.' });
    }
};

const getEmpresas = async (req, res) => {
    try {
        const sql = `
            SELECT DISTINCT em.id_empresa, em.nombre 
            FROM Empresa em
            INNER JOIN Contrato co ON em.id_empresa = co.id_empresa
            INNER JOIN Equipo eq ON co.id_contrato = eq.id_contrato
            INNER JOIN InformeCampo ic ON eq.id_equipo = ic.id_equipo
            ORDER BY em.nombre ASC
        `;
        const [empresas] = await db.execute(sql);
        res.json({ success: true, data: empresas });
    } catch (error) {
        console.error("Error al obtener empresas:", error);
        res.status(500).json({ success: false, message: 'Error al obtener empresas.' });
    }
};

const getInformeDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Obtenemos el informe principal
        const [informes] = await db.execute('SELECT * FROM InformeCampo WHERE id_informe = ?', [id]);
        if (informes.length === 0) {
            return res.status(404).json({ success: false, message: 'Informe no encontrado.' });
        }
        const informe = informes[0];

        // 2. Obtenemos los datos base (equipo, empresa, etc.)
        const sql_base = `SELECT eq.modelo, eq.num_serie, em.nombre as empresa_nombre, ct.nombre_contrato, tec.nombre as tecnico_nombre, tec.apellido as tecnico_apellido, COALESCE(ic.ticket_manual, cas.Codigo_Aranda) as Codigo_Aranda, COALESCE(ic.numero_pedido_manual, cas.Numero_Pedido) as Numero_Pedido FROM InformeCampo ic LEFT JOIN Equipo eq ON ic.id_equipo = eq.id_equipo LEFT JOIN Tecnicos tec ON ic.id_tecnico = tec.id_tecnico LEFT JOIN Contrato ct ON eq.id_contrato = ct.id_contrato LEFT JOIN Empresa em ON ct.id_empresa = em.id_empresa LEFT JOIN CasTi cas ON ic.id_casti = cas.Id_cass WHERE ic.id_informe = ?`;
        const [[baseData]] = await db.execute(sql_base, [id]);

        // 3. Obtenemos los datos del FIRMANTE condicionalmente
        let firmanteData = {};
        if (informe.firmante_type === 'Client_Ti') {
            const [[firmante]] = await db.execute('SELECT Nombre, Cel, Correo FROM Client_Ti WHERE id_ti_usuario = ?', [informe.firmante_id]);
            firmanteData = firmante;
        } else if (informe.firmante_type === 'Usuario_final') {
            const [[firmante]] = await db.execute('SELECT nombre as Nombre, cel as Cel, correo as Correo FROM Usuario_final WHERE id_usuario_final = ?', [informe.firmante_id]);
            firmanteData = firmante;
        }

        // 4. Obtenemos las fotos
        const [fotosDB] = await db.execute('SELECT ruta_archivo FROM InformeFotos WHERE id_informe = ?', [id]);
        
        // Convertir rutas a URLs accesibles
        const fotos = fotosDB.map(foto => ({
            ruta_archivo: `/admin/casti/imagen/${encodeURIComponent(foto.ruta_archivo)}`
        }));

        // 5. Procesar firmas: detectar si son rutas o Base64
        // Si comienza con 'firmas/' o 'data:image' es una ruta nueva o Base64 antiguo
        let firma_usuario_procesada = informe.firma_usuario;
        let firma_tecnico_procesada = informe.firma_tecnico;

        // FIRMA USUARIO
        if (informe.firma_usuario) {
            if (informe.firma_usuario.startsWith('firmas/')) {
                // Es una ruta nueva: prefixar con /storage/
                firma_usuario_procesada = `/storage/${informe.firma_usuario}`;
            } else if (!informe.firma_usuario.startsWith('data:image')) {
                // Si no comienza con 'data:image' y tampoco es ruta, intenta prefixar
                firma_usuario_procesada = `/storage/firmas/clientes/${informe.firma_usuario}`;
            }
            // Si comienza con 'data:image', dejarla como está (Base64)
        }

        // FIRMA TÉCNICO
        if (informe.firma_tecnico) {
            if (informe.firma_tecnico.startsWith('firmas/')) {
                // Es una ruta nueva: prefixar con /storage/
                firma_tecnico_procesada = `/storage/${informe.firma_tecnico}`;
            } else if (!informe.firma_tecnico.startsWith('data:image')) {
                // Si no comienza con 'data:image' y tampoco es ruta, intenta prefixar
                firma_tecnico_procesada = `/storage/firmas/tecnicos/${informe.firma_tecnico}`;
            }
            // Si comienza con 'data:image', dejarla como está (Base64)
        }
        
        // 6. Unimos toda la información con firmas procesadas
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
        console.error("Error al obtener detalle de informe:", error);
        res.status(500).json({ success: false, message: 'Error en el servidor.' });
    }
};




const generarInformePdf = async (req, res) => {
  try {
    const { id } = req.params;

    // 1) OBTENER DATOS
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

    // 2) CARGAR IMÁGENES / FOTOS
    const [fotosDB] = await db.execute('SELECT ruta_archivo FROM InformeFotos WHERE id_informe = ?', [id]);
    const projectRoot = path.join(__dirname, '../../../');

    const imageToBase64 = (filePath) => {
      if (!filePath || !fs.existsSync(filePath)) return null;
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

    // 3) GENERAR DEFINICIÓN DEL PDF USANDO HELPER
    const docDefinition = generateInformePdfDefinition(informe, fotosBase64, {
      logo386Base64,
      clienteLogoBase64,
      firmaUsuarioBase64,
      firmaTecnicoBase64
    });

    // 4) CREAR Y ENVIAR PDF
    const pdfBuffer = await pdfHelper.createPdf(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CVT-${String(informe.id_informe).padStart(4, '0')}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar el PDF con pdfmake:', error);
    res.status(500).send('Error al generar el PDF.');
  }
};

module.exports = {
    getInformesPaginados,
    getInformeStats,
    getInformeDetalle,
    generarInformePdf,
    getEmpresas
};