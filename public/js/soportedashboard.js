document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS DEL DOM ---
    const kpiPreparacion = document.getElementById('kpi-preparacion');
    const kpiInventario = document.getElementById('kpi-inventario');
    const graficoCanvas = document.getElementById('grafico-estados').getContext('2d');
    const tablaTopContratos = document.getElementById('tabla-top-contratos');

    let miGrafico; // Variable para mantener la instancia del gráfico y destruirla si existe

    // --- FUNCIÓN PARA DIBUJAR EL GRÁFICO ---
    const renderizarGrafico = (datosGrafico) => {
        if (miGrafico) {
            miGrafico.destroy(); // Destruir gráfico anterior para evitar conflictos
        }

        const etiquetas = datosGrafico.map(d => d.estado);
        const valores = datosGrafico.map(d => d.cantidad);
        
        const colores = [
            '#0d6efd', // Primary
            '#198754', // Success
            '#ffc107', // Warning
            '#dc3545', // Danger
            '#6c757d', // Secondary
        ];

        miGrafico = new Chart(graficoCanvas, {
            type: 'pie', // Tipo de gráfico
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Cantidad de Equipos',
                    data: valores,
                    backgroundColor: colores,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed;
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    };

    // --- FUNCIÓN PARA CARGAR LOS DATOS DEL DASHBOARD ---
    const cargarDashboard = async () => {
        try {
            const response = await fetch('/admin/soporteti/dashboard-summary');
            const result = await response.json();

            if (result.success) {
                // Actualizar KPIs
                kpiPreparacion.textContent = result.kpis.enPreparacion;
                kpiInventario.textContent = result.kpis.enInventario;

                // Renderizar el gráfico de estados
                if (result.graficoEstados && result.graficoEstados.length > 0) {
                    renderizarGrafico(result.graficoEstados);
                } else {
                     graficoCanvas.canvas.parentElement.innerHTML = '<p class="text-center text-muted mt-3">No hay datos de estado en el inventario principal.</p>';
                }
                
                // Llenar la tabla de top contratos
                tablaTopContratos.innerHTML = ''; // Limpiar tabla
                if (result.topContratosPendientes && result.topContratosPendientes.length > 0) {
                    result.topContratosPendientes.forEach(contrato => {
                        const fila = `
                            <tr>
                                <td>
                                    <div class="fw-bold">${contrato.nombre_contrato}</div>
                                </td>
                                <td>
                                    <div class="text-muted">${contrato.nombre_empresa}</div>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-danger rounded-pill fs-6">${contrato.cantidad}</span>
                                </td>
                            </tr>
                        `;
                        tablaTopContratos.innerHTML += fila;
                    });
                } else {
                    tablaTopContratos.innerHTML = '<tr><td colspan="3" class="text-center text-muted">¡Felicidades! No hay equipos pendientes de migración.</td></tr>';
                }
            }

        } catch (error) {
            console.error('Error al cargar datos del dashboard:', error);
        }
    };

    // Cargar los datos al iniciar la página
    cargarDashboard();
});