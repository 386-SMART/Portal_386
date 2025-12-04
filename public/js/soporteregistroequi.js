document.addEventListener('DOMContentLoaded', () => {
    // Referencias a los elementos del formulario
    const empresaSelect = document.getElementById('empresa-select');
    const contratoSelect = document.getElementById('contrato-select');
    const categoriaSelect = document.getElementById('categoria-select');
    const form = document.getElementById('form-registrar-equipo');
    const messageContainer = document.getElementById('form-message');

    // --- FUNCIÓN PARA MOSTRAR MENSAJES ESTILIZADOS ---
    const showMessage = (message, type = 'danger') => {
        // Crea la alerta de Bootstrap dinámicamente
        const alertHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        messageContainer.innerHTML = alertHTML;

        // Opcional: hacer que la alerta desaparezca sola después de 5 segundos
        setTimeout(() => {
            const alertElement = messageContainer.querySelector('.alert');
            if (alertElement) {
                // Usamos el objeto de Bootstrap para cerrarla con la animación correcta
                new bootstrap.Alert(alertElement).close();
            }
        }, 5000);
    };

    // --- CARGA INICIAL DE DATOS ---
    const populateSelect = (selectElement, data, valueField, textField) => {
        selectElement.innerHTML = `<option value="">Seleccione una opción</option>`;
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectElement.appendChild(option);
        });
    };

    fetch('/admin/api/empresa/lista')
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                populateSelect(empresaSelect, response.data, 'id_empresa', 'nombre');
            }
        });

    fetch('/admin/api/categorias/lista')
        .then(res => res.json())
        .then(response => {
            if (response.success) {
                populateSelect(categoriaSelect, response.data, 'id_categoria', 'nombre');
            }
        });

    // --- LÓGICA DE EVENTOS ---
    empresaSelect.addEventListener('change', () => {
        const empresaId = empresaSelect.value;
        contratoSelect.innerHTML = '<option value="">Cargando contratos...</option>';
        contratoSelect.disabled = true;

        if (!empresaId) {
            contratoSelect.innerHTML = '<option value="">Seleccione una empresa primero</option>';
            return;
        }

        fetch(`/admin/api/contratos/empresa/${empresaId}`)
            .then(res => res.json())
            .then(response => {
                if (response.success) {
                    populateSelect(contratoSelect, response.data, 'id_contrato', 'nombre_contrato');
                    contratoSelect.disabled = false;
                }
            });
    });

    // --- ENVÍO DEL FORMULARIO ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Limpiar mensajes anteriores
        messageContainer.innerHTML = '';
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.id_contrato = contratoSelect.value;
        data._csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';

        try {
            const response = await fetch('/admin/soporteti/temporal-equipos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                // Reemplazamos alert() por nuestra nueva función
                showMessage('¡Equipo registrado en la tabla temporal con éxito! ✅', 'success');
                form.reset();
                contratoSelect.innerHTML = '<option value="">Seleccione una empresa primero</option>';
                contratoSelect.disabled = true;
            } else {
                // Reemplazamos alert() por nuestra nueva función
                showMessage(`Error: ${result.message}`, 'danger');
            }
        } catch (error) {
            // Reemplazamos alert() por nuestra nueva función
            showMessage('Ocurrió un error de conexión. Inténtalo de nuevo.', 'danger');
            console.error(error);
        }
    });
});