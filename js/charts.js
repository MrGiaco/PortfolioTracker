/* =====================================================
   charts.js — Grafici Chart.js
   ===================================================== */

let _donutChart = null;

/**
 * Inizializza (o re-inizializza) il grafico donut allocazione.
 * @param {string} canvasId  id del <canvas> nella pagina
 */
function initDonut(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  if (_donutChart) {
    _donutChart.destroy();
    _donutChart = null;
  }

  _donutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels:   allocation.map(s => s.label),
      datasets: [{
        data:            allocation.map(s => Math.round(s.value)),
        backgroundColor: allocation.map(s => s.color),
        borderWidth:     0,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '68%',
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

/**
 * Distrugge il grafico attivo (utile prima di navigare via).
 */
function destroyDonut() {
  if (_donutChart) {
    _donutChart.destroy();
    _donutChart = null;
  }
}
