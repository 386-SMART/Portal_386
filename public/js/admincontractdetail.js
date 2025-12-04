document.addEventListener('DOMContentLoaded', () => {

    // --- VARIABLES GLOBALES ---
    const safeEquipos = (typeof equiposData !== 'undefined') ? equiposData : [];
    const safeDocs = (typeof documentosData !== 'undefined') ? documentosData : [];

    const inventarioTbody = document.getElementById('inventario-tbody');
    const inventarioPagination = document.getElementById('inventario-pagination');
    const catFilter = document.getElementById('filtro-categoria-inventario');
    const modFilter = document.getElementById('filtro-modelo-inventario');
    const serFilter = document.getElementById('filtro-serie-inventario');

    let inventarioState = {
        currentPage: 1,
        rowsPerPage: 8,
        filteredList: safeEquipos
    };

    // --- 1. GRÁFICO DE ANILLO (Compacto) ---
    const createChart = () => {
        const chartCanvas = document.getElementById('chart-categorias');
        if (!chartCanvas) return;

        if (safeEquipos.length === 0) {
            chartCanvas.parentElement.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted py-4">
                    <i class="bi bi-hdd-stack fs-1 opacity-25 mb-2"></i>
                    <small>Sin datos</small>
                </div>`;
            return;
        }

        const categorias = {};
        safeEquipos.forEach(eq => {
            const cat = eq.categoria_nombre || 'Otros';
            categorias[cat] = (categorias[cat] || 0) + 1;
        });

        new Chart(chartCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categorias),
                datasets: [{
                    data: Object.values(categorias),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { 
                        position: 'right', // Leyenda a la derecha para ahorrar altura
                        labels: { usePointStyle: true, boxWidth: 6, font: { size: 10 }, padding: 10 }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 8,
                        cornerRadius: 6,
                        bodyFont: { size: 11 }
                    }
                }
            }
        });
    };

    // --- 2. DOCUMENTOS (Grid) ---
    const renderDocumentsGrid = () => {
        const container = document.getElementById('documentos-container');
        if (!container) return;

        if (safeDocs.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted w-100" style="grid-column: 1 / -1;">
                    <i class="bi bi-folder2-open display-4 opacity-50"></i>
                    <p class="mt-3 small">No hay documentos adjuntos.</p>
                </div>`;
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            return;
        }

        let html = '';
        safeDocs.forEach(doc => {
            const isPdf = doc.nombre_original.toLowerCase().endsWith('.pdf');
            const isExcel = doc.nombre_original.toLowerCase().match(/\.(xlsx|xls|csv)$/);
            
            let iconClass = 'bi-file-earmark-text-fill';
            let iconColor = '#2563eb'; // Azul
            let bgColor = '#dbeafe';

            if (isPdf) {
                iconClass = 'bi-file-earmark-pdf-fill';
                iconColor = '#dc2626'; // Rojo
                bgColor = '#fee2e2';
            } else if (isExcel) {
                iconClass = 'bi-file-earmark-excel-fill';
                iconColor = '#16a34a'; // Verde
                bgColor = '#dcfce7';
            }

            const sizeMB = (doc.tamano_bytes / 1024 / 1024).toFixed(2);

            html += `
                <div class="doc-card">
                    <div class="doc-icon-wrapper" style="background-color: ${bgColor}; color: ${iconColor}">
                        <i class="bi ${iconClass}"></i>
                    </div>
                    <div class="flex-grow-1 overflow-hidden me-2">
                        <div class="fw-bold text-dark text-truncate" style="font-size: 0.9rem;" title="${doc.nombre_original}">
                            ${doc.nombre_original}
                        </div>
                        <div class="small text-muted" style="font-size: 0.75rem;">
                            <span class="text-uppercase me-1">${doc.tipo_documento}</span> • ${sizeMB} MB
                        </div>
                    </div>
                    <a href="/admin/api/documentos/descargar/${doc.id_documento}" class="btn btn-light border btn-sm text-primary" target="_blank" title="Descargar">
                        <i class="bi bi-download"></i>
                    </a>
                </div>
            `;
        });
        container.innerHTML = html;
    };

    // --- 3. INVENTARIO ---
    const setupInventory = () => {
        if (!inventarioTbody) return;

        const cats = [...new Set(safeEquipos.map(e => e.categoria_nombre).filter(Boolean))].sort();
        const mods = [...new Set(safeEquipos.map(e => e.modelo).filter(Boolean))].sort();

        cats.forEach(c => catFilter.add(new Option(c, c)));
        mods.forEach(m => modFilter.add(new Option(m, m)));

        const updateFilters = () => {
            const catVal = catFilter.value;
            const modVal = modFilter.value;
            const serVal = serFilter.value.toLowerCase();

            inventarioState.filteredList = safeEquipos.filter(eq => 
                (!catVal || eq.categoria_nombre === catVal) &&
                (!modVal || eq.modelo === modVal) &&
                (!serVal || (eq.num_serie && eq.num_serie.toLowerCase().includes(serVal)))
            );
            inventarioState.currentPage = 1;
            renderInventoryTable();
        };

        catFilter.addEventListener('change', updateFilters);
        modFilter.addEventListener('change', updateFilters);
        serFilter.addEventListener('keyup', updateFilters);

        inventarioPagination.addEventListener('click', e => {
            e.preventDefault();
            const link = e.target.closest('.page-link');
            if(link && !link.parentElement.classList.contains('disabled')) {
                const page = parseInt(link.dataset.page);
                if(page) {
                    inventarioState.currentPage = page;
                    renderInventoryTable();
                }
            }
        });

        renderInventoryTable();
    };

    const renderInventoryTable = () => {
        inventarioTbody.innerHTML = '';
        const { currentPage, rowsPerPage, filteredList } = inventarioState;

        if (filteredList.length === 0) {
            inventarioTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-5">No se encontraron equipos.</td></tr>';
            inventarioPagination.innerHTML = '';
            return;
        }

        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageData = filteredList.slice(start, end);

        pageData.forEach(eq => {
            const row = `
                <tr>
                    <td class="ps-4 font-monospace text-dark">${eq.num_serie || '-'}</td>
                    <td>
                        <div class="fw-semibold text-dark" style="font-size: 0.85rem;">${eq.modelo || 'Desconocido'}</div>
                        <div class="small text-muted" style="font-size: 0.75rem;">${eq.marca || ''}</div>
                    </td>
                    <td><span class="badge bg-light text-secondary border fw-normal">${eq.categoria_nombre || 'General'}</span></td>
                    <td><span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-10" style="font-size: 0.7rem;">Activo</span></td>
                </tr>
            `;
            inventarioTbody.insertAdjacentHTML('beforeend', row);
        });

        renderPagination(Math.ceil(filteredList.length / rowsPerPage));
    };

    const renderPagination = (totalPages) => {
        inventarioPagination.innerHTML = '';
        if (totalPages <= 1) return;
        const { currentPage } = inventarioState;
        let html = `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link border-0 text-muted" href="#" data-page="${currentPage - 1}"><i class="bi bi-chevron-left"></i></a>
            </li>
            <li class="page-item disabled">
                <span class="page-link border-0 text-dark fw-semibold" style="font-size: 0.8rem;">${currentPage} / ${totalPages}</span>
            </li>
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link border-0 text-muted" href="#" data-page="${currentPage + 1}"><i class="bi bi-chevron-right"></i></a>
            </li>
        `;
        inventarioPagination.innerHTML = html;
    };

    // --- INIT ---
    createChart();
    renderDocumentsGrid();
    setupInventory();
});