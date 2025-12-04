document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS DEL DOM ---
    const loader = document.getElementById('loader');
    const empresaSelect = document.getElementById('empresa-select');
    const contratoSelect = document.getElementById('contrato-select');
    const step2Card = document.getElementById('step-2-card');
    const summaryContainer = document.getElementById('summary-container');
    const actionContainer = document.getElementById('action-container');

    let contratoIdSeleccionado = null;

    // --- FUNCIONES AUXILIARES ---
    const populateSelect = (select, data, valueField, textField) => {
        select.innerHTML = '<option value="">Seleccione...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            select.appendChild(option);
        });
    };

    const resetUI = () => {
        step2Card.classList.add('d-none');
        summaryContainer.innerHTML = '';
        actionContainer.innerHTML = '';
        contratoIdSeleccionado = null;
    };

    // --- CARGA INICIAL (USANDO LA NUEVA API) ---
    fetch('/admin/soporteti/empresas-con-temporales').then(r => r.json()).then(res => {
        if (res.success) {
            populateSelect(empresaSelect, res.data, 'id_empresa', 'nombre');
        }
    });

    // --- MANEJO DE EVENTOS ---
    empresaSelect.addEventListener('change', () => {
        const empresaId = empresaSelect.value;
        contratoSelect.disabled = true;
        contratoSelect.innerHTML = '<option>Cargando...</option>';
        resetUI();

        if (!empresaId) {
            contratoSelect.innerHTML = '<option>Seleccione empresa</option>';
            return;
        }

        // Usar la nueva API para contratos con equipos temporales
        fetch(`/admin/soporteti/contratos-con-temporales/${empresaId}`).then(r => r.json()).then(res => {
            if (res.success) {
                populateSelect(contratoSelect, res.data, 'id_contrato', 'nombre_contrato');
                contratoSelect.disabled = false;
            }
        });
    });

    contratoSelect.addEventListener('change', async () => {
        const contratoId = contratoSelect.value;
        resetUI();
        if (!contratoId) return;

        loader.classList.remove('d-none');
        try {
            const response = await fetch(`/admin/soporteti/temporal-equipos/summary?contratoId=${contratoId}`);
            const result = await response.json();

            if (result.success) {
                step2Card.classList.remove('d-none'); // Mostrar el segundo paso
                const { totalEquipos, resumenPorCategoria } = result.summary;
                contratoIdSeleccionado = contratoId;

                if (totalEquipos === 0) {
                    summaryContainer.innerHTML = '<div class="alert alert-warning">No hay equipos en preparación para este contrato.</div>';
                    return;
                }

                let summaryHTML = `<h4 class="mb-3">Total de Equipos a Migrar: <span class="badge bg-primary fs-4">${totalEquipos}</span></h4>`;
                summaryHTML += '<h6>Desglose por Categoría:</h6>';
                summaryHTML += '<ul class="list-group list-group-flush">';

                resumenPorCategoria.forEach(cat => {
                    summaryHTML += `<li class="list-group-item d-flex justify-content-between align-items-center">${cat.categoria_nombre}<span class="badge bg-dark rounded-pill">${cat.cantidad}</span></li>`;
                });

                summaryHTML += '</ul>';
                summaryContainer.innerHTML = summaryHTML;

                actionContainer.innerHTML = `<button id="btn-migrar" class="btn btn-success btn-lg"><i class="bi bi-check2-circle"></i> Confirmar y Migrar ${totalEquipos} Equipos</button>`;
                document.getElementById('btn-migrar').addEventListener('click', handleMigration);

            } else {
                Swal.fire('Error', result.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error de Conexión', 'No se pudo obtener el resumen.', 'error');
        } finally {
            loader.classList.add('d-none');
        }
    });
    
    const handleMigration = () => {
        if (!contratoIdSeleccionado) return;

        Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción moverá los equipos de la tabla temporal al inventario principal de forma permanente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, ¡migrar ahora!',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                loader.classList.remove('d-none');
                try {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
                    const response = await fetch('/admin/soporteti/equipos/migrate', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            contratoId: contratoIdSeleccionado,
                            _csrf: csrfToken
                        })
                    });
                    const migrationResult = await response.json();

                    if (migrationResult.success) {
                        await Swal.fire('¡Migración Completa!', migrationResult.message, 'success');
                        // Resetear toda la UI para empezar de nuevo
                        empresaSelect.value = '';
                        contratoSelect.innerHTML = '<option>Seleccione empresa</option>';
                        contratoSelect.disabled = true;
                        resetUI();
                        // Opcional: Recargar la lista de empresas por si alguna ya no tiene equipos
                        fetch('/admin/soporteti/empresas-con-temporales').then(r=>r.json()).then(res => populateSelect(empresaSelect,res.data,'id_empresa','nombre'));
                    } else {
                        Swal.fire('Error en la Migración', migrationResult.message, 'error');
                    }
                } catch (error) {
                     Swal.fire('Error de Conexión', 'No se pudo completar la migración.', 'error');
                } finally {
                    loader.classList.add('d-none');
                }
            }
        });
    };
});