document.addEventListener('DOMContentLoaded', () => {
    const reportList = document.getElementById('report-selector-list');
    const reportIframe = document.getElementById('report-iframe');
    const reportSelectorBtn = document.getElementById('report-selector-btn');

    // Si no hay elementos, no hacer nada.
    if (!reportList || !reportIframe || !reportSelectorBtn) {
        return;
    }

    // Función para actualizar el estado
    const updateSelection = (selectedItem) => {
        // Remover 'active' de todos los items
        reportList.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
        
        // Añadir 'active' al item seleccionado
        selectedItem.classList.add('active');

        // Actualizar el texto del botón principal
        const newText = selectedItem.dataset.text;
        reportSelectorBtn.textContent = newText;

        // Actualizar el iframe
        const newUrl = selectedItem.dataset.url;
        if (newUrl) {
            reportIframe.src = newUrl;
        }
    };

    // Configuración inicial al cargar la página
    const initialActiveItem = reportList.querySelector('.dropdown-item.active');
    if (initialActiveItem) {
        updateSelection(initialActiveItem);
    }

    // Añadir el evento 'click' a la lista (delegación de eventos)
    reportList.addEventListener('click', (event) => {
        event.preventDefault();
        const clickedItem = event.target.closest('.dropdown-item');
        if (clickedItem) {
            updateSelection(clickedItem);
        }
    });
});