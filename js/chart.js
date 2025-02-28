let chart;
export function drawChart(history) {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  const labels = history.map((ride, i) => "Rit " + (i + 1));
  const data = history.map((ride) => ride.cost);
  if (chart) chart.destroy();
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
      scales: { y: { beginAtZero: true } },
    },
  });
}
