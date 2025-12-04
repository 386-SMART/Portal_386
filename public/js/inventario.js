// Configuración general
const API_BASE = '/admin/soporteti/api/inventario';
const PAGE_SIZE = 20;

// Estado
let currentPage = 1;
let currentFilters = {
    empresa: '',
    estado: '',
    busqueda: ''
};

let charts = {
    categoria: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Esperar Chart.js
    let attempts = 0;
    while (!window.Chart && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }

    if (window.Chart) {
        await loadGraficos();
    }

    await loadEquipos();
    await loadEmpresas();
    setupEventListeners();
});

// Eventos
function setupEventListeners() {
    const btnFiltrar = document.getElementById('btnFiltrar');
    const searchInput = document.getElementById('searchInput');

    btnFiltrar.addEventListener('click', () => {
        currentFilters.empresa = document.getElementById('filterEmpresa').value;
        currentFilters.estado = document.getElementById('filterEstado').value;
        currentFilters.busqueda = searchInput.value.trim();
        currentPage = 1;
        loadEquipos();
    });

    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            btnFiltrar.click();
        }
    });
}

// Gráficos
async function loadGraficos() {
    try {
        const response = await fetch(`${API_BASE}/graficos`);
        const data = await response.json();

        if (data.success) {
            drawCategoriaChart(data.categoria || []);
        }
    } catch (error) {
        console.error('Error cargando gráficos:', error);
    }
}

function drawCategoriaChart(data) {
    const ctx = document.getElementById('chartCategoria');
    if (!ctx) return;

    if (charts.categoria) charts.categoria.destroy();

    charts.categoria = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.categoria),
            datasets: [{
                label: 'Cantidad',
                data: data.map(d => d.cantidad),
                backgroundColor: '#0d6efd',
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

// Empresas filtro
async function loadEmpresas() {
    try {
        const response = await fetch(`${API_BASE}/empresas`);
        const data = await response.json();

        if (data.success && data.data) {
            const select = document.getElementById('filterEmpresa');
            while (select.options.length > 1) select.remove(1);

            let totalEquipos = 0;
            data.data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id_empresa;
                option.textContent = `${empresa.nombre} (${empresa.cantidad_equipos})`;
                select.appendChild(option);
                totalEquipos += Number(empresa.cantidad_equipos || 0);
            });

            // Resumen empresas/equipos
            const empresasUnicas = data.data.length;
            const summaryEmpresas = document.getElementById('summaryEmpresas');
            const summaryEquipos = document.getElementById('summaryEquipos');

            if (summaryEmpresas) summaryEmpresas.textContent = empresasUnicas;
            if (summaryEquipos) summaryEquipos.textContent = totalEquipos;
        }
    } catch (error) {
        console.error('Error cargando empresas:', error);
    }
}

// Equipos + paginación
async function loadEquipos() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: PAGE_SIZE,
            ...currentFilters
        });

        const response = await fetch(`${API_BASE}/lista?${params}`);
        const data = await response.json();

        if (data.success) {
            renderTabla(data.data || []);
            renderPaginacion(data.pagination || { page: 1, pages: 1, total: 0 });

            const countEquipos = document.getElementById('countEquipos');
            if (countEquipos) {
                countEquipos.textContent = `${data.pagination.total} equipos`;
            }

            const summaryContratos = document.getElementById('summaryContratos');
            if (summaryContratos && data.summary && data.summary.contratos) {
                summaryContratos.textContent = data.summary.contratos;
            }
        }
    } catch (error) {
        console.error('Error cargando equipos:', error);
    }
}

