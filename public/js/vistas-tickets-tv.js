document.addEventListener('DOMContentLoaded', () => {
    
    const gridContainer = document.getElementById('grid-container');
    const nextBatchContainer = document.getElementById('next-batch-container');

    // CONFIGURACIÓN
    const GRID_SIZE = 6; // Cantidad de tickets en pantalla principal (2x3)
    const ROTATION_TIME = 20000; // 20 segundos por página
    const REFRESH_API_TIME = 30000; // 30 segundos consultar al servidor

    let allTickets = [];
    let currentPageIndex = 0; 
    let rotationInterval = null;
    let timerInterval = null;

    // --- CRONÓMETRO CIRCULAR ---
    const timerCircle = document.getElementById('timer-circle');
    const timerValue = document.getElementById('timer-value');
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    
    // Configurar el círculo
    timerCircle.style.strokeDasharray = circumference;
    timerCircle.style.strokeDashoffset = 0;

    let timeLeft = ROTATION_TIME / 1000; // Convertir a segundos

    const updateTimer = () => {
        const progress = timeLeft / (ROTATION_TIME / 1000);
        const offset = circumference * (1 - progress);
        timerCircle.style.strokeDashoffset = offset;
        timerValue.innerHTML = `${timeLeft}<span class="timer-unit">s</span>`;
        
        timeLeft--;
        
        if (timeLeft < 0) {
            timeLeft = ROTATION_TIME / 1000;
        }
    };

    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timeLeft = ROTATION_TIME / 1000;
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }; 

    // --- RENDERIZAR GRID PRINCIPAL ---
    const renderGrid = () => {
        gridContainer.innerHTML = '';
        nextBatchContainer.innerHTML = '';

        if (allTickets.length === 0) {
            gridContainer.innerHTML = '<h2 class="text-muted" style="grid-column: 1/-1; text-align: center; align-self: center;">No hay tickets activos</h2>';
            return;
        }

        // Calcular índices para la página actual
        const start = currentPageIndex;
        const end = start + GRID_SIZE;
        
        // Obtener tickets de la página actual
        // Usamos lógica circular: si hay 10 tickets y pido del 6 al 12, debe mostrar 6,7,8,9,0,1
        const currentBatch = getCircularBatch(allTickets, start, GRID_SIZE);

        // Generar HTML para el Grid
        currentBatch.forEach(ticket => {
            const observaciones = ticket.Observaciones ? ticket.Observaciones.trim() : '';
            const estado = ticket.Estado ? ticket.Estado.trim() : '';
            
            const cardHtml = `
                <div class="grid-ticket-card fade-in">
                    <div class="status-bar bg-${ticket.status.color}"></div>
                    ${estado ? `<div class="ticket-estado-badge">${estado}</div>` : ''}
                    <div class="ticket-status-badge text-${ticket.status.color}">
                        <i class="${ticket.status.icon} me-1"></i> ${ticket.status.text}
                    </div>
                    <div class="ticket-code text-white">${ticket.Codigo_Aranda || 'S/C'}</div>
                    <div class="ticket-meta">${ticket.nombre_empresa || 'Sin empresa'}</div>
                    <div class="mt-2 text-white-50 small">
                        Devolución: ${ticket.Devolver_pieza ? new Date(ticket.Devolver_pieza).toLocaleDateString() : '--'}
                    </div>
                    ${observaciones ? `<div class="ticket-observaciones mt-2">${observaciones}</div>` : ''}
                </div>
            `;
            gridContainer.insertAdjacentHTML('beforeend', cardHtml);
        });

        // Renderizar Panel Derecho (Siguiente Lote)
        // Muestra una vista previa de lo que viene en la próxima rotación
        const nextStart = (start + GRID_SIZE) % allTickets.length;
        const nextBatch = getCircularBatch(allTickets, nextStart, 4); // Mostramos solo 4 en la lista lateral

        nextBatch.forEach(ticket => {
            const miniHtml = `
                <div class="mini-ticket" style="border-left-color: var(--bs-${ticket.status.color})">
                    <div class="fw-bold fs-5 text-white">${ticket.Codigo_Aranda}</div>
                    <div class="small text-muted">${ticket.status.text}</div>
                </div>
            `;
            nextBatchContainer.insertAdjacentHTML('beforeend', miniHtml);
        });
    };

    // --- FUNCIÓN AUXILIAR PARA OBTENER LOTE CIRCULAR ---
    const getCircularBatch = (array, startIndex, count) => {
        const result = [];
        for (let i = 0; i < count; i++) {
            // Si el array es más pequeño que el Grid, solo muestra lo que hay sin repetir
            if (i >= array.length) break; 
            
            const index = (startIndex + i) % array.length;
            result.push(array[index]);
        }
        return result;
    };
    
    // --- API Y DATOS ---
    const loadData = async () => {
        try {
            const response = await fetch(`/public-api/all-tickets-status/${APP_TOKEN}`);
            const result = await response.json();
            if (result.success) {
                // Opcional: Ordenar por prioridad o estado si deseas
                allTickets = result.data;
                
                // Si la paginación quedó fuera de rango tras actualizar, resetear
                if (currentPageIndex >= allTickets.length) currentPageIndex = 0;
                
                // Renderizar inmediatamente si es la primera carga
                if (gridContainer.children.length === 0) renderGrid();
            }
        } catch (error) { console.error('Error cargando tickets:', error); }
    };

    // --- ROTACIÓN ---
    const startRotation = () => {
        if (rotationInterval) clearInterval(rotationInterval);
        rotationInterval = setInterval(() => {
            if (allTickets.length > GRID_SIZE) {
                // Avanzar página
                currentPageIndex = (currentPageIndex + GRID_SIZE) % allTickets.length;
                renderGrid();
                startTimer(); // Reiniciar cronómetro
            } else if (allTickets.length > 0 && gridContainer.children.length === 0) {
                 // Si hay pocos tickets y no se ha renderizado (caso borde)
                 renderGrid();
            }
        }, ROTATION_TIME);
    };

    // INICIALIZACIÓN
    loadData();
    setInterval(loadData, REFRESH_API_TIME); // Actualizar datos de fondo
    startRotation(); // Iniciar animación de pantalla
    startTimer(); // Iniciar cronómetro
});