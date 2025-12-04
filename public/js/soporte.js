document.addEventListener("DOMContentLoaded", function () {
  // --- ELEMENTOS DEL DOM ---
  const sidebar = document.querySelector(".sidebar");
  const btnToggle = document.querySelector("#btn-toggle");
  const btnLogout = document.querySelector("#logout-btn");
  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  const contentFrame = document.getElementById("content-frame");
  const iframeLoader = document.getElementById("iframe-loader");
  const welcomeContainer = document.getElementById("welcome-container");

  // --- MANEJO DEL MENÚ HAMBURGUESA ---
  if (btnToggle) {
    btnToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // --- MANEJO DEL CIERRE DE SESIÓN ---
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/logout", {
          method: "GET",
        });
        const result = await response.json();
        if (result.success) {
          // Redirigir a la página de login si el cierre de sesión fue exitoso
          window.location.href = "/";
        } else {
          console.error("Error al cerrar sesión:", result.message);
          alert("No se pudo cerrar la sesión.");
        }
      } catch (error) {
        console.error("Error de red al cerrar sesión:", error);
        alert("Error de conexión al intentar cerrar sesión.");
      }
    });
  }

  // --- FUNCIÓN PARA MOSTRAR LA BIENVENIDA ---
  function showWelcomeScreen() {
    const userName = window.__USER_NAME__ || "Usuario";
    welcomeContainer.innerHTML = `
        <img src="/img/logo386blanco.png" alt="Logo 386">
        <h2>Bienvenido, ${userName}</h2>
        <p>Selecciona una opción del menú para comenzar.</p>
    `;
    welcomeContainer.style.display = "flex"; // Usar flex para centrar
    contentFrame.style.display = "none";
    iframeLoader.classList.add("d-none");
  }

  // --- MANEJO DE LA CARGA DE PÁGINAS ---
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      // Ocultar bienvenida y iframe, mostrar loader
      welcomeContainer.style.display = "none";
      contentFrame.style.display = "none";
      iframeLoader.classList.remove("d-none");
      iframeLoader.style.display = "flex"; // Asegurar que sea flex

      // Actualizar la clase activa
      sidebarLinks.forEach((l) => l.classList.remove("active"));
      this.classList.add("active");

      const path = this.dataset.path;
      // Asignar el src al iframe real dentro del contenedor
      contentFrame.querySelector("iframe").src = path;
    });
  });

  // Evento que se dispara cuando el iframe termina de cargar
  // Se aplica al iframe real, no al contenedor
  contentFrame.querySelector("iframe").onload = function () {
    // Ocultar loader y mostrar el contenedor del iframe
    iframeLoader.classList.add("d-none");
    iframeLoader.style.display = "none";
    contentFrame.style.display = "block";
  };

  // --- ESTADO INICIAL ---
  // Mostrar la pantalla de bienvenida al cargar la página
  showWelcomeScreen();
});
