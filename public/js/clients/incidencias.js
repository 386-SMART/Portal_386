document.addEventListener('DOMContentLoaded', () => {
    // Referencias del DOM
    const kpiContainer = document.getElementById('kpi-container');
    const tablaInformes = document.getElementById('tabla-informes');
    const paginationContainer = document.querySelector('#pagination-container .pagination');
    const piezasChartContainer = document.getElementById('piezasChartContainer');
    const slug = window.location.pathname.split('/')[1];
    
    // Filtros
    const filtroSerie = document.getElementById('filtroSerie');
    const filtroTicket = document.getElementById('filtroTicket');
    const filtroFecha = document.getElementById('filtroFecha');
    const btnBuscar = document.getElementById('btnBuscar');
    
    let currentFilters = {};

    // Función para formatear fechas sin conversión de zona horaria
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

    // Carga inicial de todos los datos
    const cargarTodo = () => {
        cargarKPIs();
        cargarGraficoPiezas();
        cargarInformes();
    };

    // --- Carga de KPIs ---
    const cargarKPIs = () => {
        fetch(`/${slug}/api/incidencias-kpis`) // Necesitarás crear este nuevo endpoint en tu API
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    const kpis = result.data;
                    kpiContainer.innerHTML = `
                        <div class="col-md-4">
                            <div class="kpi-card">
                                <div class="kpi-icon"><i class="bi bi-ticket-detailed"></i></div>
                                <div>
                                    <div class="kpi-value">${kpis.totalIncidencias || 0}</div>
                                    <div class="kpi-label">Incidencias Totales</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="kpi-card">
                                <div class="kpi-icon"><i class="bi bi-person-gear"></i></div>
                                <div>
                                    <div class="kpi-value">${kpis.tecnicosActivos || 0}</div>
                                    <div class="kpi-label">Técnicos Distintos</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="kpi-card">
                                <div class="kpi-icon"><i class="bi bi-box-seam"></i></div>
                                <div>
                                    <div class="kpi-value">${kpis.piezasSolicitadas || 0}</div>
                                    <div class="kpi-label">Piezas Solicitadas (Total)</div>
                                </div>
                            </div>
                        </div>`;
                }
            }).catch(err => console.error("Error cargando KPIs:", err));
    };

    // --- Carga de Gráfico de Piezas (Estilo Mejorado) ---
    const cargarGraficoPiezas = () => {
        fetch(`/${slug}/api/piezas-solicitadas`)
            .then(res => res.json())
            .then(result => {
                if (result.success && result.data.length > 0) {
                    const options = {
                        series: [{ name: 'Cantidad', data: result.data.map(p => p.cantidad) }],
                        chart: { type: 'bar', height: 400, toolbar: { show: false } },
                        plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '50%' } },
                        colors: ['#0d6efd'],
                        dataLabels: { enabled: false },
                        xaxis: { 
                            categories: result.data.map(p => p.pieza),
                            labels: { style: { colors: '#6c757d', fontWeight: 500 } }
                        },
                        yaxis: { labels: { style: { colors: '#6c757d', fontWeight: 500 } } },
                        grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
                        tooltip: { y: { formatter: (val) => `${val} Unidades` } }
                    };
                    const chart = new ApexCharts(piezasChartContainer, options);
                    chart.render();
                } else {
                    piezasChartContainer.innerHTML = '<div class="d-flex align-items-center justify-content-center h-100 text-muted p-5">No hay datos de piezas solicitadas para mostrar.</div>';
                }
            });
    };

    // --- Carga de Tabla y Paginación ---
    const cargarInformes = (page = 1) => {
        // Construir query string con filtros
        const params = new URLSearchParams({ page });
        if (currentFilters.serie) params.append('serie', currentFilters.serie);
        if (currentFilters.ticket) params.append('ticket', currentFilters.ticket);
        if (currentFilters.fecha) params.append('fecha', currentFilters.fecha);
        
        fetch(`/${slug}/api/informes-de-campo?${params}`)
            .then(res => res.json())
            .then(result => {
                tablaInformes.innerHTML = '';
                if (result.success && result.data.length > 0) {
                    result.data.forEach(informe => {
                        tablaInformes.innerHTML += `
                            <tr>
                                <td class="px-3">${formatearFecha(informe.fecha_servicio)}</td>
                                <td><span class="badge bg-secondary bg-opacity-10 text-secondary-emphasis fw-semibold">${informe.Codigo_Aranda || 'N/A'}</span></td>
                                <td>${informe.num_serie}</td>
                                <td>${informe.tecnico_nombre}</td>
                                <td class="text-end px-3">
                                    <a href="/${slug}/api/informes-de-campo/${informe.id_informe}/pdf" class="btn btn-sm btn-outline-danger" title="Descargar PDF">
                                        <i class="bi bi-file-earmark-pdf"></i>
                                    </a>
                                </td>
                            </tr>`;
                    });
                    renderPaginacion(result.pagination.currentPage, result.pagination.totalPages);
                } else {
                    tablaInformes.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-muted">No tiene informes de servicio registrados.</td></tr>';
                    paginationContainer.innerHTML = '';
                }
            })
            .catch(err => {
                console.error('Error cargando informes:', err);
                tablaInformes.innerHTML = '<tr><td colspan="5" class="text-center p-5 text-danger">Error al cargar informes.</td></tr>';
            });
    };

    const renderPaginacion = (currentPage, totalPages) => {
        // ... (Tu función de renderPaginacion puede mantenerse igual, ya es bastante buena)
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
        paginationContainer.appendChild(createPageItem(currentPage - 1, '‹', currentPage === 1));
        for (let i = 1; i <= totalPages; i++) {
            paginationContainer.appendChild(createPageItem(i, i, false, i === currentPage));
        }
        paginationContainer.appendChild(createPageItem(currentPage + 1, '›', currentPage === totalPages));
    };

    paginationContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.dataset.page) {
            e.preventDefault();
            const page = parseInt(e.target.dataset.page);
            if (!isNaN(page)) cargarInformes(page);
        }
    });
    
    // Event Listeners para filtros
    btnBuscar.addEventListener('click', () => {
        currentFilters = {
            serie: filtroSerie.value.trim(),
            ticket: filtroTicket.value.trim(),
            fecha: filtroFecha.value
        };
        cargarInformes(1);
    });
    
    // Enter en los campos de texto
    filtroSerie.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscar.click();
    });
    
    filtroTicket.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnBuscar.click();
    });

    cargarTodo();
});