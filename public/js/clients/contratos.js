document.addEventListener("DOMContentLoaded", () => {
  const dashboardContainer = document.getElementById("dashboard-container");
  const contractCards = document.querySelectorAll(".contract-card");
  const bsOffcanvas = new bootstrap.Offcanvas(document.getElementById("equipo-details-offcanvas"));

  const searchInput = document.getElementById("search-contrato");
  const statusFilter = document.getElementById("filter-estado");

  let charts = { categorias: null, modelos: null };
  let fullEquipmentList = [];

  // ====== CONFIG ======
  const MAX_TOP_N = 20; // Top N por defecto para "Top + Otros"

  // --- ESTADO PARA LA PAGINACIÓN ---
  let paginationState = {
    currentPage: 1,
    rowsPerPage: 40, // ahora 40 por página
    filteredList: []
  };

  // --- Utilidades ---
  const toSentenceCase = (str) => !str ? '' : str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const showLoader = () => {
    dashboardContainer.innerHTML = `<div class="d-flex h-100 align-items-center justify-content-center"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;"></div></div>`;
  };

  // ===================== FILTRO DE LA LISTA DE CONTRATOS =====================
  const applyContractFilters = () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = statusFilter.value;

    contractCards.forEach(card => {
      const contractName = card.querySelector('.fw-bold').textContent.toLowerCase();
      const badgeStatus = card.querySelector('.badge').textContent.trim();
      const typeElement = card.querySelector('.bi-file-earmark-text')
        ? card.querySelector('.bi-file-earmark-text').parentElement.textContent.trim()
        : '';

      const matchesSearch = contractName.includes(searchTerm);
      const matchesFilter =
        !filterValue ||
        badgeStatus.toLowerCase().includes(filterValue.toLowerCase()) ||
        typeElement.toLowerCase().includes(filterValue.toLowerCase());

      card.style.display = (matchesSearch && matchesFilter) ? 'block' : 'none';
    });
  };

  searchInput.addEventListener('input', applyContractFilters);
  statusFilter.addEventListener('change', applyContractFilters);

  // ===================== CLICK EN UN CONTRATO =====================
  contractCards.forEach((card) => {
    card.addEventListener("click", async () => {
      contractCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      showLoader();

      try {
        const contratoId = card.dataset.contratoId;
        const response = await fetch(`api/contract-dashboard/${contratoId}`);
        const result = await response.json();

        if (result.success) {
          fullEquipmentList = result.data.listaEquipos;
          renderDashboard(
            result.data,
            card.querySelector('.fw-bold').textContent,
            card.querySelector('.badge').outerHTML
          );
        } else {
          dashboardContainer.innerHTML = `<div class="alert alert-danger m-4">Error: ${result.message}</div>`;
        }
      } catch (error) {
        console.error("Error al cargar dashboard:", error);
        dashboardContainer.innerHTML = `<div class="alert alert-danger m-4">Error de conexión al cargar los detalles del contrato.</div>`;
      }
    });
  });

  // ===================== CSV =====================
  const sanitizeCSVField = (field) => {
    if (field === null || typeof field === 'undefined') return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const exportInventoryToCSV = () => {
    if (paginationState.filteredList.length === 0) {
      alert("No hay datos en el inventario para exportar.");
      return;
    }
    const headers = [
      "Numero de Serie","Marca","Modelo","Categoria","Part Number","Estado","Caracteristicas"
    ];
    let csvContent = headers.join(',') + '\n';
    paginationState.filteredList.forEach(eq => {
      const row = [
        eq.num_serie, eq.marca, eq.modelo, eq.categoria_nombre,
        eq.part_number, eq.estado, eq.caracteristicas
      ].map(sanitizeCSVField).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventario_contrato_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ===================== RENDER DEL DASHBOARD =====================
  const renderDashboard = (data, contractName, statusBadge) => {
    const { kpis, graficoCategorias, graficoModelos, serviciosIncluidos, documentos, contrato } = data;

    const kpisHtml = `
      <div class="col-md-4">
        <div class="kpi-item text-center h-100">
          <div class="text-muted small text-uppercase fw-bold">TOTAL INVENTARIO</div>
          <div class="fs-1 fw-bolder mt-2">${kpis.totalInventario || 0}</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="kpi-item text-center h-100">
          <div class="text-muted small text-uppercase fw-bold">TOTAL EQUIPOS</div>
          <div class="fs-1 fw-bolder mt-2">${kpis.totalEquipos || 0}</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="kpi-item text-center h-100">
          <div class="text-muted small text-uppercase fw-bold">VISITAS TÉCNICAS</div>
          <div class="fs-1 fw-bolder mt-2">${kpis.totalVisitas || 0}</div>
        </div>
      </div>`;

    let documentosHtml = '';
    if (documentos && documentos.length > 0) {
      const contratosDocs = documentos.filter(d => d.tipo_documento === 'Contrato');
      const guiasDocs = documentos.filter(d => d.tipo_documento === 'Guia');
      const propuestasDocs = documentos.filter(d => d.tipo_documento === 'Propuesta');

      const createAccordionItem = (docs, title, id, isShown = false) => {
        if (docs.length === 0) return '';
        return `
          <div class="accordion-item">
            <h2 class="accordion-header" id="heading-${id}">
              <button class="accordion-button ${isShown ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${id}">
                ${title}<span class="badge rounded-pill bg-primary ms-2">${docs.length}</span>
              </button>
            </h2>
            <div id="collapse-${id}" class="accordion-collapse collapse ${isShown ? 'show' : ''}" data-bs-parent="#documentosAccordion">
              <div class="accordion-body p-0">
                <ul class="list-group list-group-flush">
                  ${docs.map(doc => `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <i class="bi bi-file-earmark-pdf me-2 text-danger"></i>
                        <a href="${doc.ruta_archivo}" target="_blank" class="text-decoration-none">${doc.nombre_original}</a>
                      </div>
                      <span class="text-muted small">${(doc.tamano_bytes / 1024).toFixed(1)} KB</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          </div>`;
      };
      documentosHtml = `
        <div class="accordion" id="documentosAccordion">
          ${createAccordionItem(contratosDocs, 'Contratos', 'contratos', true)}
          ${createAccordionItem(guiasDocs, 'Guías', 'guias')}
          ${createAccordionItem(propuestasDocs, 'Propuestas', 'propuestas')}
        </div>`;
    } else {
      documentosHtml = '<p class="text-muted m-0">No hay documentos disponibles para este contrato.</p>';
    }

    dashboardContainer.innerHTML = `
      <div class="detail-header d-flex justify-content-between align-items-center flex-wrap">
        <div>
          <h2 class="fw-bold mb-1">${contractName}</h2>
          <div>${statusBadge}</div>
        </div>
        <div class="mt-2 mt-sm-0">
          <img src="/img/logo_paginas_cliente/logo386blanco.png" alt="Logo 386 SMART" class="header-logo">
        </div>
      </div>
      <div class="p-4">
        <ul class="nav nav-tabs mb-4" id="contractTab" role="tablist">
          <li class="nav-item" role="presentation"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#resumen-tab-pane">Resumen</button></li>
          <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#inventario-tab-pane">Inventario</button></li>
          <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#servicios-tab-pane">Servicios Incluidos</button></li>
          <li class="nav-item" role="presentation"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#documentos-tab-pane">Documentación <span class="badge rounded-pill bg-secondary ms-1">${documentos ? documentos.length : 0}</span></button></li>
        </ul>
        <div class="tab-content" id="contractTabContent">
          <div class="tab-pane fade show active" id="resumen-tab-pane"></div>
          <div class="tab-pane fade" id="inventario-tab-pane"></div>
          <div class="tab-pane fade" id="servicios-tab-pane"></div>
          <div class="tab-pane fade" id="documentos-tab-pane"></div>
        </div>
      </div>`;

    document.querySelector('#resumen-tab-pane').innerHTML = `
      <div class="row g-4">
        <div class="col-12">
          <div class="row g-4 mb-4">${kpisHtml}</div>
          <div class="card">
            <div class="card-body">
              <h5 class="fw-bold mb-3">Descripción del Contrato</h5>
              <p class="text-muted mb-0" style="white-space: pre-wrap;">
                ${contrato.descripcion || 'No se ha proporcionado una descripción para este contrato.'}
              </p>
            </div>
          </div>
          ${contrato.nombre_contrato_relacionado ? `
          <div class="alert alert-primary d-flex align-items-center mt-3" role="alert" style="background-color:#f4f8ff; border:1px solid #cce5ff;">
            <i class="bi bi-link-45deg fs-5 me-2 text-primary"></i>
            <div><strong>Contrato relacionado:</strong>
              <span class="fw-semibold">${contrato.nombre_contrato_relacionado}</span>
            </div>
          </div>` : ''}
        </div>

        <div class="col-12">
          <div class="chart-card">
            <h5 class="fw-bold mb-3 text-center">Equipos por Categoría</h5>
            <div class="chart-container" id="cat-container">
              <canvas id="chart-categorias"></canvas>
            </div>
          </div>
        </div>

        <div class="col-12">
          <div class="chart-card mt-4">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h5 class="fw-bold m-0">Equipos por Modelo</h5>
              <div class="d-flex align-items-center gap-2">
                <label class="text-muted small me-1">Vista:</label>
                <select id="models-view" class="form-select form-select-sm w-auto">
                  <option value="top" selected>Top 20 + “Otros”</option>
                  <option value="treemap">Mosaico (treemap)</option>
                  <option value="all">Todos (barras)</option>
                </select>
              </div>
            </div>
            <div class="chart-container" id="chart-modelos-wrap">
              <canvas id="chart-modelos"></canvas>
            </div>
          </div>
        </div>
      </div>`;

    document.querySelector('#inventario-tab-pane').innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold m-0">Inventario del Contrato</h5>
            <button class="btn btn-sm btn-success" id="btn-export-csv">
              <i class="bi bi-file-earmark-spreadsheet me-1"></i> Exportar a CSV
            </button>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-md-4">
              <select id="filtro-categoria" class="form-select">
                <option value="">Todas las Categorías</option>
              </select>
            </div>
            <div class="col-md-4">
              <select id="filtro-modelo" class="form-select">
                <option value="">Todos los Modelos</option>
              </select>
            </div>
            <div class="col-md-4">
              <input type="text" id="filtro-serie" class="form-control" placeholder="Buscar por N/S...">
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-hover" id="tabla-equipos"></table>
          </div>
          <div id="pagination-controls" class="d-flex justify-content-end mt-3"></div>
        </div>
      </div>`;

    document.querySelector('#servicios-tab-pane').innerHTML = `
      <div class="card">
        <div class="card-body">
          <h5 class="fw-bold mb-3">Servicios Incluidos</h5>
          <ul class="list-group list-group-flush">
            ${(serviciosIncluidos.length > 0
              ? serviciosIncluidos.map(s => `<li class="list-group-item border-0 py-3"><i class="bi bi-check-circle-fill text-success me-2"></i><span>${toSentenceCase(s)}</span></li>`).join('')
              : '<li class="list-group-item border-0 text-muted">No hay servicios adicionales incluidos.</li>')}
          </ul>
        </div>
      </div>`;

    document.querySelector('#documentos-tab-pane').innerHTML = `
      <div class="card">
        <div class="card-body">
          <h5 class="fw-bold mb-3">Documentos del Contrato</h5>
          ${documentosHtml}
        </div>
      </div>`;

    renderCharts(graficoCategorias, graficoModelos);
    setupInventoryTab();
  };

  // ===================== CHARTS =====================
  function truncateLabel(str, max = 18) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  function aggregateTopN(list, n = MAX_TOP_N) {
    const sorted = [...list].sort((a, b) => b.cantidad - a.cantidad);
    const top = sorted.slice(0, n);
    const tail = sorted.slice(n);
    const othersCount = tail.reduce((acc, it) => acc + it.cantidad, 0);
    if (othersCount > 0) {
      top.push({ modelo: `Otros (${tail.length})`, cantidad: othersCount, _isOthers: true });
    }
    return top;
  }

  function renderModelsChart(mode, modelosData) {
    if (charts.modelos) { charts.modelos.destroy(); charts.modelos = null; }

    const wrap = document.getElementById('chart-modelos-wrap');
    const ctx  = document.getElementById('chart-modelos').getContext('2d');

    const BLUE = '#0d6efd';
    const GREEN = '#198754';

    // --- Vista: TOP N + "Otros" (barras horizontales)
    if (mode === 'top') {
      const top = aggregateTopN(modelosData, MAX_TOP_N);
      const labels = top.map(r => truncateLabel(r.modelo, 26));
      const values = top.map(r => r.cantidad);
      const colors = top.map((r, i) => r._isOthers ? '#6c757d' : (i === 0 ? BLUE : GREEN));
      const h = Math.max(300, 24 * top.length + 80);
      wrap.style.height = `${h}px`;

      charts.modelos = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6 }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => top[items[0].dataIndex].modelo,
                label: (ctx) => `${ctx.parsed.x} unidades`
              }
            }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f3f5' }, ticks: { color: '#6c757d', precision: 0 } },
            y: { grid: { display: false }, ticks: { color: '#2b2b2b' } }
          }
        }
      });
      return;
    }

    // --- Vista: Todos (barras horizontales)
    if (mode === 'all') {
      const labels = modelosData.map(r => truncateLabel(r.modelo, 26));
      const values = modelosData.map(r => r.cantidad);
      const colors = modelosData.map((_, i) => (i === 0 ? BLUE : GREEN));
      const h = Math.max(360, 22 * labels.length + 80);
      wrap.style.height = `${h}px`;

      charts.modelos = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6 }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => modelosData[items[0].dataIndex].modelo,
                label: (ctx) => `${ctx.parsed.x} unidades`
              }
            }
          },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f3f5' }, ticks: { color: '#6c757d', precision: 0 } },
            y: { grid: { display: false }, ticks: { color: '#2b2b2b', autoSkip: false } }
          }
        }
      });
      return;
    }

    // --- Vista: Treemap
    if (mode === 'treemap') {
      wrap.style.height = '420px';
      const tree = modelosData.map(m => ({ v: m.cantidad, g: 'Modelos', label: m.modelo }));

      charts.modelos = new Chart(ctx, {
        type: 'treemap',
        data: {
          datasets: [{
            tree,
            key: 'v',
            groups: ['g'],
            spacing: 1,
            borderColor: '#fff',
            borderWidth: 1,
            backgroundColor(context) {
              const { v } = context.raw || {};
              const max = Math.max(1, Math.max(...modelosData.map(m => m.cantidad)));
              const base = Math.min(1, (v || 0) / max);
              const g = Math.floor(180 - 80 * base);
              return `rgb(25,${g},84)`; // escala de verdes
            },
            labels: {
              display: true,
              formatter(ctx) {
                const { label, v } = ctx.raw || {};
                return `${truncateLabel(label, 18)}\n${v}`;
              },
              color: '#fff',
              font: { size: 10, weight: '600' }
            }
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => items[0].raw.label,
                label: (ctx) => `${ctx.raw.v} unidades`
              }
            }
          }
        }
      });
    }
  }

  function renderCharts(categoriasData, modelosData) {
    // --- Categorías (barras horizontales con altura dinámica)
    if (charts.categorias) charts.categorias.destroy();
    const catContainer = document.getElementById("cat-container");
    const catCtx = document.getElementById("chart-categorias").getContext("2d");
    const CHART_COLORS = ['#0d6efd','#6f42c1','#198754','#ffc107','#dc3545','#0dcaf0','#6c757d'];

    // altura: base 320 + 28px por categoría, cap en 1200
    const catHeight = Math.max(320, Math.min(320 + categoriasData.length * 28, 1200));
    catContainer.style.height = `${catHeight}px`;

    charts.categorias = new Chart(catCtx, {
      type: "bar",
      data: {
        labels: categoriasData.map(c => c.nombre),
        datasets: [{
          label: "Cantidad de Equipos",
          data: categoriasData.map(c => c.cantidad),
          backgroundColor: categoriasData.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
          borderRadius: 6,
          barThickness: 22
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: "#f1f3f5" }, ticks: { color: "#6c757d", precision: 0 } },
          y: { grid: { display: false }, ticks: { color: "#212529", font: { weight: "600" } } }
        }
      }
    });

    // --- Modelos: crear según selector
    const viewSelect = document.getElementById('models-view') || { value: 'top' };
    renderModelsChart(viewSelect.value || 'top', modelosData);

    // bind una sola vez
    if (viewSelect && !viewSelect._bound) {
      viewSelect.addEventListener('change', () => {
        renderModelsChart(viewSelect.value, modelosData);
      });
      viewSelect._bound = true;
    }
  }

  // ===================== INVENTARIO (tabla + paginación) =====================
  const setupInventoryTab = () => {
    const uniqueCategories = [...new Set(fullEquipmentList.map(eq => eq.categoria_nombre).filter(Boolean))];
    const uniqueModels = [...new Set(fullEquipmentList.map(eq => eq.modelo).filter(Boolean))];

    const categoriaSelect = document.getElementById("filtro-categoria");
    const modeloSelect = document.getElementById("filtro-modelo");
    categoriaSelect.innerHTML = '<option value="">Todas las Categorías</option>';
    modeloSelect.innerHTML = '<option value="">Todos los Modelos</option>';
    uniqueCategories.forEach(cat => categoriaSelect.innerHTML += `<option value="${cat}">${toSentenceCase(cat)}</option>`);
    uniqueModels.forEach(mod => modeloSelect.innerHTML += `<option value="${mod}">${mod}</option>`);

    document.getElementById("filtro-categoria").addEventListener("change", applyAllFilters);
    document.getElementById("filtro-modelo").addEventListener("change", applyAllFilters);
    document.getElementById("filtro-serie").addEventListener("keyup", applyAllFilters);

    const btnExport = document.getElementById("btn-export-csv");
    if (btnExport) btnExport.addEventListener("click", exportInventoryToCSV);

    applyAllFilters();
  };

  const applyAllFilters = () => {
    const categoriaFiltro = document.getElementById("filtro-categoria").value;
    const modeloFiltro = document.getElementById("filtro-modelo").value;
    const serieFiltro = document.getElementById("filtro-serie").value.toLowerCase();

    paginationState.filteredList = fullEquipmentList.filter(eq =>
      (!categoriaFiltro || eq.categoria_nombre === categoriaFiltro) &&
      (!modeloFiltro || eq.modelo === modeloFiltro) &&
      (!serieFiltro || (eq.num_serie && eq.num_serie.toLowerCase().includes(serieFiltro)))
    );

    paginationState.currentPage = 1;
    renderEquipmentTable();
  };

  const renderEquipmentTable = () => {
    const table = document.getElementById("tabla-equipos");
    const { currentPage, rowsPerPage, filteredList } = paginationState;

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedItems = filteredList.slice(startIndex, endIndex);

    const header = `<thead><tr><th>N/S</th><th>Marca</th><th>Modelo</th><th>Categoría</th></tr></thead>`;
    const body = `<tbody>${
      paginatedItems.length > 0
        ? paginatedItems.map(eq => `
            <tr class="equipo-row" data-equipo-id="${eq.id_equipo}" style="cursor:pointer;">
              <td><strong>${eq.num_serie || '-'}</strong></td>
              <td>${eq.marca || '-'}</td>
              <td>${eq.modelo || '-'}</td>
              <td>${toSentenceCase(eq.categoria_nombre) || 'N/A'}</td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="text-center p-4 text-muted">No se encontraron equipos con los filtros aplicados.</td></tr>'
    }</tbody>`;

    table.innerHTML = header + body;

    document.querySelectorAll(".equipo-row").forEach(row => {
      row.addEventListener("click", () => {
        const equipoData = fullEquipmentList.find(eq => eq.id_equipo == row.dataset.equipoId) || {};
        document.getElementById("offcanvas-title").textContent = `Detalle: ${equipoData.num_serie || "Equipo"}`;
        document.getElementById("offcanvas-body").innerHTML = `
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between"><strong>Marca:</strong> <span>${equipoData.marca || "-"}</span></li>
            <li class="list-group-item d-flex justify-content-between"><strong>Modelo:</strong> <span>${equipoData.modelo || "-"}</span></li>
            <li class="list-group-item d-flex justify-content-between"><strong>Categoría:</strong> <span>${toSentenceCase(equipoData.categoria_nombre) || "-"}</span></li>
            <li class="list-group-item d-flex justify-content-between"><strong>N/S:</strong> <span>${equipoData.num_serie || "-"}</span></li>
            <li class="list-group-item d-flex justify-content-between"><strong>Part Number:</strong> <span>${equipoData.part_number || "-"}</span></li>
            <li class="list-group-item">
              <strong class="d-block mb-1">Características:</strong>
              <p class="mb-0 small text-muted">${equipoData.caracteristicas || "No especificadas."}</p>
            </li>
          </ul>`;
        bsOffcanvas.show();
      });
    });

    renderPaginationControls();
  };

  const renderPaginationControls = () => {
    const controlsContainer = document.getElementById("pagination-controls");
    const { currentPage, rowsPerPage, filteredList } = paginationState;
    const totalPages = Math.ceil(filteredList.length / rowsPerPage);

    if (totalPages <= 1) {
      controlsContainer.innerHTML = '';
      return;
    }

    let buttonsHtml = '';
    buttonsHtml += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage - 1}">Anterior</a></li>`;

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);

    if (startPage > 1) {
      buttonsHtml += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
      if (startPage > 2) buttonsHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      buttonsHtml += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) buttonsHtml += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
      buttonsHtml += `<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`;
    }

    buttonsHtml += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${currentPage + 1}">Siguiente</a></li>`;

    controlsContainer.innerHTML = `<ul class="pagination">${buttonsHtml}</ul>`;

    document.querySelectorAll('#pagination-controls a').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const page = parseInt(e.target.dataset.page);
        if (page && page !== paginationState.currentPage) {
          paginationState.currentPage = page;
          renderEquipmentTable();
          document.getElementById('tabla-equipos').scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  };

  // --- Redirección al contrato relacionado ---
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.link-relacion');
    if (link) {
      e.preventDefault();
      const relacionId = link.dataset.relacion;
      const relatedCard = document.querySelector(`.contract-card[data-contrato-id="${relacionId}"]`);
      if (relatedCard) {
        relatedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        relatedCard.click();
      } else {
        alert('El contrato relacionado no se encuentra en la lista.');
      }
    }
  });
});
