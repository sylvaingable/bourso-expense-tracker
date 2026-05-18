let chartInstance = null;

export function renderChart(canvas, monthly, sortedKeys) {
  const income = sortedKeys.map(k => monthly[k].income);
  const expenses = sortedKeys.map(k => monthly[k].expenses);
  const net = sortedKeys.map((k, i) => income[i] - expenses[i]);

  const data = {
    labels: sortedKeys,
    datasets: [
      { label: 'Revenus', data: income, backgroundColor: '#2ca02c', type: 'bar', order: 1 },
      { label: 'Dépenses', data: expenses, backgroundColor: '#d62728', type: 'bar', order: 1 },
      { label: 'Solde', data: net, borderColor: '#1f77b4', backgroundColor: 'transparent', type: 'line', tension: 0.3, pointRadius: 3, order: 0 },
    ],
  };

  if (chartInstance) {
    chartInstance.data = data;
    chartInstance.update();
  } else {
    chartInstance = new Chart(canvas, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: 'Mois' } },
          y: { title: { display: true, text: '€' } },
        },
      },
    });
  }
}
