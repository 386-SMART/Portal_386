/**
 * Helper para generar la definición de PDF de Informes con Diseño Premium
 * v3: Ajuste de Logo (Comentado), Eliminación de saltos de página forzados y Ajuste de Texto.
 */

// Paleta de colores
const COLORS = {
  primary: '#0056b3',    // Azul corporativo fuerte
  primaryLight: '#eef4fc', 
  secondary: '#64748b',  // Gris texto secundario
  headerBg: '#f8fafc',   
  accent: '#cbd5e1',     // Bordes sutiles
  success: '#198754',
  danger: '#dc3545',
  textMain: '#1e293b'
};

// Función auxiliar para la grilla de fotos
const buildPhotoGrid = (fotosBase64) => {
  if (!fotosBase64 || fotosBase64.length === 0) return [];

  const rows = [];
  let currentColumns = [];

  fotosBase64.forEach((foto, index) => {
    currentColumns.push({
      image: foto,
      width: 230,
      height: 200,
      fit: [230, 200],
      alignment: 'center',
      margin: [0, 5, 0, 15]
    });

    if (currentColumns.length === 2 || index === fotosBase64.length - 1) {
      if (currentColumns.length === 1) {
        currentColumns.push({ text: '', width: 230 });
      }
      rows.push({
        columns: currentColumns,
        columnGap: 15,
        margin: [0, 5, 0, 5]
      });
      currentColumns = [];
    }
  });

  return [
    // CORRECCIÓN 2: Eliminado "pageBreak: 'before'" para evitar hojas en blanco innecesarias
    // Usamos "unbreakable: false" para que fluya natural.
    { text: 'EVIDENCIA FOTOGRÁFICA', style: 'sectionTitle', margin: [0, 20, 0, 10] },
    ...rows
  ];
};

