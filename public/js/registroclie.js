document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // 1. SELECTORES
  // ==========================================
  const tbody = document.getElementById("users-body");
  const searchInput = document.getElementById("search-input");
  const companyFilter = document.getElementById("company-filter");
  const paginationContainer = document.getElementById("pagination");
  const btnAddUser = document.getElementById("btn-add-user");

  // Modal Usuario
  const userModalEl = document.getElementById("user-modal");
  const userModal = new bootstrap.Modal(userModalEl);
  const userForm = document.getElementById("user-form");
  const alertContainer = document.getElementById("alert-container");
  const tipoUsuarioSelect = document.getElementById("tipo_usuario");
  const empresasSection = document.getElementById("empresas-section");
  const empresasAsociadasSelect = document.getElementById("empresas_asociadas");
  const empresaPredeterminadaSelect = document.getElementById("id_empresa_predeterminada");
  const modalTitle = document.getElementById("modal-title");

  // Modal Relaciones
  const relationsModalEl = document.getElementById("relations-modal");
  const relationsModal = new bootstrap.Modal(relationsModalEl);
  const relationsModalTitle = document.getElementById("relations-modal-title");
  const networkGraphContainer = document.getElementById('network-graph');
  
  // ==========================================
  // 2. ESTADO
  // ==========================================
  let allCompanies = [];
  let sessions = {};
  let tomSelectEmpresas = null;
  let tomSelectCompanyFilter = null;
  let currentPage = 1;
  let debounceTimer;
  let network = null;
  
  // Estado de Ordenamiento y Datos Locales
  let sortConfig = { column: null, direction: 'asc' };
  let usersData = []; 

  // ==========================================
  // 3. HELPERS
  // ==========================================
  const getCsrfToken = () => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      return meta ? meta.getAttribute('content') : '';
  };

  const showAlert = (msg, type) => {
      alertContainer.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
  };

  // ==========================================
  // 4. INIT
  // ==========================================
  const init = async () => {
      try {
          await loadCompanies();
          // Reintento si TomSelect no cargó por red lenta
          if (typeof TomSelect === 'undefined') {
              setTimeout(init, 500); 
              return;
          }
          await fetchUsersAndSessions();
          setupEventListeners();
      } catch (error) { console.error("Error init:", error); }
  };

  // ==========================================
  // 5. CARGA DE DATOS
  // ==========================================
  const loadCompanies = async () => {
      try {
          const res = await fetch("/admin/api/empresa/lista");
          const json = await res.json();
          if(json.success) {
              allCompanies = json.data || [];
              initializeFilters();
          }
      } catch (err) { console.error("Error empresas:", err); }
  };

  const initializeFilters = () => {
      if (companyFilter && typeof TomSelect !== 'undefined') {
          if(tomSelectCompanyFilter) tomSelectCompanyFilter.destroy();
          
          tomSelectCompanyFilter = new TomSelect(companyFilter, {
              options: [{value: "", text: "Todas las empresas"}, ...allCompanies.map(c => ({ value: c.nombre, text: c.nombre }))],
              items: [""],
              placeholder: "Filtrar por empresa...",
              controlInput: '<input>',
              onChange: () => {
                  currentPage = 1;
                  fetchUsersAndSessions();
              }
          });
      }
  };

  const fetchUsersAndSessions = async () => {
      try {
          const term = searchInput.value;
          const comp = tomSelectCompanyFilter ? tomSelectCompanyFilter.getValue() : companyFilter.value;
          
          const url = `/admin/api/users?page=${currentPage}&search=${term}&company=${comp}`;
          
          const [usersRes, sessionsRes] = await Promise.all([
              fetch(url).then(r => r.json()),
              fetch("/admin/api/users/sessions").then(r => r.json()),
          ]);

          if (!usersRes.success) throw new Error(usersRes.message);

          sessions = sessionsRes.reduce((map, s) => ((map[s.user_id] = s.session_count), map), {});
          usersData = usersRes.data.users; 
          
          applySorting(); 
          renderTable(usersData);
          renderPagination(usersRes.data.totalPages, usersRes.data.currentPage);
      } catch (err) {
          tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">${err.message || 'Error de conexión'}</td></tr>`;
      }
  };

  // ==========================================
  // 6. ORDENAMIENTO
  // ==========================================
  const applySorting = () => {
      if (!sortConfig.column) return;

      usersData.sort((a, b) => {
          let valA = a[sortConfig.column] || '';
          let valB = b[sortConfig.column] || '';

          if (sortConfig.column === 'status') {
             valA = (sessions[a.id_usuario] || 0) > 0 ? 'online' : 'offline';
             valB = (sessions[b.id_usuario] || 0) > 0 ? 'online' : 'offline';
          }

          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  const handleHeaderClick = (columnKey) => {
      if (sortConfig.column === columnKey) {
          sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
          sortConfig.column = columnKey;
          sortConfig.direction = 'asc';
      }
      updateSortIcons(columnKey, sortConfig.direction);
      applySorting();
      renderTable(usersData);
  };

  const updateSortIcons = (column, direction) => {
      document.querySelectorAll('.sortable i').forEach(icon => {
          icon.className = 'bi bi-arrow-down-up ms-1 small text-muted';
      });
      const activeTh = document.querySelector(`th[data-sort="${column}"]`);
      if (activeTh) {
          const icon = activeTh.querySelector('i');
          if (icon) {
              icon.className = direction === 'asc' 
                  ? 'bi bi-sort-alpha-down ms-1 text-primary' 
                  : 'bi bi-sort-alpha-up-alt ms-1 text-primary';
          }
      }
  };

  // ==========================================
  // 7. RENDERIZADO TABLA
  // ==========================================
  const renderTable = (users) => {
      tbody.innerHTML = "";
      if (users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">No se encontraron usuarios.</td></tr>';
          return;
      }

      const getAvatarColor = (name) => {
          const colors = ['#e0e7ff', '#dbeafe', '#d1fae5', '#fef3c7', '#fee2e2'];
          const textColors = ['#4338ca', '#1e40af', '#065f46', '#92400e', '#991b1b'];
          const idx = (name.length + name.charCodeAt(0)) % colors.length;
          return { bg: colors[idx], text: textColors[idx] };
      };

      tbody.innerHTML = users.map((user) => {
          const isOnline = (sessions[user.id_usuario] || 0) > 0;
          const colors = getAvatarColor(user.username);
          const initial = user.nombre ? user.nombre.charAt(0).toUpperCase() : '?';
          const roleBadge = user.tipo_usuario === "Administrador" ? "badge-role role-admin" : "badge-role role-client";
          const statusDot = isOnline ? "status-online" : "status-offline";
          const statusText = isOnline ? "En línea" : "Desconectado";
          const statusColor = isOnline ? "text-success" : "text-muted";

          return `
              <tr>
                  <td class="ps-4">
                      <div class="d-flex align-items-center">
                          <div class="user-avatar" style="background-color: ${colors.bg}; color: ${colors.text}">
                              ${initial}
                          </div>
                          <div>
                              <div class="fw-bold text-dark">${user.nombre || 'Sin Nombre'}</div>
                              <div class="small text-muted">@${user.username}</div>
                          </div>
                      </div>
                  </td>
                  <td>
                      <div class="d-flex align-items-center text-secondary">
                          <i class="bi bi-building me-2"></i>
                          ${user.empresa || 'Sin Empresa'}
                      </div>
                  </td>
                  <td><span class="${roleBadge}">${user.tipo_usuario}</span></td>
                  <td>
                      <div class="d-flex align-items-center">
                          <span class="status-dot ${statusDot}"></span>
                          <span class="small fw-medium ${statusColor}">${statusText}</span>
                      </div>
                  </td>
                  <td class="text-end pe-4">
                      <div class="d-flex justify-content-end gap-1">
                          <button class="btn-icon btn-relations" data-id="${user.id_usuario}" data-name="${user.nombre}" title="Relaciones">
                              <i class="bi bi-diagram-3"></i>
                          </button>
                          <button class="btn-icon btn-edit-pass" data-id="${user.id_usuario}" title="Contraseña">
                              <i class="bi bi-key"></i>
                          </button>
                          ${isOnline ? `<button class="btn-icon text-warning btn-logout" data-id="${user.id_usuario}" title="Desconectar"><i class="bi bi-power"></i></button>` : ""}
                          <button class="btn-icon delete btn-delete" data-id="${user.id_usuario}" title="Eliminar">
                              <i class="bi bi-trash"></i>
                          </button>
                      </div>
                  </td>
              </tr>`;
      }).join("");
  };

  const renderPagination = (totalPages, page) => {
      paginationContainer.innerHTML = "";
      if (totalPages <= 1) return;
      
      let html = `<li class="page-item ${page===1?'disabled':''}"><button class="page-link" data-page="${page-1}">‹</button></li>`;
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);

      for(let i=start; i<=end; i++){
          html += `<li class="page-item ${i===page?'active':''}"><button class="page-link" data-page="${i}">${i}</button></li>`;
      }
      html += `<li class="page-item ${page===totalPages?'disabled':''}"><button class="page-link" data-page="${page+1}">›</button></li>`;
      paginationContainer.innerHTML = html;
  };

  // ==========================================
  // 8. FORMULARIO DE USUARIO
  // ==========================================
  const initializeTomSelectForm = () => {
      if (tomSelectEmpresas) { tomSelectEmpresas.clear(); tomSelectEmpresas.destroy(); }
      if(allCompanies.length === 0) return;

      tomSelectEmpresas = new TomSelect(empresasAsociadasSelect, {
          plugins: ["remove_button"],
          options: allCompanies.map(e => ({ value: e.id_empresa, text: e.nombre })),
          placeholder: "Seleccione empresas...",
          searchField: ['text'],
          onChange: updateDefaultCompanyOptions
      });
  };

  const updateDefaultCompanyOptions = (values) => {
      empresaPredeterminadaSelect.innerHTML = '<option value="" disabled selected>Seleccione principal...</option>';
      if (!values || values.length === 0) return;
      
      const selectedCompanies = allCompanies.filter(c => values.includes(String(c.id_empresa)));
      selectedCompanies.forEach(c => {
          empresaPredeterminadaSelect.add(new Option(c.nombre, c.id_empresa));
      });
      if (selectedCompanies.length === 1) empresaPredeterminadaSelect.value = selectedCompanies[0].id_empresa;
  };

  const toggleEmpresasSection = () => {
      const isClient = tipoUsuarioSelect.value === "Cliente";
      empresasSection.style.display = isClient ? "block" : "none";
      empresaPredeterminadaSelect.required = isClient;
      if(isClient) {
          setTimeout(() => {
             if(!tomSelectEmpresas || Object.keys(tomSelectEmpresas.options).length === 0) initializeTomSelectForm();
          }, 100);
      }
  };

  const handleUserFormSubmit = async (e) => {
      e.preventDefault();
      const payload = {
          tipo_usuario: tipoUsuarioSelect.value,
          username: document.getElementById("username").value.trim(),
          nombres: document.getElementById("nombres").value.trim(),
          password: document.getElementById("password").value,
          empresas_asociadas: tomSelectEmpresas ? tomSelectEmpresas.getValue() : [],
          id_empresa_predeterminada: empresaPredeterminadaSelect.value,
      };

      if (payload.tipo_usuario === "Cliente" && payload.empresas_asociadas.length === 0) {
          showAlert("Debe asociar al menos una empresa al cliente.", "warning");
          return;
      }

      try {
          const res = await fetch("/admin/api/register-user", { 
              method: "POST", 
              headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() }, 
              body: JSON.stringify(payload) 
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.message);
          
          Swal.fire("¡Creado!", "Usuario registrado correctamente.", "success");
          userModal.hide();
          fetchUsersAndSessions();
      } catch (err) { showAlert(err.message, "danger"); }
  };

  // ==========================================
  // 9. ACCIONES (CRUD)
  // ==========================================
  const handleEditPassword = async (id) => {
      const { value: password } = await Swal.fire({
          title: "Cambiar Contraseña",
          input: "password",
          inputLabel: "Nueva contraseña",
          inputPlaceholder: "Ingrese nueva contraseña",
          showCancelButton: true,
          confirmButtonText: "Actualizar",
          inputValidator: (val) => !val && "Campo requerido"
      });

      if (password) {
          try {
              const res = await fetch(`/admin/api/users/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
                  body: JSON.stringify({ password })
              });
              if (res.ok) Swal.fire("Éxito", "Contraseña actualizada", "success");
              else throw new Error();
          } catch (e) { Swal.fire("Error", "No se pudo actualizar", "error"); }
      }
  };

  const handleDelete = (id) => {
      Swal.fire({
          title: "¿Eliminar usuario?",
          text: "Esta acción es irreversible.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc3545",
          confirmButtonText: "Sí, eliminar"
      }).then(async (result) => {
          if (result.isConfirmed) {
              try {
                  await fetch(`/admin/api/users/${id}`, { 
                      method: "DELETE", 
                      headers: { "x-csrf-token": getCsrfToken() } 
                  });
                  Swal.fire("Eliminado", "Usuario eliminado.", "success");
                  fetchUsersAndSessions();
              } catch (e) { Swal.fire("Error", "Falló la eliminación", "error"); }
          }
      });
  };

  const handleLogout = (id) => {
      Swal.fire({
          title: "Cerrar Sesión Remota",
          text: "¿Desconectar a este usuario?",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Desconectar"
      }).then(async (r) => {
          if (r.isConfirmed) {
              try {
                  const res = await fetch(`/admin/api/users/${id}/logout`, { 
                      method: "POST",
                      headers: { "x-csrf-token": getCsrfToken() }
                  });
                  if(res.ok) {
                      Swal.fire("Listo", "Sesión cerrada.", "success");
                      fetchUsersAndSessions();
                  }
              } catch (e) { Swal.fire("Error", "No se pudo desconectar", "error"); }
          }
      });
  };

  // ==========================================
  // 10. GRÁFICO DE RED (RELACIONES)
  // ==========================================
  const handleShowRelations = async (userId, userName) => {
    relationsModalTitle.textContent = `Mapa de Relaciones: ${userName}`;
    networkGraphContainer.innerHTML = '<div class="d-flex flex-column justify-content-center align-items-center h-100 text-muted"><div class="spinner-border text-primary mb-2"></div><small>Cargando...</small></div>';
    relationsModal.show();

    if (network) { try { network.destroy(); } catch (_) {} network = null; }

    try {
        const res = await fetch(`/admin/api/user/${userId}/companies`);
        const result = await res.json();
        
        const userObj = result?.data?.user || null;
        const companies = Array.isArray(result?.data?.related) ? result.data.related : (Array.isArray(result?.data) ? result.data : []);

        if (companies.length === 0) {
            networkGraphContainer.innerHTML = '<div class="d-flex justify-content-center align-items-center h-100 text-muted">Sin relaciones.</div>';
            return;
        }

        const nodes = [{
            id: `u_${userId}`, 
            label: userName, 
            shape: 'circle', 
            color: {background:'#0d6efd', border:'#ffffff'}, 
            font:{color:'#ffffff', size:16, face:'Inter', bold:true},
            borderWidth: 3, shadow:{enabled:true}
        }];
        const edges = [];
        const processedCompanyIds = new Set();

        companies.forEach((c) => {
            const idEmpresa = c.id_empresa || c.id;
            if (!idEmpresa || processedCompanyIds.has(idEmpresa)) return;
            processedCompanyIds.add(idEmpresa);

            const isDef = userObj?.id_empresa_predeterminada == idEmpresa;
            nodes.push({
                id: `c_${idEmpresa}`, 
                label: isDef ? `⭐ ${c.nombre}\n(Principal)` : `🏢 ${c.nombre}`, 
                shape: 'box', 
                color: { background: isDef ? '#fffbeb' : '#ffffff', border: isDef ? '#fbbf24' : '#e2e8f0' },
                font: { color: isDef ? '#92400e' : '#334155', size:14, face:'Inter' },
                shapeProperties: {borderRadius: 8}
            });
            edges.push({ from: `u_${userId}`, to: `c_${idEmpresa}`, color: {color: isDef?'#fbbf24':'#cbd5e1'}, width: isDef?2:1 });
        });

        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        // 3. CONFIGURACIÓN PARA FORMA DE ESTRELLA (RADIAL)
        const options = { 
            layout: {
                hierarchical: false, // IMPORTANTE: Desactivar para que no sea una lista
                randomSeed: 2 // Para que siempre se acomode igual visualmente
            },
            physics: {
                enabled: true,
                solver: 'repulsion', // Algoritmo que empuja los nodos hacia afuera
                repulsion: {
                    nodeDistance: 250, // Distancia entre empresas (aumentar para más espacio)
                    centralGravity: 0.1, // Qué tanto los atrae el centro (bajo = más extendido)
                    springLength: 250, // Longitud de la línea conectora
                    springConstant: 0.05,
                    damping: 0.09
                },
                stabilization: {
                    enabled: true,
                    iterations: 1000, // Calcular la forma antes de mostrarla
                    fit: true
                }
            },
            interaction: {
                hover: true,
                zoomView: true,
                dragView: true
            }
        };
        networkGraphContainer.innerHTML = '';
        network = new vis.Network(networkGraphContainer, data, options);
        network.fit();

    } catch (err) {
        console.error(err);
        networkGraphContainer.innerHTML = '<p class="text-danger text-center p-5">Error al cargar gráfico.</p>';
    }
  };

  // ==========================================
  // 11. EVENT LISTENERS (UNIFICADO)
  // ==========================================
  const setupEventListeners = () => {
      // Add User Button
      btnAddUser.addEventListener("click", () => {
          userForm.reset();
          document.getElementById("password").required = true;
          if(tomSelectEmpresas) tomSelectEmpresas.clear();
          toggleEmpresasSection();
          alertContainer.innerHTML = "";
          if(modalTitle) modalTitle.textContent = "Nuevo Usuario";
          userModal.show();
      });

      // Form & Inputs
      tipoUsuarioSelect.addEventListener("change", toggleEmpresasSection);
      userForm.addEventListener("submit", handleUserFormSubmit);
      
      searchInput.addEventListener("keyup", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => { currentPage = 1; fetchUsersAndSessions(); }, 400);
      });

      // Pagination
      paginationContainer.addEventListener("click", (e) => {
          e.preventDefault();
          const btn = e.target.closest(".page-link");
          if (btn) {
              const p = parseInt(btn.dataset.page);
              if (p && p !== currentPage) { currentPage = p; fetchUsersAndSessions(); }
          }
      });

      // Sorting Headers (Aquí estaba el error antes, ahora está incluido)
      document.querySelectorAll('th.sortable').forEach(th => {
          th.addEventListener('click', () => {
              const column = th.dataset.sort;
              handleHeaderClick(column);
          });
      });

      // Table Actions (Delegation)
      tbody.addEventListener("click", (e) => {
          const btn = e.target.closest("button");
          if (!btn) return;
          const id = btn.dataset.id;
          if (btn.classList.contains("btn-edit-pass")) handleEditPassword(id);
          if (btn.classList.contains("btn-delete")) handleDelete(id);
          if (btn.classList.contains("btn-logout")) handleLogout(id);
          if (btn.classList.contains("btn-relations")) handleShowRelations(id, btn.dataset.name);
      });

      // Graph Modal Fix
      relationsModalEl.addEventListener('shown.bs.modal', () => {
          if (network) { network.redraw(); network.fit({ animation: { duration: 800, easingFunction: "easeInOutQuad" } }); }
      });
  };

  // Start
  init();
});