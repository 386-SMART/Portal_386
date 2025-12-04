document.addEventListener("DOMContentLoaded", () => {
  // ... (Variables y Selectores iguales al anterior) ...
  const els = {
    list: document.getElementById("contracts-list"),
    search: document.getElementById("search-input"),
    count: document.getElementById("count-contracts"),
    btnVal: document.getElementById("btn-view-valorizar"),
    btnAna: document.getElementById("btn-view-analisis"),
    viewVal: document.getElementById("view-valorizacion"),
    viewAna: document.getElementById("view-analisis"),
    tabs: document.querySelectorAll("#mode-tabs .nav-link"),
    placeholder: document.getElementById("placeholder-section"),
    details: document.getElementById("details-section"),
    title: document.getElementById("contract-title"),
    client: document.getElementById("contract-client"),
    currencyBadge: document.getElementById("contract-currency"),
    totalDisplay: document.getElementById("contract-total-display"),
    equiposContainer: document.getElementById("equipos-container"),
    serviciosNombres: document.getElementById("servicios-nombres"),
    inputServ: document.getElementById("valor_total_servicios"),
    symbolServ: document.getElementById("currency-symbol-serv"),
    saveBar: document.getElementById("save-bar"),
    btnSave: document.getElementById("btn-save"),
    btnCancel: document.getElementById("btn-cancel"),
    kpiTotal: document.getElementById("kpi-total"),
    kpiProm: document.getElementById("kpi-promedio"),
    kpiCli: document.getElementById("kpi-clientes"),
    kpiTop: document.getElementById("kpi-top"),
    chartTop: document.getElementById("chart-top-contratos"),
    chartPie: document.getElementById("chart-serv-eqp"),
    fxBase: document.getElementById("currency-base"),
  };

  let contracts = [];
  let selectedId = null;
  let hasChanges = false;
  let charts = {};
  let rates = { USD: 1, PEN: 3.75, EUR: 1.08 };
  let baseCurr = "USD";

  function getCsrfToken() {
      return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  }

  function money(val, curr) {
    const sym = { USD: "$", PEN: "S/", EUR: "€" }[curr] || "";
    return `${sym} ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function shorten(str, max = 24) {
      return (str?.length > max ? str.slice(0, max - 1) + "…" : str || "—");
  }

  function toggleSaveBar(show) {
    if(!els.saveBar) return;
    if(show) els.saveBar.classList.add('visible');
    else els.saveBar.classList.remove('visible');
  }

  async function init() {
    if(window.Busy) window.Busy.show();
    await loadContracts();
    setupEvents();
    if(window.Busy) window.Busy.hide();
  }

  async function loadContracts() {
    try {
      const res = await fetch("/admin/api/valorizacion/contratos");
      const json = await res.json();
      if (json.success) {
        contracts = json.data || [];
        renderList(contracts);
        if(els.viewAna && !els.viewAna.classList.contains('d-none')) {
            updateAnalytics();
        }
      }
    } catch (e) { console.error("Error loadContracts:", e); }
  }

  function renderList(data) {
    if(!els.list) return;
    if(els.count) els.count.textContent = data.length;
    
    els.list.innerHTML = data.map(c => {
        const total = (parseFloat(c.valor_total_equipos)||0) + (parseFloat(c.valor_total_servicios)||0);
        const activeClass = c.id_contrato == selectedId ? 'active' : '';
        return `
            <div class="contract-item ${activeClass}" onclick="loadDetails('${c.id_contrato}')">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="c-name text-truncate" style="max-width: 180px;">${c.nombre_contrato}</span>
                    <span class="c-price">${money(total, c.moneda)}</span>
                </div>
                <div class="c-company"><i class="bi bi-building"></i> ${c.empresa_nombre}</div>
            </div>`;
    }).join('');
  }

  // === CAMBIO CLAVE: SweetAlert en lugar de confirm() nativo ===
  window.loadDetails = async function(id) {
    if(hasChanges) {
        const result = await Swal.fire({
            title: 'Cambios sin guardar',
            text: "Si cambias de contrato, perderás los datos ingresados.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, descartar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!result.isConfirmed) return; // Si cancela, no cambia de contrato
    }
    
    selectedId = id;
    hasChanges = false;
    toggleSaveBar(false);
    renderList(contracts); 
    
    if(window.Busy) window.Busy.show();
    try {
        const res = await fetch(`/admin/api/valorizacion/contratos/${id}`);
        const json = await res.json();
        if(json.success) {
            renderWorkspace(json.data);
        }
    } catch(e) { console.error(e); }
    finally { if(window.Busy) window.Busy.hide(); }
  };

  function renderWorkspace(data) {
    const curr = data.contrato.moneda;
    const sym = { USD: "$", PEN: "S/", EUR: "€" }[curr] || "";

    if(els.title) els.title.textContent = data.contrato.nombre_contrato;
    if(els.client) els.client.textContent = data.contrato.empresa_nombre;
    if(els.currencyBadge) els.currencyBadge.textContent = curr;
    if(els.symbolServ) els.symbolServ.textContent = sym;

    if(els.inputServ) els.inputServ.value = data.valorServiciosGuardado > 0 ? data.valorServiciosGuardado : "";
    
    if(els.serviciosNombres) {
        els.serviciosNombres.innerHTML = data.servicios.length 
            ? data.servicios.map(s => `<span class="badge bg-secondary bg-opacity-10 text-secondary border me-1">${s.nombre_servicio}</span>`).join('')
            : "Sin servicios adicionales.";
    }

    const groups = data.gruposDeEquipos.reduce((acc, g) => {
        const k = g.categoria_nombre || "Otros";
        if(!acc[k]) acc[k] = [];
        acc[k].push(g);
        return acc;
    }, {});

    let htmlEquipos = '';
    for(const [cat, items] of Object.entries(groups)) {
        htmlEquipos += `
            <div class="mb-4">
                <h6 class="fw-bold text-primary border-bottom pb-2 mb-0 px-3 bg-light rounded-top pt-2">${cat}</h6>
                <div class="table-responsive border border-top-0 rounded-bottom">
                    <table class="table table-pricing mb-0 bg-white">
                        <thead>
                            <tr><th style="width: 50%;">Modelo</th><th class="text-center" style="width: 15%;">Cant.</th><th class="text-end" style="width: 35%;">Precio (${curr})</th></tr>
                        </thead>
                        <tbody>
                            ${items.map(g => `
                                <tr class="grupo-fila" data-cat="${g.id_categoria}" data-ids="${g.equipos_ids}" data-cant="${g.cantidad}">
                                    <td><div class="fw-semibold text-dark">${g.modelo || 'N/A'}</div><div class="small text-muted">${g.marca || ''}</div></td>
                                    <td class="text-center fw-bold text-secondary fs-6">${g.cantidad}</td>
                                    <td class="text-end">
                                        <div class="d-flex justify-content-end align-items-center gap-2">
                                            <span class="text-muted small">${sym}</span>
                                            <input type="number" class="input-price precio-input" value="${g.precio_unitario_grupo > 0 ? g.precio_unitario_grupo : ''}" placeholder="0.00" step="0.01">
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    }

    if(els.equiposContainer) els.equiposContainer.innerHTML = htmlEquipos || '<div class="text-center py-4 text-muted">No hay equipos.</div>';
    
    if(els.placeholder) els.placeholder.classList.add('d-none');
    if(els.details) els.details.classList.remove('d-none');
    
    calcTotalLocal(false);
  }

  function calcTotalLocal(markAsChanged = true) {
    let total = 0;
    document.querySelectorAll('.grupo-fila').forEach(row => {
        const cant = parseFloat(row.dataset.cant) || 0;
        const val = parseFloat(row.querySelector('.precio-input').value) || 0;
        total += (cant * val);
    });
    if(els.inputServ) total += parseFloat(els.inputServ.value) || 0;
    
    const curr = els.currencyBadge ? els.currencyBadge.textContent : 'USD';
    if(els.totalDisplay) els.totalDisplay.textContent = money(total, curr);
    
    if(markAsChanged) {
        hasChanges = true;
        toggleSaveBar(true);
    }
  }

  async function guardarCambios() {
      if(!selectedId) return;
      
      const payload = {
          id_contrato: selectedId,
          valor_total_servicios: parseFloat(els.inputServ.value) || 0,
          precios_equipos: []
      };

      document.querySelectorAll('.grupo-fila').forEach(row => {
          const val = parseFloat(row.querySelector('.precio-input').value);
          if (val > 0) {
              payload.precios_equipos.push({
                  id_categoria: row.dataset.cat,
                  precio_unitario: val,
                  ids: row.dataset.ids.split(',').filter(Boolean)
              });
          }
      });

      if(window.Busy) window.Busy.show();
      
      try {
          const res = await fetch("/admin/api/valorizacion/guardar", {
              method: "POST",
              headers: { 
                  "Content-Type": "application/json",
                  "x-csrf-token": getCsrfToken() 
              },
              body: JSON.stringify(payload)
          });
          const json = await res.json();
          if(json.success) {
              hasChanges = false;
              toggleSaveBar(false);
              await loadContracts(); 
              
              const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
              toast.fire({ icon: 'success', title: 'Guardado correctamente' });
              
              const item = document.querySelector(`.contract-item[data-id="${selectedId}"]`);
              if(item) item.classList.add('active');
          }
      } catch(e) { 
          Swal.fire("Error", "No se pudo guardar. " + e.message, "error");
      } finally {
          if(window.Busy) window.Busy.hide();
      }
  }

  // --- ANALYTICS ---
  function updateAnalytics() {
      if (!els.kpiTotal) return;

      rates.PEN = parseFloat(els.fxPEN?.value) || 3.75;
      rates.EUR = parseFloat(els.fxEUR?.value) || 1.08;
      baseCurr = els.fxBase?.value || "USD";

      const convert = (val, curr) => {
          if(!val) return 0;
          let usdVal = val;
          if(curr === 'PEN') usdVal = val / rates.PEN;
          else if(curr === 'EUR') usdVal = val * rates.EUR;
          
          if(baseCurr === 'PEN') return usdVal * rates.PEN;
          if(baseCurr === 'EUR') return usdVal / rates.EUR;
          return usdVal;
      };

      let totalVal = 0, clientMap = {}, eqVal = 0, srvVal = 0;
      
      let processed = contracts.map(c => {
          const vEq = convert(c.valor_total_equipos, c.moneda);
          const vSv = convert(c.valor_total_servicios, c.moneda);
          const vTot = vEq + vSv;
          
          totalVal += vTot;
          eqVal += vEq;
          srvVal += vSv;
          clientMap[c.empresa_nombre] = (clientMap[c.empresa_nombre] || 0) + vTot;
          
          return { ...c, vTot };
      });

      if(els.kpiTotal) els.kpiTotal.textContent = money(totalVal, baseCurr);
      if(els.kpiCli) els.kpiCli.textContent = Object.keys(clientMap).length;
      if(els.kpiProm) els.kpiProm.textContent = money(contracts.length ? totalVal/contracts.length : 0, baseCurr);
      
      const topC = processed.sort((a,b) => b.vTot - a.vTot)[0];
      if(els.kpiTop) els.kpiTop.textContent = topC ? `${shorten(topC.nombre_contrato, 20)}` : "—";

      renderCharts(processed.slice(0, 10), clientMap, eqVal, srvVal);
  }

  function renderCharts(top10, clientMap, eq, sv) {
      if (els.chartTop) {
          const ctx1 = els.chartTop.getContext('2d');
          if(charts.top) charts.top.destroy();
          charts.top = new Chart(ctx1, {
              type: 'bar',
              data: {
                  labels: top10.map(r => shorten(r.nombre_contrato, 20)),
                  datasets: [{ data: top10.map(r => r.vTot), backgroundColor: '#0d6efd', borderRadius: 4 }]
              },
              options: { indexAxis: "y", plugins: { legend: {display:false} }, maintainAspectRatio: false }
          });
      }
      
      if (els.chartPie) {
          const ctx2 = els.chartPie.getContext('2d');
          if(charts.pie) charts.pie.destroy();
          charts.pie = new Chart(ctx2, {
              type: 'doughnut',
              data: {
                  labels: ["Equipos", "Servicios"],
                  datasets: [{ data: [eq, sv], backgroundColor: ['#3b82f6', '#10b981'] }]
              },
              options: { maintainAspectRatio: false, plugins: { legend: {position:'bottom'} } }
          });
      }
  }

  // --- EVENTS ---
  function setupEvents() {
      const switchView = (view) => {
          if(view === 'valorizar') {
              els.viewVal?.classList.remove('d-none');
              els.viewAna?.classList.add('d-none');
              els.btnVal?.classList.add('active');
              els.btnAna?.classList.remove('active');
          } else {
              els.viewVal?.classList.add('d-none');
              els.viewAna?.classList.remove('d-none');
              els.btnVal?.classList.remove('active');
              els.btnAna?.classList.add('active');
              updateAnalytics();
          }
      };

      if(els.btnVal) els.btnVal.addEventListener('click', () => switchView('valorizar'));
      if(els.btnAna) els.btnAna.addEventListener('click', () => switchView('analisis'));

      if(els.search) {
          els.search.addEventListener('input', (e) => {
              const term = e.target.value.toLowerCase();
              const filtered = contracts.filter(c => 
                  c.nombre_contrato.toLowerCase().includes(term) || 
                  c.empresa_nombre.toLowerCase().includes(term)
              );
              renderList(filtered);
          });
      }

      if(els.details) {
          els.details.addEventListener('input', (e) => {
              if(e.target.classList.contains('precio-input') || e.target.id === 'valor_total_servicios') {
                  calcTotalLocal(true); 
              }
          });
      }

      if(els.btnSave) els.btnSave.addEventListener('click', guardarCambios);
      
      // Acción del botón "Descartar/Cancelar"
      if(els.btnCancel) els.btnCancel.addEventListener('click', () => window.loadDetails(selectedId));

      [els.fxBase, els.fxPEN, els.fxEUR].forEach(el => {
          if(el) el.addEventListener('change', updateAnalytics);
      });
  }

  init();
});