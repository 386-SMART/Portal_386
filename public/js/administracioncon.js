document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. SELECTORES DEL DOM
  // ==========================================
  
  // Formulario y Wizard
  const form = document.getElementById("contract-form");
  const formAlert = document.getElementById("form-alert");
  const formTitle = document.getElementById("form-title");
  const formSubmitBtn = document.getElementById("form-submit-btn");
  const cancelEditBtn = document.getElementById("btn-cancel-edit");
  
  // Inputs del Formulario
  const empresaSelect = document.getElementById("id_empresa");
  const nombreInput = document.getElementById("nombre_contrato");
  const fechaInicioInput = document.getElementById("fecha_inicio");
  
  // Paneles de Ayuda
  const infoPanelDefault = document.getElementById("info-panel-default");
  const infoPanelEdit = document.getElementById("info-panel-edit");
  
  // Navegación de Pestañas (Tabs)
  const formTabEl = document.getElementById("form-tab");
  const formTab = new bootstrap.Tab(formTabEl);
  const listTabEl = document.getElementById("list-tab");
  const listTab = new bootstrap.Tab(listTabEl);

  // Wizard (Pasos)
  const progressLine = document.getElementById("progress-line");
  const btnNext = document.getElementById("btn-next");
  const btnPrev = document.getElementById("btn-prev");
  const steps = document.querySelectorAll(".form-step");
  const stepItems = document.querySelectorAll(".step-item");

  // Pestaña: Lista de Contratos
  const tableBody = document.getElementById("contracts-table-body");
  const contractsPagination = document.getElementById("contracts-pagination");
  const contractSearchInput = document.getElementById("contract-search-input");
  const filterCompanyList = document.getElementById("filter-company-list"); // Selector de filtro en la lista

  // Relación entre contratos
  const relacionContainer = document.getElementById("relacion-container");
  const relacionSelectEl = document.getElementById("id_relacion");

  // Documentos (Dentro del formulario)
  const documentosTabsContent = document.getElementById("documentosTabsContent");

  // Pestaña: Importación Masiva
  const btnDownloadTemplate = document.getElementById("btn-download-template");
  const excelFileInput = document.getElementById("excel-file-input");
  const companyGuideSelect = document.getElementById("company-guide-select");
  const previewSection = document.getElementById("preview-section");
  const previewThead = document.getElementById("preview-thead");
  const previewTbody = document.getElementById("preview-tbody");
  const previewPagination = document.getElementById("preview-pagination");
  const previewCountBadge = document.getElementById("preview-count-badge");
  const btnSaveBulk = document.getElementById("btn-save-bulk");

  // ==========================================
  // 2. ESTADO DE LA APLICACIÓN
  // ==========================================
  let allCompanies = [];
  let allContracts = [];
  let currentEditId = null;
  let currentStep = 1;
  const totalSteps = 3;
  
  // Variables para TomSelect
  let tomSelectRelacion = null;
  let tomSelectCompanyFilter = null;

  // Paginación Lista
  let contractsCurrentPage = 1;
  const contractsRowsPerPage = 8;
  let currentCompanyFilter = ""; // ID de la empresa para filtrar

  // Paginación Importación
  let bulkData = [];
  let bulkCurrentPage = 1;
  const bulkRowsPerPage = 10;

  // ==========================================
  // 3. FUNCIONES AUXILIARES (Token & Alertas)
  // ==========================================
  
  // Obtener Token CSRF del meta tag (CRÍTICO PARA SEGURIDAD)
  const getCsrfToken = () => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute('content') : '';
  };

  const showAlert = (message, type = "danger") => {
    if (formAlert) {
        formAlert.textContent = message;
        formAlert.className = `alert alert-${type} mb-4`;
        formAlert.classList.remove("d-none");
        // Auto-ocultar después de 5 segundos
        setTimeout(() => formAlert.classList.add("d-none"), 5000);
    }
  };

  const hideAlert = () => {
    if (formAlert) formAlert.classList.add("d-none");
  };

  // ==========================================
  // 4. INICIALIZACIÓN
  // ==========================================
  const init = async () => {
    setupEventListeners();
    await Promise.all([loadCompanies(), loadContracts()]);
    updateWizard();
  };

  // ==========================================
  // 5. CARGA DE DATOS
  // ==========================================
  
  const loadCompanies = async () => {
    try {
      const res = await fetch("/admin/api/empresa/lista");
      const response = await res.json();
      if (response.success) {
        allCompanies = response.data;
        
        // A) Llenar select del formulario (Crear/Editar)
        empresaSelect.innerHTML = '<option value="" disabled selected>Seleccionar...</option>';
        allCompanies.forEach(c => empresaSelect.add(new Option(c.nombre, c.id_empresa)));
        
        // B) Inicializar Buscador de IDs (Pestaña Importación)
        if (companyGuideSelect) initializeTomSelect(companyGuideSelect, allCompanies, true);

        // C) Inicializar Filtro de Lista (Pestaña Lista)
        if (filterCompanyList) {
            // Destruir instancia anterior si existe para evitar duplicados al recargar
            if (tomSelectCompanyFilter) tomSelectCompanyFilter.destroy();
            
            tomSelectCompanyFilter = new TomSelect(filterCompanyList, {
                options: [{value: "", text: "Todas las empresas"}, ...allCompanies.map(c => ({ value: c.id_empresa, text: c.nombre }))],
                items: [""], // Seleccionar 'Todas' por defecto
                placeholder: "Filtrar por Empresa...",
                render: {
                    option: (data, escape) => `<div>${escape(data.text)}</div>`,
                    item: (data, escape) => `<div>${escape(data.text)}</div>`
                },
                onChange: (value) => {
                    currentCompanyFilter = value; // Actualizar filtro
                    contractsCurrentPage = 1;     // Resetear a página 1
                    renderContractsTable();       // Refrescar tabla
                }
            });
        }
      }
    } catch (err) { console.error("Error cargando empresas:", err); }
  };

  // Función genérica para inicializar TomSelect
  const initializeTomSelect = (element, companies, showId = false) => {
    return new TomSelect(element, {
      options: companies.map((c) => ({ value: c.id_empresa, text: c.nombre })),
      render: {
        option: function (data, escape) {
          return `<div class="py-2 px-3">
                    <div class="fw-bold text-truncate">${escape(data.text)}</div>
                    ${showId ? `<div class="small text-muted">ID: ${escape(data.value)}</div>` : ''}
                  </div>`;
        },
        item: function (data, escape) {
          return `<div class="d-inline-flex align-items-center">
                    ${showId ? `<strong class="me-2">ID: ${escape(data.value)}</strong>` : ''} ${escape(data.text)}
                  </div>`;
        },
      },
    });
  };

  const loadContracts = async () => {
    try {
      const res = await fetch("/admin/api/contratos/lista");
      const response = await res.json();
      if (response.success) {
        allContracts = response.data;
        contractsCurrentPage = 1;
        renderContractsTable();
      }
    } catch (err) { console.error("Error cargando contratos:", err); }
  };

  // ==========================================
  // 6. LÓGICA DEL WIZARD (PASOS)
  // ==========================================
  const updateWizard = () => {
    // Mostrar solo el paso actual
    steps.forEach(step => step.style.display = step.dataset.step == currentStep ? "block" : "none");
    
    // Actualizar círculos superiores
    stepItems.forEach((item, index) => {
        if ((index + 1) <= currentStep) item.classList.add("active");
        else item.classList.remove("active");
    });

    // Barra de progreso azul
    const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
    if (progressLine) progressLine.style.width = `${percentage}%`;

    // Visibilidad de botones
    if (btnPrev) btnPrev.style.display = currentStep > 1 ? "inline-block" : "none";
    if (btnNext) btnNext.style.display = currentStep < totalSteps ? "inline-block" : "none";
    if (formSubmitBtn) formSubmitBtn.style.display = currentStep === totalSteps ? "inline-block" : "none";
  };

  const validateStep = (step) => {
    if (step === 1) {
        const emp = empresaSelect.value;
        const nom = nombreInput.value.trim();
        const fecha = fechaInicioInput.value;
        
        if (!emp || !nom || !fecha) {
            Swal.fire("Campos Incompletos", "Por favor completa Empresa, Nombre y Fecha de Inicio.", "warning");
            return false;
        }
    }
    return true;
  };

  // ==========================================
  // 7. MANEJO DEL FORMULARIO (CREAR / EDITAR)
  // ==========================================
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    hideAlert(); 
    const isEditing = !!currentEditId;
    
    // URL y Método según acción
    const url = isEditing ? `/admin/api/contratos/${currentEditId}` : "/admin/api/contratos";
    const method = isEditing ? "PUT" : "POST";
    
    const formData = new FormData(form);

    // Asegurar que los checkboxes envíen true/false
    ["implementacion", "mantenimiento", "devolucion_de_equipos", "preparacion_de_imagen"].forEach(name => {
        formData.set(name, document.getElementById(name).checked);
    });

    try {
        // Mostramos loading en el botón
        const originalText = formSubmitBtn.innerHTML;
        formSubmitBtn.disabled = true;
        formSubmitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...';

        const res = await fetch(url, { 
            method, 
            headers: { 'x-csrf-token': getCsrfToken() }, // HEADER DE SEGURIDAD
            body: formData 
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json.message || "Error en el servidor");

        await Swal.fire({ icon: "success", title: "¡Éxito!", text: json.message, timer: 1500, showConfirmButton: false });
        
        await loadContracts(); // Recargar lista
        setupFormFor("create"); // Limpiar formulario
        listTab.show(); // Ir a la pestaña de lista

    } catch (err) {
        console.error(err);
        Swal.fire("Error", err.message, "error");
    } finally {
        formSubmitBtn.disabled = false;
        formSubmitBtn.innerHTML = isEditing ? '<i class="bi bi-check2-circle me-2"></i>Guardar Cambios' : '<i class="bi bi-check2-circle me-2"></i>Crear Contrato';
    }
  };

  // Configurar formulario para Crear o Editar
  const setupFormFor = async (mode, data = {}) => {
    form.reset();
    currentEditId = mode === "edit" ? data.id_contrato : null;
    currentStep = 1;
    updateWizard();

    // Textos y Visibilidad
    if (formTitle) formTitle.textContent = mode === "edit" ? "Editar Contrato" : "Crear Nuevo Contrato";
    if (formSubmitBtn) formSubmitBtn.innerHTML = mode === "edit" ? '<i class="bi bi-check2-circle me-2"></i>Guardar Cambios' : '<i class="bi bi-check2-circle me-2"></i>Crear Contrato';
    if (cancelEditBtn) cancelEditBtn.classList.toggle("d-none", mode !== "edit");
    if (infoPanelDefault) infoPanelDefault.classList.toggle("d-none", mode === "edit");
    if (infoPanelEdit) infoPanelEdit.classList.toggle("d-none", mode !== "edit");
    
    // Bloquear empresa en edición (regla de negocio)
    empresaSelect.disabled = mode === "edit";
    
    // Contratos Relacionados
    if (relacionContainer) relacionContainer.classList.toggle("d-none", mode !== "edit");
    if (tomSelectRelacion) tomSelectRelacion.destroy();

    // Limpiar lista de documentos visual
    const contratosContainer = document.getElementById("contratos-pane");
    const guiasContainer = document.getElementById("guias-pane");
    const propuestasContainer = document.getElementById("propuestas-pane");
    const existingDocsSection = document.getElementById("existing-docs-section");

    if (mode === "edit") {
        // Llenar campos con datos
        empresaSelect.value = data.id_empresa;
        nombreInput.value = data.nombre_contrato;
        document.getElementById("categoria").value = data.categoria || "";
        document.getElementById("moneda").value = data.moneda || "PEN";
        document.getElementById("descripcion").value = data.descripcion || "";
        document.getElementById("fecha_inicio").value = data.fecha_inicio ? new Date(data.fecha_inicio).toISOString().split('T')[0] : "";
        document.getElementById("fecha_fin").value = data.fecha_fin ? new Date(data.fecha_fin).toISOString().split('T')[0] : "";
        
        // Checkboxes
        document.getElementById("implementacion").checked = !!data.implementacion;
        document.getElementById("mantenimiento").checked = !!data.mantenimiento;
        document.getElementById("devolucion_de_equipos").checked = !!data.devolucion_de_equipos;
        document.getElementById("preparacion_de_imagen").checked = !!data.preparacion_de_imagen;

        // Inicializar TomSelect para relacionar contrato
        if (relacionSelectEl) {
            const contractsFiltered = allContracts.filter(c => c.id_empresa == data.id_empresa && c.id_contrato != data.id_contrato);
            tomSelectRelacion = new TomSelect(relacionSelectEl, {
                options: contractsFiltered.map(c => ({ value: c.id_contrato, text: c.nombre_contrato })),
                placeholder: "Buscar contrato relacionado..."
            });
            if (data.id_relacion) tomSelectRelacion.setValue(data.id_relacion);
        }

        // Mostrar sección de documentos existentes y cargarlos
        if (existingDocsSection) existingDocsSection.classList.remove("d-none");
        await loadAndRenderDocuments(data.id_contrato);

    } else {
        // Modo Crear: Ocultar documentos existentes
        if (existingDocsSection) existingDocsSection.classList.add("d-none");
        if (contratosContainer) renderDocuments([], { contratosContainer, guiasContainer, propuestasContainer });
    }
  };

  // ==========================================
  // 8. LISTA DE CONTRATOS (Tabla y Paginación)
  // ==========================================
  const renderContractsTable = () => {
    const term = contractSearchInput ? contractSearchInput.value.toLowerCase() : '';
    
    // Filtro Combinado: Texto + Empresa
    const filtered = allContracts.filter(c => {
        const matchesText = c.nombre_contrato.toLowerCase().includes(term) || c.empresa_nombre.toLowerCase().includes(term);
        // Si currentCompanyFilter está vacío (""), coincide con todo. Si no, debe ser igual.
        const matchesCompany = currentCompanyFilter === "" || c.id_empresa == currentCompanyFilter;
        return matchesText && matchesCompany;
    });

    tableBody.innerHTML = "";
    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-5">No se encontraron contratos con los filtros actuales.</td></tr>';
        contractsPagination.innerHTML = "";
        return;
    }

    // Calcular paginación
    const totalPages = Math.ceil(filtered.length / contractsRowsPerPage);
    contractsCurrentPage = Math.min(contractsCurrentPage, totalPages);
    const start = (contractsCurrentPage - 1) * contractsRowsPerPage;
    const pageData = filtered.slice(start, start + contractsRowsPerPage);

    pageData.forEach(c => {
        const inicio = new Date(c.fecha_inicio).toLocaleDateString('es-PE', {timeZone: 'UTC'});
        const row = `
            <tr>
                <td class="ps-3">
                    <div class="fw-semibold text-dark">${c.nombre_contrato}</div>
                    <div class="small text-muted"><i class="bi bi-building me-1"></i>${c.empresa_nombre}</div>
                </td>
                <td class="small font-monospace text-muted">${inicio}</td>
                <td class="text-center">
                    <button class="btn btn-light border btn-sm btn-edit text-primary" data-id="${c.id_contrato}" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
    
    renderContractsPagination(totalPages);
  };

  // Paginación Inteligente (1 ... 4 5 6 ... 10)
  const renderContractsPagination = (totalPages) => {
    if (!contractsPagination) return;
    contractsPagination.innerHTML = "";
    if (totalPages <= 1) return;

    const createPageItem = (page, text = page, isActive = false, isDisabled = false) => {
        return `<li class="page-item ${isActive ? "active" : ""} ${isDisabled ? "disabled" : ""}">
                    <button class="page-link" ${!isDisabled ? `data-page="${page}"` : ""}>${text}</button>
                </li>`;
    };

    let html = "";
    // Botón Anterior
    html += createPageItem(contractsCurrentPage - 1, "‹", false, contractsCurrentPage === 1);

    // Algoritmo de Elipsis
    if (totalPages <= 7) {
        // Si son pocas páginas, mostrar todas (1 2 3 4 5 6 7)
        for (let i = 1; i <= totalPages; i++) html += createPageItem(i, i, i === contractsCurrentPage);
    } else {
        // Si son muchas, mostrar ventana
        if (contractsCurrentPage <= 4) {
            // Cerca del inicio: 1 2 3 4 5 ... 20
            for (let i = 1; i <= 5; i++) html += createPageItem(i, i, i === contractsCurrentPage);
            html += createPageItem(null, "...", false, true);
            html += createPageItem(totalPages, totalPages, totalPages === contractsCurrentPage);
        } else if (contractsCurrentPage >= totalPages - 3) {
            // Cerca del final: 1 ... 16 17 18 19 20
            html += createPageItem(1, 1, 1 === contractsCurrentPage);
            html += createPageItem(null, "...", false, true);
            for (let i = totalPages - 4; i <= totalPages; i++) html += createPageItem(i, i, i === contractsCurrentPage);
        } else {
            // En el medio: 1 ... 9 10 11 ... 20
            html += createPageItem(1, 1, 1 === contractsCurrentPage);
            html += createPageItem(null, "...", false, true);
            for (let i = contractsCurrentPage - 1; i <= contractsCurrentPage + 1; i++) html += createPageItem(i, i, i === contractsCurrentPage);
            html += createPageItem(null, "...", false, true);
            html += createPageItem(totalPages, totalPages, totalPages === contractsCurrentPage);
        }
    }

    // Botón Siguiente
    html += createPageItem(contractsCurrentPage + 1, "›", false, contractsCurrentPage === totalPages);
    
    contractsPagination.innerHTML = html;
  };

  // ==========================================
  // 9. GESTIÓN DE DOCUMENTOS (CORREGIDO)
  // ==========================================
  const loadAndRenderDocuments = async (contractId) => {
    try {
        // Nuevos selectores específicos para el modo edición
        const containerContratos = document.getElementById("list-edit-contratos");
        const containerGuias = document.getElementById("list-edit-guias");
        const containerPropuestas = document.getElementById("list-edit-propuestas");
        
        // Si no existen los contenedores (ej: estamos en otra pestaña), salimos
        if (!containerContratos) return;

        // Limpiamos antes de cargar (UI Feedback)
        [containerContratos, containerGuias, containerPropuestas].forEach(el => 
            el.innerHTML = '<div class="text-center py-2 text-muted"><small>Cargando...</small></div>'
        );

        const res = await fetch(`/admin/api/contratos/${contractId}/documentos`);
        const json = await res.json();
        
        if (json.success && json.data) {
            renderDocuments(json.data, { containerContratos, containerGuias, containerPropuestas });
        } else {
            renderDocuments([], { containerContratos, containerGuias, containerPropuestas });
        }
    } catch (err) { 
        console.error("Error cargando documentos:", err); 
    }
  };

  const renderDocuments = (docs, containers) => {
    // Filtramos por tipo
    const contratos = docs.filter(d => d.tipo_documento === "Contrato");
    const guias = docs.filter(d => d.tipo_documento === "Guia");
    const propuestas = docs.filter(d => d.tipo_documento === "Propuesta");

    // Actualizamos los badges (contadores)
    const badgeC = document.getElementById("badge-edit-contratos");
    const badgeG = document.getElementById("badge-edit-guias");
    const badgeP = document.getElementById("badge-edit-propuestas");
    
    if (badgeC) badgeC.textContent = contratos.length;
    if (badgeG) badgeG.textContent = guias.length;
    if (badgeP) badgeP.textContent = propuestas.length;

    // Renderizamos las listas
    createDocumentList(contratos, containers.containerContratos);
    createDocumentList(guias, containers.containerGuias);
    createDocumentList(propuestas, containers.containerPropuestas);
  };

  const createDocumentList = (docArray, container) => {
    container.innerHTML = ""; // Limpiar
    
    if (docArray.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 border border-dashed rounded-2 bg-light">
                <i class="bi bi-folder2-open text-muted mb-2 fs-4 d-block"></i>
                <small class="text-muted">No hay documentos cargados aquí.</small>
            </div>`;
        return;
    }
    
    docArray.forEach((doc) => {
        const div = document.createElement("div");
        div.className = "d-flex align-items-center justify-content-between p-3 border rounded-2 bg-white shadow-sm";
        
        const downloadUrl = `/admin/api/documentos/descargar/${doc.id_documento}`;
        const size = (doc.tamano_bytes / 1024).toFixed(1) + " KB";
        
        // Icono según extensión (simple)
        const icon = doc.nombre_original.endsWith('.pdf') 
            ? '<i class="bi bi-file-earmark-pdf-fill text-danger fs-4"></i>' 
            : '<i class="bi bi-file-earmark-text-fill text-primary fs-4"></i>';

        div.innerHTML = `
            <div class="d-flex align-items-center overflow-hidden">
                <div class="me-3">${icon}</div>
                <div class="overflow-hidden">
                    <div class="fw-semibold text-truncate text-dark" title="${doc.nombre_original}">
                        ${doc.nombre_original}
                    </div>
                    <div class="small text-muted">${size}</div>
                </div>
            </div>
            <div class="d-flex gap-2 ms-3">
                <a href="${downloadUrl}" target="_blank" class="btn btn-light border btn-sm text-primary" title="Descargar">
                    <i class="bi bi-download"></i>
                </a>
                <button type="button" class="btn btn-light border btn-sm text-danger btn-delete-doc" data-doc-id="${doc.id_documento}" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            </div>`;
        
        container.appendChild(div);
    });
  };

 // ==========================================
  // REEMPLAZAR ESTA FUNCIÓN COMPLETA
  // ==========================================
  const handleDeleteDocument = async (e) => {
    // Buscamos si el clic fue en el botón o en el ícono dentro del botón
    const btn = e.target.closest(".btn-delete-doc");
    
    // Si NO se dio clic en un botón de borrar, salimos inmediatamente
    if (!btn) return;

    // Si SÍ fue en el botón, prevenimos cualquier comportamiento extraño
    e.preventDefault();
    e.stopPropagation();

    const docId = btn.dataset.docId;

    // Confirmación y Borrado
    const result = await Swal.fire({
        title: "¿Estás seguro?",
        text: "No podrás revertir esta acción.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (result.isConfirmed) {
        try {
            // Mostramos loading
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;

            const res = await fetch(`/admin/api/documentos/${docId}`, { 
                method: "DELETE",
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken() // Importante para evitar el error CSRF
                }
            });

            const json = await res.json();
            
            if (res.ok) {
                // Recargamos la lista de documentos
                // currentEditId es una variable global que ya tienes en tu código
                await loadAndRenderDocuments(currentEditId);
                
                // Pequeña notificación toast
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({ icon: 'success', title: 'Documento eliminado' });
            } else {
                throw new Error(json.message);
            }
        } catch (err) { 
            console.error(err);
            Swal.fire("Error", "No se pudo eliminar el documento.", "error");
            // Restaurar botón si falló
            btn.innerHTML = '<i class="bi bi-trash"></i>';
            btn.disabled = false;
        }
    }
  };

  // ==========================================
  // 10. IMPORTACIÓN MASIVA
  // ==========================================
  const handleFileRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            
            if (jsonData.length === 0) {
                Swal.fire("Archivo Vacío", "No se encontraron datos.", "warning");
                return;
            }
            bulkData = jsonData;
            bulkCurrentPage = 1;
            renderPreviewTable();
            if (previewSection) previewSection.classList.remove("d-none");
        } catch (err) { console.error(err); Swal.fire("Error", "Archivo inválido", "error"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderPreviewTable = () => {
    if (bulkData.length === 0 || !previewTbody) return;
    const headers = Object.keys(bulkData[0]);
    if (previewThead) previewThead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
    
    const start = (bulkCurrentPage - 1) * bulkRowsPerPage;
    const pageData = bulkData.slice(start, start + bulkRowsPerPage);
    
    previewTbody.innerHTML = pageData.map(row => 
        `<tr>${headers.map(h => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
    ).join("");
    
    if (previewCountBadge) previewCountBadge.textContent = bulkData.length;
    renderPreviewPagination(Math.ceil(bulkData.length / bulkRowsPerPage));
  };

  const renderPreviewPagination = (totalPages) => {
    if (!previewPagination) return;
    previewPagination.innerHTML = "";
    if (totalPages <= 1) return;

    let html = '<ul class="pagination pagination-sm justify-content-end mb-0">';
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === bulkCurrentPage ? "active" : ""}"><button class="page-link" data-page="${i}">${i}</button></li>`;
    }
    html += "</ul>";
    previewPagination.innerHTML = html;
    
    previewPagination.querySelectorAll(".page-link").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            bulkCurrentPage = parseInt(e.target.dataset.page);
            renderPreviewTable();
        });
    });
  };

  const saveBulkData = async () => {
    if (bulkData.length === 0) return;
    const confirm = await Swal.fire({ 
        title: `¿Importar ${bulkData.length} contratos?`, 
        icon: "question", showCancelButton: true, confirmButtonText: "Sí, Importar" 
    });
    
    if (confirm.isConfirmed) {
        if (btnSaveBulk) { btnSaveBulk.disabled = true; btnSaveBulk.innerHTML = "Procesando..."; }
        
        try {
            const res = await fetch("/admin/api/contratos/bulk-insert", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-csrf-token": getCsrfToken() // SEGURIDAD
                },
                body: JSON.stringify({ contracts: bulkData }),
            });
            const json = await res.json();
            
            if (res.ok) {
                await Swal.fire("Éxito", json.message, "success");
                if (previewSection) previewSection.classList.add("d-none");
                if (excelFileInput) excelFileInput.value = "";
                bulkData = [];
                loadContracts();
                listTab.show();
            } else {
                throw new Error(json.message);
            }
        } catch (err) {
            Swal.fire("Error", err.message, "error");
        } finally {
            if (btnSaveBulk) { btnSaveBulk.disabled = false; btnSaveBulk.textContent = "Confirmar e Importar"; }
        }
    }
  };

  // ==========================================
  // 11. EVENT LISTENERS (Configuración General)
  // ==========================================
  // ==========================================
  // REEMPLAZAR ESTA FUNCIÓN COMPLETA
  // ==========================================
  const setupEventListeners = () => {
    // 1. Delegación GLOBAL para el botón de eliminar documentos
    // Esto soluciona el problema de que no funcione en elementos dinámicos
    document.addEventListener("click", handleDeleteDocument);

    // 2. Paginación Lista
    if (contractsPagination) {
        contractsPagination.addEventListener("click", (e) => {
            e.preventDefault();
            const link = e.target.closest(".page-link");
            if (link && !link.parentElement.classList.contains("disabled")) {
                const page = parseInt(link.dataset.page);
                if (page && page !== contractsCurrentPage) {
                    contractsCurrentPage = page;
                    renderContractsTable();
                }
            }
        });
    }

    // 3. Buscador
    if (contractSearchInput) {
        contractSearchInput.addEventListener("keyup", () => {
            contractsCurrentPage = 1;
            renderContractsTable();
        });
    }

    // 4. Formulario
    if (form) form.addEventListener("submit", handleFormSubmit);
    
    if (btnNext) btnNext.addEventListener("click", () => { 
        if(validateStep(currentStep)) { currentStep++; updateWizard(); } 
    });
    
    if (btnPrev) btnPrev.addEventListener("click", () => { 
        currentStep--; updateWizard(); 
    });
    
    if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => { setupFormFor("create"); });


    // 5. Botón Editar en Tabla (Lista)
    if (tableBody) {
        tableBody.addEventListener("click", async (e) => {
            const btn = e.target.closest(".btn-edit");
            if (btn) {
                const id = btn.dataset.id;
                try {
                    const res = await fetch(`/admin/api/contratos/${id}`);
                    const json = await res.json();
                    if (json.success) {
                        await setupFormFor("edit", json.data);
                        formTab.show(); 
                    }
                } catch (err) { console.error(err); }
            }
        });
    }

    // 6. Resetear al cambiar de pestaña
    if (listTabEl) listTabEl.addEventListener("shown.bs.tab", () => setupFormFor("create"));

    // 7. Importación
    if (btnDownloadTemplate) btnDownloadTemplate.addEventListener("click", () => window.location.href = "/admin/api/contratos/template");
    if (excelFileInput) excelFileInput.addEventListener("change", handleFileRead);
    if (btnSaveBulk) btnSaveBulk.addEventListener("click", saveBulkData);
  };

  // Ejecutar
  init();
});