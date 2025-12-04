document.addEventListener('DOMContentLoaded', () => {
    // ================================
    // 1. SELECTORES
    // ================================
    // Vistas
    const listView = document.getElementById('list-view');
    const formView = document.getElementById('form-view');
    const btnCreateNew = document.getElementById('btn-create-new');
    const btnCancelForm = document.getElementById('btn-cancel-form');
    const btnCancelFooter = document.getElementById('btn-cancel-footer');

    // Formulario
    const reportForm = document.getElementById('report-form');
    const formTitle = document.getElementById('form-title');
    const formSubmitBtn = document.getElementById('form-submit-btn');
    const idEmpresaSelect = document.getElementById('id_empresa');
    const urlInput = document.getElementById('url_informe');
    const fechaInput = document.getElementById('fecha_creacion');
    const alertContainer = document.getElementById('alert-container');

    // Lista y Filtros
    const searchInput = document.getElementById('search-input');
    const companyFilter = document.getElementById('company-filter');
    const reportsBody = document.getElementById('reports-body');
    const paginationEl = document.getElementById('pagination');

    // Modal Borrar
    const deleteModalEl = document.getElementById('deleteModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const bsDeleteModal = new bootstrap.Modal(deleteModalEl);

    // ================================
    // 2. ESTADO
    // ================================
    let reports = [], companies = [], filtered = [];
    let currentPage = 1;
    const rowsPerPage = 8;
    let currentEditId = null;
    let toDeleteId = null;

    // CSRF Helper
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // ================================
    // 3. INICIALIZACIÓN
    // ================================
    const init = async () => {
        await loadData();
        setupEventListeners();
    };

    const loadData = async () => {
        try {
            const [empresasRes, informesRes] = await Promise.all([
                fetch('/admin/api/empresa/lista'),
                fetch('/admin/api/informes')
            ]);

            const companiesResponse = await empresasRes.json();
            const reportsResponse = await informesRes.json();

            if (companiesResponse.success) companies = companiesResponse.data;
            if (reportsResponse.success) reports = reportsResponse.data;
            
            populateSelects();
            applyFiltersAndRender();
        } catch (err) {
            console.error('Error de carga:', err);
            reportsBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error de conexión al cargar datos.</td></tr>';
        }
    };

    const populateSelects = () => {
        const options = companies.map(c => `<option value="${c.id_empresa}">${c.nombre}</option>`).join('');
        
        // Llenar filtro
        companyFilter.innerHTML = `<option value="">— Todas las empresas —</option>${options}`;
        
        // Llenar select del formulario
        idEmpresaSelect.innerHTML = `<option value="" disabled selected>Seleccionar...</option>${options}`;
    };

    // ================================
    // 4. LÓGICA DE VISTAS
    // ================================
    const showForm = (isEdit = false, data = null) => {
        listView.classList.add('d-none');
        formView.classList.remove('d-none');
        btnCreateNew.classList.add('d-none'); // Ocultar botón "Nuevo" en modo form
        
        // Resetear form
        reportForm.reset();
        alertContainer.innerHTML = '';
        idEmpresaSelect.value = ""; // Reset select

        if (isEdit && data) {
            currentEditId = data.id_informe;
            formTitle.textContent = 'Editar Informe';
            formSubmitBtn.textContent = 'Guardar Cambios';
            
            idEmpresaSelect.value = data.id_empresa;
            urlInput.value = data.Url_Informe;
            
            // Formato fecha input date: YYYY-MM-DD
            if (data.fecha_creacion) {
                const dt = new Date(data.fecha_creacion);
                const yyyy = dt.getUTCFullYear();
                const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(dt.getUTCDate()).padStart(2, '0');
                fechaInput.value = `${yyyy}-${mm}-${dd}`;
            }
        } else {
            currentEditId = null;
            formTitle.textContent = 'Nuevo Informe';
            formSubmitBtn.textContent = 'Crear Informe';
            // Fecha hoy por defecto
            fechaInput.value = new Date().toISOString().split('T')[0];
        }
    };

    const showList = () => {
        formView.classList.add('d-none');
        listView.classList.remove('d-none');
        btnCreateNew.classList.remove('d-none');
        applyFiltersAndRender();
    };

    // ================================
    // 5. LISTA Y FILTROS
    // ================================
    const applyFiltersAndRender = () => {
        const term = searchInput.value.trim().toLowerCase();
        const compId = companyFilter.value;
        
        filtered = reports.filter(r => 
            r.Url_Informe.toLowerCase().includes(term) && 
            (compId === '' || r.id_empresa == compId)
        );
        
        // Si se filtra, volver a página 1
        // currentPage = 1; // Opcional, resetea paginación al filtrar
        renderTable();
    };

    const renderTable = () => {
        reportsBody.innerHTML = "";
        if (filtered.length === 0) {
            reportsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-5">No se encontraron informes.</td></tr>`;
            paginationEl.innerHTML = "";
            return;
        }

        const totalPages = Math.ceil(filtered.length / rowsPerPage);
        currentPage = Math.min(currentPage, totalPages);
        const start = (currentPage - 1) * rowsPerPage;
        const pageData = filtered.slice(start, start + rowsPerPage);

        pageData.forEach(r => {
            const fecha = new Date(r.fecha_creacion).toLocaleDateString('es-PE', {timeZone: 'UTC'});
            
            const row = `
                <tr>
                    <td class="ps-4 fw-semibold text-dark">${r.empresa || 'N/A'}</td>
                    <td>
                        <a href="${r.Url_Informe}" target="_blank" class="truncate-link" title="${r.Url_Informe}">
                            ${r.Url_Informe}
                        </a>
                    </td>
                    <td class="text-muted small font-monospace">${fecha}</td>
                    <td class="text-end pe-4">
                        <button class="btn-icon btn-edit" data-id="${r.id_informe}" title="Editar">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn-icon delete btn-delete" data-id="${r.id_informe}" title="Eliminar">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            reportsBody.insertAdjacentHTML('beforeend', row);
        });
        
        renderPagination(totalPages);
    };

    const renderPagination = (totalPages) => {
        paginationEl.innerHTML = '';
        if (totalPages <= 1) return;

        let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <button class="page-link border-0 text-muted" data-page="${currentPage - 1}">Anterior</button>
                    </li>`;
        
        for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                        <button class="page-link border-0 ${i === currentPage ? 'bg-primary text-white rounded-3 shadow-sm' : 'text-muted'}" data-page="${i}">${i}</button>
                     </li>`;
        }

        html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <button class="page-link border-0 text-muted" data-page="${currentPage + 1}">Siguiente</button>
                 </li>`;
        
        paginationEl.innerHTML = html;
    };

    // ================================
    // 6. ACCIONES (Submit / Delete)
    // ================================
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            id_empresa: idEmpresaSelect.value,
            Url_Informe: urlInput.value.trim(),
            fecha_creacion: fechaInput.value 
        };

        if (!payload.id_empresa || !payload.Url_Informe || !payload.fecha_creacion) {
            return showAlert('Por favor complete todos los campos.', 'warning');
        }

        formSubmitBtn.disabled = true;
        const originalText = formSubmitBtn.textContent;
        formSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

        const isEditing = !!currentEditId;
        const url = isEditing ? `/admin/api/informes/${currentEditId}` : '/admin/api/informes';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken() // SEGURIDAD CSRF
                },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            
            if (res.ok && json.success) {
                await loadData(); // Recargar datos frescos
                showList(); // Volver a la lista
                // Podrías agregar un Toast aquí si tuvieras el sistema implementado
            } else {
                showAlert(json.message || 'Error en la operación.', 'danger');
            }
        } catch (err) {
            console.error(err);
            showAlert('Error de conexión con el servidor.', 'danger');
        } finally {
            formSubmitBtn.disabled = false;
            formSubmitBtn.textContent = originalText;
        }
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!toDeleteId) return;
        
        // UI Feedback
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = "Eliminando...";

        try {
            const res = await fetch(`/admin/api/informes/${toDeleteId}`, { 
                method: 'DELETE',
                headers: { 'x-csrf-token': getCsrfToken() } // SEGURIDAD CSRF
            });
            
            if (res.ok) {
                bsDeleteModal.hide();
                await loadData();
            } else {
                alert('No se pudo eliminar el informe.');
            }
        } catch (err) { 
            console.error(err);
            alert('Error de red.'); 
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = "Sí, eliminar";
        }
    });

    function showAlert(msg, type) {
        alertContainer.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show border-0 shadow-sm">
                <i class="bi ${type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'} me-2"></i>
                ${msg}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>`;
    }

    // ================================
    // 7. EVENT LISTENERS GLOBALES
    // ================================
    btnCreateNew.addEventListener('click', () => showForm(false));
    btnCancelForm.addEventListener('click', showList);
    btnCancelFooter.addEventListener('click', showList);

    searchInput.addEventListener('keyup', () => { currentPage = 1; applyFiltersAndRender(); });
    companyFilter.addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });

    // Delegación para botones de tabla
    reportsBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const id = btn.dataset.id;
        
        if (btn.classList.contains('btn-edit')) {
            const report = reports.find(r => r.id_informe == id);
            if (report) showForm(true, report);
        }
        
        if (btn.classList.contains('btn-delete')) {
            toDeleteId = id;
            bsDeleteModal.show();
        }
    });

    // Paginación click
    paginationEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn) {
            const p = parseInt(btn.dataset.page);
            if (p && p !== currentPage) {
                currentPage = p;
                renderTable();
            }
        }
    });

    // INICIO
    init();
});