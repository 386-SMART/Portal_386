document.addEventListener('DOMContentLoaded', () => {
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // Referencias
    const ticketSection = document.getElementById('ticket-management-section');
    const mainListCard = document.getElementById('main-list-card'); // Nueva referencia para ocultar la lista
    const tablaTickets = document.getElementById('tabla-tickets');
    const paginacionContainer = document.getElementById('paginacion-container');
    const filtroEmpresa = document.getElementById('filtro-empresa');
    const filtroSerie = document.getElementById('filtro-serie');
    const filtroTicket = document.getElementById('filtro-ticket');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimpiar = document.getElementById('btn-limpiar');
    const btnCerrarEdicion = document.getElementById('btn-cerrar-edicion');
    const btnEliminarTicket = document.getElementById('btn-eliminar-ticket');
    
    // Formularios
    const formInfoBasica = document.getElementById('form-info-basica');
    const formFechas = document.getElementById('form-update-fechas');
    
    let currentTicketId = null;
    let currentPage = 1;
    let currentFilters = {};

    // ===== CARGAR LISTA DE TICKETS =====
    const cargarTickets = async (page = 1) => {
        // Spinner loading
        tablaTickets.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><div class="spinner-border text-primary spinner-border-sm me-2"></div>Cargando tickets...</td></tr>';

        try {
            const params = new URLSearchParams({ page, ...currentFilters });
            const response = await fetch(`/admin/casti/casti-tickets/lista?${params}`);
            const result = await response.json();

            if (result.success) {
                renderizarTabla(result.data);
                renderizarPaginacion(result.pagination);
            }
        } catch (error) {
            console.error('Error al cargar tickets:', error);
            tablaTickets.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4"><i class="bi bi-exclamation-circle me-2"></i>Error al cargar tickets</td></tr>';
        }
    };

    const renderizarTabla = (tickets) => {
        tablaTickets.innerHTML = '';
        if (tickets.length === 0) {
            tablaTickets.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">No se encontraron tickets registrados.</td></tr>';
            return;
        }

        tickets.forEach(ticket => {
            const estadoBadge = obtenerBadgeEstado(ticket.Estado);
            const fechaFormat = ticket.Fecha_Pedido ? new Date(ticket.Fecha_Pedido).toLocaleDateString('es-ES') : '<span class="text-muted fst-italic">--</span>';
            
            const row = `
                <tr>
                    <td class="fw-bold text-primary">${ticket.Codigo_Aranda || '<span class="text-muted">N/A</span>'}</td>
                    <td class="font-monospace text-dark">${ticket.Numero_serie || 'N/A'}</td>
                    <td>${ticket.empresa_nombre || 'N/A'}</td>
                    <td>${fechaFormat}</td>
                    <td>${estadoBadge}</td>
                    <td>${ticket.Tipo_garantia || 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-editar px-3" data-id="${ticket.Id_cass}">
                            <i class="bi bi-pencil-square"></i> Editar
                        </button>
                    </td>
                </tr>
            `;
            tablaTickets.insertAdjacentHTML('beforeend', row);
        });

        // Event listeners para botones editar
        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                cargarDetalleTicket(id);
            });
        });
    };

    const obtenerBadgeEstado = (estado) => {
        // Clases actualizadas para Bootstrap 5 sutiles
        const badges = {
            'Pendiente': 'badge bg-warning text-dark bg-opacity-25 border border-warning',
            'En Proceso': 'badge bg-info text-dark bg-opacity-25 border border-info',
            'Completado': 'badge bg-success bg-opacity-75',
            'Cancelado': 'badge bg-danger bg-opacity-75',
            'Pedido': 'badge bg-primary bg-opacity-25 text-primary border border-primary',
            'Recibido': 'badge bg-success bg-opacity-25 text-success border border-success'
        };
        // Fallback default
        const className = badges[estado] || 'badge bg-secondary bg-opacity-25 text-secondary border';
        return `<span class="${className} badge-status rounded-pill">${estado || 'Sin Estado'}</span>`;
    };

    const renderizarPaginacion = (pagination) => {
        if (pagination.totalPages <= 1) {
            paginacionContainer.innerHTML = '';
            return;
        }

        let html = '<ul class="pagination pagination-sm justify-content-center mb-0">';
        
        // Anterior
        html += `<li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link border-0 rounded-start-pill px-3" href="#" data-page="${pagination.currentPage - 1}">Anterior</a>
        </li>`;
        
        // Números
        for (let i = 1; i <= pagination.totalPages; i++) {
            if (i === 1 || i === pagination.totalPages || (i >= pagination.currentPage - 2 && i <= pagination.currentPage + 2)) {
                const activeClass = i === pagination.currentPage ? 'active fw-bold' : '';
                html += `<li class="page-item ${activeClass}">
                    <a class="page-link border-0 mx-1 rounded" href="#" data-page="${i}">${i}</a>
                </li>`;
            } else if (i === pagination.currentPage - 3 || i === pagination.currentPage + 3) {
                html += '<li class="page-item disabled"><span class="page-link border-0">...</span></li>';
            }
        }
        
        // Siguiente
        html += `<li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
            <a class="page-link border-0 rounded-end-pill px-3" href="#" data-page="${pagination.currentPage + 1}">Siguiente</a>
        </li>`;
        
        html += '</ul>';
        paginacionContainer.innerHTML = html;

        // Event listeners
        paginacionContainer.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                if (page && page >= 1 && page <= pagination.totalPages) {
                    currentPage = page;
                    cargarTickets(page);
                }
            });
        });
    };

    // ===== CARGAR DETALLE DE TICKET =====
    const cargarDetalleTicket = async (ticketId) => {
        try {
            const response = await fetch(`/admin/casti/casti-tickets/${ticketId}`);
            const result = await response.json();

            if (result.success) {
                currentTicketId = ticketId;
                const ticket = result.data;
                
                // Actualizar título
                document.getElementById('ticket-code-display').textContent = ticket.Codigo_Aranda || ticket.Numero_serie;
                
                // Cargar información básica
                document.getElementById('hp-orden').value = ticket.Hp_Orden_Number || '';
                document.getElementById('numero-pedido').value = ticket.Numero_Pedido || '';
                document.getElementById('tipo-garantia').value = ticket.Tipo_garantia || '';
                document.getElementById('estado-ticket').value = ticket.Estado || 'Pedido';
                document.getElementById('observaciones').value = ticket.Observaciones || '';
                
                // Actualizar contador de caracteres
                const contadorObs = document.getElementById('contador-observaciones');
                if (contadorObs) {
                    contadorObs.textContent = (ticket.Observaciones || '').length;
                }
                
                // Cargar fechas
                document.getElementById('llegada-pieza').value = ticket.LLegada_de_pieza ? ticket.LLegada_de_pieza.split('T')[0] : '';
                document.getElementById('devolver-pieza').value = ticket.Devolver_pieza ? ticket.Devolver_pieza.split('T')[0] : '';
                document.getElementById('erdt').value = ticket.ERDT ? ticket.ERDT.split('T')[0] : '';
                document.getElementById('ticket-erdt').value = ticket.Ticket_ERDT || '';
                document.getElementById('claim').value = ticket.Claim ? ticket.Claim.split('T')[0] : '';
                document.getElementById('ticket-claim').value = ticket.Ticket_Claim || '';
                
                // Cargar piezas
                renderPiezasTable(ticket.piezas_nuevas, 'tabla-piezas-nuevas');
                renderPiezasTable(ticket.piezas_dañadas, 'tabla-piezas-dañadas');
                
                // Interacción Visual: Ocultar lista, mostrar edición
                if(mainListCard) mainListCard.classList.add('d-none');
                ticketSection.classList.remove('d-none');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error al cargar detalle:', error);
            Swal.fire('Error', 'No se pudo cargar el detalle del ticket', 'error');
        }
    };

    const renderPiezasTable = (piezas, tableId) => {
        const tbody = document.getElementById(tableId);
        tbody.innerHTML = '';
        if (piezas && piezas.length > 0) {
            piezas.forEach(p => {
                tbody.innerHTML += `<tr><td class="font-monospace">${p.part_number}</td><td>${p.descripcion}</td><td>${p.ct}</td></tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted small py-2">No hay piezas registradas en esta sección.</td></tr>';
        }
    };

    // ===== GUARDAR INFORMACIÓN BÁSICA =====
    formInfoBasica.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            Hp_Orden_Number: document.getElementById('hp-orden').value.trim() || null,
            Numero_Pedido: document.getElementById('numero-pedido').value.trim() || null,
            Tipo_garantia: document.getElementById('tipo-garantia').value || null,
            Estado: document.getElementById('estado-ticket').value || null,
            Observaciones: document.getElementById('observaciones').value.trim() || null
        };

        try {
            const response = await fetch(`/admin/casti/casti-tickets/${currentTicketId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            Swal.fire({
                title: response.ok ? 'Guardado' : 'Error',
                text: result.message,
                icon: response.ok ? 'success' : 'error',
                confirmButtonColor: '#0d6efd'
            });
            
            if (response.ok) {
                cargarTickets(currentPage); // Recargar lista en background
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al guardar', 'error');
        }
    });

    // ===== GUARDAR FECHAS =====
    formFechas.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            LLegada_de_pieza: document.getElementById('llegada-pieza').value || null,
            Devolver_pieza: document.getElementById('devolver-pieza').value || null,
            ERDT: document.getElementById('erdt').value || null,
            Ticket_ERDT: document.getElementById('ticket-erdt').value.trim() || null,
            Claim: document.getElementById('claim').value || null,
            Ticket_Claim: document.getElementById('ticket-claim').value.trim() || null
        };

        // Si hay ERDT, sobreescribe la fecha de devolución
        if (data.ERDT) data.Devolver_pieza = data.ERDT;

        try {
            const response = await fetch(`/admin/casti/casti-tickets/${currentTicketId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            Swal.fire({
                title: response.ok ? 'Actualizado' : 'Error',
                text: result.message,
                icon: response.ok ? 'success' : 'error',
                confirmButtonColor: '#0d6efd'
            });
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al guardar fechas', 'error');
        }
    });

    // ===== AÑADIR PIEZAS =====
    document.querySelectorAll('#nav-nuevas form, #nav-dañadas form').forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            const body = {
                id_cass: currentTicketId,
                tipo_pieza: form.dataset.tipoPieza,
                ...data
            };

            const response = await fetch('/admin/casti/casti-piezas', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(body)
            });
            const result = await response.json();

            if (response.ok) {
                form.reset();
                cargarDetalleTicket(currentTicketId);
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                Toast.fire({ icon: 'success', title: 'Pieza agregada correctamente' });
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        });
    });

    // ===== ELIMINAR TICKET =====
    btnEliminarTicket.addEventListener('click', async () => {
        const confirmacion = await Swal.fire({
            title: '¿Eliminar Ticket?',
            text: 'Esta acción eliminará el ticket y todas sus piezas asociadas. No se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            focusCancel: true
        });

        if (!confirmacion.isConfirmed) return;

        try {
            const response = await fetch(`/admin/casti/casti-tickets/${currentTicketId}`, {
                method: 'DELETE',
                headers: { 'x-csrf-token': getCsrfToken() }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                Swal.fire('Eliminado', result.message, 'success');
                ticketSection.classList.add('d-none');
                if(mainListCard) mainListCard.classList.remove('d-none');
                currentTicketId = null;
                cargarTickets(currentPage);
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Error al eliminar el ticket', 'error');
        }
    });

    // ===== CALCULAR FECHA DE DEVOLUCIÓN =====
    document.getElementById('llegada-pieza').addEventListener('change', () => {
        const llegada = document.getElementById('llegada-pieza').value;
        if (!llegada) {
            document.getElementById('devolver-pieza').value = '';
            return;
        }
        const dateParts = llegada.split('-');
        const llegadaDate = new Date(Date.UTC(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]));
        llegadaDate.setUTCDate(llegadaDate.getUTCDate() + 6);
        const dayOfWeek = llegadaDate.getUTCDay();
        if (dayOfWeek === 6) llegadaDate.setUTCDate(llegadaDate.getUTCDate() + 2);
        else if (dayOfWeek === 0) llegadaDate.setUTCDate(llegadaDate.getUTCDate() + 1);
        document.getElementById('devolver-pieza').value = llegadaDate.toISOString().split('T')[0];
    });

    // ===== FILTROS =====
    const aplicarFiltro = () => {
        currentFilters = {};
        if (filtroEmpresa.value) currentFilters.empresa = filtroEmpresa.value;
        if (filtroSerie.value) currentFilters.serie = filtroSerie.value;
        if (filtroTicket.value) currentFilters.ticket = filtroTicket.value;
        currentPage = 1;
        cargarTickets(1);
    };

    btnFiltrar.addEventListener('click', aplicarFiltro);

    btnLimpiar.addEventListener('click', () => {
        filtroEmpresa.value = '';
        filtroSerie.value = '';
        filtroTicket.value = '';
        currentFilters = {};
        currentPage = 1;
        cargarTickets(1);
    });

    // Cerrar edición y volver a la lista
    btnCerrarEdicion.addEventListener('click', () => {
        ticketSection.classList.add('d-none');
        if(mainListCard) mainListCard.classList.remove('d-none');
        currentTicketId = null;
    });

    // ===== CARGAR EMPRESAS =====
    const cargarEmpresas = async () => {
        try {
            const response = await fetch('/admin/casti/empresas-tickets');
            const result = await response.json();
            if (result.success) {
                // Mantener la opción default
                filtroEmpresa.innerHTML = '<option value="">Todas las empresas</option>'; 
                result.data.forEach(emp => {
                    filtroEmpresa.innerHTML += `<option value="${emp.id_empresa}">${emp.nombre}</option>`;
                });
            }
        } catch (error) {
            console.error('Error al cargar empresas:', error);
        }
    };

    // INICIALIZACIÓN
    cargarEmpresas();
    
    // Verificar si hay parámetro 'ticket' en la URL
    const urlParams = new URLSearchParams(window.location.search);
    const ticketParam = urlParams.get('ticket');
    
    if (ticketParam) {
        // Si hay parámetro, pre-llenar el filtro y ejecutar búsqueda automáticamente
        filtroTicket.value = ticketParam;
        
        // Llamar directamente a la función de filtrado
        setTimeout(() => {
            aplicarFiltro();
        }, 100);
    } else {
        // Si no hay parámetro, cargar todos los tickets
        cargarTickets(1);
    }
});