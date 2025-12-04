document.addEventListener("DOMContentLoaded", () => {
  // DOM
  const kpiContratos = document.getElementById("kpi-contratos");
  const kpiEquipos = document.getElementById("kpi-equipos");
  const kpiVisitas = document.getElementById("kpi-visitas");
  const chartModelosCanvas = document.getElementById("chart-modelos");
  const chartVisitasCanvas = document.getElementById("chart-visitas");
  const modelDetailsModal = new bootstrap.Modal(document.getElementById("model-details-modal"));
  const slug = window.location.pathname.split("/")[1];
  const kpiInventario = document.getElementById("kpi-inventario");

  const getCssVar = (variable) =>
    getComputedStyle(document.documentElement)
      .getPropertyValue(variable)
      .trim();

  // ===== Asistente IA =====

  const chatToggleButton = document.getElementById("chat-toggle-button");
  const chatWindow = document.getElementById("chat-window");
  const chatCloseButton = document.getElementById("chat-close-button");
  const chatBody = document.getElementById("chat-body");
  
  const chatInput = document.getElementById("chat-input");
  const quickActions = document.querySelector(".chat-quick-actions");

  // Chart instances (para poder acceder a ellas globalmente dentro de este scope)
  let chartModelos, chartVisitas;

  // =================================================================
  // --- LÓGICA DEL ASISTENTE VIRTUAL (CHATBOT) ---
  // =================================================================

  const API_ACTION_URL = `/${slug}/api/asistente/action`; // Para los botones
  const API_QUERY_URL = `/${slug}/api/asistente/query`; // Para el texto libre con IA

  const toggleChatWindow = () => {
    chatWindow.classList.toggle("d-none");
    if (!chatWindow.classList.contains("d-none")) {
      
    }
  };

  const addMessage = (text, sender, isHtml = false) => {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", sender);
    const contentElement = document.createElement("div");
    contentElement.classList.add("message-content");
    if (isHtml) {
      contentElement.innerHTML = text;
    } else {
      contentElement.textContent = text;
    }
    messageElement.appendChild(contentElement);
    chatBody.appendChild(messageElement);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const sendMessage = async (body, apiUrl) => {
    const thinkingMsg = document.createElement("div");
    thinkingMsg.className = "message bot";
    thinkingMsg.innerHTML = `<div class="message-content"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
    chatBody.appendChild(thinkingMsg);
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
      // Obtener el token CSRF de la meta tag
      const csrfMetaTag = document.querySelector('meta[name="csrf-token"]');
      const csrfToken = csrfMetaTag ? csrfMetaTag.getAttribute('content') : null;
      
      console.log('CSRF Meta Tag:', csrfMetaTag);
      console.log('CSRF Token:', csrfToken);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken || ""
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        if (result.isHtml) {
          thinkingMsg.querySelector(".message-content").innerHTML =
            result.message;
        } else {
          thinkingMsg.querySelector(".message-content").textContent =
            result.message;
        }
      } else {
        thinkingMsg.querySelector(".message-content").textContent =
          result.message || "Ocurrió un error.";
      }
    } catch (error) {
      console.error("Error al contactar al asistente:", error);
      thinkingMsg.querySelector(".message-content").textContent =
        "Hubo un error de conexión con el asistente. Inténtalo de nuevo.";
    }
  };

  // --- Event Listeners del Chatbot ---
  if (chatToggleButton)
    chatToggleButton.addEventListener("click", toggleChatWindow);
  if (chatCloseButton)
    chatCloseButton.addEventListener("click", toggleChatWindow);

  

  if (quickActions) {
    quickActions.addEventListener("click", (e) => {
      if (e.target.matches("button[data-intent]")) {
        const intent = e.target.dataset.intent;
        const userQuestion = e.target.textContent.trim();
        addMessage(userQuestion, "user");
        if (intent === "SEARCH_REPORT_BY_SERIAL") {
          Swal.fire({
            title: "Buscar Informe",
            input: "text",
            inputPlaceholder: "Ingresa el número de serie del equipo",
            showCancelButton: true,
            confirmButtonText: "Buscar",
            cancelButtonText: "Cancelar",
            customClass: {
              popup: "swal2-custom-popup",
              confirmButton: "btn btn-primary",
              cancelButton: "btn btn-outline-secondary",
            },
            buttonsStyling: false,
          }).then((result) => {
            if (result.isConfirmed && result.value) {
              sendMessage(
                { intent, payload: { serial: result.value } },
                API_ACTION_URL
              );
            }
          });
        } else {
          sendMessage({ intent }, API_ACTION_URL);
        }
      }
    });
  }

  //NOTIFICACIONES CLIENTE ALERTAS

  // ====== Alertas de Marketing (Cliente) ======
const ALERT_DISMISS_DAYS = 7;

const lsKeyForAlert = (id) => `mkt_alert_dismissed_${id}`;
const isDismissed = (id) => {
  const raw = localStorage.getItem(lsKeyForAlert(id));
  if (!raw) return false;
  try {
    const { until } = JSON.parse(raw);
    return until && Date.now() < until;
  } catch { return false; }
};
const dismissAlertForDays = (id, days = ALERT_DISMISS_DAYS) => {
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(lsKeyForAlert(id), JSON.stringify({ until }));
};

const severityToClass = (sev) =>
  ({ info: 'mkt-info', warning: 'mkt-warning', danger: 'mkt-danger' }[sev] || 'mkt-info');

const severityToIcon = (sev) =>
  ({ info: 'bi-info-circle', warning: 'bi-exclamation-triangle', danger: 'bi-shield-exclamation' }[sev] || 'bi-info-circle');

const renderMarketingAlerts = (alerts, slug) => {
    const host = document.getElementById('marketing-alerts');
    if (!host) return;

    // CAMBIO: Ya no filtramos por "isDismissed". Mostramos todas las alertas activas.
    const visibles = alerts;
    if (!visibles.length) {
        host.innerHTML = '';
        return;
    }

    const first = visibles.slice(0, 1); // Mostramos solo 1 por defecto
    const rest = visibles.slice(1);

    const card = (a) => {
        const cls = severityToClass(a.severity);
        const ico = severityToIcon(a.severity);
        const periodo = `${a.start_at ? new Date(a.start_at).toLocaleDateString() : 'Desde siempre'}${a.end_at ? (' • Hasta ' + new Date(a.end_at).toLocaleDateString()) : ''}`;
        
        // CAMBIO: Lógica para truncar el mensaje y añadir botón "Ver más"
        const messageIsLong = a.message.length > 120; // Umbral para truncar
        const shortMessage = messageIsLong ? a.message.substring(0, 120) + '...' : a.message;

        return `
        <div class="mkt-banner ${cls}" data-id="${a.id_alerta}">
            <div class="mkt-icon"><i class="bi ${ico}"></i></div>
            <div class="mkt-body">
                <div class="mkt-title">${a.title}</div>
                <div class="mkt-meta">Categoría: <code>${a.categoria_servicio}</code>${periodo ? ` • ${periodo}` : ''}</div>
                <div class="mkt-message-wrapper mt-1">
                    <div class="mkt-message-short">${shortMessage}</div>
                    ${messageIsLong ? `<div class="mkt-message-full d-none">${a.message}</div>` : ''}
                </div>
            </div>
            <div class="mkt-actions">
                ${a.cta_url ? `<a class="btn btn-sm btn-outline-primary" target="_blank" href="${a.cta_url}">${a.cta_label || 'Saber más'}</a>` : ''}
                ${messageIsLong ? `<button class="btn btn-link btn-sm mkt-toggle-details">Ver más</button>` : ''}
                </div>
        </div>`;
    };

    const moreBlock = rest.length ?
        `<div class="mkt-more">
            <button class="btn btn-sm btn-soft" data-mkt-more>
                Ver ${rest.length} alerta(s) más
            </button>
            <div class="marketing-stack d-none" data-mkt-more-list>
                ${rest.map(card).join('')}
            </div>
        </div>` :
        '';

    host.innerHTML = `
        <div class="marketing-stack">
            ${first.map(card).join('')}
        </div>
        ${moreBlock}
    `;
  host.querySelectorAll('.mkt-toggle-details').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.mkt-banner');
            const short = wrapper.querySelector('.mkt-message-short');
            const full = wrapper.querySelector('.mkt-message-full');
            
            short.classList.toggle('d-none');
            full.classList.toggle('d-none');
            btn.textContent = full.classList.contains('d-none') ? 'Ver más' : 'Ver menos';
        });
    });

    // Evento: ver más (para el resto de alertas)
    const btnMore = host.querySelector('[data-mkt-more]');
    const listMore = host.querySelector('[data-mkt-more-list]');
    if (btnMore && listMore) {
        btnMore.addEventListener('click', () => {
            listMore.classList.toggle('d-none');
            btnMore.innerHTML = listMore.classList.contains('d-none') ?
                `Ver ${rest.length} alerta(s) más` :
                'Ocultar';
        });
    }
};








const loadMarketingAlerts = async (slug) => {
  try {
    const res = await fetch(`/${slug}/api/marketing-alerts`);
    const j = await res.json();
    if (j.success) renderMarketingAlerts(j.data || [], slug);
  } catch (e) {
    // silencioso: si falla, no molesta la UI
    console.warn('marketing alerts fetch failed', e);
  }
};


  // ===== Utilidades UI =====
  const countUp = (el, to, ms = 900) => {
    const start = 0;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const value = Math.floor(start + (to - start) * p);
      el.textContent = value.toLocaleString("es-PE");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const shorten = (str, max = 16) =>
    str && str.length > max ? str.slice(0, max - 1) + "…" : str || "";

  // Mapea estado -> color de badge
  const badgeClassForEstado = (estado = "") => {
    const s = (estado || "").toLowerCase();
    if (/disponible|libre/.test(s)) return "success";
    if (/manten|taller|soporte/.test(s)) return "warning";
    if (/baja|dañ|roto|robado|perdido/.test(s)) return "danger";
    if (/asignado|activo/.test(s)) return "primary";
    return "secondary";
  };

  const downloadTextFile = (
    filename,
    text,
    mime = "text/csv;charset=utf-8;"
  ) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Estilos por defecto de gráficos =====
  const chartDefaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 6 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0F172A",
        padding: 10,
        titleFont: { weight: "700" },
        bodyFont: { weight: "500" },
        callbacks: {
          title: (items) => items[0].labelFull || items[0].label,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "#E6E8EB" },
        ticks: { color: "#64748B", precision: 0 },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: "#64748B",
          maxRotation: 0,
          minRotation: 0,
          callback: function (value) {
            const label = this.getLabelForValue(value);
            return shorten(label, 14);
          },
        },
      },
    },
  };

  // ===== Render: Modelos =====
  // En Inicio.js, reemplaza esta función completa:

 // ===== Render: Modelos (Pareto Mejorado) =====
// ===== Render: Modelos (Pareto mejorado y armonizado con colores del dashboard) =====
const renderChartModelos = (data) => {
  if (chartModelos) chartModelos.destroy();

  // --- ORDENAR Y CALCULAR PARETO ---
  const sorted = data.sort((a, b) => b.cantidad - a.cantidad);
  const total = sorted.reduce((s, x) => s + x.cantidad, 0);
  let acumulado = 0;
  const pareto = sorted.map((x) => (acumulado += (x.cantidad / total) * 100));
  const labels = sorted.map((x) => x.modelo);
  const values = sorted.map((x) => x.cantidad);

  const ctx = chartModelosCanvas.getContext("2d");

  // --- GRADIENTE AZUL SUAVE PARA LAS BARRAS ---
  const grad = ctx.createLinearGradient(0, 0, 0, chartModelosCanvas.height);
  grad.addColorStop(0, "rgba(13, 110, 253, 0.85)"); // Azul superior (fuerte)
  grad.addColorStop(1, "rgba(13, 110, 253, 0.15)"); // Azul inferior (transparente)

  // --- CONFIGURACIÓN DEL GRÁFICO ---
  chartModelos = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Cantidad",
          data: values,
          backgroundColor: grad,
          borderColor: "rgba(13,110,253,0.9)",
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Porcentaje Acumulado",
          data: pareto,
          borderColor: "#6f42c1", // Morado (armoniza con gráfico de Categorías)
          borderWidth: 2.8,
          tension: 0.35,
          fill: false,
          pointBackgroundColor: "#6f42c1",
          pointBorderColor: "#fff",
          pointRadius: 5,
          pointHoverRadius: 7,
          yAxisID: "yPercentage",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      layout: { padding: 6 },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#334155",
            boxWidth: 14,
            usePointStyle: true,
            pointStyle: "rectRounded",
          },
        },
        tooltip: {
          backgroundColor: "#1e293b",
          padding: 12,
          cornerRadius: 8,
          titleFont: { weight: "700" },
          bodyFont: { weight: "500" },
          displayColors: false,
          callbacks: {
            label: (ctx) =>
              ctx.dataset.type === "line"
                ? ` ${ctx.parsed.y.toFixed(1)}% acumulado`
                : ` ${ctx.parsed.y.toLocaleString("es-PE")} equipos`,
          },
        },
        datalabels: {
          color: "#334155",
          anchor: "end",
          align: "top",
          font: { weight: "600" },
          formatter: (val, ctx) =>
            ctx.dataset.type === "bar" ? `${val}` : null,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#64748B",
            maxRotation: 25,
            callback: (v) => {
              const label = labels[v];
              return label?.length > 16 ? label.slice(0, 16) + "…" : label;
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#E6E8EB" },
          ticks: { color: "#64748B", precision: 0 },
          title: {
            display: true,
            text: "Cantidad de Equipos",
            color: "#475569",
            font: { weight: "600" },
          },
        },
        yPercentage: {
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#6f42c1",
            callback: (v) => v + "%",
          },
          title: {
            display: true,
            text: "Porcentaje Acumulado",
            color: "#6f42c1",
            font: { weight: "600" },
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  });

  // --- CLIC EN BARRAS PARA DETALLE ---
  chartModelosCanvas.onclick = (e) => {
    const points = chartModelos.getElementsAtEventForMode(
      e,
      "nearest",
      { intersect: true },
      true
    );
    if (!points.length) return;
    const p = points[0];
    if (chartModelos.data.datasets[p.datasetIndex].type !== "bar") return;
    const modelo = labels[p.index];
    const cantidad = values[p.index];
    showModelDetails(modelo, cantidad);
  };

  // --- EXPORTAR PNG ---
  document.getElementById("btn-export-modelos").onclick = () => {
    const a = document.createElement("a");
    a.href = chartModelos.toBase64Image();
    a.download = "distribucion_modelos_pareto.png";
    a.click();
  };
};




  // ===== Render: Visitas por Mes =====
  // ===== Render: Visitas Técnicas (Estilo moderno y dinámico) =====
const renderChartVisitas = (data) => {
  if (chartVisitas) chartVisitas.destroy();

  const ctx = chartVisitasCanvas.getContext("2d");

  // --- Si solo hay una fila (ejemplo: hoy) ---
  if (data.length === 1) {
    const unico = data[0];
    const fecha = new Date(unico.mes + "-02").toLocaleDateString("es-ES", {
      month: "short",
      year: "numeric",
    });
    chartVisitas = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [fecha],
        datasets: [
          {
            label: "Visitas Técnicas",
            data: [unico.cantidad],
            backgroundColor: "rgba(13,110,253,0.8)",
            borderRadius: 8,
            barThickness: 60,
          },
        ],
      },
      options: {
        ...chartDefaultOptions,
        plugins: {
          ...chartDefaultOptions.plugins,
          tooltip: {
            ...chartDefaultOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} visitas`,
            },
          },
        },
        scales: {
          ...chartDefaultOptions.scales,
          x: {
            ...chartDefaultOptions.scales.x,
            ticks: { color: "#334155" },
          },
        },
      },
    });
    return;
  }

  // --- Si hay más de un punto, se renderiza área curva ---
  const labels = data.map((item) =>
    new Date(item.mes + "-02").toLocaleString("es-ES", {
      month: "short",
      year: "2-digit",
    })
  );
  const values = data.map((item) => item.cantidad);

  const grad = ctx.createLinearGradient(0, 0, 0, chartVisitasCanvas.height);
  grad.addColorStop(0, "rgba(13,110,253,0.4)");
  grad.addColorStop(1, "rgba(0,166,147,0.05)");

  // --- Calcular promedio móvil (tendencia) ---
  const promedio = values.map((_, i) => {
    if (i === 0) return values[0];
    const prev = values[i - 1];
    return (prev + values[i]) / 2;
  });

  chartVisitas = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Visitas Técnicas",
          data: values,
          fill: true,
          backgroundColor: grad,
          borderColor: "#0d6efd",
          borderWidth: 2.5,
          tension: 0.4,
          pointBackgroundColor: "#0d6efd",
          pointBorderColor: "#fff",
          pointRadius: 5,
          pointHoverRadius: 7,
        },
        {
          label: "Promedio móvil",
          data: promedio,
          borderColor: "#00a693",
          borderDash: [6, 4],
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      layout: { padding: 6 },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#E6E8EB" },
          ticks: { color: "#64748B" },
          title: {
            display: true,
            text: "Cantidad de Visitas",
            color: "#475569",
            font: { weight: "600" },
          },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#334155" },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#334155",
            boxWidth: 14,
            usePointStyle: true,
            pointStyle: "line",
          },
        },
        tooltip: {
          backgroundColor: "#0F172A",
          padding: 10,
          titleFont: { weight: "700" },
          bodyFont: { weight: "500" },
          displayColors: false,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} visitas`,
          },
        },
      },
    },
  });

  // Exportar PNG
  document.getElementById("btn-export-visitas").onclick = () => {
    const a = document.createElement("a");
    a.href = chartVisitas.toBase64Image();
    a.download = "resumen-visitas.png";
    a.click();
  };
};


  // ===== Render: Equipos por Categoría =====
 const renderChartCategorias = (data) => {
        const canvas = document.getElementById("chart-categorias");
        const ctx = canvas.getContext("2d");

        const sorted = data.sort((a, b) => b.cantidad - a.cantidad);
        const labels = sorted.map((x) => x.categoria);
        const values = sorted.map((x) => x.cantidad);
        const total = values.reduce((a, b) => a + b, 0);
        const percentages = values.map((v) => ((v / total) * 100).toFixed(1));
        const colors = ["#0d6efd", "#6f42c1", "#198754", "#ffc107", "#dc3545", "#0dcaf0", "#6c757d", "#fd7e14"];

        if (window.chartCategorias) window.chartCategorias.destroy();

        window.chartCategorias = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Equipos (%)",
                    data: percentages,
                    backgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false,
                    barThickness: 26,
                }],
            },
            options: {
                indexAxis: "y", // <--- ¡LA CLAVE PARA RESTAURAR EL DISEÑO HORIZONTAL!
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: "#f0f2f5" },
                        ticks: { color: "#64748B", callback: (v) => v + "%" },
                        title: { display: true, text: "Porcentaje del total", color: "#475569", font: { weight: "600" } },
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: "#1e293b", font: { weight: "600" } },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#0F172A",
                        titleFont: { weight: "700" },
                        bodyFont: { weight: "500" },
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${values[ctx.dataIndex]} equipos (${percentages[ctx.dataIndex]}%)`,
                        },
                    },
                    datalabels: {
                        anchor: "end",
                        align: "right",
                        color: "#334155",
                        formatter: (val) => `${val}%`,
                    },
                },
            },
            plugins: [ChartDataLabels],
        });

        // --- CLIC EN BARRAS PARA VER DETALLE DE CATEGORÍA ---
        canvas.onclick = (e) => {
            const points = window.chartCategorias.getElementsAtEventForMode(e, "nearest", { intersect: true }, true);
            if (!points.length) return;
            const p = points[0];
            const categoria = labels[p.index];
            const cantidad = values[p.index];
            showCategoryDetails(categoria, cantidad);
        };
        
        document.getElementById("btn-export-categorias").onclick = () => { /* ... tu lógica de exportación ... */ };
    };

  // ===== Modal mejorado =====
  const showModelDetails = async (modelo, cantidad) => {
    const modalTitle = document.getElementById("model-details-title");
    const modalSubTitle = document.getElementById("model-details-subtitle");
    const modalBody = document.getElementById("model-details-body");
    const inputSearch = document.getElementById("model-details-search");
    const btnCopy = document.getElementById("btn-copy-visible");
    const btnCsv = document.getElementById("btn-exportar-csv");

    modalTitle.textContent = `Detalle de Equipos: ${modelo} (${cantidad} ${cantidad === 1 ? "unidad" : "unidades"
      })`;
    modalSubTitle.textContent = "Haz clic en un N/S para copiarlo.";

    modalBody.innerHTML =
      '<div class="text-center p-5"><div class="spinner-border" role="status"></div></div>';
    modelDetailsModal.show();

    try {
      const response = await fetch(
        `/${slug}/api/equipos-por-modelo?modelo=${encodeURIComponent(modelo)}`
      );
      const result = await response.json();

      if (!(result.success && result.data.length)) {
        modalBody.innerHTML = `<div class="empty"><i class="bi bi-inbox"></i><div>${result.message || "No se encontraron detalles."
          }</div></div>`;
        inputSearch.value = "";
        btnCopy.onclick = btnCsv.onclick = null;
        return;
      }

      // Dataset local
      const rows = result.data.map((x) => ({
        ns: x.num_serie || "-",
        estado: x.estado || "-",
        carac: x.caracteristicas || "-",
      }));

      const buildTable = (arr) => `
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th style="width:28%">N/S</th>
              <th style="width:16%">Estado</th>
              <th>Características</th>
            </tr>
          </thead>
          <tbody>
            ${arr
          .map(
            (r) => `
              <tr>
                <td class="serial">
                  <span class="copy-pill" data-copy="${r.ns
              }" title="Copiar N/S">${r.ns}</span>
                </td>
                <td>
                  <span class="badge text-bg-${badgeClassForEstado(
                r.estado
              )}">${r.estado}</span>
                </td>
                <td>${r.carac}</td>
              </tr>`
          )
          .join("")}
          </tbody>
        </table>`;

      // Render inicial
      modalBody.innerHTML = buildTable(rows);

      // Delegación para copiar N/S
      modalBody.addEventListener(
        "click",
        async (ev) => {
          const el = ev.target.closest("[data-copy]");
          if (!el) return;
          try {
            await navigator.clipboard.writeText(el.dataset.copy);
            el.innerHTML = `<i class="bi bi-check2 me-1"></i>${el.dataset.copy}`;
            setTimeout(() => (el.textContent = el.dataset.copy), 900);
          } catch {
            /* noop */
          }
        },
        { once: false }
      );

      // Búsqueda rápida
      inputSearch.value = "";
      inputSearch.oninput = () => {
        const q = inputSearch.value.trim().toLowerCase();
        const filtered = !q
          ? rows
          : rows.filter(
            (r) =>
              r.ns.toLowerCase().includes(q) ||
              r.estado.toLowerCase().includes(q) ||
              r.carac.toLowerCase().includes(q)
          );
        modalBody.innerHTML = filtered.length
          ? buildTable(filtered)
          : `<div class="empty"><i class="bi bi-search"></i><div>Sin coincidencias.</div></div>`;
      };

      // Copiar visibles
      btnCopy.onclick = async () => {
        const visibles = [...modalBody.querySelectorAll("[data-copy]")].map(
          (el) => el.dataset.copy
        );
        if (!visibles.length) return;
        await navigator.clipboard.writeText(visibles.join("\n"));
        btnCopy.innerHTML = '<i class="bi bi-clipboard-check me-1"></i>Copiado';
        setTimeout(
          () =>
          (btnCopy.innerHTML =
            '<i class="bi bi-clipboard me-1"></i>Copiar N/S visibles'),
          1000
        );
      };

      // Exportar CSV (todo el dataset)
      btnCsv.onclick = () => {
        const header = "NS,Estado,Caracteristicas\n";
        const lines = rows
          .map(
            (r) =>
              `"${(r.ns || "").replace(/"/g, '""')}","${(
                r.estado || ""
              ).replace(/"/g, '""')}","${(r.carac || "").replace(/"/g, '""')}"`
          )
          .join("\n");
        downloadTextFile(
          `equipos_${modelo.replace(/\s+/g, "_")}.csv`,
          header + lines
        );
      };
    } catch (error) {
      modalBody.innerHTML =
        '<div class="alert alert-danger">Error de conexión.</div>';
    }
  };

  // =================================================================
  // --- NUEVA FUNCIÓN AUXILIAR PARA ACTUALIZAR KPIs ---
  // =================================================================
  /**
   * Actualiza una tarjeta KPI completa (valor y tendencia).
   * @param {HTMLElement} kpiValueElement - El elemento que muestra el número principal (ej. kpiContratosEl).
   * @param {object} kpiData - El objeto de datos para este KPI desde la API.
   */
  const updateKpiCard = (kpiValueElement, kpiData) => {
    // Si no hay elemento o datos, no hacemos nada.
    if (!kpiValueElement || !kpiData) {
      console.warn("Elemento KPI o datos no encontrados.");
      return;
    }

    // 1. Animar el valor principal del KPI.
    countUp(kpiValueElement, kpiData.valor || 0);

    // 2. Encontrar el elemento de la tendencia, que es hermano del elemento del valor.
    const trendElement =
      kpiValueElement.parentElement.querySelector(".kpi-trend");
    if (!trendElement) return; // Salir si no hay elemento de tendencia.

    // 3. Preparar el HTML para la tendencia.
    const { tendenciaClase, tendenciaIcono, tendenciaTexto } = kpiData;
    let trendHTML = "";

    if (tendenciaIcono) {
      trendHTML += `<i class="bi ${tendenciaIcono}"></i> `;
    }
    trendHTML += tendenciaTexto || "Estable"; // Muestra 'Estable' si no hay texto.

    // 4. Actualizar la clase (para el color) y el contenido del HTML.
    trendElement.className = `kpi-trend ${tendenciaClase || "text-secondary"}`;
    trendElement.innerHTML = trendHTML;
  };

  // ===== Carga Principal =====
  // --- FUNCIÓN DE CARGA PRINCIPAL (CORREGIDA PARA USAR TUS NOMBRES DE VARIABLES) ---

  const loadDashboard = async () => {
    try {
      const res = await fetch(`/${slug}/api/dashboard-summary`);
      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }
      const { success, data } = await res.json();

      if (!success) {
        console.error("La API indicó un error:", data.message);
        return;
      }

      // --- Actualizar KPIs usando la nueva función ---
      // ¡AHORA USA TUS NOMBRES DE VARIABLE ORIGINALES: kpiContratos, kpiEquipos, kpiVisitas!
     updateKpiCard(kpiContratos, data.kpiContratos);
updateKpiCard(kpiInventario, data.kpiInventario); // Nuevo KPI
updateKpiCard(kpiEquipos, data.kpiEquipos);
updateKpiCard(kpiVisitas, data.kpiVisitas);


      // --- Renderizar Gráficos (sin cambios en la lógica) ---
      // Modelos
      if (data.resumenModelos && data.resumenModelos.length) {
        renderChartModelos(data.resumenModelos);
      } else {
        const chartBody = chartModelosCanvas.closest(".card-body");
        if (chartBody)
          chartBody.innerHTML = `<div class="empty h-100"><i class="bi bi-laptop"></i><div>No hay equipos registrados.</div></div>`;
      }

      // Visitas
      if (data.visitasPorMes && data.visitasPorMes.length) {
        renderChartVisitas(data.visitasPorMes);
      } else {
        const chartBody = chartVisitasCanvas.closest(".card-body");
        if (chartBody)
          chartBody.innerHTML = `<div class="empty h-100"><i class="bi bi-wrench-adjustable"></i><div>No hay visitas técnicas registradas.</div></div>`;
      }
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
      // Opcional: Mostrar un mensaje de error en la UI.
    }


    // --- Gráfico de Categorías ---
