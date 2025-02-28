// js/chart.js
let chart; // Globale Chart.js instantie

/**
 * Tekent (of update) de grafiek met de ritkosten uit de geschiedenis.
 * Verwacht een array van rit-objecten.
 */
export function drawChart(history) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  const labels = history.map((ride, index) => `Rit ${index + 1}`);
  const data = history.map((ride) => ride.cost);

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Ritkosten (€)",
          data: data,
          borderColor: "rgba(75, 192, 192, 1)",
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}
