document.addEventListener('DOMContentLoaded', () => {
    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // --- Referencias a Elementos ---
    const listContainer = document.getElementById('contacts-list-container');
    const btnAddContact = document.getElementById('btn-add-contact');
    const contactModal = new bootstrap.Modal(document.getElementById('contact-modal'));
    const contactForm = document.getElementById('contact-form');
    const modalTitle = document.getElementById('modal-title');
    const btnSaveContact = document.getElementById('btn-save-contact');
    const contactIdInput = document.getElementById('contact-id');
    const contactCounter = document.getElementById('contact-counter');
    const contactProgressBar = document.getElementById('contact-progress-bar');
    
    const slug = window.location.pathname.split('/')[1];
    const API_URL = `/${slug}/api/contactos-ti`;
    
    // --- Cargar y Renderizar Contactos ---
    const loadContacts = async () => {
        try {
            const response = await fetch(API_URL);
            const result = await response.json();
            
            listContainer.innerHTML = '';
            
            if (result.success && result.data.length > 0) {
                result.data.forEach(contact => {
                    const initials = (contact.Nombre || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    const cardHtml = `
                        <div class="contact-card">
                            <div class="contact-avatar me-3">${initials}</div>
                            <div class="flex-grow-1 contact-info">
                                <h6 class="fw-bold mb-1">${contact.Nombre}</h6>
                                <div class="d-flex flex-wrap gap-3">
                                    ${contact.Cel ? `<a href="tel:${contact.Cel}" class="icon-link"><i class="bi bi-telephone-fill me-1"></i> ${contact.Cel}</a>` : ''}
                                    ${contact.Correo ? `<a href="mailto:${contact.Correo}" class="icon-link"><i class="bi bi-envelope-fill me-1"></i> ${contact.Correo}</a>` : ''}
                                </div>
                            </div>
                            <div class="ms-auto">
                                <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${contact.id_ti_usuario}" title="Editar"><i class="bi bi-pencil-fill"></i></button>
                                <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${contact.id_ti_usuario}" title="Eliminar"><i class="bi bi-trash-fill"></i></button>
                            </div>
                        </div>`;
                    listContainer.insertAdjacentHTML('beforeend', cardHtml);
                });
            } else {
                // Estado Vacío Mejorado
                listContainer.innerHTML = `
                    <div class="text-center p-5">
                        <i class="bi bi-people-fill" style="font-size: 3rem; color: #ced4da;"></i>
                        <h5 class="mt-3">No hay contactos</h5>
                        <p class="text-muted">Aún no has añadido ningún contacto técnico. ¡Añade el primero!</p>
                    </div>`;
            }
            
            // Actualizar contador y barra de progreso
            const count = result.count || 0;
            const limit = result.limit || 10;
            contactCounter.textContent = `${count} de ${limit} registros`;
            const percentage = (count / limit) * 100;
            contactProgressBar.style.width = `${percentage}%`;
            contactProgressBar.setAttribute('aria-valuenow', count);
            btnAddContact.disabled = count >= limit;

        } catch (error) {
            console.error("Error al cargar contactos:", error);
            listContainer.innerHTML = '<div class="alert alert-danger m-3">No se pudieron cargar los contactos.</div>';
        }
    };

    // --- Abrir Modal (sin cambios lógicos) ---
    const openModal = (contact = {}) => {
        contactForm.reset();
        const isEditing = !!contact.id_ti_usuario;
        
        modalTitle.textContent = isEditing ? 'Editar Contacto' : 'Añadir Nuevo Contacto';
        btnSaveContact.textContent = isEditing ? 'Guardar Cambios' : 'Crear Contacto';
        
        contactIdInput.value = contact.id_ti_usuario || '';
        document.getElementById('contact-nombre').value = contact.Nombre || '';
        document.getElementById('contact-cel').value = contact.Cel || '';
        document.getElementById('contact-correo').value = contact.Correo || '';
        
        contactModal.show();
    };

    // --- Manejo de Eventos ---
    btnAddContact.addEventListener('click', () => openModal());

    listContainer.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');

        if (editBtn) {
            const id = editBtn.dataset.id;
            fetch(API_URL).then(r => r.json()).then(res => {
                const contact = res.data.find(c => c.id_ti_usuario == id);
                if (contact) openModal(contact);
            });
        }
        
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            Swal.fire({
                title: '¿Estás seguro?',
                text: "No podrás revertir esta acción.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const response = await fetch(`${API_URL}/${id}`, { 
                            method: 'DELETE',
                            headers: { 'x-csrf-token': getCsrfToken() }
                        });
                        const resJson = await response.json();
                        Swal.fire(resJson.success ? '¡Eliminado!' : 'Error', resJson.message, resJson.success ? 'success' : 'error');
                        loadContacts();
                    } catch (error) {
                        Swal.fire('Error', 'No se pudo conectar al servidor.', 'error');
                    }
                }
            });
        }
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = contactIdInput.value;
        const url = id ? `${API_URL}/${id}` : API_URL;
        const method = id ? 'PATCH' : 'POST';
        
        const body = {
            Nombre: document.getElementById('contact-nombre').value,
            Cel: document.getElementById('contact-cel').value,
            Correo: document.getElementById('contact-correo').value,
        };

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            Swal.fire(response.ok ? '¡Éxito!' : 'Error', result.message, response.ok ? 'success' : 'error');

            if (response.ok) {
                contactModal.hide();
                loadContacts();
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo conectar al servidor.', 'error');
        }
    });
    
    // --- Carga Inicial ---
    loadContacts();
});