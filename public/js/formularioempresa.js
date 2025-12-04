document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let currentStep = 1;
    const totalSteps = 2;
    const form = document.getElementById('empresa-form');
    let cropper = null;
    let croppedBlob = null;

    // --- Element References ---
    const steps = document.querySelectorAll('.form-step');
    const progressLine = document.getElementById('progress-line');
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnSubmit = document.getElementById('btn-submit');

    // --- File Upload Elements ---
    const dropZone = document.getElementById('drop-zone');
    const logoInput = document.getElementById('logo');
    const previewImage = document.getElementById('logo-preview');
    const dropZonePrompt = document.getElementById('drop-zone-prompt');
    const cropperContainer = document.getElementById('cropper-container');

    // --- Input References ---
    const nombreInput = document.getElementById('nombre');
    const direccionInput = document.getElementById('direccion');
    const slugInput = document.getElementById('slug');

    // --- Slug Generation ---
    const toSlug = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
    };
    nombreInput.addEventListener('input', () => {
        slugInput.value = toSlug(nombreInput.value);
    });

    // --- Wizard Navigation Logic ---
    const updateWizard = () => {
        // 1. Mostrar/Ocultar pasos del formulario
        steps.forEach(step => {
            step.style.display = step.dataset.step == currentStep ? 'block' : 'none';
        });

        // 2. Actualizar indicadores visuales (Círculos)
        for (let i = 1; i <= totalSteps; i++) {
            const indicator = document.getElementById(`step-indicator-${i}`);
            if (i <= currentStep) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        }

        // 3. Animar barra de progreso
        // Si paso 1 (de 2) -> 0% | Si paso 2 -> 100%
        const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
        progressLine.style.width = `${progressPercentage}%`;

        // 4. Control de botones
        btnPrev.style.display = currentStep > 1 ? 'inline-flex' : 'none';
        btnNext.style.display = currentStep < totalSteps ? 'inline-flex' : 'none';
        btnSubmit.style.display = currentStep === totalSteps ? 'inline-flex' : 'none';
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

    const validateStep = (step) => {
        if (step === 1) {
            if (!nombreInput.value.trim() || !direccionInput.value.trim() || !slugInput.value.trim()) {
                showMessage('Por favor, completa todos los campos obligatorios marcados con *.', 'danger');
                return false;
            }
        }
        showMessage(''); // Clear message if valid
        return true;
    };

    // --- File Upload Logic with Cropper.js ---
    dropZone.addEventListener('click', () => {
        if (!cropper) {
            logoInput.click();
        }
    });
    logoInput.addEventListener('change', () => handleFiles(logoInput.files));

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
    });
    dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

    const handleFiles = (files) => {
        if (files.length) {
            const file = files[0];

            const allowedTypes = ['image/jpeg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                showMessage('Formato no válido. Usa JPG o PNG.', 'warning');
                logoInput.value = '';
                return;
            }
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                showMessage('El archivo excede los 5MB permitidos.', 'warning');
                logoInput.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                previewImage.src = e.target.result;
                cropperContainer.classList.remove('d-none');
                dropZonePrompt.classList.add('d-none');

                if (cropper) cropper.destroy();

                cropper = new Cropper(previewImage, {
                    aspectRatio: 1, // Cuadrado forzado
                    viewMode: 1,
                    dragMode: 'move',
                    background: false,
                    autoCropArea: 0.9,
                    guides: true,
                });
                showMessage('');
            };
            reader.readAsDataURL(file);
        }
    };

    const resetFormUI = () => {
        form.reset();
        currentStep = 1;
        updateWizard();
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        croppedBlob = null;
        logoInput.value = '';
        cropperContainer.classList.add('d-none');
        dropZonePrompt.classList.remove('d-none');
        showMessage('');
    };

    // --- Form Submission ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!cropper) {
            return showMessage('Debes subir y confirmar el logo antes de guardar.', 'danger');
        }

        const submitButton = btnSubmit;
        const originalButtonText = submitButton.innerHTML;
        showMessage('');
        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Guardando...`;

        cropper.getCroppedCanvas({
            width: 400,
            height: 400,
            imageSmoothingQuality: 'high',
            fillColor: '#fff' // Fondo blanco si hay transparencias (opcional)
        }).toBlob(async (blob) => {
            croppedBlob = blob;

            const formData = new FormData();
            formData.append('nombre', nombreInput.value.trim());
            formData.append('direccion', direccionInput.value.trim());
            formData.append('slug', slugInput.value.trim());
            formData.append('logo', croppedBlob, `${slugInput.value.trim()}-logo.png`);

            // CSRF Token
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

            try {
                const res = await fetch('/admin/api/registrar-cliente', {
                    method: 'POST',
                    headers: { 'x-csrf-token': csrfToken },
                    body: formData
                });
                const json = await res.json();

                if (res.ok) {
                    showMessage('¡Empresa registrada con éxito! Redirigiendo...', 'success');
                    setTimeout(() => {
                        window.location.href = '/admin/visualizar_empresas';
                    }, 1500);
                } else {
                    showMessage(json.message || 'Error al registrar la empresa.', 'danger');
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                }
            } catch (err) {
                console.error(err);
                showMessage('Error de conexión con el servidor.', 'danger');
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonText;
            }
        }, 'image/png');
    });

    // --- Helper ---
    const showMessage = (text, type = 'success') => {
        const ph = document.getElementById('alert-placeholder');
        if (!text) {
            ph.innerHTML = '';
            return;
        }
        const icon = type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill';
        const colorClass = type === 'success' ? 'alert-success' : (type === 'warning' ? 'alert-warning' : 'alert-danger');

        ph.innerHTML = `
            <div class="alert ${colorClass} d-flex align-items-center border-0 shadow-sm" role="alert">
                <i class="bi ${icon} me-2 fs-5"></i>
                <div>${text}</div>
            </div>
        `;
    };

    // Inicializar wizard
    updateWizard();
});