try {
  const resCat = await fetch(`/${slug}/api/equipos-por-categoria`);
  const resultCat = await resCat.json();
  if (resultCat.success && resultCat.data.length) {
    renderChartCategorias(resultCat.data);
  } else {
    const chartBody = document.getElementById("chart-categorias").closest(".card-body");
    chartBody.innerHTML = `<div class="empty h-100"><i class="bi bi-laptop"></i><div>No hay datos de categorías disponibles.</div></div>`;
  }
} catch (error) {
  console.error("Error al cargar categorías:", error);
}


  };

// =======================
// ALERTAS / NOTIFICACIONES (CLIENTE) - BLOQUE ÚNICO
// Encapsulado para evitar duplicados / fugas de nombres
// =======================
(() => {
  // Si ya había una versión previa, la desmontamos
  if (window.ClientNotify?.teardown) {
    try { window.ClientNotify.teardown(); } catch {}
  }

  window.ClientNotify = (() => {
    // ---------- Helpers internos (no globales) ----------
    const severityToClass = (sev) =>
      ({ info: 'mkt-info', warning: 'mkt-warning', danger: 'mkt-danger' }[sev] || 'mkt-info');

    const severityToIcon = (sev) =>
      ({ info: 'bi-info-circle', warning: 'bi-exclamation-triangle', danger: 'bi-shield-exclamation' }[sev] || 'bi-info-circle');

    // ---------- Marketing banners (top) ----------
    const renderMarketingAlerts = (alerts) => {
      const host = document.getElementById('marketing-alerts');
      if (!host) return;

      const visibles = alerts || [];
      if (!visibles.length) {
        host.innerHTML = '';
        return;
      }

      const first = visibles.slice(0, 1);
      const rest  = visibles.slice(1);

      const card = (a) => {
        const cls = severityToClass(a.severity);
        const ico = severityToIcon(a.severity);
        const periodo =
          `${a.start_at ? new Date(a.start_at).toLocaleDateString('es-PE') : 'Desde siempre'
          }${a.end_at ? (' • Hasta ' + new Date(a.end_at).toLocaleDateString('es-PE')) : ''}`;

        const messageIsLong = (a.message || '').length > 120;
        const shortMessage  = messageIsLong ? a.message.substring(0, 120) + '…' : a.message;

        return `
          <div class="mkt-banner ${cls}" data-id="${a.id_alerta}">
            <div class="mkt-icon"><i class="bi ${ico}"></i></div>
            <div class="mkt-body">
              <div class="mkt-title">${a.title}</div>
              <div class="mkt-meta">
                Categoría: <code>${a.categoria_servicio}</code>${periodo ? ` • ${periodo}` : ''}
              </div>
              <div class="mkt-message-wrapper mt-1">
                <div class="mkt-message-short">${shortMessage}</div>
                ${messageIsLong ? `<div class="mkt-message-full d-none">${a.message}</div>` : ''}
              </div>
            </div>
            <div class="mkt-actions">
              ${a.cta_url ? `<a class="btn btn-sm btn-outline-primary" target="_blank" href="${a.cta_url}">
                ${a.cta_label || 'Saber más'}
              </a>` : ''}
              ${messageIsLong ? `<button class="btn btn-link btn-sm mkt-toggle-details">Ver más</button>` : ''}
            </div>
          </div>`;
      };

      const moreBlock = rest.length
        ? `<div class="mkt-more">
             <button class="btn btn-sm btn-soft" data-mkt-more>Ver ${rest.length} alerta(s) más</button>
             <div class="marketing-stack d-none" data-mkt-more-list>
               ${rest.map(card).join('')}
             </div>
           </div>`
        : '';

      host.innerHTML = `
        <div class="marketing-stack">${first.map(card).join('')}</div>
        ${moreBlock}
      `;

      // “Ver más / Ver menos” dentro del banner
      host.querySelectorAll('.mkt-toggle-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const wrapper = btn.closest('.mkt-banner');
          const short = wrapper.querySelector('.mkt-message-short');
          const full  = wrapper.querySelector('.mkt-message-full');
          short.classList.toggle('d-none');
          full.classList.toggle('d-none');
          btn.textContent = full.classList.contains('d-none') ? 'Ver más' : 'Ver menos';
        });
      });

      // Desplegar listado extra
      const btnMore  = host.querySelector('[data-mkt-more]');
      const listMore = host.querySelector('[data-mkt-more-list]');
      if (btnMore && listMore) {
        btnMore.addEventListener('click', () => {
          listMore.classList.toggle('d-none');
          btnMore.textContent = listMore.classList.contains('d-none')
            ? `Ver ${rest.length} alerta(s) más`
            : 'Ocultar';
        });
      }
    };

    const loadMarketingAlerts = async (slug) => {
      try {
        const res = await fetch(`/${slug}/api/marketing-alerts`);
        const j   = await res.json();
        if (j.success) renderMarketingAlerts(j.data || []);
      } catch (e) {
        console.warn('marketing alerts fetch failed', e);
      }
    };

    // ---------- Centro de notificaciones (panel) ----------
    const renderNotifItem = (a) => {
      const desde = a.start_at ? new Date(a.start_at).toLocaleDateString('es-PE') : '';
      const sev   = ({ info: 'primary', warning: 'warning', danger: 'danger' }[a.severity] || 'primary');
      const cta   = (a.cta_label && a.cta_url)
        ? `<a target="_blank" href="${a.cta_url}" class="btn btn-sm btn-outline-${sev}">${a.cta_label}</a>`
        : '';

      const messageIsLong = (a.message || '').length > 80;
      const shortMessage  = messageIsLong ? a.message.substring(0, 80) + '…' : a.message;

      return `
        <div class="notif-item" data-id="${a.id_alerta}">
          <div class="notif-header-item">
            <div class="notif-title">
              <span class="notif-icon"><i class="bi bi-shield-exclamation"></i></span>
              ${a.title}
            </div>
          </div>
          <div class="notif-meta">
            Categoría: <code>${a.categoria_servicio}</code> ${desde ? `• ${desde}` : ''}
          </div>
          <div class="notif-message-wrapper mt-1">
            <div class="notif-message-short">${shortMessage}</div>
            ${messageIsLong ? `<div class="notif-message-full d-none">${a.message}</div>` : ''}
          </div>
          <div class="notif-footer-item">
            ${cta}
            ${messageIsLong ? `<button class="btn btn-link btn-sm notif-toggle-details">Ver más</button>` : ''}
          </div>
        </div>`;
    };

    const loadClientAlerts = async (slug) => {
      const notifList  = document.getElementById('notif-list');
      const notifCount = document.getElementById('notif-count');
      if (!notifList || !notifCount) return;

      notifList.innerHTML = `<div class="text-center text-muted small p-3">Cargando…</div>`;
      try {
        const r = await fetch(`/${slug}/api/alerts`);
        const j = await r.json();
        if (!j.success) throw 0;

        const visibles = j.data || [];

        // Badge contador
        if (visibles.length) {
          notifCount.textContent = visibles.length;
          notifCount.classList.remove('d-none');
        } else {
          notifCount.classList.add('d-none');
        }

        // Render listado
        notifList.innerHTML = visibles.length
          ? visibles.map(renderNotifItem).join('')
          : `<div class="text-center text-muted small p-3">Sin notificaciones pendientes.</div>`;

        // “Ver más / Ver menos” por item
        notifList.querySelectorAll('.notif-toggle-details').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const wrapper = btn.closest('.notif-item');
            const short = wrapper.querySelector('.notif-message-short');
            const full  = wrapper.querySelector('.notif-message-full');
            short.classList.toggle('d-none');
            full.classList.toggle('d-none');
            btn.textContent = full.classList.contains('d-none') ? 'Ver más' : 'Ver menos';
          });
        });
      } catch {
        notifList.innerHTML = `<div class="text-danger small p-3">Error cargando notificaciones.</div>`;
      }
    };

    // ---------- Listeners del panel (se reenganchan en cada init) ----------
    let listenersBound = false;
    const bindPanelListeners = () => {
      if (listenersBound) return;
      const notifBtn   = document.getElementById('notif-toggle');
      const notifPanel = document.getElementById('notif-panel');
      const notifClose = document.getElementById('notif-close');

      notifBtn?.addEventListener('click', () => notifPanel?.classList.toggle('d-none'));
      notifClose?.addEventListener('click', () => notifPanel?.classList.add('d-none'));

      listenersBound = true;
    };

    // ---------- API pública ----------
    const init = (slug) => {
      bindPanelListeners();
      loadMarketingAlerts(slug);
      loadClientAlerts(slug);
    };

    const teardown = () => {
      // No-op: dejamos que el GC limpie listeners en recarga.
      // Si necesitas quitar listeners manualmente, podríamos guardar referencias y removerlas aquí.
    };

    return { init, teardown };
  })();

  // Lanza la carga con tu slug ya declarado arriba en el archivo
  window.ClientNotify.init(slug);
})();


