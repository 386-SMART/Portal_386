document.addEventListener('DOMContentLoaded', () => {

    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // Referencias a los formularios y elementos
    const formUpdateDetails = document.getElementById('form-update-details');
    const formUpdatePassword = document.getElementById('form-update-password');
    const formUpdateLogo = document.getElementById('form-update-logo');
    const logoInput = document.getElementById('logo-input');
    const fileNameDisplay = document.getElementById('file-name-display');

    // 1. Lógica para actualizar nombre y username
    if (formUpdateDetails) {
        formUpdateDetails.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nombre = document.getElementById('nombre-input').value;
            const username = document.getElementById('username-input').value;

            try {
                const response = await fetch('api/profile/details', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json',
                        'x-csrf-token': getCsrfToken()
                    },
                    body: JSON.stringify({ nombre, username })
                });
                const result = await response.json();

                if (response.ok) {
                    Swal.fire('¡Éxito!', result.message, 'success');
                    // Actualizar el nombre mostrado en la tarjeta de perfil en tiempo real
                    document.getElementById('display-name').textContent = nombre;
                } else {
                    Swal.fire('Error', result.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo conectar al servidor.', 'error');
            }
        });
    }

    // 2. Lógica para cambiar la contraseña
    if (formUpdatePassword) {
        formUpdatePassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                Swal.fire('Error', 'Las nuevas contraseñas no coinciden.', 'error');
                return;
            }
            if (!currentPassword || !newPassword) {
                Swal.fire('Atención', 'Por favor, completa todos los campos.', 'warning');
                return;
            }

            try {
                const response = await fetch('api/profile/password', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json',
                        'x-csrf-token': getCsrfToken()
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const result = await response.json();

                if (response.ok) {
                    Swal.fire('¡Éxito!', result.message, 'success');
                    formUpdatePassword.reset(); // Limpiar campos del formulario de contraseña
                } else {
                    Swal.fire('Error', result.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo conectar al servidor.', 'error');
            }
        });
    }
    
    // 3. Lógica para actualizar el logo
    if (formUpdateLogo) {
        formUpdateLogo.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (logoInput.files.length === 0) {
                Swal.fire('Atención', 'Por favor, selecciona un archivo de imagen.', 'warning');
                return;
            }
            
            const formData = new FormData();
            formData.append('logo', logoInput.files[0]);

            try {
                const response = await fetch('api/profile/logo', {
                    method: 'POST',
                    headers: {
                        'x-csrf-token': getCsrfToken()
                    },
                    body: formData
                });
                const result = await response.json();

                if(result.success) {
                    Swal.fire('¡Éxito!', result.message, 'success');
                    // Actualizar la imagen en la página sin recargar
                    // Se añade un timestamp para evitar que el navegador muestre la imagen antigua de la caché
                    document.getElementById('profile-logo').src = `/img/logo_cliente/${result.newLogo}?t=${new Date().getTime()}`;
                    formUpdateLogo.reset();
                    fileNameDisplay.textContent = '';
                } else {
                    Swal.fire('Error', result.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'No se pudo conectar al servidor.', 'error');
            }
        });
    }

    // Lógica para mostrar el nombre del archivo seleccionado
    if (logoInput) {
        logoInput.addEventListener('change', () => {
            if (logoInput.files.length > 0) {
                fileNameDisplay.textContent = `Archivo seleccionado: ${logoInput.files[0].name}`;
            } else {
                fileNameDisplay.textContent = '';
            }
        });
    }
});