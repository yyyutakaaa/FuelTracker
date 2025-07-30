// FuelTracker - Chart Service

export class ChartService {
    constructor() {
        this.chart = null;
    }
    
    updateChart(history) {
        const ctx = document.getElementById('costChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Prepare data
        const labels = history.map(trip => {
            const date = new Date(trip.date);
            return date.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
        });
        
        const costs = history.map(trip => parseFloat(trip.cost));
        const distances = history.map(trip => parseFloat(trip.distance));
        
        // Get theme
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#f3f4f6' : '#1f2937';
        const gridColor = isDark ? '#374151' : '#e5e7eb';
        
        // Create chart
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Kosten (€)',
                        data: costs,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        yAxisID: 'y',
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Afstand (km)',
                        data: distances,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.3,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: textColor,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                        titleColor: textColor,
                        bodyColor: textColor,
                        borderColor: gridColor,
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            afterLabel: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Prijs/L: €${history[context.dataIndex].fuelPrice}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: textColor,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Kosten (€)',
                            color: textColor
                        },
                        grid: {
                            color: gridColor,
                            drawBorder: false
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return '€' + value.toFixed(2);
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Afstand (km)',
                            color: textColor
                        },
                        grid: {
                            drawOnChartArea: false,
                            color: gridColor
                        },
                        ticks: {
                            color: textColor,
                            callback: function(value) {
                                return value + ' km';
                            }
                        }
                    }
                }
            }
        });
    }
    
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}