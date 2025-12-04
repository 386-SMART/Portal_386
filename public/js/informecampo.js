document.addEventListener("DOMContentLoaded", () => {
    console.log("📱 Formulario cargando...");
    
    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  
    // Referencias a Elementos Existentes - CON VALIDACIÓN
    const form = document.getElementById("informe-form");
    if (!form) {
        console.error("❌ CRÍTICO: No se encontró el formulario #informe-form");
        return;
    }
    
    const formFields = form.querySelectorAll("input, select, textarea");
    console.log(`✓ Formulario encontrado con ${formFields.length} campos`);
    
    const serieInput = document.getElementById("serieInput");
    const idEquipoInput = document.getElementById("idEquipoInput");
    const idEmpresaInput = document.getElementById("idEmpresaInput");
    const fechaServicioInput = document.getElementById("fechaServicioInput");
    const btnBuscarTicket = document.getElementById("btnBuscarTicket");
    const ticketInput = document.getElementById("ticketInput");
    const selectTecnico = document.querySelector('select[name="id_tecnico"]');
    const radioFirmante = document.querySelectorAll('input[name="firmante_type"]');
    const tiContainer = document.getElementById("ti-container");
    const usuarioFinalContainer = document.getElementById("usuario-final-container");
    const selectContactoCliente = document.querySelector('select[name="firmante_ti_id"]');
    const selectUsuarioFinal = document.querySelector('select[name="firmante_uf_id"]');
    
    // Modal con validación
    const modalElement = document.getElementById("usuarioFinalModal");
    const usuarioFinalModal = modalElement ? new bootstrap.Modal(modalElement) : null;
    
    const formUsuarioFinal = document.getElementById("form-usuario-final");
    const canvasUsuario = document.getElementById("firmaUsuarioPad");
    const canvasTecnico = document.getElementById("firmaTecnicoPad");
    
    if (!canvasUsuario || !canvasTecnico) {
        console.error("❌ CRÍTICO: Canvas de firmas no encontrados");
        return;
    }
    
    const firmaUsuarioPad = new SignaturePad(canvasUsuario);
    const firmaTecnicoPad = new SignaturePad(canvasTecnico);
    const btnLimpiarFormulario = document.getElementById("btnLimpiarFormulario");
    
    // ← NUEVAS REFERENCIAS para firma del técnico cargada
    const firmaCaradadaContainer = document.getElementById("firmaCaradadaContainer");
    const firmaCaradadaMensaje = document.getElementById("firmaCaradadaMensaje");
    const firmaCaradadaImg = document.getElementById("firmaCaradadaImg");
    const canvasTecnicoContainer = document.getElementById("canvasTecnicoContainer");
  
    // --- NUEVO: Referencias para la lógica de Tipo de Informe ---
    const divFotoPieza1 = document.getElementById("divFotoPieza1");
    const divFotoPieza2 = document.getElementById("divFotoPieza2");
    const labelFotoExtra = document.getElementById("labelFotoExtra");
    const radioTipoInforme = document.querySelectorAll('input[name="tipo_informe"]');
    
    // NUEVO: Referencias para el cambio de ticket
    const contenedorVisitaTecnica = document.getElementById("contenedorVisitaTecnica");
    const contenedorIncidencia = document.getElementById("contenedorIncidencia");
    const ticketManualInput = document.getElementById("ticketManualInput");
    
    console.log("✓ Todos los elementos están listos");
  
    // --- NUEVO: Función para alternar vistas según el tipo de informe ---
    const toggleTipoInforme = () => {
        // Si los elementos no existen, salir sin error
        if (!divFotoPieza1 || !divFotoPieza2 || !labelFotoExtra) {
            console.warn("Elementos de tipo_informe no encontrados");
            return;
        }
        
        // Obtenemos el valor del radio seleccionado (Visita Técnica o Incidencia)
        const tipoSeleccionado = document.querySelector('input[name="tipo_informe"]:checked')?.value || 'Visita Técnica';
        
        if (tipoSeleccionado === "Incidencia") {
            // MODO INCIDENCIA (sin piezas)
            
            // 1. Ocultar búsqueda de CasTi, mostrar ingreso manual
            if (contenedorVisitaTecnica) contenedorVisitaTecnica.style.display = 'none';
            if (contenedorIncidencia) contenedorIncidencia.style.display = 'block';
            
            // 2. Limpiar ticket de CasTi
            if (ticketInput) ticketInput.value = '';
            if (idCastiInput) idCastiInput.value = '';
            
            // 3. CAMBIO: Mantener todas las fotos visibles (igual que Visita Técnica)
            divFotoPieza1.classList.remove("d-none");
            divFotoPieza2.classList.remove("d-none");
            
            // 4. Mantener el label original
            labelFotoExtra.textContent = "5. Otra";
        } else {
            // MODO VISITA TÉCNICA (con piezas)
            
            // 1. Mostrar búsqueda de CasTi, ocultar ingreso manual
            if (contenedorVisitaTecnica) contenedorVisitaTecnica.style.display = 'block';
            if (contenedorIncidencia) contenedorIncidencia.style.display = 'none';
            
            // 2. Limpiar ticket manual
            if (ticketManualInput) ticketManualInput.value = '';
            
            // 3. Mostrar fotos de piezas
            divFotoPieza1.classList.remove("d-none");
            divFotoPieza2.classList.remove("d-none");
            labelFotoExtra.textContent = "5. Otra";
        }
    };
  
    // --- NUEVO: Escuchar cambios en los radios de tipo de informe ---
    radioTipoInforme.forEach(radio => {
        radio.addEventListener("change", () => {
            toggleTipoInforme();
            saveFormState(); // Guardamos la elección
        });
    });
  
    // LÓGICA DE GUARDADO TEMPORAL (LOCAL STORAGE)
    const saveFormState = () => {
      try {
        const state = {};
        formFields.forEach((field) => {
          if (field.name && field.type !== "file") {
            if (field.type === "radio") {
              if (field.checked) state[field.name] = field.value;
            } else {
              state[field.name] = field.value;
            }
          }
        });
        
        // Solo guardar firmas si no están vacías
        if (!firmaUsuarioPad.isEmpty()) {
          state.firma_usuario_data = firmaUsuarioPad.toDataURL();
        }
        if (!firmaTecnicoPad.isEmpty()) {
          state.firma_tecnico_data = firmaTecnicoPad.toDataURL();
        }
        
        localStorage.setItem("informeTemporal", JSON.stringify(state));
      } catch (err) {
        console.warn("Error al guardar en localStorage:", err);
        // En mobile, a veces localStorage está lleno
      }
    };
  
    const loadFormState = () => {
      try {
        const savedState = localStorage.getItem("informeTemporal");
        if (savedState) {
          const state = JSON.parse(savedState);
          // Restaurar campos
          formFields.forEach((field) => {
            if (field.name && typeof state[field.name] !== "undefined") {
              if (field.type === "radio") {
                // Comparar valor para marcar el radio correcto (incluye tipo_informe)
                field.checked = field.value === state[field.name];
              } else {
                field.value = state[field.name];
              }
            }
          });
  
          // Disparar eventos visuales tras restaurar datos
          const firmanteTypeRadio = document.querySelector('input[name="firmante_type"]:checked');
          if (firmanteTypeRadio) firmanteTypeRadio.dispatchEvent(new Event("change"));
  
          // --- NUEVO: Actualizar la UI del tipo de informe tras cargar ---
          toggleTipoInforme();
  
          if (state.firma_usuario_data) {
            try {
              firmaUsuarioPad.fromDataURL(state.firma_usuario_data);
            } catch (err) {
              console.warn("No se pudo restaurar firma de usuario:", err);
            }
          }
          if (state.firma_tecnico_data) {
            try {
              firmaTecnicoPad.fromDataURL(state.firma_tecnico_data);
            } catch (err) {
              console.warn("No se pudo restaurar firma de técnico:", err);
            }
          }
  
          if (idEmpresaInput.value) {
            serieInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else {
            // Si no hay estado guardado, asegurar que la UI inicial esté correcta
            toggleTipoInforme();
        }
      } catch (err) {
        console.warn("Error al cargar estado:", err);
        toggleTipoInforme();
      }
    };
  
    // LÓGICA PARA LAS FIRMAS - Mejorado para MOBILE
    function resizeCanvas(canvas, signaturePad) {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      
      // En mobile, asegurar que el canvas tenga tamaño mínimo adecuado
      const width = Math.max(rect.width, 200);
      const height = Math.max(rect.height, 150);
      
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      
      // NO limpiar si tiene datos (para preservar firma al rotar)
      if (signaturePad.isEmpty()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  
    // Inicializar canvas con manejo mejorado para mobile
    function initializeCanvas(canvas, signaturePad) {
      resizeCanvas(canvas, signaturePad);
      
      // En mobile, mejorar el hit detection para toques pequeños
      if (window.innerWidth < 768) { // Dispositivos móviles
        canvas.style.touchAction = 'none'; // Evitar scroll al tocar
        // SignaturePad usa estas propiedades directamente, no setOptions
        signaturePad.minWidth = 1.5;
        signaturePad.maxWidth = 2.5;
        signaturePad.throttle = 16;
      }
    }
  
    initializeCanvas(canvasUsuario, firmaUsuarioPad);
    initializeCanvas(canvasTecnico, firmaTecnicoPad);
  
    // Manejar redimensionamiento (rotación de pantalla)
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const dataUsuario = firmaUsuarioPad.toData();
        const dataTecnico = firmaTecnicoPad.toData();
        
        resizeCanvas(canvasUsuario, firmaUsuarioPad);
        resizeCanvas(canvasTecnico, firmaTecnicoPad);
        
        // Restaurar datos si existen
        if (dataUsuario && dataUsuario.length > 0) {
          firmaUsuarioPad.fromData(dataUsuario);
        }
        if (dataTecnico && dataTecnico.length > 0) {
          firmaTecnicoPad.fromData(dataTecnico);
        }
        saveFormState();
      }, 250);
    });
    
    // Manejar orientación de pantalla en iOS
    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);
    });
  
    document.querySelectorAll("button[data-pad]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.pad === "firmaUsuarioPad") firmaUsuarioPad.clear();
        if (btn.dataset.pad === "firmaTecnicoPad") firmaTecnicoPad.clear();
        saveFormState();
      });
    });
  
    // --- LÓGICA DE LA PÁGINA (EVENTOS Y FETCH) ---
  
    // Carga inicial de técnicos
    fetch("/api/public/tecnicos")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          const currentValue = selectTecnico.value;
          res.data.forEach(
            (t) =>
              (selectTecnico.innerHTML += `<option value="${t.id_tecnico}">${t.nombre} ${t.apellido}</option>`)
          );
          selectTecnico.value = currentValue;
        }
      });

    // ← NUEVO: Escuchar cambios en el select de técnicos para cargar su firma
    selectTecnico.addEventListener("change", async () => {
      const idTecnico = selectTecnico.value;
      if (!idTecnico) {
        // Si no hay técnico seleccionado, mostrar mensaje
        firmaCaradadaMensaje.style.display = 'block';
        firmaCaradadaImg.style.display = 'none';
        canvasTecnicoContainer.classList.add('d-none');
        canvasTecnico.style.display = 'none';
        return;
      }

      try {
        const response = await fetch(`/api/public/tecnico/${idTecnico}/firma`);
        const result = await response.json();

        if (result.success && result.data.firma_path) {
          // ← Cargar firma del técnico como imagen
          const firmaPath = `/storage/${result.data.firma_path}`;
          firmaCaradadaImg.src = firmaPath;
          firmaCaradadaImg.style.display = 'block';
          firmaCaradadaMensaje.style.display = 'none';
          canvasTecnicoContainer.classList.add('d-none'); // Ocultar opción de dibujar
          
          // Guardar la ruta en un atributo para usar después
          form.dataset.firmaTecnicoPath = result.data.firma_path;
          saveFormState();
        } else {
          // Si no tiene firma guardada, mostrar canvas para dibujar
          firmaCaradadaImg.style.display = 'none';
          firmaCaradadaMensaje.textContent = 'Este técnico no tiene firma guardada. Por favor, dibuja una.';
          firmaCaradadaMensaje.style.display = 'block';
          canvasTecnicoContainer.classList.remove('d-none');
          firmaTecnicoPad.clear();
          form.dataset.firmaTecnicoPath = null;
        }
      } catch (error) {
        console.error("Error cargando firma del técnico:", error);
        firmaCaradadaImg.style.display = 'none';
        firmaCaradadaMensaje.textContent = 'Error al cargar la firma';
        firmaCaradadaMensaje.style.display = 'block';
        canvasTecnicoContainer.classList.add('d-none');
      }
    });
  
    form.addEventListener("input", saveFormState);
    firmaUsuarioPad.addEventListener("endStroke", saveFormState);
    firmaTecnicoPad.addEventListener("endStroke", saveFormState);
  
    radioFirmante.forEach((radio) =>
      radio.addEventListener("change", async () => {
        const firmanteType = document.querySelector('input[name="firmante_type"]:checked').value;
        
        if (firmanteType === "Client_Ti") {
          tiContainer.classList.remove("d-none");
          usuarioFinalContainer.classList.add("d-none");
        } else {
          tiContainer.classList.add("d-none");
          usuarioFinalContainer.classList.remove("d-none");
          
          // Cargar usuarios finales si hay empresa seleccionada
          const empresaId = idEmpresaInput.value;
          if (empresaId && selectUsuarioFinal) {
            try {
              const response = await fetch(`/api/public/usuarios-finales/${empresaId}`);
              const result = await response.json();
              const currentValue = selectUsuarioFinal.value;
              
              if (result.success) {
                selectUsuarioFinal.innerHTML = '<option value="">-- Seleccione o registre usuario final --</option>';
                result.data.forEach(
                  (u) => (selectUsuarioFinal.innerHTML += `<option value="${u.id_usuario_final}">${u.nombre}</option>`)
                );
                if (currentValue) selectUsuarioFinal.value = currentValue;
              }
            } catch (error) {
              console.warn("Error cargando usuarios finales:", error);
            }
          }
        }
      })
    );
  
    // Buscar equipo por serie - Mejorado para mobile
    const buscarEquipoPorSerie = async () => {
        const serie = serieInput.value.trim();
        if (!serie) {
            console.log("⚠️ Serie vacía");
            return;
        }
        console.log(`🔍 Buscando equipo: ${serie}`);
        try {
          const response = await fetch(`/api/public/buscar-equipo/${serie}`);
          console.log(`📡 Respuesta: ${response.status}`);
          if (!response.ok) throw new Error("Equipo no encontrado");
          const result = await response.json();
          console.log("✓ Resultado:", result);
          
          if (result.success) {
            const { data } = result;
            idEquipoInput.value = data.id_equipo;
            idEmpresaInput.value = data.id_empresa;
            document.getElementById("clienteInput").value = data.nombre_empresa;
            document.getElementById("contratoInput").value = data.nombre_contrato;
            document.getElementById("modeloInput").value = data.modelo;
            document.getElementById("productNumberInput").value = data.part_number;
            
            // Cargar contactos TI de esa empresa
            const contactosRes = await fetch(`/api/public/contactos-ti/${data.id_empresa}`);
            const contactosResult = await contactosRes.json();
            const currentContact = selectContactoCliente.value;
            selectContactoCliente.innerHTML = '<option value="">Seleccione contacto...</option>';
            if (contactosResult.success) {
              contactosResult.data.forEach(
                (c) => (selectContactoCliente.innerHTML += `<option value="${c.id_ti_usuario}">${c.Nombre}</option>`)
              );
              selectContactoCliente.disabled = false;
              selectContactoCliente.value = currentContact;
            }
            
            // NUEVO: Cargar usuarios finales de esa empresa
            if (selectUsuarioFinal) {
                try {
                    const usuariosRes = await fetch(`/api/public/usuarios-finales/${data.id_empresa}`);
                    const usuariosResult = await usuariosRes.json();
                    const currentUsuario = selectUsuarioFinal.value;
                    selectUsuarioFinal.innerHTML = '<option value="">-- Seleccione o registre usuario final --</option>';
                    if (usuariosResult.success) {
                        usuariosResult.data.forEach(
                            (u) => (selectUsuarioFinal.innerHTML += `<option value="${u.id_usuario_final}">${u.nombre}</option>`)
                        );
                        selectUsuarioFinal.value = currentUsuario;
                    }
                } catch (error) {
                    console.warn("Error cargando usuarios finales:", error);
                }
            }
            
            saveFormState();
            console.log("✓ Equipo encontrado y cargado");
            
            // En mobile, scroll al siguiente campo importante
            if (window.innerWidth < 768) {
              setTimeout(() => {
                ticketInput.focus();
                ticketInput.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 300);
            }
          } else {
            console.warn("❌ No se encontró el equipo");
          }
        } catch (error) {
          console.error("❌ Error buscando equipo:", error);
        }
    };
    
    // Event listeners - Usar "blur" en mobile y "change" en desktop
    if (serieInput) {
        console.log("✓ Event listener para serie agregado");
        if (window.innerWidth < 768) {
            // Mobile: activar cuando se pierde el foco
            serieInput.addEventListener("blur", buscarEquipoPorSerie);
        } else {
            // Desktop: activar en change
            serieInput.addEventListener("change", buscarEquipoPorSerie);
        }
    } else {
        console.error("❌ serieInput no encontrado");
    }
    
    if (btnBuscarTicket) {
        console.log("✓ Event listener para búsqueda de ticket agregado");
        btnBuscarTicket.addEventListener("click", async () => {
          const codigoTicket = ticketInput.value.trim();
          console.log(`🔍 Buscando ticket: ${codigoTicket}`);
          
          if (!codigoTicket) {
            console.warn("⚠️ Código de ticket vacío");
            return Swal.fire('Error', 'Por favor, ingrese un código de ticket.', 'error');
          }
          try {
            const response = await fetch(`/api/public/buscar-casti?codigo=${codigoTicket}`);
            console.log(`📡 Respuesta ticket: ${response.status}`);
            const result = await response.json();
            console.log("✓ Resultado ticket:", result);
            
            if (result.success) {
              document.getElementById("numeroPedidoInput").value = result.data.Numero_Pedido;
              document.getElementById("idCastiInput").value = result.data.Id_cass;
              ticketInput.classList.remove("is-invalid");
              ticketInput.classList.add("is-valid");
              saveFormState();
              
              // En mobile, feedback visual
              if (window.innerWidth < 768) {
                Swal.fire('Éxito', 'Ticket encontrado', 'success').then(() => {
                  // Buscar el textarea por name, no por id
                  const incidenteField = document.querySelector('textarea[name="incidente_reportado"]');
                  if (incidenteField) {
                    incidenteField.focus();
                    incidenteField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                });
              }
            } else {
              document.getElementById("numeroPedidoInput").value = "";
              document.getElementById("idCastiInput").value = "";
              Swal.fire('Error', result.message || 'Ticket no encontrado', 'error');
              ticketInput.classList.remove("is-valid");
              ticketInput.classList.add("is-invalid");
            }
          } catch (error) {
            console.error("❌ Error buscando ticket:", error);
            Swal.fire('Error', 'Hubo un error de conexión al buscar el ticket.', 'error');
          }
        });
    } else {
        console.error("❌ btnBuscarTicket no encontrado");
    }
  
    // === Lógica para el botón Limpiar Formulario ===
    if (btnLimpiarFormulario) {
        btnLimpiarFormulario.addEventListener("click", () => {
          Swal.fire({
            title: "¿Estás seguro?",
            text: "Se borrarán todos los datos ingresados y guardados temporalmente.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Sí, ¡limpiar todo!",
            cancelButtonText: "Cancelar",
          }).then((result) => {
            if (result.isConfirmed) {
              localStorage.removeItem("informeTemporal");
              form.reset();
              form.dataset.firmaTecnicoPath = null;
              firmaUsuarioPad.clear();
              firmaTecnicoPad.clear();

              // Resetear valores por defecto
              if (fechaServicioInput) {
                fechaServicioInput.value = new Date().toISOString().split("T")[0];
              }
              if (selectContactoCliente) {
                selectContactoCliente.innerHTML = "<option>Seleccione contacto de TI...</option>";
                selectContactoCliente.disabled = true;
              }
              
              const tipoTiRadio = document.getElementById("tipoTi");
              if (tipoTiRadio) tipoTiRadio.checked = true;
              
              // NUEVO: Resetear tipo de informe a "Visita Técnica"
              const tipoVisitaTecnicaRadio = document.getElementById("tipoVisitaTecnica");
              if (tipoVisitaTecnicaRadio) {
                  tipoVisitaTecnicaRadio.checked = true;
                  toggleTipoInforme(); // Aplicar el estado correcto
              }
              
              if (firmaCaradadaMensaje) {
                firmaCaradadaMensaje.textContent = 'Selecciona un técnico para cargar su firma';
                firmaCaradadaMensaje.style.display = 'block';
              }
              if (firmaCaradadaImg) firmaCaradadaImg.style.display = 'none';
              if (canvasTecnicoContainer) canvasTecnicoContainer.classList.add('d-none');
              
              const tipoVisitaRadio = document.getElementById("tipoVisita");
              if (tipoVisitaRadio) {
                  tipoVisitaRadio.checked = true; 
                  toggleTipoInforme();
              }

              if (tiContainer) tiContainer.classList.remove("d-none");
              if (usuarioFinalContainer) usuarioFinalContainer.classList.add("d-none");
              if (ticketInput) ticketInput.classList.remove("is-valid", "is-invalid");

              Swal.fire("¡Limpiado!", "El formulario ha sido reiniciado.", "success");
            }
          });
        });
    } else {
        console.warn("⚠️ btnLimpiarFormulario no encontrado");
    }
  
    // Envío del Formulario
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      // Validaciones previas
      if (!idEquipoInput.value) {
        return Swal.fire('Error', 'Debes buscar un equipo válido antes de guardar.', 'error');
      }
      
      if (!selectTecnico.value) {
        return Swal.fire('Error', 'Debes seleccionar un técnico.', 'error');
      }
      
      // NUEVO: Validación opcional de firma del cliente con confirmación
      if (firmaUsuarioPad.isEmpty()) {
        const confirmacionSinFirma = await Swal.fire({
          title: '⚠️ Firma del Cliente Faltante',
          html: '<p>No se ha registrado la firma del cliente.</p><p><strong>¿Deseas continuar sin la firma?</strong></p>',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#f39c12',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Sí, continuar sin firma',
          cancelButtonText: 'Cancelar y agregar firma'
        });
        
        if (!confirmacionSinFirma.isConfirmed) {
          return; // Usuario decide agregar la firma
        }
      }

      // NUEVO: Confirmación antes de guardar
      const confirmacion = await Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas registrar este informe de campo?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0d6efd',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, registrar',
        cancelButtonText: 'Cancelar'
      });
      
      if (!confirmacion.isConfirmed) {
        return; // Usuario canceló
      }

      // NUEVO: Mostrar loader
      Swal.fire({
        title: 'Guardando informe...',
        html: 'Por favor espera mientras se procesa la información.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Obtener firma del usuario (puede ser vacía si el usuario decidió continuar sin firma)
      const firmaUsuarioValue = firmaUsuarioPad.isEmpty() ? '' : firmaUsuarioPad.toDataURL();
      document.querySelector('input[name="firma_usuario"]').value = firmaUsuarioValue;
      
      // Obtener firma del técnico (puede ser ruta del perfil O Base64 del canvas si dibujó)
      let firmaTecnicoValue = '';
      
      // Si existe una ruta guardada (significa que se cargó la firma del técnico)
      if (form.dataset.firmaTecnicoPath) {
        // Usar la ruta guardada (la firma del perfil del técnico)
        firmaTecnicoValue = form.dataset.firmaTecnicoPath;
      } else if (!firmaTecnicoPad.isEmpty()) {
        // Si no hay ruta pero dibujó algo en el canvas, usar el Base64
        firmaTecnicoValue = canvasTecnico.toDataURL();
      } else {
        Swal.close(); // Cerrar loader
        return Swal.fire('Error', 'Debe cargarse una firma del técnico válida.', 'error');
      }
      
      document.querySelector('input[name="firma_tecnico"]').value = firmaTecnicoValue;
      
      const formData = new FormData(form);
      
      // Si es modo Incidencia (manual), concatenar "INC-" al ticket
      const tipoInforme = document.querySelector('input[name="tipo_informe"]:checked')?.value;
      if (tipoInforme === "Incidencia") {
        const ticketManualInput = document.getElementById('ticketManualInput');
        if (ticketManualInput && ticketManualInput.value.trim()) {
          // Concatenar INC- con el valor ingresado
          formData.set("ticket_manual", "INC-" + ticketManualInput.value.trim());
        }
      }
      
      // Lógica para enviar solo el ID del firmante correcto
      const firmanteType = formData.get("firmante_type");
      if (firmanteType === "Client_Ti") {
        const firmanteTiId = formData.get("firmante_ti_id");
        if (!firmanteTiId) {
          Swal.close(); // Cerrar loader
          return Swal.fire('Error', 'Debes seleccionar un personal de TI.', 'error');
        }
        formData.append("firmante_id", firmanteTiId);
      } else {
        const firmanteUfId = formData.get("firmante_uf_id");
        if (!firmanteUfId) {
          Swal.close(); // Cerrar loader
          return Swal.fire('Error', 'Debes seleccionar un usuario final.', 'error');
        }
        formData.append("firmante_id", firmanteUfId);
      }
      // Limpiamos los IDs auxiliares para no ensuciar el request
      formData.delete("firmante_ti_id");
      formData.delete("firmante_uf_id");

      try {
        const response = await fetch("/api/public/guardar-informe", {
          method: "POST",
          headers: { 'x-csrf-token': getCsrfToken() },
          body: formData,
        });
        const result = await response.json();
        
        Swal.close(); // Cerrar loader
        
        if (result.success) {
          localStorage.removeItem("informeTemporal");
          
          // Usar SweetAlert para éxito
          Swal.fire({
              title: '¡Éxito!',
              text: result.message,
              icon: 'success',
              confirmButtonText: 'Aceptar'
          }).then(() => {
              window.location.href = "/menu-central";
          });
  
        } else {
          Swal.fire('Error', result.message || 'Error desconocido al guardar el informe.', 'error');
        }
      } catch (error) {
        console.error("Error guardando informe:", error);
        Swal.close(); // Cerrar loader
        Swal.fire('Error', 'Error de conexión al guardar el informe.', 'error');
      }
    });
  
    // =====================================================
    // FUNCIONALIDAD: Registro de nuevo usuario final
    // =====================================================
    if (formUsuarioFinal && usuarioFinalModal) {
        formUsuarioFinal.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nombre = document.getElementById('usuarioFinalNombre').value.trim();
            const cel = document.getElementById('usuarioFinalCel').value.trim();
            const correo = document.getElementById('usuarioFinalCorreo').value.trim();
            const id_empresa = idEmpresaInput.value;
            
            if (!nombre) {
                return Swal.fire('Error', 'El nombre es requerido.', 'error');
            }
            
            if (!id_empresa) {
                return Swal.fire('Error', 'Primero debes buscar un equipo para identificar la empresa.', 'warning');
            }
            
            // Mostrar loader
            Swal.fire({
                title: 'Guardando...',
                text: 'Registrando usuario final',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            
            try {
                const response = await fetch('/api/public/usuario-final', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': getCsrfToken()
                    },
                    body: JSON.stringify({ nombre, cel, correo, id_empresa })
                });
                
                const result = await response.json();
                
                Swal.close();
                
                if (result.success) {
                    // Agregar el nuevo usuario al select
                    selectUsuarioFinal.innerHTML += `<option value="${result.data.id}" selected>${result.data.nombre}</option>`;
                    selectUsuarioFinal.value = result.data.id;
                    
                    // Limpiar el formulario
                    formUsuarioFinal.reset();
                    
                    // Cerrar modal
                    usuarioFinalModal.hide();
                    
                    // Mensaje de éxito
                    Swal.fire('Éxito', result.message, 'success');
                    
                    // Guardar estado
                    saveFormState();
                } else {
                    Swal.fire('Error', result.message || 'No se pudo registrar el usuario.', 'error');
                }
            } catch (error) {
                console.error('Error registrando usuario final:', error);
                Swal.close();
                Swal.fire('Error', 'Error de conexión al registrar el usuario.', 'error');
            }
        });
    }
  
    // Cargar el estado guardado al iniciar
    if (!fechaServicioInput.value) {
      fechaServicioInput.value = new Date().toISOString().split("T")[0];
    }
    loadFormState();
  });