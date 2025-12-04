document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const companyFilter = document.getElementById('company-filter');
    const paginationContainer = document.getElementById('pagination');
    const tableContainer = document.getElementById('table-container');

    let currentPage = 1;
    let debounceTimer;

    const showLoader = () => {
        tableContainer.classList.add('loading');
        tableContainer.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>';
    };

    const fetchContracts = async () => {
        showLoader();
        const searchTerm = searchInput.value;
        const empresaId = companyFilter.value;

        const url = `/admin/api/admin/contracts?page=${currentPage}&search=${searchTerm}&empresaId=${empresaId}`;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                renderTable(result.data.contracts);
                renderPagination(result.data.totalPages, result.data.currentPage);
            } else {
                renderError(result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            renderError('No se pudo conectar con el servidor.');
        }
    };

    const renderTable = (contracts) => {
        tableContainer.classList.remove('loading');

        if (contracts.length === 0) {
            tableContainer.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-3 text-muted display-4"><i class="bi bi-file-earmark-x"></i></div>
                    <h6 class="fw-bold">No se encontraron contratos</h6>
                    <p class="text-muted small">Intenta con otros filtros de búsqueda.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table-custom">
                    <thead>
                        <tr>
                            <th class="ps-4">Contrato / Empresa</th>
                            <th>Vigencia</th>
                            <th class="text-center">Estado</th>
                            <th class="text-center pe-4">Detalles</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        contracts.forEach(c => {
            // Formateo de fechas
            const inicio = new Date(c.fecha_inicio).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
            const fin = c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-PE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Indefinido';

            // Mapeo de colores para badges
            let statusClass = 'status-vigente';
            if (c.estado.color === 'danger') statusClass = 'status-vencido';
            if (c.estado.color === 'warning') statusClass = 'status-proximo';

            html += `
                <tr>
                    <td class="ps-4">
                        <div class="contract-name text-dark">${c.nombre_contrato}</div>
                        <div class="company-name">
                            <i class="bi bi-building"></i> ${c.empresa_nombre}
                        </div>
                    </td>
                    <td>
                        <div class="date-wrapper">
                            <div><span class="date-label">Desde:</span> <span class="date-text">${inicio}</span></div>
                            <div><span class="date-label">Hasta:</span> <span class="date-text">${fin}</span></div>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="badge-status ${statusClass}">${c.estado.texto}</span>
                    </td>
                    <td class="text-center pe-4">
                        <a href="/admin/contrato/${c.id_contrato}" class="btn-action" title="Ver Resumen y Equipos">
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        tableContainer.innerHTML = html;
    };

    const renderPagination = (totalPages, page) => {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        let prevClass = page === 1 ? 'disabled' : '';
        let nextClass = page === totalPages ? 'disabled' : '';

        let html = `
            <li class="page-item ${prevClass}">
                <a class="page-link border-0 text-muted" href="#" data-page="${page - 1}">
                    <i class="bi bi-chevron-left me-1"></i>
                </a>
            </li>
        `;

        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, page + 2);

        for (let i = startPage; i <= endPage; i++) {
            let activeClass = i === page ? 'active bg-primary border-primary text-white' : 'text-muted border-0';
            html += `
                <li class="page-item">
                    <a class="page-link rounded-circle mx-1 d-flex align-items-center justify-content-center ${activeClass}" 
                       style="width: 32px; height: 32px;" 
                       href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        html += `
            <li class="page-item ${nextClass}">
                <a class="page-link border-0 text-muted" href="#" data-page="${page + 1}">
                     <i class="bi bi-chevron-right ms-1"></i>
                </a>
            </li>
        `;
        paginationContainer.innerHTML = html;
    };

    const renderError = (message) => {
        tableContainer.classList.remove('loading');
        tableContainer.innerHTML = `
            <div class="p-4 text-center">
                <div class="text-danger mb-2"><i class="bi bi-exclamation-triangle display-5"></i></div>
                <h6 class="text-danger">Error</h6>
                <p class="text-muted small">${message}</p>
            </div>
        `;
    };

    const loadCompanyFilter = async () => {
        try {
            const res = await fetch("/admin/api/empresa/lista");
            const result = await res.json();
            if (result.success) {
                result.data.forEach(c => {
                    companyFilter.add(new Option(c.nombre, c.id_empresa));
                });
            }
        } catch (error) {
            console.error('Error al cargar filtro:', error);
        }
    };

    // --- EVENT LISTENERS ---
    searchInput.addEventListener('keyup', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchContracts();
        }, 400);
    });

    companyFilter.addEventListener('change', () => {
        currentPage = 1;
        fetchContracts();
    });

    paginationContainer.addEventListener('click', e => {
        e.preventDefault();
        const pageLink = e.target.closest('.page-link');
        if (pageLink && !pageLink.parentElement.classList.contains('disabled')) {
            const page = parseInt(pageLink.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                fetchContracts();
            }
        }
    });

    // Init
    loadCompanyFilter();
    fetchContracts();
});