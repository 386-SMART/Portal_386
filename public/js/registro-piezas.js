document.addEventListener('DOMContentLoaded', () => {
    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // --- SELECTORES DEL DOM ---
    const form = document.getElementById('form-registro-piezas');
    const empresaSelect = document.getElementById('id_empresa');
    const serieInput = document.getElementById('Numero_serie');
    const modeloInput = document.getElementById('Modelo_equipo');
    const llegadaPiezaInput = document.getElementById('llegada-pieza');
    const devolverPiezaInput = document.getElementById('devolver-pieza');

    // --- WIZARD ELEMENTS ---
    let currentStep = 1;
    const totalSteps = 5;
    const steps = document.querySelectorAll(".form-step");
    const progressSteps = document.querySelectorAll(".progress-step");
    const progressLine = document.getElementById("progress-line");
    const btnNext = document.getElementById("btn-next");
    const btnPrev = document.getElementById("btn-prev");
    const btnSubmit = document.getElementById("btn-submit");

    // --- LÓGICA DEL WIZARD ---
    const updateWizard = () => {
        steps.forEach(step => {
            step.style.display = step.dataset.step == currentStep ? "block" : "none";
        });
        progressSteps.forEach((step, index) => {
            step.classList.toggle("active", index < currentStep);
        });
        progressLine.style.width = `${((currentStep - 1) / (totalSteps - 1)) * 100}%`;
        btnPrev.style.display = currentStep > 1 ? "inline-block" : "none";
        btnNext.style.display = currentStep < totalSteps ? "inline-block" : "none";
        btnSubmit.style.display = currentStep === totalSteps ? "inline-block" : "none";
    };

    const validateStep = (step) => {
        if (step === 1) {
            if (!empresaSelect.value || !serieInput.value) {
                Swal.fire('Campos Incompletos', 'Por favor, seleccione una empresa e ingrese un número de serie.', 'warning');
                return false;
            }
        }
        // Puedes añadir más validaciones para otros pasos aquí si es necesario
        return true;
    };

    btnNext.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            currentStep++;
            updateWizard();
        }
    });

    btnPrev.addEventListener('click', () => {
        currentStep--;
        updateWizard();
    });

    // --- FUNCIONALIDAD EXISTENTE ---
    empresaSelect.addEventListener('change', () => {
        serieInput.disabled = !empresaSelect.value;
        serieInput.placeholder = empresaSelect.value ? 'Escriba para buscar...' : 'Seleccione una empresa primero';
    });

    serieInput.addEventListener('blur', async (e) => {
        const empresaId = empresaSelect.value;
        const serie = e.target.value;
        if (!empresaId || !serie) return;
        try {
            const response = await fetch(`/admin/casti/equipos-por-empresa?empresaId=${empresaId}&serie=${serie}`);
            const equipos = await response.json();
            modeloInput.value = equipos.length > 0 ? equipos[0].modelo : '';
        } catch(error) { console.error("Error al buscar equipo:", error); }
    });
    
    if (llegadaPiezaInput) {
        llegadaPiezaInput.addEventListener('change', () => {
            if (!llegadaPiezaInput.value) {
                devolverPiezaInput.value = '';
                return;
            }
            const dateParts = llegadaPiezaInput.value.split('-');
            const llegada = new Date(Date.UTC(dateParts[0], parseInt(dateParts[1], 10) - 1, dateParts[2]));
            llegada.setUTCDate(llegada.getUTCDate() + 6);
            const dayOfWeek = llegada.getUTCDay();
            if (dayOfWeek === 6) llegada.setUTCDate(llegada.getUTCDate() + 2);
            else if (dayOfWeek === 0) llegada.setUTCDate(llegada.getUTCDate() + 1);
            devolverPiezaInput.value = llegada.toISOString().split('T')[0];
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.standardParts = Array.from(form.querySelectorAll('input[name="standardParts"]:checked')).map(cb => cb.value);
        
        try {
            const response = await fetch('/admin/casti/casti-tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (response.ok) {
                await Swal.fire('¡Éxito!', result.message, 'success');
                form.reset();
                currentStep = 1;
                updateWizard();
                serieInput.disabled = true;
                serieInput.placeholder = 'Seleccione una empresa primero';
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error de Conexión', 'No se pudo registrar el ticket.', 'error');
        }
    });

    // --- INICIALIZACIÓN DEL WIZARD ---
    updateWizard(); 
});