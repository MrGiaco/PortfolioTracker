/* =====================================================
   charts.js — Grafici Chart.js (Fase 6)
   ===================================================== */

var _donutChart = null;
var _barChart   = null;
var _lineChart  = null;

/* ── Distruggi tutti i grafici attivi ─────────────── */
function destroyAllCharts() {
  if (_donutChart) { _donutChart.destroy(); _donutChart = null; }
  if (_barChart)   { _barChart.destroy();   _barChart   = null; }
  if (_lineChart)  { _lineChart.destroy();  _lineChart  = null; }
}

/* alias retro-compat */
function destroyDonut() { destroyAllCharts(); }

/* ── Donut allocazione (Dashboard) ───────────────── */
function initDonut(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  if (_donutChart) { _donutChart.destroy(); _donutChart = null; }

  _donutChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels:   allocation.map(function(s) { return s.label; }),
      datasets: [{
        data:            allocation.map(function(s) { return Math.round(s.value); }),
        backgroundColor: allocation.map(function(s) { return s.color; }),
        borderWidth:     0,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '68%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });
}

/* ── Bar chart G/P per titolo (Portafoglio) ──────── */
function initBarChart(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart || !window.enriched || !enriched.length) return;
  if (_barChart) { _barChart.destroy(); _barChart = null; }

  var items = enriched.slice().sort(function(a, b) { return b.gl - a.gl; });

  _barChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: items.map(function(i) { return i.ticker; }),
      datasets: [{
        label: 'G/P (€)',
        data:  items.map(function(i) { return parseFloat(i.gl.toFixed(2)); }),
        backgroundColor: items.map(function(i) {
          return i.gl >= 0 ? 'rgba(46,125,50,0.75)' : 'rgba(216,90,48,0.75)';
        }),
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              var v = ctx.raw;
              return ' ' + (v >= 0 ? '+' : '') + '€' + Math.abs(v).toLocaleString('it-IT', { minimumFractionDigits: 2 });
            },
          },
        },
      },
      scales: {
        x: {
          grid:  { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 11 },
            callback: function(v) { return (v >= 0 ? '' : '') + '€' + Math.round(v / 1000) + 'k'; },
          },
        },
        y: {
          ticks: { font: { size: 12, weight: '600' } },
        },
      },
    },
  });
}

/* ── Line chart liquidità (Dashboard) ────────────── */
function initLineChart(canvasId, data) {
  var canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart || !data || !data.length) return;
  if (_lineChart) { _lineChart.destroy(); _lineChart = null; }

  _lineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(function(d) { return d.label; }),
      datasets: [{
        label:           'Liquidità',
        data:            data.map(function(d) { return Math.round(d.liquid); }),
        borderColor:     '#378ADD',
        backgroundColor: 'rgba(55,138,221,0.10)',
        borderWidth:     2.5,
        pointRadius:     3,
        pointHoverRadius: 5,
        fill:            true,
        tension:         0.4,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ' €' + Math.round(ctx.raw).toLocaleString('it-IT');
            },
          },
        },
      },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { font: { size: 11 } },
        },
        y: {
          grid:  { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 11 },
            callback: function(v) { return '€' + Math.round(v / 1000) + 'k'; },
          },
        },
      },
    },
  });
}
