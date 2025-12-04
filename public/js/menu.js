document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELECTORES (Con validación de seguridad) ---
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.getElementById('btn-toggle');
    const iframe = document.getElementById('content-frame'); // Contenedor o Iframe directo
    const welcome = document.getElementById('welcome-container');
    const iframeLoader = document.getElementById('iframe-loader');
    const pageLoader = document.getElementById('page-loader-overlay'); // Loader de pantalla completa
    const logoutBtn = document.getElementById('log_out');
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    
    // Switcher de Empresa
    const companySwitcher = document.getElementById('company-switcher-menu');
    const companyOptions = document.querySelectorAll('.company-option');
    const switcherToggle = companySwitcher ? companySwitcher.querySelector('.switcher-toggle') : null;

    // --- 2. VARIABLES GLOBALES ---
    // Obtenemos el iframe real, ya sea el elemento directo o uno dentro del contenedor
    const realIframe = iframe && iframe.tagName === 'IFRAME' ? iframe : (iframe ? iframe.querySelector('iframe') : null);
    
    const IS_ADMIN = window.__IS_ADMIN__ === 'true';
    const TENANT_SLUG = window.__TENANT_SLUG__ || 'admin';
    const USER_NAME = window.__USER_NAME__ || 'Usuario';

    // --- 3. TOGGLE SIDEBAR ---
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            // Cerrar submenú si se colapsa el sidebar
            if (!sidebar.classList.contains('open') && companySwitcher) {
                companySwitcher.classList.remove('open');
            }
        });
    }

    // --- 4. PANTALLA DE BIENVENIDA E INICIO ---
    const initWelcome = () => {
        if (!welcome) return;

        const hour = new Date().getHours();
        const saludo = hour < 12 ? '¡Buenos días!' : hour < 18 ? '¡Buenas tardes!' : '¡Buenas noches!';
        const logoSrc = document.querySelector('.logo-details img')?.src || '/img/logo386blanco.png';

        // Renderizar HTML de bienvenida
        welcome.innerHTML = `
            <div class="welcome-card">
                <div class="welcome-head">
                    <img class="welcome-logo" src="${logoSrc}" alt="Logo">
                    <div>
                        <h2 class="welcome-title">${saludo}, ${USER_NAME}</h2>
                        <p class="welcome-sub">Estamos preparando tu entorno...</p>
                    </div>
                </div>
                <div class="welcome-progress"></div>
            </div>
        `;

        // Simular carga y redirigir
        setTimeout(() => {
            // Definir ruta inicial según el rol
            const initialPath = IS_ADMIN ? '/admin/dashboard' : `/${TENANT_SLUG}/inicio`;

            // Transición suave
            welcome.style.opacity = '0';
            welcome.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                welcome.style.display = 'none';
                if (iframe) iframe.style.display = 'block'; // Mostrar contenedor del iframe
                
                // Cargar iframe
                if (realIframe) {
                    if (iframeLoader) iframeLoader.classList.remove('d-none');
                    realIframe.src = initialPath;
                }

                // Marcar link activo visualmente
                sidebarLinks.forEach(link => {
                    if (link.dataset.path === initialPath) link.classList.add('active');
                });
            }, 500);

        }, 1500);
    };

    initWelcome();

    // --- 5. NAVEGACIÓN (LINKS) ---
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Gestión visual "Active"
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Cargar URL en Iframe
            const path = link.dataset.path;
            if (realIframe) {
                // Solo recargar si es una ruta diferente
                // if (!realIframe.src.endsWith(path)) { // Comentado para forzar recarga si se desea
                    if (iframeLoader) {
                        iframeLoader.classList.remove('d-none');
                        // Asegurar que el loader sea visible (flex)
                        iframeLoader.style.display = 'flex';
                    }
                    if (welcome) welcome.style.display = 'none';
                    if (iframe) iframe.style.display = 'block';
                    
                    realIframe.src = path;
                // }
            }

            // En móviles, cerrar sidebar al hacer click
            if (window.innerWidth < 768 && sidebar) {
                sidebar.classList.remove('open');
            }
        });
    });

    // Ocultar loader cuando el iframe termine de cargar
    if (realIframe) {
        realIframe.addEventListener('load', () => {
            if (iframeLoader) {
                iframeLoader.classList.add('d-none');
                iframeLoader.style.display = 'none'; // Forzar ocultamiento
            }
        });
    }

    // --- 6. CAMBIAR EMPRESA (Company Switcher) ---
    // Lógica para desplegar el menú
    if (companySwitcher && switcherToggle) {
        switcherToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (sidebar.classList.contains('open')) {
                companySwitcher.classList.toggle('open');
            } else {
                sidebar.classList.add('open');
                setTimeout(() => companySwitcher.classList.add('open'), 150);
            }
        });
    }

    // Lógica al hacer clic en una empresa
    // ... dentro de public/js/menu.js ...

    // Lógica al hacer clic en una empresa
    companyOptions.forEach(opt => {
        opt.addEventListener('click', async (e) => {
            e.preventDefault();
            const target = e.currentTarget;
            
            if (target.classList.contains('active-company')) return;

            const newId = target.dataset.empresaId;
            
            // Loader
            if (pageLoader) {
                pageLoader.style.display = 'flex';
                pageLoader.style.opacity = '1';
            }

            try {
                // --- CORRECCIÓN CLAVE AQUÍ ---
                // Determinamos la URL según si estamos en Admin o Cliente
                let url;
                if (IS_ADMIN) {
                    // Ruta del Router de Admin
                    url = '/admin/api/global/switch-tenant'; 
                } else {
                    // Ruta del Router de Cliente (client.router.js)
                    // Usa el slug actual para construir la ruta relativa
                    url = `/${TENANT_SLUG}/api/switch-tenant`; 
                }

                // Obtener token CSRF del meta tag del layout
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-csrf-token': csrfToken // Header de seguridad obligatorio
                    },
                    body: JSON.stringify({ new_empresa_id: newId })
                });

                const data = await res.json();
                
                if (data.success && data.new_slug) {
                    // Redirección al dashboard de la nueva empresa
                    // Si es admin, suele mantenerse en /admin/dashboard o ir al menú
                    // Si es cliente, va a /nuevo-slug/menu
                    if (IS_ADMIN) {
                         window.location.reload(); // O redirigir a donde prefieras en admin
                    } else {
                         window.location.href = `/${data.new_slug}/menu`;
                    }
                } else {
                    throw new Error(data.message || 'Error al cambiar de empresa');
                }

            } catch (error) {
                console.error('Error switching tenant:', error);
                alert('No se pudo cambiar de empresa. ' + (error.message || ''));
                if (pageLoader) {
                    pageLoader.style.opacity = '0';
                    setTimeout(() => pageLoader.style.display = 'none', 300);
                }
            }
        });
    });

    // --- 7. LOGOUT ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            fetch('/api/logout').finally(() => {
                window.location.replace('/');
            });
        });
    }
});