function renderTabla(equipos) {
    const tbody = document.getElementById('equiposBody');
    if (!tbody) return;

    if (!equipos.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="bi bi-inbox fs-3 text-muted"></i>
                    <p class="mt-2 text-muted mb-0">No hay equipos para mostrar con los filtros actuales.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = equipos.map(equipo => `
        <tr>
            <td class="fw-semibold text-muted">#${equipo.id_equipo}</td>
            <td>
                <span class="badge-serial">${equipo.num_serie}</span>
            </td>
            <td>
                <div class="fw-semibold">${equipo.marca || '--'}</div>
                <small class="text-muted">${equipo.modelo || '--'}</small>
            </td>
            <td>
                <div class="fw-semibold">${equipo.nombre_empresa}</div>
                <small class="text-muted">Contrato #${equipo.id_contrato}</small>
            </td>
            <td>${equipo.categoria_nombre || '--'}</td>
            <td>
                <span class="badge-soft ${getEstadoBadgeClass(equipo.estado)}">
                    ${equipo.estado}
                </span>
            </td>
            <td class="text-center">
                <button class="btn-icon-soft" onclick="verDetalles(${equipo.id_equipo})" title="Ver detalles">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderPaginacion(pagination) {
    const paginacionDiv = document.getElementById('paginacion');
    const info = document.getElementById('paginationInfo');
    if (!paginacionDiv) return;

    paginacionDiv.innerHTML = '';

    const { page, pages, total } = pagination;
    if (info) {
        const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
        const end = Math.min(page * PAGE_SIZE, total);
        info.textContent = total
            ? `Mostrando ${start} - ${end} de ${total} registros`
            : 'Sin registros';
    }

    if (pages <= 1) return;

    // Anterior
    if (page > 1) {
        paginacionDiv.innerHTML += `
            <li class="page-item">
                <button class="page-link" onclick="irPagina(${page - 1})">
                    <i class="bi bi-chevron-left"></i>
                </button>
            </li>
        `;
    }

    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(pages, page + 2);

    if (startPage > 1) {
        paginacionDiv.innerHTML += `
            <li class="page-item">
                <button class="page-link" onclick="irPagina(1)">1</button>
            </li>
        `;
        if (startPage > 2) {
            paginacionDiv.innerHTML += `
                <li class="page-item disabled"><span class="page-link">…</span></li>
            `;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === page ? 'active' : '';
        paginacionDiv.innerHTML += `
            <li class="page-item ${active}">
                <button class="page-link ${active ? 'active' : ''}" onclick="irPagina(${i})">${i}</button>
            </li>
        `;
    }

    if (endPage < pages) {
        if (endPage < pages - 1) {
            paginacionDiv.innerHTML += `
                <li class="page-item disabled"><span class="page-link">…</span></li>
            `;
        }
        paginacionDiv.innerHTML += `
            <li class="page-item">
                <button class="page-link" onclick="irPagina(${pages})">${pages}</button>
            </li>
        `;
    }

    if (page < pages) {
        paginacionDiv.innerHTML += `
            <li class="page-item">
                <button class="page-link" onclick="irPagina(${page + 1})">
                    <i class="bi bi-chevron-right"></i>
                </button>
            </li>
        `;
    }
}

function irPagina(page) {
    currentPage = page;
    loadEquipos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Detalle
async function verDetalles(id) {
    try {
        const response = await fetch(`${API_BASE}/detalle/${id}`);
        const data = await response.json();

        if (data.success) {
            const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
            renderDetalle(data.data);
            modal.show();
        }
    } catch (error) {
        console.error('Error cargando detalles:', error);
    }
}

function renderDetalle(equipo) {
    const fechaInicio = equipo.fecha_inicio ? new Date(equipo.fecha_inicio).toLocaleDateString('es-ES') : '--';
    const fechaFin    = equipo.fecha_fin ? new Date(equipo.fecha_fin).toLocaleDateString('es-ES') : '--';

    const html = `
        <div class="detail-shell">
            <!-- CABECERA EQUIPO -->
            <div class="detail-header-box">
                <div>
                    <h5 class="detail-main-title mb-1">${equipo.marca || ''} ${equipo.modelo || ''}</h5>
                    <p class="detail-main-subtitle mb-0">
                        N/S: <span class="badge-serial">${equipo.num_serie}</span>
                    </p>
                </div>
                <div class="text-end">
                    <div class="detail-chip-id">ID #${equipo.id_equipo}</div>
                    <span class="badge-soft ${getEstadoBadgeClass(equipo.estado)} mt-2 d-inline-block">
                        ${equipo.estado}
                    </span>
                </div>
            </div>

            <!-- INFO EQUIPO -->
            <section class="detail-section mt-3">
                <div class="detail-section-title">
                    <i class="bi bi-cpu"></i>
                    <span>Información del equipo</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-card">
                        <span class="detail-label">Número de serie</span>
                        <span class="detail-value fw-semibold">${equipo.num_serie}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Categoría</span>
                        <span class="detail-value">${equipo.categoria_nombre || '--'}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Marca</span>
                        <span class="detail-value">${equipo.marca || '--'}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Modelo</span>
                        <span class="detail-value">${equipo.modelo || '--'}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Part Number</span>
                        <span class="detail-value">de>${equipo.part_number || '--'}</code></span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Accesorios</span>
                        <span class="detail-value">
                            Cargador: ${equipo.ct_cargador ? '✓' : '✗'} ·
                            Teclado: ${equipo.ct_teclado ? '✓' : '✗'} ·
                            Mouse: ${equipo.ct_mouse ? '✓' : '✗'}
                        </span>
                    </div>
                    <div class="detail-card detail-span-2">
                        <span class="detail-label">Características</span>
                        <span class="detail-value">${equipo.caracteristicas || '--'}</span>
                    </div>
                </div>
            </section>

            <!-- EMPRESA -->
            <section class="detail-section">
                <div class="detail-section-title">
                    <i class="bi bi-building"></i>
                    <span>Empresa asignada</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-card">
                        <span class="detail-label">Nombre de empresa</span>
                        <span class="detail-value fw-semibold">${equipo.nombre_empresa}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Slug</span>
                        <span class="detail-value">de>${equipo.slug || '--'}</code></span>
                    </div>
                    <div class="detail-card detail-span-2">
                        <span class="detail-label">Dirección</span>
                        <span class="detail-value">${equipo.direccion || '--'}</span>
                    </div>
                </div>
            </section>

            <!-- CONTRATO -->
            <section class="detail-section">
                <div class="detail-section-title">
                    <i class="bi bi-file-earmark-text"></i>
                    <span>Información del contrato</span>
                </div>
                <div class="detail-grid">
                    <div class="detail-card detail-span-2">
                        <span class="detail-label">Nombre del contrato</span>
                        <span class="detail-value fw-semibold">${equipo.nombre_contrato || 'N/A'}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Vigencia desde</span>
                        <span class="detail-value">${fechaInicio}</span>
                    </div>
                    <div class="detail-card">
                        <span class="detail-label">Vigencia hasta</span>
                        <span class="detail-value">${fechaFin}</span>
                    </div>
                    <div class="detail-card detail-span-2">
                        <span class="detail-label">Servicios contratados</span>
                        <div class="detail-services">
                            <span><i class="bi ${equipo.implementacion ? 'bi-check-circle-fill text-success' : 'bi-dash-circle text-muted'}"></i> Implementación</span>
                            <span><i class="bi ${equipo.mantenimiento ? 'bi-check-circle-fill text-success' : 'bi-dash-circle text-muted'}"></i> Mantenimiento</span>
                            <span><i class="bi ${equipo.devolucion_de_equipos ? 'bi-check-circle-fill text-success' : 'bi-dash-circle text-muted'}"></i> Devolución de equipos</span>
                            <span><i class="bi ${equipo.preparacion_de_imagen ? 'bi-check-circle-fill text-success' : 'bi-dash-circle text-muted'}"></i> Preparación de imagen</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `;

    document.getElementById('detalleContent').innerHTML = html;
}


// Utilidades
function getEstadoBadgeClass(estado) {
    const map = {
        'Operativo': 'badge-soft-success',
        'En Almacén': 'badge-soft-primary',
        'Asignado': 'badge-soft-warning',
        'En Mantenimiento': 'badge-soft-danger',
        'De Baja': 'badge-soft-secondary'
    };
    return map[estado] || 'badge-soft-secondary';
}

function formatMoneda(valor) {
    return parseFloat(valor).toLocaleString('es-ES', {
        style: 'currency',
        currency: 'USD'
    });
}
