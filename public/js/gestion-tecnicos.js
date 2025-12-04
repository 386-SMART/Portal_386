document.addEventListener('DOMContentLoaded', () => {
    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    const API_TECNICOS = '/admin/soporteti/tecnicos';
    const API_USUARIOS = '/admin/soporteti/usuarios-cliente';
    
    // ==================== SECCIÓN: TÉCNICOS ====================
    
    // Referencias a elementos del DOM - TÉCNICOS
    const tableBodyTecnicos = document.getElementById('tecnicos-table-body');
    const formTecnico = document.getElementById('form-tecnico');
    const tecnicoIdInput = document.getElementById('tecnico-id');
    const nombreInput = document.getElementById('nombre');
    const apellidoInput = document.getElementById('apellido');
    const dniInput = document.getElementById('dni');
    const firmaInput = document.getElementById('firma'); 
    const btnSave = document.getElementById('btn-save');
    const btnCancel = document.getElementById('btn-cancel');

    // Cargar y mostrar los técnicos
    const loadTecnicos = async () => {
        const response = await fetch(API_TECNICOS);
        const result = await response.json();
        
        tableBodyTecnicos.innerHTML = '';
        if (result.success && result.data.length > 0) {
            result.data.forEach(t => {
                tableBodyTecnicos.innerHTML += `
                    <tr>
                        <td>${t.nombre} ${t.apellido}</td>
                        <td>${t.dni}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary btn-edit-tecnico" data-id="${t.id_tecnico}"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-outline-danger btn-delete-tecnico" data-id="${t.id_tecnico}"><i class="bi bi-trash-fill"></i></button>
                        </td>
                    </tr>`;
            });
        } else {
            tableBodyTecnicos.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay técnicos registrados.</td></tr>';
        }
    };

    // Resetear formulario de técnicos a modo "Crear"
    const resetFormTecnico = () => {
        formTecnico.reset();
        tecnicoIdInput.value = '';
        firmaInput.value = '';
        btnSave.textContent = 'Registrar';
        btnCancel.classList.add('d-none');
    };

    // Manejo del envío del formulario de técnicos
    formTecnico.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = tecnicoIdInput.value;
        const url = id ? `${API_TECNICOS}/${id}` : API_TECNICOS;
        const method = id ? 'PATCH' : 'POST';

        const formData = new FormData();
        formData.append('nombre', nombreInput.value);
        formData.append('apellido', apellidoInput.value);
        formData.append('dni', dniInput.value);
        formData.append('_csrf', getCsrfToken());

        if (firmaInput.files[0]) {
            formData.append('firma_tecnico', firmaInput.files[0]);
        }
        
        try {
            const response = await fetch(url, {
                method,
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire('¡Éxito!', result.message, 'success');
                resetFormTecnico();
                loadTecnicos();
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error de conexión con el servidor', 'error');
        }
    });

    // Manejo de botones de la tabla de técnicos
    tableBodyTecnicos.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.dataset.id;
        
        if (target.classList.contains('btn-edit-tecnico')) {
            const row = target.closest('tr');
            const [nombre, apellido] = row.cells[0].textContent.split(' ');
            const dni = row.cells[1].textContent;

            tecnicoIdInput.value = id;
            nombreInput.value = nombre;
            apellidoInput.value = apellido;
            dniInput.value = dni;

            btnSave.textContent = 'Guardar Cambios';
            btnCancel.classList.remove('d-none');
            window.scrollTo(0, 0); 
        }
        
        if (target.classList.contains('btn-delete-tecnico')) {
            Swal.fire({
                title: '¿Estás seguro?', text: "No podrás revertir esta acción.",
                icon: 'warning', showCancelButton: true,
                confirmButtonColor: '#d33', cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const response = await fetch(`${API_TECNICOS}/${id}`, { 
                        method: 'DELETE',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-csrf-token': getCsrfToken() 
                        },
                        body: JSON.stringify({ _csrf: getCsrfToken() })
                    });
                    const resJson = await response.json();
                    Swal.fire(resJson.success ? '¡Eliminado!' : 'Error', resJson.message, resJson.success ? 'success' : 'error');
                    loadTecnicos();
                }
            });
        }
    });

    btnCancel.addEventListener('click', resetFormTecnico);

    // ==================== SECCIÓN: USUARIOS CLIENTE ====================

    // Referencias a elementos del DOM - USUARIOS
    const tableBodyUsuarios = document.getElementById('usuarios-table-body');
    const formUsuario = document.getElementById('form-usuario-cliente');
    const usuarioIdInput = document.getElementById('usuario-id');
    const usuarioNombreInput = document.getElementById('usuario-nombre');
    const usuarioUsernameInput = document.getElementById('usuario-username');
    const usuarioPasswordInput = document.getElementById('usuario-password');
    const usuarioConfirmPasswordInput = document.getElementById('usuario-confirm-password');
    const btnSaveUsuario = document.getElementById('btn-save-usuario');
    const btnCancelUsuario = document.getElementById('btn-cancel-usuario');
    const passContainer = document.getElementById('pass-container');
    const passconfContainer = document.getElementById('passconf-container');
    const btnShowPassContainer = document.getElementById('btn-show-pass-container');
    const btnShowPass = document.getElementById('btn-show-pass');

    // Cargar y mostrar los usuarios cliente
    const loadUsuarios = async () => {
        const response = await fetch(API_USUARIOS);
        const result = await response.json();
        
        tableBodyUsuarios.innerHTML = '';
        if (result.success && result.data.length > 0) {
            result.data.forEach(u => {
                const fecha = new Date(u.created_at).toLocaleDateString('es-ES');
                tableBodyUsuarios.innerHTML += `
                    <tr>
                        <td>${u.nombre}</td>
                        <td><code>${u.username}</code></td>
                        <td>${fecha}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary btn-edit-usuario" data-id="${u.id_usuario}"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-outline-danger btn-delete-usuario" data-id="${u.id_usuario}"><i class="bi bi-trash-fill"></i></button>
                        </td>
                    </tr>`;
            });
        } else {
            tableBodyUsuarios.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay usuarios cliente registrados.</td></tr>';
        }
    };

    // Resetear formulario de usuarios
    const resetFormUsuario = () => {
        formUsuario.reset();
        usuarioIdInput.value = '';
        btnSaveUsuario.textContent = 'Crear Usuario';
        btnCancelUsuario.classList.add('d-none');
        passContainer.style.display = 'block';
        passconfContainer.style.display = 'block';
        btnShowPassContainer.style.display = 'none';
        // Hacer required los campos de contraseña en modo crear
        usuarioPasswordInput.required = true;
        usuarioConfirmPasswordInput.required = true;
    };

    // Manejo del envío del formulario de usuarios
    formUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = usuarioIdInput.value;
        const url = id ? `${API_USUARIOS}/${id}` : API_USUARIOS;
        const method = id ? 'PATCH' : 'POST';

        // Validar contraseñas si es creación o si se proporcionan en edición
        if (!id) {
            // Modo crear: contraseñas son obligatorias
            if (!usuarioPasswordInput.value || !usuarioConfirmPasswordInput.value) {
                Swal.fire('Error', 'Las contraseñas son obligatorias', 'error');
                return;
            }
            if (usuarioPasswordInput.value !== usuarioConfirmPasswordInput.value) {
                Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
                return;
            }
            if (usuarioPasswordInput.value.length < 6) {
                Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }
        } else {
            // Modo editar: si proporciona contraseña, debe confirmarla
            if (usuarioPasswordInput.value || usuarioConfirmPasswordInput.value) {
                if (usuarioPasswordInput.value !== usuarioConfirmPasswordInput.value) {
                    Swal.fire('Error', 'Las contraseñas no coinciden', 'error');
                    return;
                }
                if (usuarioPasswordInput.value.length < 6) {
                    Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres', 'error');
                    return;
                }
            }
        }

        const payload = {
            nombre: usuarioNombreInput.value,
            username: usuarioUsernameInput.value,
            _csrf: getCsrfToken()
        };

        // Solo agregar contraseña si es crear o si el campo no está vacío
        if (!id || usuarioPasswordInput.value) {
            payload.password = usuarioPasswordInput.value;
            payload.confirmPassword = usuarioConfirmPasswordInput.value;
        }
        
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire('¡Éxito!', result.message, 'success');
                resetFormUsuario();
                loadUsuarios();
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Error de conexión con el servidor', 'error');
        }
    });

    // Manejo de botones de la tabla de usuarios
    tableBodyUsuarios.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.dataset.id;
        
        if (target.classList.contains('btn-edit-usuario')) {
            const row = target.closest('tr');
            const nombre = row.cells[0].textContent;
            const username = row.cells[1].textContent;

            usuarioIdInput.value = id;
            usuarioNombreInput.value = nombre;
            usuarioUsernameInput.value = username;
            usuarioPasswordInput.value = '';
            usuarioConfirmPasswordInput.value = '';

            // Ocultar campos de contraseña en modo edición
            passContainer.style.display = 'none';
            passconfContainer.style.display = 'none';
            // Mostrar botón para cambiar contraseña
            btnShowPassContainer.style.display = 'block';
            // No requerir contraseña en modo edición
            usuarioPasswordInput.required = false;
            usuarioConfirmPasswordInput.required = false;

            btnSaveUsuario.textContent = 'Guardar Cambios';
            btnCancelUsuario.classList.remove('d-none');
            window.scrollTo(0, window.innerHeight);
        }
        
        if (target.classList.contains('btn-delete-usuario')) {
            Swal.fire({
                title: '¿Estás seguro?', 
                text: "Se eliminará el usuario y no podrá acceder al sistema.",
                icon: 'warning', 
                showCancelButton: true,
                confirmButtonColor: '#d33', 
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, ¡eliminar!', 
                cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const response = await fetch(`${API_USUARIOS}/${id}`, { 
                        method: 'DELETE',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-csrf-token': getCsrfToken() 
                        },
                        body: JSON.stringify({ _csrf: getCsrfToken() })
                    });
                    const resJson = await response.json();
                    Swal.fire(resJson.success ? '¡Eliminado!' : 'Error', resJson.message, resJson.success ? 'success' : 'error');
                    loadUsuarios();
                }
            });
        }
    });

    btnCancelUsuario.addEventListener('click', resetFormUsuario);

    // Manejador para mostrar/ocultar campos de contraseña en edición
    btnShowPass.addEventListener('click', (e) => {
        e.preventDefault();
        if (passContainer.style.display === 'none') {
            passContainer.style.display = 'block';
            passconfContainer.style.display = 'block';
            btnShowPass.innerHTML = '<i class="bi bi-eye-slash-fill"></i> Ocultar Contraseña';
        } else {
            passContainer.style.display = 'none';
            passconfContainer.style.display = 'none';
            usuarioPasswordInput.value = '';
            usuarioConfirmPasswordInput.value = '';
            btnShowPass.innerHTML = '<i class="bi bi-key-fill"></i> Cambiar Contraseña';
        }
    });

    // Cargar datos iniciales
    loadTecnicos();
    loadUsuarios();
});