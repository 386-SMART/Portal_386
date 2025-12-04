document.addEventListener('DOMContentLoaded', () => {
    // 1. DEFINIR CONSTANTES
    const tablaInformes = document.getElementById('tabla-informes');
    const paginationContainer = document.querySelector('#pagination-container .pagination');
    const informeModal = new bootstrap.Modal(document.getElementById('informeModal'));
    const modalBody = document.getElementById('modal-body-content');
    const chartContainer = document.getElementById('tecnicosChart');
    
    // Filtros
    const filtroEmpresa = document.getElementById('filtroEmpresa');
    const filtroSerie = document.getElementById('filtroSerie');
    const filtroTicket = document.getElementById('filtroTicket');
    const btnBuscar = document.getElementById('btnBuscar');
    const btnLimpiar = document.getElementById('btnLimpiar');
    
    let chartInstance = null;
    let currentFilters = {};

    // 2. DEFINIR FUNCIONES

    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const partes = fecha.split('T')[0].split('-');
        if (partes.length === 3) {
            const [year, month, day] = partes;
            return `${day}/${month}/${year}`;
        }
        return new Date(fecha).toLocaleDateString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
    };

    const renderPaginacion = (currentPage, totalPages) => {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;
        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.dataset.page = page;
            a.textContent = text;
            li.appendChild(a);
            return li;
        };
        paginationContainer.appendChild(createPageItem(currentPage - 1, 'Anterior', currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            paginationContainer.appendChild(createPageItem(i, i, false, i === currentPage));
        }
        paginationContainer.appendChild(createPageItem(currentPage + 1, 'Siguiente', currentPage === totalPages));
    };

    const cargarInformes = (page = 1) => {
        tablaInformes.innerHTML = `<tr><td colspan="7" class="text-center">Cargando...</td></tr>`;
        
        // Construir query string con filtros
        const params = new URLSearchParams({ page });
        if (currentFilters.empresa) params.append('empresa', currentFilters.empresa);
        if (currentFilters.serie) params.append('serie', currentFilters.serie);
        if (currentFilters.ticket) params.append('ticket', currentFilters.ticket);
        
        fetch(`/admin/api/informes-de-campo?${params}`)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(result => {
                tablaInformes.innerHTML = '';
                if (result.success && result.data.length > 0) {
                    result.data.forEach(informe => {
                        tablaInformes.innerHTML += `
                            <tr>
                                <td>${formatearFecha(informe.fecha_servicio)}</td>
                                <td>${informe.empresa_nombre}</td>
                                <td>${informe.Codigo_Aranda || 'N/A'}</td>
                                <td>${informe.num_serie}</td>
                                <td>${informe.tecnico_nombre} ${informe.tecnico_apellido}</td>
                                <td><span class="badge bg-success">${informe.estado_equipo}</span></td>
                                <td class="text-end">
                                    <button class="btn btn-sm btn-primary btn-ver" data-id="${informe.id_informe}">Ver</button>
                                    <a href="/admin/api/informes-de-campo/${informe.id_informe}/pdf" class="btn btn-sm btn-danger">PDF</a>
                                </td>
                            </tr>`;
                    });
                    renderPaginacion(result.pagination.currentPage, result.pagination.totalPages);
                } else {
                    tablaInformes.innerHTML = `<tr><td colspan="7" class="text-center">No hay informes registrados.</td></tr>`;
                    paginationContainer.innerHTML = '';
                }
            })
            .catch(err => {
                console.error(err);
                tablaInformes.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar informes.</td></tr>`;
            });
    };

    const cargarStats = () => {
        fetch('/admin/api/informes-de-campo/stats')
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(result => {
                if (chartInstance) chartInstance.destroy();
                chartContainer.innerHTML = '';
                if (result.success && result.data.length > 0) {
                    const options = {
                        series: [{ name: 'Informes', data: result.data.map(stat => stat.total_informes) }],
                        chart: { type: 'bar', height: 250, toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, horizontal: true, } },
                        dataLabels: { enabled: true, style: { colors: ['#fff'] } },
                        xaxis: { categories: result.data.map(stat => `${stat.nombre} ${stat.apellido}`), labels: { show: false } },
                        yaxis: { labels: { style: { fontWeight: 'bold' } } },
                        tooltip: { y: { formatter: (val) => `${val} informes` } }
                    };
                    chartInstance = new ApexCharts(chartContainer, options);
                    chartInstance.render();
                } else {
                    chartContainer.innerHTML = `<p class="text-center text-muted pt-5">No hay datos para mostrar.</p>`;
                }
            })
            .catch(err => console.error(err));
    };
    
    const cargarEmpresas = () => {
        fetch('/admin/api/informes-de-campo/empresas')
            .then(res => res.ok ? res.json() : Promise.reject(res))
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

    // 3. EVENT LISTENERS
    
    btnBuscar.addEventListener('click', () => {
        currentFilters = {
            empresa: filtroEmpresa.value,
            serie: filtroSerie.value.trim(),
            ticket: filtroTicket.value.trim()
        };
        cargarInformes(1);
    });
    
    btnLimpiar.addEventListener('click', () => {
        filtroEmpresa.value = '';
        filtroSerie.value = '';
        filtroTicket.value = '';
        currentFilters = {};
        cargarInformes(1);
    });
    
    // Enter en los campos de texto
    filtroSerie.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscar.click();
    });
    
    filtroTicket.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscar.click();
    });
    
    paginationContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.dataset.page) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page)) cargarInformes(page);
        }
    });
    
    tablaInformes.addEventListener('click', async (e) => {
        const target = e.target.closest('.btn-ver');
        if (target) {
            const id = target.dataset.id;
            modalBody.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';
            informeModal.show();
            try {
                const response = await fetch(`/admin/api/informes-de-campo/${id}`);
                const result = await response.json();
                if (result.success) {
                    const informe = result.data;
                    const firmante = informe.firmante || {};
                    let fotosHTML = '';
                    if (informe.fotos && informe.fotos.length > 0) {
                        fotosHTML += '<h6>Fotos:</h6><div class="row g-2">';
                        informe.fotos.forEach((foto, index) => {
                            fotosHTML += `
                                <div class="col-md-4 col-6">
                                    <a href="${foto.ruta_archivo}" data-lightbox="informe-${id}" data-title="Foto ${index + 1}">
                                        <img src="${foto.ruta_archivo}" class="img-fluid img-thumbnail" style="height: 120px; width: 100%; object-fit: cover;">
                                    </a>
                                </div>`;
                        });
                        fotosHTML += '</div>';
                    }
                    modalBody.innerHTML = `
                        <div class="report-preview">
                            <div class="report-header">CONSTANCIA DE VISITA TÉCNICA</div>
                            <div class="report-section"><div class="report-section-title">DATOS DEL CLIENTE</div><div class="report-body"><div class="report-field"><label>Cliente:</label><span>${informe.empresa_nombre || ''}</span></div><div class="report-field"><label>Contrato:</label><span>${informe.nombre_contrato || ''}</span></div><div class="report-field"><label>Usuario:</label><span>${informe.usuario_cliente_manual || ''}</span></div></div></div>
                            <div class="report-section"><div class="report-section-title">INFORMACIÓN DEL EQUIPO</div><div class="report-body"><div class="report-field"><label>Modelo:</label><span>${informe.modelo || ''}</span></div><div class="report-field"><label>Serie:</label><span>${informe.num_serie || ''}</span></div></div></div>
                            <div class="report-section"><div class="report-section-title">DIAGNÓSTICO - REPARACIÓN</div><div class="report-body"><div class="report-field"><label>Ticket:</label><span>${informe.Codigo_Aranda || 'N/A'}</span></div><div class="report-field"><label>N° Pedido:</label><span>${informe.Numero_Pedido || 'N/A'}</span></div></div></div>
                            <div class="report-section"><div class="report-section-title">CONFORMIDAD</div><div class="report-body"><div class="row"><div class="col-6"><div class="report-field"><label>Hora Inicio:</label><span>${informe.hora_inicio}</span></div><div class="report-field"><label>Usuario:</label><span>${firmante.Nombre || ''}</span></div><div class="report-field"><label>Correo:</label><span>${firmante.Correo || ''}</span></div></div><div class="col-6"><div class="report-field"><label>Hora Fin:</label><span>${informe.hora_finalizacion}</span></div><div class="report-field"><label>Teléfono:</label><span>${firmante.Cel || ''}</span></div></div></div><hr class="my-3"><div class="row text-center"><div class="col-6"><strong>Firma Usuario (${informe.firmante_type === 'Client_Ti' ? 'Personal TI' : 'Usuario Final'})</strong><img src="${informe.firma_usuario}" class="img-fluid bg-white border p-1 mt-1"></div><div class="col-6"><strong>Firma Técnico</strong><br><small>${informe.tecnico_nombre} ${informe.tecnico_apellido}</small><img src="${informe.firma_tecnico}" class="img-fluid bg-white border p-1 mt-1"></div></div></div></div>
                            ${fotosHTML ? `<div class="report-section mt-3"><div class="report-section-title">FOTOS</div><div class="report-body">${fotosHTML}</div></div>` : ''}
                        </div>`;
                } else {
                    modalBody.innerHTML = 'Error al cargar los detalles.';
                }
            } catch (error) {
                console.error(error);
                modalBody.innerHTML = 'Error de conexión.';
            }
        }
    });

    // 4. LLAMADAS INICIALES
    cargarInformes();
    cargarStats();
    cargarEmpresas();
});