// --- MODAL DE DETALLE POR CATEGORÍA ---
    const showCategoryDetails = async (categoria, cantidad) => {
        const modalTitle = document.getElementById("model-details-title");
        const modalSubTitle = document.getElementById("model-details-subtitle");
        const modalBody = document.getElementById("model-details-body");
        const inputSearch = document.getElementById("model-details-search");
        const btnCopy = document.getElementById("btn-copy-visible");
        const btnCsv = document.getElementById("btn-exportar-csv");

        modalTitle.textContent = `Detalle: ${categoria} (${cantidad} unidades)`;
        modalSubTitle.textContent = "Equipos pertenecientes a esta categoría.";
        modalBody.innerHTML = '<div class="text-center p-5"><div class="spinner-border" role="status"></div></div>';
        modelDetailsModal.show();

        try {
            const response = await fetch(`/${slug}/api/equipos-por-categoria-detalle?categoria=${encodeURIComponent(categoria)}`);
            const result = await response.json();

            if (!result.success || !result.data.length) {
                modalBody.innerHTML = `<div class="empty"><i class="bi bi-inbox"></i><div>${result.message || "No se encontraron detalles."}</div></div>`;
                return;
            }

            const rows = result.data.map(x => ({
                modelo: x.modelo || "-",
                ns: x.num_serie || "-",
                estado: x.estado || "-",
                carac: x.caracteristicas || "-",
            }));

            const buildTable = (arr) => `
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th style="width:30%">Modelo</th>
                            <th style="width:25%">N/S</th>
                            <th style="width:15%">Estado</th>
                            <th>Características</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${arr.map(r => `
                            <tr>
                                <td>${r.modelo}</td>
                                <td class="serial"><span class="copy-pill" data-copy="${r.ns}" title="Copiar N/S">${r.ns}</span></td>
                                <td><span class="badge text-bg-${badgeClassForEstado(r.estado)}">${r.estado}</span></td>
                                <td>${r.carac}</td>
                            </tr>`).join("")}
                    </tbody>
                </table>`;

            modalBody.innerHTML = buildTable(rows);

            inputSearch.value = "";
            inputSearch.oninput = () => {
                const q = inputSearch.value.trim().toLowerCase();
                const filtered = !q ? rows : rows.filter(r =>
                    r.modelo.toLowerCase().includes(q) ||
                    r.ns.toLowerCase().includes(q) ||
                    r.estado.toLowerCase().includes(q) ||
                    r.carac.toLowerCase().includes(q)
                );
                modalBody.innerHTML = filtered.length ? buildTable(filtered) : `<div class="empty"><i class="bi bi-search"></i><div>Sin coincidencias.</div></div>`;
            };

            btnCsv.onclick = () => {
                const header = "Modelo,N/S,Estado,Caracteristicas\n";
                const lines = rows.map(r => `"${(r.modelo || "").replace(/"/g, '""')}","${(r.ns || "").replace(/"/g, '""')}","${(r.estado || "").replace(/"/g, '""')}","${(r.carac || "").replace(/"/g, '""')}"`).join("\n");
                downloadTextFile(`equipos_${categoria.replace(/\s+/g, "_")}.csv`, header + lines);
            };
            
            btnCopy.onclick = async () => {
                const visibles = [...modalBody.querySelectorAll("[data-copy]")].map(el => el.dataset.copy);
                if (!visibles.length) return;
                await navigator.clipboard.writeText(visibles.join("\n"));
                btnCopy.innerHTML = '<i class="bi bi-clipboard-check me-1"></i>Copiado';
                setTimeout(() => btnCopy.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copiar N/S visibles', 1000);
            };

        } catch (error) {
            modalBody.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>';
        }
    };

loadDashboard();

});
