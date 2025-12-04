document.addEventListener('DOMContentLoaded', () => {
    // Obtener el token CSRF del meta tag
    const getCsrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    const searchInput = document.getElementById('search-ticket-input');
    const searchBtn = document.getElementById('search-ticket-btn');
    const searchResults = document.getElementById('search-results');
    const excelForm = document.getElementById('form-generate-excel');
    const ticketBatchList = document.getElementById('ticket-batch-list');
    const batchCount = document.getElementById('batch-count');
    
    let ticketBatch = []; // Array para almacenar los tickets seleccionados

    const remitentes = {
        surquillo: { nombre: "386 SMART S.A.C", ruc: "20601001285", direccion: "Av. Guardia Civil, Surquillo\nLima - Perú" },
        tacna: { nombre: "386 SMART S.A.C", ruc: "20601001285", direccion: "Urbanizacion Fatima A1\nTacna - Perú" }
    };

    // --- RENDERIZAR LA LISTA DE TICKETS SELECCIONADOS ---
    const renderBatchList = () => {
        ticketBatchList.innerHTML = '';
        if (ticketBatch.length === 0) {
            ticketBatchList.innerHTML = '<li class="list-group-item text-muted">Añade tickets desde la búsqueda.</li>';
        } else {
            ticketBatch.forEach(ticket => {
                const item = `<li class="list-group-item d-flex justify-content-between align-items-center">${ticket.displayText}<button class="btn-close remove-ticket-btn" data-id="${ticket.id}"></button></li>`;
                ticketBatchList.insertAdjacentHTML('beforeend', item);
            });
        }
        batchCount.textContent = ticketBatch.length;
    };

    // --- BÚSQUEDA DE TICKETS ---
    searchBtn.addEventListener('click', async () => {
        const searchTerm = searchInput.value;
        if (searchTerm.length < 3) return;
        const response = await fetch(`/admin/casti/casti-tickets?searchTerm=${searchTerm}`);
        const result = await response.json();
        searchResults.innerHTML = '';
        if (result.success && result.data.length > 0) {
            result.data.forEach(ticket => {
                const displayText = `${ticket.Hp_Orden_Number || ticket.Codigo_Aranda} - ${ticket.Numero_serie}`;
                const item = `<a href="#" class="list-group-item list-group-item-action add-ticket-btn" data-id="${ticket.Id_cass}" data-display="${displayText}">Añadir: ${displayText}</a>`;
                searchResults.insertAdjacentHTML('beforeend', item);
            });
        } else {
            searchResults.innerHTML = '<div class="list-group-item">No se encontraron tickets.</div>';
        }
    });

    // --- AÑADIR/QUITAR TICKETS DEL LOTE ---
    searchResults.addEventListener('click', e => {
        if (e.target.classList.contains('add-ticket-btn')) {
            e.preventDefault();
            const id = e.target.dataset.id;
            // Evitar duplicados
            if (!ticketBatch.some(t => t.id === id)) {
                ticketBatch.push({ id: id, displayText: e.target.dataset.display });
                renderBatchList();
            }
        }
    });
    ticketBatchList.addEventListener('click', e => {
        if (e.target.classList.contains('remove-ticket-btn')) {
            const id = e.target.dataset.id;
            ticketBatch = ticketBatch.filter(t => t.id !== id);
            renderBatchList();
        }
    });

    // --- GENERACIÓN Y DESCARGA DEL EXCEL ---
    excelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (ticketBatch.length === 0) {
            Swal.fire('Error', 'Debes añadir al menos un ticket al reporte.', 'error');
            return;
        }

        const formData = new FormData(excelForm);
        const manualData = Object.fromEntries(formData.entries());
        
        // Añadir datos del remitente seleccionado
        const remitenteKey = document.getElementById('remitente-select').value;
        manualData.remitenteNombre = remitentes[remitenteKey].nombre;
        manualData.remitenteRUC = remitentes[remitenteKey].ruc;
        manualData.remitenteDireccion = remitentes[remitenteKey].direccion;

        const ticketIds = ticketBatch.map(t => t.id);

        try {
            const response = await fetch('/admin/casti/generate-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json',
                    'x-csrf-token': getCsrfToken()
                },
                body: JSON.stringify({ ticketIds, manualData })
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || 'Error en el servidor');
            }
            
            const blob = await response.blob();
            const filename = response.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            Swal.fire('Error', `No se pudo generar el archivo: ${error.message}`, 'error');
        }
    });
});