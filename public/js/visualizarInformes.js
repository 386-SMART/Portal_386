document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos que SÍ existen en esta página
    const filtroEmpresa = document.getElementById('filtroEmpresa');
    const tablaInformes = document.getElementById('tabla-informes');
    const ticketSearchInput = document.getElementById('ticketSearchInput');
    const btnBuscarFotos = document.getElementById('btnBuscarFotos');
    const fotosContainer = document.getElementById('fotos-container');
    const fotosModal = new bootstrap.Modal(document.getElementById('fotosModal'));
    const informeModal = new bootstrap.Modal(document.getElementById('informeModal'));
    const modalBody = document.getElementById('modal-body-content');

    let todosLosInformes = [];
    let paginaActual = 1;
    const informesPorPagina = 20;

    // Función para formatear fecha sin cambio de zona horaria
    const formatearFecha = (fecha) => {
        if (!fecha) return 'N/A';
        const partes = fecha.split('T')[0].split('-');
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // DD/MM/YYYY
    };

    // Cargar el filtro de empresas
    fetch('/admin/api/empresa/lista').then(res => res.json()).then(result => {
        if (result.success) {
            result.data.forEach(empresa => {
                filtroEmpresa.innerHTML += `<option value="${empresa.nombre}">${empresa.nombre}</option>`;
            });
        }
    });

    // Cargar todos los informes
    const cargarInformes = () => {
        fetch('/admin/api/informes-de-campo?page=1&limit=9999')
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    todosLosInformes = result.data;
                    renderizarTabla(todosLosInformes);
                }
            });
    };

    const renderizarTabla = (informes) => {
        tablaInformes.innerHTML = '';
        
        // Calcular el rango de informes para la página actual
        const inicio = (paginaActual - 1) * informesPorPagina;
        const fin = inicio + informesPorPagina;
        const informesPaginados = informes.slice(inicio, fin);
        
        if (informesPaginados && informesPaginados.length > 0) {
            informesPaginados.forEach(informe => {
                tablaInformes.innerHTML += `
                    <tr>
                        <td>${formatearFecha(informe.fecha_servicio)}</td>
                        <td>${informe.empresa_nombre || 'N/A'}</td>
                        <td>${informe.Codigo_Aranda || 'N/A'}</td>
                        <td>${informe.num_serie || 'N/A'}</td>
                        <td>${informe.tecnico_nombre} ${informe.tecnico_apellido}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-primary btn-ver" data-id="${informe.id_informe}">
                                <i class="bi bi-eye"></i> Ver
                            </button>
                            <a href="/admin/api/informes-de-campo/${informe.id_informe}/pdf" class="btn btn-sm btn-danger" target="_blank">
                                <i class="bi bi-file-pdf"></i> PDF
                            </a>
                        </td>
                    </tr>`;
            });
        } else {
            tablaInformes.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron informes.</td></tr>';
        }
        
        // Renderizar paginación
        renderizarPaginacion(informes.length);
    };

    const renderizarPaginacion = (totalInformes) => {
        const totalPaginas = Math.ceil(totalInformes / informesPorPagina);
        let paginacionHTML = document.getElementById('paginacion-container');
        
        if (!paginacionHTML) {
            // Crear el contenedor de paginación si no existe
            const tabla = document.querySelector('.table-responsive');
            paginacionHTML = document.createElement('div');
            paginacionHTML.id = 'paginacion-container';
            paginacionHTML.className = 'd-flex justify-content-between align-items-center mt-3';
            tabla.after(paginacionHTML);
        }
        
        if (totalPaginas <= 1) {
            paginacionHTML.innerHTML = '';
            return;
        }
        
        let paginacionButtons = '<nav><ul class="pagination pagination-sm mb-0">';
        
        // Botón Anterior
        paginacionButtons += `<li class="page-item ${paginaActual === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${paginaActual - 1}">Anterior</a>
        </li>`;
        
        // Páginas numeradas
        for (let i = 1; i <= totalPaginas; i++) {
            if (i === 1 || i === totalPaginas || (i >= paginaActual - 2 && i <= paginaActual + 2)) {
                paginacionButtons += `<li class="page-item ${i === paginaActual ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>`;
            } else if (i === paginaActual - 3 || i === paginaActual + 3) {
                paginacionButtons += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            }
        }
        
        // Botón Siguiente
        paginacionButtons += `<li class="page-item ${paginaActual === totalPaginas ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${paginaActual + 1}">Siguiente</a>
        </li>`;
        
        paginacionButtons += '</ul></nav>';
        
        // Información de resultados
        const inicio = (paginaActual - 1) * informesPorPagina + 1;
        const fin = Math.min(paginaActual * informesPorPagina, totalInformes);
        const infoHTML = `<small class="text-muted">Mostrando ${inicio}-${fin} de ${totalInformes} informes</small>`;
        
        paginacionHTML.innerHTML = infoHTML + paginacionButtons;
        
        // Event listeners para los botones de paginación
        paginacionHTML.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const nuevaPagina = parseInt(e.target.dataset.page);
                if (nuevaPagina && nuevaPagina !== paginaActual && nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
                    paginaActual = nuevaPagina;
                    renderizarTabla(filtroEmpresa.value ? 
                        todosLosInformes.filter(informe => informe.empresa_nombre === filtroEmpresa.value) : 
                        todosLosInformes
                    );
                    // Scroll suave al inicio de la tabla
                    document.querySelector('.table-responsive').scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    };

    filtroEmpresa.addEventListener('change', () => {
        paginaActual = 1; // Resetear a la primera página al filtrar
        const empresaSeleccionada = filtroEmpresa.value;
        if (empresaSeleccionada) {
            const informesFiltrados = todosLosInformes.filter(informe => informe.empresa_nombre === empresaSeleccionada);
            renderizarTabla(informesFiltrados);
        } else {
            renderizarTabla(todosLosInformes);
        }
    });

    btnBuscarFotos.addEventListener('click', async () => {
        const codigoTicket = ticketSearchInput.value.trim();
        if (!codigoTicket) {
            alert('Por favor ingrese un código de ticket');
            return;
        }
        
        const response = await fetch(`/admin/casti/fotos-por-ticket/${codigoTicket}`);
        const result = await response.json();
        
        fotosContainer.innerHTML = '';
        if (result.success && result.data.length > 0) {
            document.getElementById('fotosModalLabel').textContent = `Fotos del Ticket: ${codigoTicket}`;
            result.data.forEach((foto, index) => {
                fotosContainer.innerHTML += `
                    <div class="col-lg-3 col-md-4 col-6">
                        <a href="${foto.ruta_archivo}" data-lightbox="galeria-ticket-${codigoTicket}" data-title="Foto ${index + 1}">
                            <img src="${foto.ruta_archivo}" class="img-fluid img-thumbnail" style="height: 200px; width: 100%; object-fit: cover;">
                        </a>
                    </div>`;
            });
            fotosModal.show();
        } else {
            alert('No se encontraron fotos para este ticket.');
        }
    });

    tablaInformes.addEventListener('click', async (e) => {
        const target = e.target.closest('.btn-ver');
        if (target) {
            const id = target.dataset.id;
            modalBody.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div></div>';
            informeModal.show();
            
            const response = await fetch(`/admin/api/informes-de-campo/${id}`);
            const result = await response.json();
            
            if (result.success) {
                const informe = result.data;
                const firmante = informe.firmante || {};
                let fotosHTML = '';
                
                if (informe.fotos && informe.fotos.length > 0) {
                    fotosHTML += '<h6 class="mt-3"><i class="bi bi-images"></i> Fotos del Servicio:</h6><div class="row g-2">';
                    informe.fotos.forEach((foto, index) => {
                        fotosHTML += `
                            <div class="col-md-4 col-6">
                                <a href="${foto.ruta_archivo}" data-lightbox="informe-${id}" data-title="Foto ${index + 1}">
                                    <img src="${foto.ruta_archivo}" class="img-fluid img-thumbnail" style="height: 150px; width: 100%; object-fit: cover; cursor: pointer;">
                                </a>
                            </div>`;
                    });
                    fotosHTML += '</div>';
                }
                
                modalBody.innerHTML = `
                    <div class="report-preview">
                        <div class="report-header mb-3">CONSTANCIA DE VISITA TÉCNICA</div>
                        
                        <div class="report-section">
                            <div class="report-section-title">DATOS DEL CLIENTE</div>
                            <div class="report-body">
                                <div class="report-field"><label>Cliente:</label><span>${informe.empresa_nombre || 'N/A'}</span></div>
                                <div class="report-field"><label>Contrato:</label><span>${informe.nombre_contrato || 'N/A'}</span></div>
                                <div class="report-field"><label>Usuario:</label><span>${informe.usuario_cliente_manual || 'N/A'}</span></div>
                                <div class="report-field"><label>Dirección:</label><span>${informe.direccion_manual || 'N/A'}</span></div>
                                <div class="report-field"><label>Sede:</label><span>${informe.sede_manual || 'N/A'}</span></div>
                            </div>
                        </div>
                        
                        <div class="report-section">
                            <div class="report-section-title">INFORMACIÓN DEL EQUIPO</div>
                            <div class="report-body">
                                <div class="report-field"><label>Modelo:</label><span>${informe.modelo || 'N/A'}</span></div>
                                <div class="report-field"><label>Serie:</label><span>${informe.num_serie || 'N/A'}</span></div>
                                <div class="report-field"><label>Product Number:</label><span>${informe.product_number || 'N/A'}</span></div>
                            </div>
                        </div>
                        
                        <div class="report-section">
                            <div class="report-section-title">DIAGNÓSTICO</div>
                            <div class="report-body">
                                <div class="report-field"><label>Ticket:</label><span>${informe.Codigo_Aranda || 'N/A'}</span></div>
                                <div class="report-field"><label>Fecha Servicio:</label><span>${formatearFecha(informe.fecha_servicio)}</span></div>
                                <div class="report-field"><label>Técnico:</label><span>${informe.tecnico_nombre} ${informe.tecnico_apellido}</span></div>
                            </div>
                        </div>
                        
                        <div class="report-section">
                            <div class="report-section-title">CONFORMIDAD</div>
                            <div class="report-body">
                                <div class="row text-center">
                                    <div class="col-md-6 mb-3">
                                        <strong>Firma Usuario</strong><br>
                                        <small class="text-muted">(${informe.firmante_type === 'Client_Ti' ? 'Personal TI' : 'Usuario Final'})</small>
                                        <div class="mt-2">
                                            <img src="${informe.firma_usuario}" class="img-fluid bg-white border p-2" style="max-height: 150px;">
                                        </div>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <strong>Firma Técnico</strong><br>
                                        <small class="text-muted">${informe.tecnico_nombre} ${informe.tecnico_apellido}</small>
                                        <div class="mt-2">
                                            <img src="${informe.firma_tecnico}" class="img-fluid bg-white border p-2" style="max-height: 150px;">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${fotosHTML}
                    </div>`;
            } else {
                modalBody.innerHTML = '<div class="alert alert-danger">Error al cargar los detalles del informe.</div>';
            }
        }
    });

    cargarInformes();
});