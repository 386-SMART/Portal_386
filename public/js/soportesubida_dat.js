document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO Y REFERENCIAS GLOBALES ---
    let datosCargados = [];
    let paginaActual = 1;
    const itemsPorPagina = 10;

    const loader = document.getElementById('loader');
    const archivoInput = document.getElementById('archivo-excel-input');
    const resultadoCarga = document.getElementById('resultado-carga');
    const controlesTabla = document.getElementById('controles-tabla');
    const footerTabla = document.getElementById('footer-tabla');
    const tablaCuerpo = document.getElementById('tabla-cuerpo');
    const contadorRegistros = document.getElementById('contador-registros');
    const filtroInput = document.getElementById('filtro-serie');
    const paginacionContainer = document.getElementById('paginacion-container');
    const btnGuardar = document.getElementById('btn-guardar-todo');
    const filtroEstado = document.getElementById('filtro-estado');
    const guiaEmpresa = document.getElementById('guia-empresa');
    const guiaContrato = document.getElementById('guia-contrato');
    const guiaCategoria = document.getElementById('guia-categoria');

    // --- FUNCIÓN DE RENDERIZADO DE TABLA ---
    const renderTabla = () => {
        const filtroTexto = filtroInput.value.toLowerCase();
        const estadoSeleccionado = filtroEstado.value;
        const datosFiltrados = datosCargados.filter(d => {
            const matchSerie = d.num_serie ? d.num_serie.toString().toLowerCase().includes(filtroTexto) : true;
            const matchEstado = (estadoSeleccionado === 'todos') || (d.estado === estadoSeleccionado);
            return matchSerie && matchEstado;
        });

        contadorRegistros.textContent = datosFiltrados.length;
        tablaCuerpo.innerHTML = '';

        const inicio = (paginaActual - 1) * itemsPorPagina;
        const fin = inicio + itemsPorPagina;
        const datosPaginados = datosFiltrados.slice(inicio, fin);

        if (datosPaginados.length === 0) {
            tablaCuerpo.innerHTML = '<tr><td colspan="6" class="text-center">No hay datos que coincidan.</td></tr>';
        } else {
            datosPaginados.forEach(d => {
                const fila = `
                    <tr>
                        <td>${d.id_contrato || ''}</td>
                        <td>${d.id_categoria || ''}</td>
                        <td>${d.marca || ''}</td>
                        <td>${d.modelo || ''}</td>
                        <td>${d.num_serie || ''}</td>
                        <td><span class="badge bg-secondary">${d.estado || 'En Almacén'}</span></td>
                    </tr>
                `;
                tablaCuerpo.innerHTML += fila;
            });
        }
        renderPaginacion(datosFiltrados.length);
    };

    // --- FUNCIÓN DE RENDERIZADO DE PAGINACIÓN ---
    const renderPaginacion = (totalItems) => {
        const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
        paginacionContainer.innerHTML = '';
        if (totalPaginas <= 1) return;

        let paginacionHTML = '<ul class="pagination">';
        const agregarItem = (pagina, texto = pagina, activo = false, deshabilitado = false) => {
            paginacionHTML += `<li class="page-item ${activo ? 'active' : ''} ${deshabilitado ? 'disabled' : ''}"><a class="page-link" href="#" data-page="${pagina}">${texto}</a></li>`;
        };
        
        agregarItem(paginaActual - 1, '&laquo;', false, paginaActual === 1);
        const paginasAMostrar = [];
        if (totalPaginas <= 7) {
            for (let i = 1; i <= totalPaginas; i++) paginasAMostrar.push(i);
        } else {
            paginasAMostrar.push(1);
            if (paginaActual > 3) paginasAMostrar.push('...');
            let inicio = Math.max(2, paginaActual - 1);
            let fin = Math.min(totalPaginas - 1, paginaActual + 1);
            for (let i = inicio; i <= fin; i++) paginasAMostrar.push(i);
            if (paginaActual < totalPaginas - 2) paginasAMostrar.push('...');
            paginasAMostrar.push(totalPaginas);
        }
        paginasAMostrar.forEach(p => {
            if (p === '...') {
                paginacionHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            } else {
                agregarItem(p, p, p === paginaActual);
            }
        });
        agregarItem(paginaActual + 1, '&raquo;', false, paginaActual === totalPaginas);
        paginacionHTML += '</ul>';
        paginacionContainer.innerHTML = paginacionHTML;
    };

    // --- LÓGICA DE LA GUÍA DE IDS ---
    const populateSelect = (select, data, valueField, textField, textPrefix = '') => {
        select.innerHTML = '<option value="">Seleccione...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = `${textPrefix}${item[valueField]} - ${item[textField]}`;
            select.appendChild(option);
        });
    };
    fetch('/admin/api/empresa/lista').then(r => r.json()).then(res => populateSelect(guiaEmpresa, res.data, 'id_empresa', 'nombre', 'ID: '));
    fetch('/admin/api/categorias/lista').then(r => r.json()).then(res => populateSelect(guiaCategoria, res.data, 'id_categoria', 'nombre', 'ID: '));
    guiaEmpresa.addEventListener('change', () => {
        const empresaId = guiaEmpresa.value;
        guiaContrato.disabled = true;
        guiaContrato.innerHTML = '<option>Cargando...</option>';
        if (!empresaId) return;
        fetch(`/admin/api/contratos/empresa/${empresaId}`).then(r => r.json()).then(res => {
            populateSelect(guiaContrato, res.data, 'id_contrato', 'nombre_contrato', 'ID: ');
            guiaContrato.disabled = false;
        });
    });

    // --- MANEJO DE EVENTOS ---
    archivoInput.addEventListener('change', async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;
        loader.classList.remove('d-none');
        const formData = new FormData();
        formData.append('archivoExcel', archivo);
        formData.append('_csrf', document.querySelector('meta[name="csrf-token"]')?.content || '');
        
        console.log('FormData entries:');
        for (let pair of formData.entries()) {
            console.log('  ', pair[0], ':', typeof pair[1]);
        }
        
        try {
            // Usar directamente el endpoint real (sin test)
            const response = await fetch('/admin/soporteti/upload/validate', { method: 'POST', body: formData });
            const result = await response.json();
            
            console.log('Upload result:', result);
            
            if (result.success) {
                datosCargados = result.data;
                console.log('datosCargados after upload:', datosCargados);
                paginaActual = 1;
                resultadoCarga.innerHTML = '';
                resultadoCarga.classList.add('d-none');
                controlesTabla.classList.remove('d-none');
                footerTabla.classList.remove('d-none');
                renderTabla();
            } else {
                Swal.fire('Error de Archivo', result.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error de Conexión', 'No se pudo subir el archivo.', 'error');
            console.error('Upload error:', error);
        } finally {
            loader.classList.add('d-none');
        }
    });

    filtroInput.addEventListener('keyup', () => { paginaActual = 1; renderTabla(); });
    filtroEstado.addEventListener('change', () => { paginaActual = 1; renderTabla(); });

    paginacionContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.parentElement.classList.contains('page-item') && !e.target.parentElement.classList.contains('disabled')) {
            e.preventDefault();
            paginaActual = parseInt(e.target.dataset.page);
            renderTabla();
        }
    });

    // --- INICIO: LÓGICA DE GUARDADO ACTUALIZADA CON SWEETALERT2 ---
    btnGuardar.addEventListener('click', () => {
        if (datosCargados.length === 0) {
            Swal.fire('Atención', 'No hay datos cargados para guardar.', 'warning');
            return;
        }

        Swal.fire({
            title: '¿Confirmar Registro?',
            text: `Estás a punto de registrar ${datosCargados.length} equipos en la tabla temporal. ¿Deseas continuar?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, registrar todo',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                loader.classList.remove('d-none');
                try {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
                    // Crear un array con los datos + token
                    const dataToSend = datosCargados.map(item => ({
                        ...item,
                        _csrf: csrfToken
                    }));
                    
                    console.log('Data to send:', dataToSend);
                    
                    const response = await fetch('/admin/soporteti/temporal-equipos/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToSend)
                    });
                    const saveResult = await response.json();
                    
                    if (saveResult.success) {
                        Swal.fire('¡Éxito!', saveResult.message, 'success');
                        // Resetear UI
                        datosCargados = [];
                        archivoInput.value = '';
                        resultadoCarga.innerHTML = '<div class="alert alert-secondary text-center">Sube un archivo para visualizar los datos aquí.</div>';
                        resultadoCarga.classList.remove('d-none');
                        controlesTabla.classList.add('d-none');
                        footerTabla.classList.add('d-none');
                        tablaCuerpo.innerHTML = '';
                    } else {
                        Swal.fire('Error al Guardar', saveResult.message, 'error');
                    }
                } catch (error) {
                    Swal.fire('Error de Conexión', 'No se pudo completar el registro.', 'error');
                } finally {
                    loader.classList.add('d-none');
                }
            }
        });
    });
    // --- FIN: LÓGICA DE GUARDADO ACTUALIZADA ---
});