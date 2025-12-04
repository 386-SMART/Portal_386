document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('tickets-grid');
    const tvModeBtn = document.getElementById('tv-mode-btn');
    const filterGroup = document.getElementById('status-filter-group');
    
    let allTickets = [];

    // Función para obtener clases de estilo basadas en el color
    const getStyleClasses = (bsColor) => {
        // Mapeo de color bootstrap -> clases CSS personalizadas
        const map = {
            'warning': { border: 'border-warning', badge: 'badge-soft-warning' },
            'danger': { border: 'border-danger', badge: 'badge-soft-danger' },
            'success': { border: 'border-success', badge: 'badge-soft-success' },
            'info': { border: 'border-info', badge: 'badge-soft-info' },
            'primary': { border: 'border-primary', badge: 'badge-soft-primary' },
            'secondary': { border: 'border-secondary', badge: 'badge-soft-secondary' },
            'dark': { border: 'border-secondary', badge: 'badge-soft-secondary' }
        };
        return map[bsColor] || map['primary'];
    };

    const renderTickets = (ticketsToRender) => {
        grid.innerHTML = '';
        if (ticketsToRender.length === 0) {
            grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="text-muted opacity-50 mb-3"><i class="bi bi-folder2-open fs-1"></i></div>
                    <h5 class="text-muted fw-light">No hay tickets con este criterio</h5>
                </div>`;
            return;
        }

        ticketsToRender.forEach(ticket => {
            const estado = ticket.Estado ? ticket.Estado.trim() : 'Sin Estado';
            // Obtenemos las clases visuales según el color que manda el backend
            const styles = getStyleClasses(ticket.status.color); 
            
            const fechaLlegada = ticket.LLegada_de_pieza ? new Date(ticket.LLegada_de_pieza).toLocaleDateString('es-ES', {day:'2-digit', month:'short'}) : '--';
            const fechaDevolucion = ticket.Devolver_pieza ? new Date(ticket.Devolver_pieza).toLocaleDateString('es-ES', {day:'2-digit', month:'short'}) : '--';

            // Alerta visual en la fecha si es rojo (vencido)
            const dateAlertClass = ticket.status.color === 'danger' ? 'text-danger fw-bold' : '';

            const ticketCard = `
                <div class="col-xl-3 col-lg-4 col-md-6">
                    <div class="ticket-card-clean ${styles.border}">
                        <div class="card-body-clean">
                            
                            <div class="ticket-header">
                                <div>
                                    <div class="ticket-code">
                                        ${ticket.Codigo_Aranda || 'S/C'}
                                        <i class="bi bi-files copy-icon ms-2 fs-6" data-text="${ticket.Codigo_Aranda}" title="Copiar"></i>
                                    </div>
                                    <div class="company-text text-truncate" style="max-width: 200px;" title="${ticket.nombre_empresa}">
                                        ${ticket.nombre_empresa || 'Empresa No Registrada'}
                                    </div>
                                </div>
                                <span class="status-badge ${styles.badge}">
                                    ${estado}
                                </span>
                            </div>

                            <div class="mb-3 d-flex align-items-center">
                                <span class="badge bg-light text-secondary border fw-normal me-2">Orden HP</span>
                                <span class="text-dark small font-monospace">${ticket.Hp_Orden_Number || '-'}</span>
                                ${ticket.Hp_Orden_Number ? `<i class="bi bi-copy copy-icon ms-2 small" data-text="${ticket.Hp_Orden_Number}"></i>` : ''}
                            </div>

                            <div class="info-grid">
                                <div>
                                    <span class="info-label">Llegada Pieza</span>
                                    <div class="info-value"><i class="bi bi-box-seam me-1 text-primary opacity-50"></i>${fechaLlegada}</div>
                                </div>
                                <div>
                                    <span class="info-label">Devolución</span>
                                    <div class="info-value ${dateAlertClass}"><i class="bi bi-calendar-check me-1 text-primary opacity-50"></i>${fechaDevolucion}</div>
                                </div>
                            </div>

                            <a href="/admin/casti/actualizar-ticket?ticket=${encodeURIComponent(ticket.Codigo_Aranda || '')}" class="btn btn-action">
                                Gestionar Ticket
                            </a>
                        </div>
                    </div>
                </div>`;
            grid.insertAdjacentHTML('beforeend', ticketCard);
        });
    };
    
    // --- Lógica de Filtros (Sin cambios) ---
    const applyFilter = () => {
        const statusCheckboxes = filterGroup.querySelectorAll('.status-filter:checked');
        const selectedStatuses = Array.from(statusCheckboxes).map(cb => cb.dataset.status);

        if (selectedStatuses.length === 0 || document.getElementById('status-all').checked) {
            renderTickets(allTickets);
        } else {
            const filteredTickets = allTickets.filter(ticket => selectedStatuses.includes(ticket.status.text));
            renderTickets(filteredTickets);
        }
    };
    
    const loadTickets = async () => {
        grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary" role="status"></div></div>';
        try {
            const response = await fetch('/admin/casti/all-tickets-status');
            const result = await response.json();
            if (result.success) {
                allTickets = result.data;
                applyFilter();
            }
        } catch (error) { console.error(error); }
    };

    // Event Listeners
    filterGroup.addEventListener('change', (e) => {
        const checkAll = document.getElementById('status-all');
        const statusFilters = filterGroup.querySelectorAll('.status-filter');
        
        if (e.target.id === 'status-all' && e.target.checked) {
            statusFilters.forEach(cb => cb.checked = false);
        } else if (e.target.classList.contains('status-filter')) {
            checkAll.checked = false;
        }
        if (filterGroup.querySelectorAll('.status-filter:checked').length === 0) {
            checkAll.checked = true;
        }
        applyFilter();
    });

    grid.addEventListener('click', e => {
        const copyIcon = e.target.closest('.copy-icon');
        if (copyIcon) {
            navigator.clipboard.writeText(copyIcon.dataset.text).then(() => {
                const Toast = Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 1500
                });
                Toast.fire({ icon: 'success', title: 'Copiado' });
            });
        }
    });

    if (tvModeBtn) tvModeBtn.addEventListener('click', () => window.open('/admin/casti/vistas-tickets-tv', '_blank'));

    loadTickets();
});