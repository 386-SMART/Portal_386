document.addEventListener("DOMContentLoaded", () => {
    // Prevenir que el usuario regrese a esta página con el botón "atrás" del navegador después de iniciar sesión
    history.pushState(null, "", location.href);
    window.addEventListener("popstate", () =>
        history.pushState(null, "", location.href)
    );

    // --- NUEVA LÓGICA: Animación de Partículas ---
    // Se asegura de que el div exista antes de intentar cargar la animación
    if (document.getElementById('particles-js')) {
        particlesJS.load('particles-js', '/js/particles.json', function() {
            console.log('Fondo de partículas cargado.');
        });
    }

    // --- LÓGICA EXISTENTE: Saludo dinámico según la hora ---
    const greetingEl = document.getElementById("greeting");
    if (greetingEl) {
        const currentHour = new Date().getHours();
        let greetingText = "Bienvenido";

        if (currentHour < 12) {
            greetingText = "Buenos días";
        } else if (currentHour < 19) {
            greetingText = "Buenas tardes";
        } else {
            greetingText = "Buenas noches";
        }
        greetingEl.textContent = greetingText;
    }

    // --- LÓGICA EXISTENTE: Verificación de sesión al cargar la página ---
    fetch("/api/check-session")
        .then((r) => r.json())
        .then((d) => {
            if (d.success && d.redirectPath) {
                window.location.replace(d.redirectPath);
            }
        })
        .catch(() => {});

    // --- LÓGICA EXISTENTE: Mostrar/ocultar contraseña ---
    const togglePasswordBtn = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener("click", function () {
            const type =
                passwordInput.getAttribute("type") === "password" ? "text" : "password";
            passwordInput.setAttribute("type", type);
            this.innerHTML =
                type === "password"
                    ? '<i class="bi bi-eye-slash"></i>'
                    : '<i class="bi bi-eye"></i>';
        });
    }

    // --- LÓGICA EXISTENTE: Envío del formulario de login ---
    const form = document.getElementById("login-form");
    const userInput = document.getElementById("username");
    const passInput = document.getElementById("password");
    const loader = document.getElementById("loader");
    const errorAlert = document.getElementById("alert-error");

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        errorAlert.classList.add("d-none");
        loader.style.display = "block";
        form.querySelector('button[type="submit"]').disabled = true; // Deshabilitar botón

        const csrfToken = document.querySelector('input[name="_csrf"]').value;

        axios
            .post("/api/login", {
                username: userInput.value,
                password: passInput.value,
                _csrf: csrfToken
            })
            .then(({ data }) => {
                if (data.success && data.redirectPath) {
                    setTimeout(() => {
                        window.location.replace(data.redirectPath);
                    }, 500);
                } else {
                    showError(data.message || "Error en la respuesta del servidor");
                }
            })
            .catch((error) => {
                const errorMessage =
                    error.response?.data?.message ||
                    "⚠︎ Credenciales Incorrectas o error de conexión ⚠︎";
                showError(errorMessage);
            });
    });

    function showError(msg) {
        loader.style.display = "none";
        form.querySelector('button[type="submit"]').disabled = false; // Habilitar botón de nuevo
        errorAlert.textContent = msg;
        errorAlert.classList.remove("d-none");
    }
});