const generateInformePdfDefinition = (informe, fotosBase64, logos) => {
  const fechaServicioStr = informe.fecha_servicio
    ? new Date(informe.fecha_servicio).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const firmanteData = (informe.firmante_type === 'Client_Ti')
    ? { 
        nombre: informe.cti_nombre || 'Sin Nombre', 
        cel: informe.cti_cel || '', 
        correo: informe.cti_correo || '' 
      }
    : { 
        nombre: informe.uf_nombre || 'Sin Nombre', 
        cel: informe.uf_cel || '', 
        correo: informe.uf_correo || '' 
      };

  const estadoColor = (informe.estado_equipo === 'Operativo' || informe.estado_equipo === 'Reparado') 
    ? COLORS.success 
    : COLORS.danger;

  const direccionFinal = informe.direccion_manual || informe.empresa_direccion || '—';

  return {
    pageSize: 'A4',
    // Ajustamos márgenes. Top 100 es suficiente si quitamos el logo cliente flotante.
    pageMargins: [40, 100, 40, 60], 

    background: logos.logo386Base64
      ? [{ 
          image: logos.logo386Base64, 
          width: 500, 
          opacity: 0.03, 
          absolutePosition: { x: 50, y: 300 } 
        }]
      : undefined,

    header: {
      margin: [0, 0, 0, 0],
      stack: [
        // 1. Barra de color superior
        // CAMBIO: Aumentamos altura de 70 a 85 para que la fecha entre cómoda
        {
          canvas: [{ type: 'rect', x: 0, y: 0, w: 595.28, h: 85, color: COLORS.primary }] 
        },
        // 2. Contenido superpuesto
        // CAMBIO: Ajustamos el margen negativo a -70 para centrar verticalmente en la nueva altura
        {
          margin: [40, -70, 40, 0], 
          columns: [
            // Logo 386 SMART o Texto a la izquierda
            {
                width: 150,
                stack: [
                    logos.logo386Base64 
                    ? { image: logos.logo386Base64, fit: [120, 40], alignment: 'left' } 
                    : { text: '386 SMART', bold: true, fontSize: 22, color: 'white' }
                ]
            },

            // Columna Derecha: Título y Datos
            {
              stack: [
                { text: 'INFORME DE VISITA TÉCNICA', style: 'headerTitle', alignment: 'right' },
                { text: `CVT-${String(informe.id_informe).padStart(4, '0')}`, style: 'headerSubtitle', alignment: 'right' },
                { 
                  text: [
                    // CAMBIO: Reducimos un pelín el margen superior para agruparlo mejor
                    { text: 'Fecha: ', bold: true, color: '#cbd5e1' },
                    { text: fechaServicioStr, bold: true, color: 'white' }
                  ], 
                  alignment: 'right', 
                  fontSize: 10,
                  margin: [0, 2, 0, 0] // Margen superior reducido de 5 a 2
                }
              ],
              width: '*',
              margin: [0, 5, 0, 0] // Bajamos un poco el bloque de texto para centrarlo visualmente
            }
          ]
        }
      ]
    },

    footer: (currentPage, pageCount) => ({
      margin: [40, 10],
      columns: [
        { text: '386 Smart S.A.C. - Servicios Tecnológicos', alignment: 'left', color: COLORS.secondary, fontSize: 8 },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', color: COLORS.secondary, fontSize: 8 }
      ]
    }),

    content: [
      // ===== DATOS DEL CLIENTE =====
      // CORRECCIÓN 3: Anchos en % para forzar salto de línea (Responsividad)
      {
        style: 'tableExample',
        table: {
          widths: ['15%', '35%', '15%', '35%'],
          body: [
            [
              { text: 'CLIENTE', style: 'tableHeader', colSpan: 4, fillColor: COLORS.primary, color: 'white' }, {}, {}, {}
            ],
            [
              { text: 'Empresa:', style: 'fieldLabel' }, 
              { text: informe.empresa_nombre || '—', style: 'fieldValue', bold: true },
              { text: 'Contrato:', style: 'fieldLabel' }, 
              { text: informe.nombre_contrato || '—', style: 'fieldValue' }
            ],
            [
              { text: 'Solicitante:', style: 'fieldLabel' }, 
              { text: informe.usuario_cliente_manual || '—', style: 'fieldValue' },
              { text: 'Sede:', style: 'fieldLabel' }, 
              { text: informe.sede_manual || '—', style: 'fieldValue' }
            ],
            // RUC eliminado, Dirección ocupa todo el ancho
            [
              { text: 'Dirección:', style: 'fieldLabel' }, 
              { text: direccionFinal, style: 'fieldValue', colSpan: 3 }, 
              {}, {}
            ]
          ]
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 1) ? 0 : 1,
          vLineWidth: () => 0,
          hLineColor: COLORS.accent,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        }
      },

      { text: '', margin: [0, 10] },

      // ===== INFORMACIÓN DEL EQUIPO =====
      {
        style: 'tableExample',
        table: {
          widths: ['15%', '35%', '15%', '35%'], // % asegura que el texto largo baje y no rompa
          body: [
            [
              { text: 'EQUIPO', style: 'tableHeader', colSpan: 4, fillColor: COLORS.primary, color: 'white' }, {}, {}, {}
            ],
            [
              { text: 'Equipo:', style: 'fieldLabel' }, 
              { text: informe.nombre_equipo_manual || '—', style: 'fieldValue' },
              { text: 'Marca/Mod:', style: 'fieldLabel' }, 
              { text: informe.modelo || '—', style: 'fieldValue' }
            ],
            [
              { text: 'N° Serie:', style: 'fieldLabel' }, 
              { text: informe.num_serie || '—', style: 'fieldValue', bold: true },
              { text: 'P/N:', style: 'fieldLabel' }, 
              { text: informe.part_number || '—', style: 'fieldValue' }
            ]
          ]
        },
        layout: {
          hLineWidth: (i) => (i === 0 || i === 1) ? 0 : 1,
          vLineWidth: () => 0,
          hLineColor: COLORS.accent,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        }
      },

      { text: '', margin: [0, 10] },

      // ===== DETALLES DEL SERVICIO =====
      // Aquí usamos width '*' que se ajusta al espacio restante, permitiendo párrafos largos
      {
        table: {
          widths: ['*'],
          body: [
            [{ text: 'DETALLES DEL SERVICIO TÉCNICO', style: 'tableHeader', fillColor: '#334155', color: 'white', alignment: 'center' }],
            [{
              stack: [
                { text: 'Incidente Reportado:', style: 'fieldLabelBlock' },
                { text: informe.incidente_reportado || 'No especificado', style: 'fieldValueBlock' },
                
                { text: 'Diagnóstico / Revisión Inicial:', style: 'fieldLabelBlock', margin: [0, 8, 0, 0] },
                { text: informe.revision_inicial || 'Sin observaciones', style: 'fieldValueBlock' },

                { text: 'Trabajos Realizados:', style: 'fieldLabelBlock', margin: [0, 8, 0, 0] },
                { text: informe.acciones_realizadas || '—', style: 'fieldValueBlock' },

                { text: 'Observaciones Finales:', style: 'fieldLabelBlock', margin: [0, 8, 0, 0] },
                { text: informe.observaciones || 'Ninguna', style: 'fieldValueBlock' },
              ],
              margin: [10, 10, 10, 10]
            }]
          ]
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 1,
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0,
          hLineColor: COLORS.accent,
          vLineColor: COLORS.accent
        }
      },

      { text: '', margin: [0, 10] },

      // ===== ESTADO FINAL =====
      {
        canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 35, r: 4, color: '#f8fafc', lineColor: COLORS.accent }]
      },
      {
        relativePosition: { x: 0, y: -30 },
        columns: [
          { text: 'ESTADO FINAL:', width: 'auto', style: 'fieldLabel', margin: [15, 8, 5, 0] },
          { text: (informe.estado_equipo || 'Desconocido').toUpperCase(), style: { bold: true, color: estadoColor, fontSize: 12 }, margin: [0, 8, 0, 0] },
          { 
            text: `Horario: ${informe.hora_inicio} - ${informe.hora_finalizacion}`, 
            alignment: 'right', 
            fontSize: 10, 
            color: COLORS.secondary, 
            margin: [0, 8, 15, 0] 
          }
        ]
      },

      { text: '', margin: [0, 30] },

      // ===== FIRMAS =====
      // Usamos 'unbreakable: true' para evitar que las firmas se separen en dos hojas
      {
        unbreakable: true,
        table: {
          widths: ['*', '10%', '*'],
          body: [
            [
              // Firma Usuario
              {
                stack: [
                  logos.firmaUsuarioBase64 
                    ? { image: logos.firmaUsuarioBase64, width: 120, alignment: 'center', margin: [0, 0, 0, 5] }
                    : { text: '', height: 40 },
                  { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 190, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }] },
                  { text: 'CONFORMIDAD DEL USUARIO', style: 'signatureTitle', margin: [0, 5, 0, 0] },
                  { text: firmanteData.nombre, style: 'signatureName' },
                  { text: `Cel: ${firmanteData.cel} | Email: ${firmanteData.correo}`, style: 'signatureMeta' },
                  { text: informe.firmante_type === 'Client_Ti' ? 'Personal TI' : 'Usuario Final', style: 'signatureMeta', italics: true }
                ],
                alignment: 'center'
              },
              '',
              // Firma Técnico
              {
                stack: [
                  logos.firmaTecnicoBase64 
                    ? { image: logos.firmaTecnicoBase64, width: 120, alignment: 'center', margin: [0, 0, 0, 5] }
                    : { text: '', height: 40 },
                  { canvas: [{ type: 'line', x1: 10, y1: 0, x2: 190, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }] },
                  { text: 'POR 386 SMART S.A.C.', style: 'signatureTitle', margin: [0, 5, 0, 0] },
                  { text: `${informe.tecnico_nombre} ${informe.tecnico_apellido}`, style: 'signatureName' },
                  { text: 'Soporte Técnico', style: 'signatureMeta' }
                ],
                alignment: 'center'
              }
            ]
          ]
        },
        layout: 'noBorders'
      },

      // ===== FOTOS =====
      ...buildPhotoGrid(fotosBase64)
    ],

    styles: {
      headerTitle: {
        fontSize: 18,
        bold: true,
        color: 'white',
        margin: [0, 0, 0, 2]
      },
      headerSubtitle: {
        fontSize: 14,
        bold: true,
        color: COLORS.accent
      },
      sectionTitle: {
        fontSize: 12,
        bold: true,
        color: 'white',
        fillColor: COLORS.primary,
        margin: [0, 10, 0, 5],
        padding: 5
      },
      tableHeader: {
        fontSize: 10,
        bold: true,
        color: 'white',
        alignment: 'left',
        margin: [5, 3, 0, 3]
      },
      fieldLabel: {
        fontSize: 9,
        bold: true,
        color: '#64748b'
      },
      fieldValue: {
        fontSize: 9,
        color: COLORS.textMain
      },
      fieldLabelBlock: {
        fontSize: 10,
        bold: true,
        color: COLORS.primary,
        margin: [0, 0, 0, 2]
      },
      fieldValueBlock: {
        fontSize: 10,
        color: '#334155',
        alignment: 'justify' // Texto justificado para mejor apariencia con mucho contenido
      },
      signatureTitle: {
        fontSize: 9,
        bold: true,
        color: '#334155'
      },
      signatureName: {
        fontSize: 10,
        bold: true,
        color: '#000000',
        margin: [0, 2, 0, 0]
      },
      signatureMeta: {
        fontSize: 8,
        color: '#64748b',
        margin: [0, 1, 0, 0]
      }
    }
  };
};

module.exports = { generateInformePdfDefinition };