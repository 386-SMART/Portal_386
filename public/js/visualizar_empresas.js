document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const paginationContainer = document.getElementById('pagination');
    const tableContainer = document.getElementById('table-container');

    let currentPage = 1;
    let debounceTimer;

    const showLoader = () => {
        tableContainer.classList.add('loading');
        tableContainer.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div>';
    };

    const fetchCompanies = async () => {
        showLoader();
        const searchTerm = searchInput.value;
        const url = `/admin/api/admin/companies?page=${currentPage}&search=${searchTerm}`;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                renderTable(result.data.companies);
                renderPagination(result.data.totalPages, result.data.currentPage);
            } else {
                renderError(result.message);
            }
        } catch (error) {
            console.error('Error:', error);
            renderError('No se pudo conectar con el servidor.');
        }
    };

    const renderTable = (companies) => {
        tableContainer.classList.remove('loading');

        if (companies.length === 0) {
            tableContainer.innerHTML = `
                <div class="text-center py-5">
                    <div class="mb-3 text-muted display-4"><i class="bi bi-inbox"></i></div>
                    <h6 class="fw-bold">No se encontraron empresas</h6>
                    <p class="text-muted small">Intenta con otro término de búsqueda.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="table-custom">
                    <thead>
                        <tr>
                            <th class="ps-4" style="width: 70%;">Información de la Empresa</th>
                            <th class="text-end pe-4" style="width: 30%;">Slug (Acceso)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        companies.forEach(c => {
            html += `
                <tr>
                    <td class="ps-4">
                        <div class="d-flex flex-column justify-content-center">
                            <div class="fw-bold text-dark fs-6 mb-1">${c.nombre}</div>
                            <div class="small text-muted">
                                <i class="bi bi-geo-alt me-1 text-secondary"></i>
                                ${c.direccion || 'Sin dirección registrada'}
                            </div>
                        </div>
                    </td>
                    <td class="text-end pe-4">
                        <span class="slug-badge">${c.slug}</span>
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
                    <i class="bi bi-chevron-left me-1"></i> Anterior
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
                    Siguiente <i class="bi bi-chevron-right ms-1"></i>
                </a>
            </li>
        `;

        paginationContainer.innerHTML = html;
    };

    const renderError = (message) => {
        tableContainer.classList.remove('loading');
        tableContainer.innerHTML = `
            <div class="p-4 text-center">
                <div class="text-danger mb-2"><i class="bi bi-exclamation-circle display-4"></i></div>
                <h6 class="text-danger">${message}</h6>
            </div>
        `;
    };

    // --- LISTENERS ---
    searchInput.addEventListener('keyup', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchCompanies();
        }, 400);
    });

    paginationContainer.addEventListener('click', e => {
        e.preventDefault();
        const pageLink = e.target.closest('.page-link');
        if (pageLink && !pageLink.parentElement.classList.contains('disabled')) {
            const page = parseInt(pageLink.dataset.page);
            if (page && page !== currentPage) {
                currentPage = page;
                fetchCompanies();
            }
        }
    });

    // Init
    fetchCompanies();
});