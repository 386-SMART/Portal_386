document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('btn-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    const menuLinks = document.querySelectorAll('.menu-link');

    // 1. Lógica para colapsar/expandir el menú
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // 2. Lógica para resaltar el link activo
    menuLinks.forEach(link => {
        link.addEventListener('click', function() {
            menuLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // 3. Lógica para cerrar sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('/api/logout', { method: 'GET' })
                .then(response => {
                    if (response.ok) {
                        window.location.href = '/';
                    } else {
                        alert('Error al cerrar sesión.');
                    }
                })
                .catch(error => {
                    console.error('Error de red al cerrar sesión:', error);
                });
        });
    }
});