document.addEventListener('DOMContentLoaded', () => {
    let chartCategorias = null;
    let chartModelos = null;

    // --- Configuración Global de Fuentes ---
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    // --- Paleta de Colores Premium (Azules/Indigo/Teal) ---
    const PREMIUM_COLORS = [
        '#3b82f6', // Blue 500
        '#6366f1', // Indigo 500
        '#14b8a6', // Teal 500
        '#f59e0b', // Amber 500
        '#ec4899', // Pink 500
        '#8b5cf6', // Violet 500
        '#06b6d4', // Cyan 500
        '#10b981', // Emerald 500
    ];

    const loadChartsData = async () => {
        try {
            const response = await fetch('/admin/api/dashboard-charts');
            const result = await response.json();

            if (result.success) {
                createChartCategorias(result.data.equiposPorCategoria);
                createChartModelos(result.data.equiposPorModelo);
            } else {
                console.error('Error API:', result.message);
            }
        } catch (error) {
            console.error('Error de conexión:', error);
        }
    };

    const createChartCategorias = (data) => {
        const canvas = document.getElementById('chart-categorias');
        if (!canvas) return;

        const labels = data.map(item => item.nombre);
        const values = data.map(item => item.cantidad);
        const total = values.reduce((a, b) => a + b, 0);

        if (chartCategorias) chartCategorias.destroy();

        chartCategorias = new Chart(canvas.getContext('2d'), {
            type: 'bar', // Gráfico de barras horizontal
            data: {
                labels: labels,
                datasets: [{
                    label: 'Equipos',
                    data: values,
                    backgroundColor: PREMIUM_COLORS,
                    borderRadius: 6,
                    barThickness: 20, // Barras más finas y elegantes
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 30 } }, // Espacio para las etiquetas
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        callbacks: {
                            label: (ctx) => {
                                const pct = ((ctx.parsed.x / total) * 100).toFixed(1);
                                return ` ${ctx.parsed.x} equipos (${pct}%)`;
                            }
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'right',
                        offset: 4,
                        color: '#475569',
                        font: { weight: '600', size: 11 },
                        formatter: (value) => value
                    }
                },
                scales: {
                    x: {
                        display: false, // Ocultar eje X para limpieza
                        grid: { display: false }
                    },
                    y: {
                        grid: { display: false }, // Sin líneas verticales
                        ticks: {
                            font: { size: 11, weight: '500' },
                            color: '#334155',
                            autoSkip: false
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    };

    const createChartModelos = (data) => {
        const canvas = document.getElementById('chart-modelos');
        if (!canvas) return;

        const labels = data.map(item => item.modelo);
        const values = data.map(item => item.cantidad);

        // Gradiente para el Top 1
        const ctx = canvas.getContext('2d');
        const gradientTop = ctx.createLinearGradient(0, 0, 0, 400);
        gradientTop.addColorStop(0, '#3b82f6');
        gradientTop.addColorStop(1, '#60a5fa');

        const bgColors = values.map((_, i) => i === 0 ? gradientTop : '#cbd5e1'); // Top 1 azul, resto gris

        if (chartModelos) chartModelos.destroy();

        chartModelos = new Chart(ctx, {
            type: 'bar', // Barras verticales
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cantidad',
                    data: values,
                    backgroundColor: bgColors,
                    borderRadius: 8,
                    barThickness: 30,
                    hoverBackgroundColor: '#3b82f6' // Azul al pasar mouse
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            title: (ctx) => ctx[0].label,
                            label: (ctx) => ` ${ctx.parsed.y} unidades`
                        }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        offset: -4,
                        color: (ctx) => ctx.dataIndex === 0 ? '#2563eb' : '#64748b', // Color destacado para el 1ro
                        font: { weight: 'bold', size: 12 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { display: false } // Ocultamos nombres abajo para que no se amontonen
                    },
                    y: {
                        display: false, // Ocultamos eje Y para diseño minimalista
                        grid: { display: false }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    };

    loadChartsData();
});