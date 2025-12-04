document.addEventListener('DOMContentLoaded', () => {
    // Referencias
    const kpiContainer = document.getElementById('kpi-estados-container');
    const garantiasChartContainer = document.getElementById('garantiasChart');
    const piezasChartContainer = document.getElementById('piezasChart');

    // Mapeo de colores e iconos para los estados
    const estadoStyles = {
        'En Espera de Pieza': { color: 'secondary', icon: 'bi-box-seam' },
        'En Proceso de Reparación': { color: 'primary', icon: 'bi-tools' },
        'Próximo a Devolver': { color: 'warning', icon: 'bi-alarm-fill' },
        'Devolución Vencida': { color: 'danger', icon: 'bi-exclamation-triangle-fill' },
        'Devolución Extendida': { color: 'info', icon: 'bi-clock-history' },
        'Finalizado y Devuelto': { color: 'success', icon: 'bi-check-circle-fill' }
    };
    
    // Función para renderizar el gráfico de garantías
    const renderGarantiasChart = (data) => {
        const options = {
            series: data.map(item => item.cantidad),
            labels: data.map(item => item.Tipo_garantia),
            chart: { type: 'donut', height: 350 },
            legend: { position: 'bottom' },
            responsive: [{ breakpoint: 480, options: { chart: { width: 200 }, legend: { position: 'bottom' } } }]
        };
        const chart = new ApexCharts(garantiasChartContainer, options);
        chart.render();
    };

    // Función para renderizar el gráfico de piezas
    const renderPiezasChart = (data) => {
        const options = {
            series: [{ name: 'Cantidad', data: data.map(p => p.cantidad) }],
            chart: { type: 'bar', height: 350, toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, horizontal: true } },
            dataLabels: { enabled: true, offsetX: -10, style: { colors: ['#fff'] } },
            xaxis: { categories: data.map(p => p.pieza) },
        };
        const chart = new ApexCharts(piezasChartContainer, options);
        chart.render();
    };

    // Carga de todos los datos del dashboard
    fetch('/admin/casti/dashboard-summary')
        .then(res => res.json())
        .then(result => {
            if (!result.success) return;
            const { data } = result;

            // Renderizar KPIs de Estados
            kpiContainer.innerHTML = '';
            for (const [estado, cantidad] of Object.entries(data.estados)) {
                if (cantidad > 0) {
                    const style = estadoStyles[estado] || { color: 'dark', icon: 'bi-question-circle' };
                    kpiContainer.innerHTML += `
                        <div class="col-xl-2 col-md-4 col-sm-6">
                            <div class="card kpi-card border-${style.color} shadow-sm">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <div class="kpi-label text-uppercase small">${estado}</div>
                                            <div class="kpi-value">${cantidad}</div>
                                        </div>
                                        <i class="bi ${style.icon} fs-2 text-${style.color} opacity-50"></i>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                }
            }

            // Renderizar gráficos
            if (data.garantias && data.garantias.length > 0) renderGarantiasChart(data.garantias);
            if (data.piezas && data.piezas.length > 0) renderPiezasChart(data.piezas);
        });
});