document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. SELECTORES GLOBALES
  // ==========================================
  
  // Gestión de Contratos
  const selectEmpresaEl = document.getElementById('selectEmpresa');
  const selectContratoEl = document.getElementById('selectContrato');
  const resumenBox = document.getElementById('resumenSeleccion');
  const resEmpresaText = document.getElementById('res-empresa');
  const resContratoText = document.getElementById('res-contrato');
  const formServiciosContrato = document.getElementById('form-servicios-contrato');
  const catalogoContainer = document.getElementById('catalogo-servicios-container');
  const infoNoContrato = document.getElementById('info-no-contrato');
  const alertContrato = document.getElementById('alert-contrato');

  // Nuevo Servicio
  const formNuevoServicio = document.getElementById('form-nuevo-servicio');
  const nuevoServicioNombreInput = document.getElementById('nuevoServicioNombre');
  const nuevoServicioCategoriaEl = document.getElementById('nuevoServicioCategoria');
  const alertServicio = document.getElementById('alert-servicio');

  // Marketing / Alertas
  const selCategoria = document.getElementById('al-categoria');
  const selSeverity = document.getElementById('al-severity');
  const inTitle = document.getElementById('al-title');
  const inMessage = document.getElementById('al-message');
  const inCtaLabel = document.getElementById('al-cta-label');
  const inCtaUrl = document.getElementById('al-cta-url');
  const inStart = document.getElementById('al-start');
  const inEnd = document.getElementById('al-end');
  const btnPublicar = document.getElementById('al-publicar');
  const alertBox = document.getElementById('al-alert');
  const listBox = document.getElementById('al-list'); 

  // Modal Empresas (Alertas)
  const companiesBox = document.getElementById('al-companies-box');
  const searchBox = document.getElementById('al-search');
  const btnAll = document.getElementById('al-select-all');
  const btnClear = document.getElementById('al-clear-all');
  const selectedCount = document.getElementById('al-selected-count'); 
  const modalMeta = document.getElementById('al-modal-meta');         

  // WhatsApp
  const waBtn = document.getElementById('al-gen-wa'); 
  const waGenerateBtn = document.getElementById('wa-generate-btn'); 
  const waNumberInput = document.getElementById('wa-number');
  const waMessageInput = document.getElementById('wa-message');
  const modalWhatsappEl = document.getElementById('modalWhatsapp');
  const modalWhatsapp = modalWhatsappEl ? new bootstrap.Modal(modalWhatsappEl) : null;

  // ==========================================
  // 2. ESTADO
  // ==========================================
  let allCompanies = [], allContracts = [], catalogServices = [];
  let tomSelectEmpresa, tomSelectContrato, tomSelectCategoria;
  
  // Estado para Alertas
  let missingCompanies = [];
  let selectedCompanyIds = new Set();
  let editingId = null;

  // ==========================================
  // 3. HELPERS (UI & SEGURIDAD)
  // ==========================================
  
  // --- CSRF TOKEN (CRÍTICO: ESTO ARREGLA EL ERROR 403) ---
  const getCsrfToken = () => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute('content') : '';
  };

  // Sistema de Toasts
  const Toasts = (() => {
    const area = document.getElementById('toast-area');
    function show(type = 'info', title = '', msg = '') {
      if (!area) return;
      const id = `t-${Date.now()}`;
      const color = { success: 'text-bg-success', danger: 'text-bg-danger', warning: 'text-bg-warning', info: 'text-bg-primary' }[type] || 'text-bg-primary';
      
      const html = `
        <div id="${id}" class="toast align-items-center ${color} border-0 shadow" role="status" aria-live="polite" aria-atomic="true">
          <div class="d-flex">
            <div class="toast-body">
              ${title ? `<strong class="me-2">${title}</strong>` : ''}${msg}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
          </div>
        </div>`;
      area.insertAdjacentHTML('beforeend', html);
      const el = document.getElementById(id);
      const toast = new bootstrap.Toast(el, { delay: 3000 });
      toast.show();
      el.addEventListener('hidden.bs.toast', () => el.remove());
    }
    return { show };
  })();

  function showAlert(container, message, type = 'success') {
    if (!container) return;
    container.innerHTML = `
      <div class="alert alert-${type} d-flex align-items-center gap-2 py-2 px-3 rounded-3 border-0 shadow-sm w-100">
        <i class="bi ${type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}"></i>
        <small class="fw-medium">${message}</small>
      </div>`;
    setTimeout(() => container.innerHTML = '', 4000);
  }

  function setLoading(btn, state = true, labelWhileLoading) {
    if (!btn) return;
    if (state) {
      btn.dataset._label = btn.innerHTML;
      btn.classList.add('btn-loading');
      if (labelWhileLoading) btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ${labelWhileLoading}`;
      btn.disabled = true;
    } else {
      btn.classList.remove('btn-loading');
      if (btn.dataset._label) btn.innerHTML = btn.dataset._label;
      btn.disabled = false;
    }
  }

  // ==========================================
  // 4. INICIALIZACIÓN
  // ==========================================
  const init = async () => {
    try {
        // Cargar datos iniciales (GET no necesita token)
        await Promise.all([loadCompanies(), loadContracts(), loadCatalogServices()]);
        
        // Reintento si TomSelect no cargó
        if (typeof TomSelect === 'undefined') {
            setTimeout(init, 500); 
            return;
        }

        initializeTomSelects();
        setupEventListeners();
        
        // Cargar lista de alertas inicial
        await loadAlertsList();

    } catch (error) { console.error("Error init:", error); }
  };

  // ==========================================
  // 5. CARGA DE DATOS (API GET)
  // ==========================================
  const loadCompanies = async () => {
    try {
      const res = await fetch('/admin/api/empresa/lista');
      const json = await res.json();
      if (json.success) allCompanies = json.data;
    } catch (err) { console.error(err); }
  };

  const loadContracts = async () => {
    try {
      const res = await fetch('/admin/api/contratos/lista');
      const json = await res.json();
      if (json.success) allContracts = json.data;
    } catch (err) { console.error(err); }
  };

  const loadCatalogServices = async () => {
    try {
      const res = await fetch('/admin/api/servicios');
      const json = await res.json();
      if (json.success) {
        catalogServices = json.data;
        renderCatalogCheckboxes();
        fillServiceCategoriesForAlerts();
      }
    } catch (err) { console.error(err); }
  };

  // ==========================================
  // 6. TOM SELECTS
  // ==========================================
  const initializeTomSelects = () => {
    if (selectEmpresaEl) {
        tomSelectEmpresa = new TomSelect(selectEmpresaEl, {
          options: allCompanies.map(c => ({ value: c.id_empresa, text: c.nombre })),
          onChange: onCompanyChange,
          placeholder: 'Buscar empresa...'
        });
    }

    if (selectContratoEl) {
        tomSelectContrato = new TomSelect(selectContratoEl, {
          onChange: onContractChange,
          placeholder: '— Seleccione empresa primero —'
        });
        tomSelectContrato.disable();
    }

    updateTomSelectCategories();
  };

  const updateTomSelectCategories = () => {
    if (!nuevoServicioCategoriaEl) return;
    const categories = [...new Set(catalogServices.map(s => s.categoria_servicio))];
    
    if (tomSelectCategoria) tomSelectCategoria.destroy();
    
    tomSelectCategoria = new TomSelect(nuevoServicioCategoriaEl, {
      create: true,
      options: categories.map(c => ({ value: c, text: c })),
      sortField: { field: "text", direction: "asc" },
      placeholder: 'Selecciona o escribe...'
    });
  };

  // ==========================================
  // 7. GESTIÓN DE CONTRATOS
  // ==========================================
  const onCompanyChange = (companyId) => {
    if (!tomSelectContrato) return;
    tomSelectContrato.clear(true);
    tomSelectContrato.clearOptions();

    if (companyId) {
      const companyContracts = allContracts.filter(c => c.id_empresa == companyId);
      tomSelectContrato.addOptions(companyContracts.map(c => ({ value: c.id_contrato, text: c.nombre_contrato })));
      tomSelectContrato.enable();
    } else {
      tomSelectContrato.disable();
    }
    resetServicesSection();
  };

  const onContractChange = async () => {
    const empId = tomSelectEmpresa.getValue();
    const conId = tomSelectContrato.getValue();
    
    if (empId && conId) {
        const empName = tomSelectEmpresa.getItem(empId).textContent;
        const conName = tomSelectContrato.getItem(conId).textContent;
        resEmpresaText.textContent = empName;
        resContratoText.textContent = conName;
        
        resumenBox.classList.remove('d-none');
        infoNoContrato.classList.add('d-none');
        formServiciosContrato.classList.remove('d-none');
        await loadContractServices();
    } else {
        resetServicesSection();
    }
  };

  async function loadContractServices() {
    if (!catalogoContainer) return;
    // Resetear visualmente
    catalogoContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    const idContrato = tomSelectContrato.getValue();
    if (!idContrato) return;

    try {
      const res = await fetch(`/admin/api/contratos/${idContrato}/servicios`);
      const response = await res.json();
      if (response.success) {
        response.data.forEach(s => {
          const cb = document.getElementById(`srv-${s.id_servicio}`);
          if (cb) cb.checked = true;
        });
      }
    } catch (err) { console.error('Error services:', err); }
  }

  const renderCatalogCheckboxes = () => {
    if (!catalogoContainer) return;
    catalogoContainer.innerHTML = '';
    const categories = [...new Set(catalogServices.map(s => s.categoria_servicio))].sort();

    categories.forEach(category => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-4';
      const title = document.createElement('h6');
      title.className = 'fw-bold text-primary border-bottom pb-1 mb-2 small text-uppercase';
      title.textContent = category;
      wrapper.appendChild(title);

      catalogServices.filter(s => s.categoria_servicio === category).forEach(service => {
         const label = document.createElement('label');
         label.className = 'service-check-card d-flex align-items-center justify-content-between';
         label.innerHTML = `
            <span class="fw-medium text-dark">${service.nombre_servicio}</span>
            <div class="form-check m-0">
                <input class="form-check-input" type="checkbox" value="${service.id_servicio}" id="srv-${service.id_servicio}">
            </div>`;
         wrapper.appendChild(label);
      });
      catalogoContainer.appendChild(wrapper);
    });
  };

  const resetServicesSection = () => {
      if (resumenBox) resumenBox.classList.add('d-none');
      if (infoNoContrato) infoNoContrato.classList.remove('d-none');
      if (formServiciosContrato) formServiciosContrato.classList.add('d-none');
  };

  // --- AQUÍ ESTABA EL ERROR: FALTABA EL HEADER CSRF ---
  async function handleSaveContractServices(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const idContrato = tomSelectContrato.getValue();
    const checkboxes = catalogoContainer.querySelectorAll('input[type="checkbox"]:checked');
    const id_servicios = Array.from(checkboxes).map(cb => cb.value);

    try {
      setLoading(btn, true, 'Guardando...');
      const res = await fetch(`/admin/api/contratos/${idContrato}/servicios`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken() // SOLUCIÓN: Header agregado
        },
        body: JSON.stringify({ id_servicios })
      });
      const json = await res.json();

      if (res.ok && json.success) {
        Toasts.show('success', 'Contrato', 'Servicios actualizados.');
      } else {
        showAlert(alertContrato, 'Error al guardar.', 'danger');
      }
    } catch (err) { showAlert(alertContrato, 'Error de red.', 'danger'); }
    finally { 
        setLoading(btn, false); 
        btn.innerHTML = 'Guardar Cambios';
    }
  }

  // ==========================================
  // 8. NUEVO SERVICIO
  // ==========================================
  async function handleNewServiceSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const nombre = nuevoServicioNombreInput.value.trim();
    const categoria = tomSelectCategoria.getValue();

    if (!nombre || !categoria) return;

    try {
      setLoading(btn, true, 'Añadiendo...');
      const res = await fetch('/admin/api/servicios', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-csrf-token': getCsrfToken() // SOLUCIÓN: Header agregado
        },
        body: JSON.stringify({ nombre_servicio: nombre, categoria_servicio: categoria })
      });
      const json = await res.json();
      
      if (res.ok && json.success) {
        Toasts.show('success', 'Catálogo', 'Servicio añadido.');
        nuevoServicioNombreInput.value = '';
        tomSelectCategoria.clear();
        await loadCatalogServices();
        updateTomSelectCategories();
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoServicio')).hide();
      } else {
        showAlert(alertServicio, json.message, 'danger');
      }
    } catch (err) { showAlert(alertServicio, 'Error de red', 'danger'); }
    finally { setLoading(btn, false); }
  }

  // ==========================================
  // 9. MARKETING / ALERTAS
  // ==========================================
  
  function fillServiceCategoriesForAlerts() {
      if (!selCategoria) return;
      const categorias = [...new Set(catalogServices.map(s => s.categoria_servicio))].sort();
      selCategoria.innerHTML = '<option value="">Selecciona...</option>' +
        categorias.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function renderCompanyList(filter='') {
      const f = filter.toLowerCase();
      const rows = missingCompanies
        .filter(c => !f || c.nombre.toLowerCase().includes(f))
        .map(c => `
          <label class="btn btn-outline-light text-dark text-start border d-flex align-items-center gap-2 p-2">
            <input class="form-check-input m-0" type="checkbox" value="${c.id_empresa}" ${selectedCompanyIds.has(String(c.id_empresa))?'checked':''} />
            <span class="small text-truncate">${c.nombre}</span>
          </label>
        `).join('');
      
      if (companiesBox) {
        companiesBox.innerHTML = rows || '<div class="text-muted small text-center py-3 col-12">Sin resultados...</div>';
        companiesBox.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', () => {
                if (chk.checked) selectedCompanyIds.add(chk.value);
                else selectedCompanyIds.delete(chk.value);
                updateSelectedCount();
            });
        });
      }
      updateSelectedCount();
  }

  function updateSelectedCount() {
      if(selectedCount) selectedCount.textContent = selectedCompanyIds.size;
      if(modalMeta) modalMeta.textContent = `${selectedCompanyIds.size} empresas seleccionadas`;
  }

  if(selCategoria) {
      selCategoria.addEventListener('change', async () => {
          selectedCompanyIds.clear();
          updateSelectedCount();

          if (!selCategoria.value) {
            if(companiesBox) companiesBox.innerHTML = '<div class="text-center text-muted p-3 col-12">Selecciona una categoría primero.</div>';
            return;
          }
          const btnModal = document.querySelector('[data-bs-target="#modalEmpresas"]');
          const originalText = btnModal ? btnModal.innerHTML : '';
          if(btnModal) btnModal.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cargando...';

          try {
            const r = await fetch(`/admin/api/alerts/missing-companies/${encodeURIComponent(selCategoria.value)}`);
            const j = await r.json();
            if (!j.success) throw new Error('Error');
            missingCompanies = j.data;
            renderCompanyList();
          } catch (e) { console.error(e); } 
          finally { if(btnModal) btnModal.innerHTML = originalText; }
      });
  }

  if(searchBox) searchBox.addEventListener('input', () => renderCompanyList(searchBox.value));
  
  if(btnAll) btnAll.addEventListener('click', (e) => {
      e.preventDefault();
      missingCompanies.forEach(c => selectedCompanyIds.add(String(c.id_empresa)));
      renderCompanyList(searchBox.value);
  });
  
  if(btnClear) btnClear.addEventListener('click', (e) => {
      e.preventDefault();
      selectedCompanyIds.clear();
      renderCompanyList(searchBox.value);
  });

  // --- PUBLICAR ALERTA (CSRF AGREGADO) ---
  if(btnPublicar) {
      btnPublicar.addEventListener('click', async () => {
          const payload = {
            categoria_servicio: selCategoria.value,
            severity: selSeverity.value,
            title: inTitle.value.trim(),
            message: inMessage.value.trim(),
            cta_label: inCtaLabel.value.trim() || null,
            cta_url: inCtaUrl.value.trim() || null,
            start_at: inStart && inStart.value ? inStart.value.replace('T',' ') + ':00' : null,
            end_at:   inEnd && inEnd.value ? inEnd.value.replace('T',' ') + ':00' : null,
            company_ids: Array.from(selectedCompanyIds).map(Number)
          };

          if (!payload.categoria_servicio || !payload.title || !payload.message) {
            return showAlert(alertBox, 'Completa los campos obligatorios.', 'warning');
          }
          if (!editingId && payload.company_ids.length === 0) {
             return showAlert(alertBox, 'Debes seleccionar al menos una empresa.', 'warning');
          }

          try {
            setLoading(btnPublicar, true, 'Guardando...');
            const url = editingId ? `/admin/api/alerts/${editingId}` : '/admin/api/alerts';
            const method = editingId ? 'PUT' : 'POST';
            
            const r = await fetch(url, { 
                method, 
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken() // SOLUCIÓN: Header agregado
                }, 
                body: JSON.stringify(payload) 
            });
            const j = await r.json();

            if (j.success) {
              showAlert(alertBox, 'Alerta guardada correctamente.', 'success');
              Toasts.show('success', 'Alerta', 'Operación exitosa.');
              document.getElementById('form-alerta').reset();
              selectedCompanyIds.clear();
              updateSelectedCount();
              editingId = null;
              btnPublicar.textContent = 'Publicar Alerta';
              loadAlertsList();
            } else {
              showAlert(alertBox, j.message, 'danger');
            }
          } catch (err) { showAlert(alertBox, 'Error de conexión.', 'danger'); }
          finally { setLoading(btnPublicar, false); }
      });
  }

  async function loadAlertsList() {
    if (!listBox) return;
    listBox.innerHTML = '<div class="text-center py-3"><div class="spinner-border text-primary"></div></div>';
    
    try {
      const r = await fetch('/admin/api/alerts');
      const j = await r.json();
      
      if (!j.success || !j.data.length) {
          listBox.innerHTML = '<div class="text-center text-muted py-4">No hay alertas activas.</div>';
          return;
      }
      
      listBox.innerHTML = j.data.map(a => {
          const badgeClass = a.severity === 'danger' ? 'text-bg-danger' : (a.severity === 'warning' ? 'text-bg-warning' : 'text-bg-info');
          const start = a.start_at ? new Date(a.start_at).toLocaleDateString() : 'Inicio';
          const end = a.end_at ? new Date(a.end_at).toLocaleDateString() : 'Indefinido';

          return `
            <div class="alert-card ${a.severity}">
               <div class="alert-card-header">
                  <h6 class="alert-card-title mb-0 text-truncate" style="max-width: 70%;">${a.title}</h6>
                  <span class="badge ${badgeClass}">${a.severity}</span>
               </div>
               <p class="small text-muted mb-2 text-truncate">${a.message}</p>
               <div class="alert-meta d-flex justify-content-between align-items-center">
                   <span><i class="bi bi-people"></i> ${a.empresas_objetivo} empresas</span>
                   <span><i class="bi bi-calendar"></i> ${start} - ${end}</span>
               </div>
               <div class="alert-card-footer mt-3 d-flex justify-content-end gap-2 border-top pt-2">
                  <button class="btn btn-sm btn-light border js-toggle" data-id="${a.id_alerta}" data-active="${a.active}">
                      <i class="bi ${a.active ? 'bi-toggle-on text-success' : 'bi-toggle-off text-secondary'}"></i> ${a.active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button class="btn btn-sm btn-light border text-primary js-edit" data-id="${a.id_alerta}"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-light border text-danger js-del" data-id="${a.id_alerta}"><i class="bi bi-trash"></i></button>
               </div>
            </div>
          `;
      }).join('');

      attachAlertListeners();

    } catch (e) { console.error(e); listBox.innerHTML = 'Error al cargar.'; }
  }

  function attachAlertListeners() {
      // Eliminar (CSRF Agregado)
      listBox.querySelectorAll('.js-del').forEach(btn => {
          btn.addEventListener('click', async () => {
              if(!confirm('¿Eliminar alerta?')) return;
              await fetch(`/admin/api/alerts/${btn.dataset.id}`, { 
                  method: 'DELETE',
                  headers: { 'x-csrf-token': getCsrfToken() } // SOLUCIÓN
              });
              loadAlertsList();
          });
      });

      // Toggle Activo (CSRF Agregado)
      listBox.querySelectorAll('.js-toggle').forEach(btn => {
          btn.addEventListener('click', async () => {
              const active = btn.dataset.active == '1' ? 0 : 1;
              await fetch(`/admin/api/alerts/${btn.dataset.id}/toggle`, { 
                  method: 'PUT',
                  headers: { 
                      'Content-Type': 'application/json',
                      'x-csrf-token': getCsrfToken() // SOLUCIÓN
                  },
                  body: JSON.stringify({ active })
              });
              loadAlertsList();
          });
      });

      // Editar
      listBox.querySelectorAll('.js-edit').forEach(btn => {
          btn.addEventListener('click', async () => {
              try {
                  const r = await fetch(`/admin/api/alerts/${btn.dataset.id}`);
                  const j = await r.json();
                  if(j.success) {
                      const { alerta, targets } = j.data;
                      selCategoria.value = alerta.categoria_servicio;
                      selCategoria.dispatchEvent(new Event('change'));
                      
                      setTimeout(() => {
                          selectedCompanyIds = new Set(targets.map(String));
                          updateSelectedCount();
                          renderCompanyList();
                      }, 800);

                      selSeverity.value = alerta.severity;
                      inTitle.value = alerta.title;
                      inMessage.value = alerta.message;
                      inCtaLabel.value = alerta.cta_label || '';
                      inCtaUrl.value = alerta.cta_url || '';
                      if(alerta.start_at) inStart.value = alerta.start_at.replace(' ', 'T').slice(0,16);
                      if(alerta.end_at) inEnd.value = alerta.end_at.replace(' ', 'T').slice(0,16);

                      editingId = alerta.id_alerta;
                      btnPublicar.textContent = 'Actualizar Alerta';
                      document.getElementById('form-alerta').scrollIntoView({ behavior: 'smooth' });
                      Toasts.show('info', 'Edición', 'Editando alerta...');
                  }
              } catch (e) { console.error(e); }
          });
      });
  }

  // 9.7 WhatsApp Modal
  if(waBtn) {
      waBtn.addEventListener('click', () => modalWhatsapp?.show());
  }
  if(waGenerateBtn) {
      waGenerateBtn.addEventListener('click', () => {
          const num = waNumberInput.value.replace(/\D/g, '');
          const msg = waMessageInput.value;
          if(num) {
              const link = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
              inCtaUrl.value = link;
              if(!inCtaLabel.value) inCtaLabel.value = "Contactar por WhatsApp";
              modalWhatsapp?.hide();
          }
      });
  }

  // ==========================================
  // 10. EVENTOS GLOBALES
  // ==========================================
  const setupEventListeners = () => {
    if(formNuevoServicio) formNuevoServicio.addEventListener('submit', handleNewServiceSubmit);
    if(formServiciosContrato) formServiciosContrato.addEventListener('submit', handleSaveContractServices);
  };

  // INICIO
  init();
});