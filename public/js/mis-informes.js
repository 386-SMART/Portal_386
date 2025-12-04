document.addEventListener('DOMContentLoaded', () => {
    // 1. VARIABLES GLOBALES
    const tablaInformes = document.getElementById('tablaInformes');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const tablaInformesContainer = document.getElementById('tablaInformesContainer');
    const noDataMessage = document.getElementById('noDataMessage');
    const btnFiltrar = document.getElementById('btnFiltrar');
    const btnLimpiar = document.getElementById('btnLimpiar');
    const filtroEmpresa = document.getElementById('filtroEmpresa');
    const filtroSerie = document.getElementById('filtroSerie');
    const filtroTicket = document.getElementById('filtroTicket');
    const paginacionContainer = document.querySelector('#paginacionContainer .pagination');
    const modalPrevia = new bootstrap.Modal(document.getElementById('modalPrevia'));
    const modalPreviaContent = document.getElementById('modalPreviaContent');
    const btnDescargarDesdeModal = document.getElementById('btnDescargarDesdeModal');

    let currentPage = 1;
    let informesActuales = [];
    let filtrosActuales = {};

    // 2. FUNCIONES AUXILIARES

    const mostrarCargando = () => {
        loadingSpinner.style.display = 'block';
        tablaInformesContainer.style.display = 'none';
        noDataMessage.style.display = 'none';
        paginacionContainer.parentElement.style.display = 'none';
    };

    const ocultarCargando = () => {
        loadingSpinner.style.display = 'none';
    };

    const renderPaginacion = (currentPage, totalPages) => {
        paginacionContainer.innerHTML = '';
        if (totalPages <= 1) {
            paginacionContainer.parentElement.style.display = 'none';
            return;
        }

        paginacionContainer.parentElement.style.display = 'block';

        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.dataset.page = page;
            a.textContent = text;
            if (!isDisabled) a.href = '#';
            li.appendChild(a);
            return li;
        };

        paginacionContainer.appendChild(createPageItem(currentPage - 1, 'Anterior', currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            paginacionContainer.appendChild(createPageItem(i, i, false, i === currentPage));
        }
        paginacionContainer.appendChild(createPageItem(currentPage + 1, 'Siguiente', currentPage === totalPages));
    };

    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        
        // Si la fecha viene en formato YYYY-MM-DD, parsearla directamente
        const partes = fecha.split('T')[0].split('-');
        if (partes.length === 3) {
            const [year, month, day] = partes;
            return `${day}/${month}/${year}`;
        }
        
        // Fallback por si viene en otro formato
        return new Date(fecha).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const obtenerBadgeEstado = (estado) => {
        let badgeClass = 'estado-completado';
        let badgeText = estado || 'N/A';

        if (estado === 'Reparado' || estado === 'Completado' || estado === 'Finalizado') {
            badgeClass = 'estado-completado';
        } else if (estado === 'Pendiente') {
            badgeClass = 'estado-pendiente';
        } else if (estado === 'Cancelado' || estado === 'Inoperativo') {
            badgeClass = 'estado-cancelado';
        }

        return `<span class="badge badge-custom ${badgeClass}">${badgeText}</span>`;
    };

    // 3. CARGAR INFORMES

    const cargarInformes = (page = 1) => {
        mostrarCargando();

        const params = new URLSearchParams({
            page: page,
            ...filtrosActuales
        });

        fetch(`/api/public/mis-informes?${params}`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(result => {
                ocultarCargando();

                if (result.success && result.data.length > 0) {
                    informesActuales = result.data;
                    tablaInformes.innerHTML = '';

                    result.data.forEach(informe => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${formatearFecha(informe.fecha_servicio)}</td>
                            <td>${informe.empresa_nombre || 'N/A'}</td>
                            <td>${informe.Codigo_Aranda || 'N/A'}</td>
                            <td>${informe.num_serie || 'N/A'}</td>
                            <td>${informe.tipo_informe || 'Visita Técnica'}</td>
                            <td>${obtenerBadgeEstado(informe.estado_equipo)}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-info btn-previa" data-id="${informe.id_informe}" title="Vista Previa">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <a href="/api/public/informe/${informe.id_informe}/pdf" class="btn btn-sm btn-danger" title="Descargar PDF" target="_blank">
                                    <i class="bi bi-download"></i>
                                </a>
                            </td>
                        `;
                        tablaInformes.appendChild(row);
                    });

                    tablaInformesContainer.style.display = 'block';
                    noDataMessage.style.display = 'none';
                    renderPaginacion(result.pagination.currentPage, result.pagination.totalPages);

                    // Agregar event listeners a botones de previa
                    document.querySelectorAll('.btn-previa').forEach(btn => {
                        btn.addEventListener('click', mostrarPrevia);
                    });

                } else {
                    tablaInformesContainer.style.display = 'none';
                    noDataMessage.style.display = 'block';
                    paginacionContainer.parentElement.style.display = 'none';
                }
            })
            .catch(err => {
                ocultarCargando();
                console.error(err);
                tablaInformesContainer.style.display = 'none';
                noDataMessage.style.display = 'block';
                noDataMessage.innerHTML = `
                    <i class="bi bi-exclamation-triangle"></i>
                    <p class="text-danger">Error al cargar los informes. Intenta nuevamente.</p>
                `;
            });
    };

    // 4. CARGAR EMPRESAS EN FILTRO

    const cargarEmpresas = () => {
        fetch('/api/public/empresas')
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data.length > 0) {
                    result.data.forEach(empresa => {
                        const option = document.createElement('option');
                        option.value = empresa.id_empresa;
                        option.textContent = empresa.nombre;
                        filtroEmpresa.appendChild(option);
                    });
                }
            })
            .catch(err => console.error('Error cargando empresas:', err));
    };

    // 5. MOSTRAR VISTA PREVIA

    const mostrarPrevia = async (e) => {
        const id = e.target.closest('.btn-previa').dataset.id;
        modalPreviaContent.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Cargando...</span>
                </div>
            </div>
        `;
        modalPrevia.show();

        try {
            const response = await fetch(`/api/public/informe/${id}/previa`);
            const result = await response.json();

            if (result.success) {
                const informe = result.data;
                const htmlPrevia = generarHTMLPrevia(informe);
                modalPreviaContent.innerHTML = htmlPrevia;
                btnDescargarDesdeModal.href = `/api/public/informe/${id}/pdf`;

                // Reinicializar lightbox después de agregar nuevo contenido
                if (typeof $ !== 'undefined' && $.fn.lightbox) {
                    $(document).find('a[data-lightbox]').lightbox();
                }
            } else {
                modalPreviaContent.innerHTML = `<p class="text-danger">Error al cargar la previa.</p>`;
            }
        } catch (error) {
            console.error(error);
            modalPreviaContent.innerHTML = `<p class="text-danger">Error de conexión.</p>`;
        }
    };

    const generarHTMLPrevia = (informe) => {
        const fotosHTML = informe.fotos && informe.fotos.length > 0
            ? `
                <div class="report-section mt-3">
                    <div class="report-section-title">FOTOS</div>
                    <div class="report-body">
                        <h6>Fotos:</h6>
                        <div class="row g-2">
                            ${informe.fotos.map((foto, index) => `
                                <div class="col-md-4 col-6">
                                    <a href="${foto.ruta_archivo}" data-lightbox="previa-${informe.id_informe}" data-title="Foto ${index + 1}">
                                        <img src="${foto.ruta_archivo}" class="img-fluid img-thumbnail" style="height: 120px; width: 100%; object-fit: cover;">
                                    </a>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `
            : '';

        return `
            <div class="report-preview" style="max-height: 70vh; overflow-y: auto;">
                <style>
                    .report-header {
                        background-color: #f8f9fa;
                        padding: 1rem;
                        text-align: center;
                        font-weight: bold;
                        border-bottom: 3px solid #667eea;
                        margin-bottom: 1rem;
                    }
                    .report-section {
                        margin-bottom: 1.5rem;
                    }
                    .report-section-title {
                        background-color: #e7f1ff;
                        padding: 0.75rem 1rem;
                        font-weight: bold;
                        color: #667eea;
                        border-left: 4px solid #667eea;
                        margin-bottom: 1rem;
                    }
                    .report-body {
                        padding: 1rem;
                    }
                    .report-field {
                        display: flex;
                        margin-bottom: 0.75rem;
                    }
                    .report-field label {
                        font-weight: bold;
                        min-width: 150px;
                        color: #495057;
                    }
                    .report-field span {
                        color: #212529;
                    }
                </style>

                <div class="report-header">CONSTANCIA DE VISITA TÉCNICA</div>

                <div class="report-section">
                    <div class="report-section-title">DATOS DEL CLIENTE</div>
                    <div class="report-body">
                        <div class="report-field"><label>Cliente:</label><span>${informe.empresa_nombre || ''}</span></div>
                        <div class="report-field"><label>Contrato:</label><span>${informe.nombre_contrato || ''}</span></div>
                        <div class="report-field"><label>Usuario:</label><span>${informe.usuario_cliente_manual || ''}</span></div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-section-title">INFORMACIÓN DEL EQUIPO</div>
                    <div class="report-body">
                        <div class="report-field"><label>Modelo:</label><span>${informe.modelo || ''}</span></div>
                        <div class="report-field"><label>Serie:</label><span>${informe.num_serie || ''}</span></div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-section-title">DIAGNÓSTICO - REPARACIÓN</div>
                    <div class="report-body">
                        <div class="report-field"><label>Ticket:</label><span>${informe.Codigo_Aranda || 'N/A'}</span></div>
                        <div class="report-field"><label>N° Pedido:</label><span>${informe.Numero_Pedido || 'N/A'}</span></div>
                        <div class="report-field"><label>Incidente:</label><span>${informe.incidente_reportado || ''}</span></div>
                        <div class="report-field"><label>Acciones:</label><span>${informe.acciones_realizadas || ''}</span></div>
                    </div>
                </div>

                <div class="report-section">
                    <div class="report-section-title">CONFORMIDAD</div>
                    <div class="report-body">
                        <div class="row">
                            <div class="col-6">
                                <div class="report-field"><label>Hora Inicio:</label><span>${informe.hora_inicio}</span></div>
                                <div class="report-field"><label>Usuario:</label><span>${informe.firmante?.Nombre || ''}</span></div>
                                <div class="report-field"><label>Correo:</label><span>${informe.firmante?.Correo || ''}</span></div>
                            </div>
                            <div class="col-6">
                                <div class="report-field"><label>Hora Fin:</label><span>${informe.hora_finalizacion}</span></div>
                                <div class="report-field"><label>Teléfono:</label><span>${informe.firmante?.Cel || ''}</span></div>
                            </div>
                        </div>
                        <hr class="my-3">
                        <div class="row text-center">
                            <div class="col-6">
                                <strong>Firma Usuario (${informe.firmante_type === 'Client_Ti' ? 'Personal TI' : 'Usuario Final'})</strong>
                                ${informe.firma_usuario ? `<img src="${informe.firma_usuario}" class="img-fluid bg-white border p-1 mt-1" style="max-height: 120px;">` : '<p class="text-muted">Sin firma</p>'}
                            </div>
                            <div class="col-6">
                                <strong>Firma Técnico</strong><br>
                                <small>${informe.tecnico_nombre} ${informe.tecnico_apellido}</small>
                                ${informe.firma_tecnico ? `<img src="${informe.firma_tecnico}" class="img-fluid bg-white border p-1 mt-1" style="max-height: 120px;">` : '<p class="text-muted">Sin firma</p>'}
                            </div>
                        </div>
                    </div>
                </div>

                ${fotosHTML}

                <div class="report-section">
                    <div class="report-body">
                        <div class="report-field"><label>Estado Final:</label><span>${informe.estado_equipo}</span></div>
                        <div class="report-field"><label>Observaciones:</label><span>${informe.observaciones || 'N/A'}</span></div>
                    </div>
                </div>
            </div>
        `;
    };

    // 6. EVENT LISTENERS

    btnFiltrar.addEventListener('click', () => {
        filtrosActuales = {};

        if (filtroEmpresa.value) {
            filtrosActuales.empresa = filtroEmpresa.value;
        }
        if (filtroSerie.value) {
            filtrosActuales.serie = filtroSerie.value;
        }
        if (filtroTicket.value) {
            filtrosActuales.ticket = filtroTicket.value;
        }

        cargarInformes(1);
    });

    btnLimpiar.addEventListener('click', () => {
        filtroEmpresa.value = '';
        filtroSerie.value = '';
        filtroTicket.value = '';
        filtrosActuales = {};
        cargarInformes(1);
    });

    paginacionContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.dataset.page) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page)) {
                cargarInformes(page);
            }
        }
    });

    // 7. INICIALIZACIÓN

    cargarEmpresas();
    cargarInformes();
});
