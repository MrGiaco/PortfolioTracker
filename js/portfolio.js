/* =====================================================
   portfolio.js — CRUD titoli + calcoli storici (Fase 6)
   ===================================================== */

/* ── CRUD ─────────────────────────────────────────── */

function getPortfolioItems() {
  return Array.isArray(APP_DATA.portfolio) ? APP_DATA.portfolio : [];
}

function getPortfolioItem(id) {
  return getPortfolioItems().find(function(i) { return i.id === id; }) || null;
}

function addPortfolioItem(fields) {
  if (!Array.isArray(APP_DATA.portfolio)) APP_DATA.portfolio = [];
  var item = Object.assign({
    id:           'port_' + Date.now(),
    dayChange:    0,
    dayChangePct: 0,
    priceUpdated: null,
    priceSource:  'manual',
    customUrl:    null,
    logoImg:      null,
    logoKey:      null,
  }, fields);
  APP_DATA.portfolio.push(item);
  _portfolioSave();
  return item;
}

function updatePortfolioItem(id, fields) {
  var list = APP_DATA.portfolio || [];
  var idx  = list.findIndex(function(i) { return i.id === id; });
  if (idx < 0) return;
  APP_DATA.portfolio[idx] = Object.assign({}, APP_DATA.portfolio[idx], fields);
  _portfolioSave();
}

function deletePortfolioItem(id) {
  APP_DATA.portfolio = (APP_DATA.portfolio || []).filter(function(i) { return i.id !== id; });
  _portfolioSave();
}

function _portfolioSave() {
  if (typeof recalculate === 'function') recalculate();
  if (typeof storage !== 'undefined' && storage.save) storage.save();
}

/* ── Storico liquidità per grafico dashboard ──────── */

/**
 * Ritorna gli ultimi N mesi con:
 *   { label, liquid }
 * liquid = saldo totale conti a fine mese (da transazioni)
 */
function getPatrimonyHistory(months) {
  months = months || 6;
  var result = [];
  var now    = new Date();

  for (var i = months - 1; i >= 0; i--) {
    var y = now.getFullYear();
    var m = now.getMonth() - i;
    while (m < 0) { m += 12; y--; }
    var lastDay = new Date(y, m + 1, 0);
    var dateCut = lastDay.toISOString().slice(0, 10);
    var liquid  = _liquidAtDate(dateCut);
    result.push({
      label:  new Date(y, m, 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
      liquid: liquid,
    });
  }
  return result;
}

function _liquidAtDate(dateCut) {
  if (typeof getConti !== 'function') return 0;
  return getConti().reduce(function(sum, acc) {
    var from  = new Date((acc.dataPartenza || '1970-01-01') + 'T00:00:00');
    var delta = (APP_DATA.transactions || [])
      .filter(function(t) {
        var d = new Date(t.data + 'T00:00:00');
        return t.contoId === acc.id && d >= from && t.data <= dateCut;
      })
      .reduce(function(s, t) { return s + t.importo; }, 0);
    return sum + (acc.saldoPartenza || 0) + delta;
  }, 0);
}

/* ── Esportazione CSV ─────────────────────────────── */

function exportPortfolioCSV() {
  var rows = ['Ticker;Nome;Tipo;Quantita;Carico (€);Prezzo (€);Valore (€);G/P (€);G/P (%)'];
  (enriched || []).forEach(function(i) {
    rows.push([
      i.ticker,
      '"' + (i.name || '').replace(/"/g, '""') + '"',
      i.type,
      i.qty,
      i.avgCost.toFixed(2).replace('.', ','),
      i.price.toFixed(2).replace('.', ','),
      i.totalValue.toFixed(2).replace('.', ','),
      i.gl.toFixed(2).replace('.', ','),
      i.glPct.toFixed(2).replace('.', ',') + '%'
    ].join(';'));
  });
  _downloadCSV(rows.join('\n'), 'portafoglio_' + new Date().toISOString().slice(0, 10) + '.csv');
}

function exportTransactionsCSV() {
  var rows = ['Data;Descrizione;Importo (€);Categoria;Conto'];
  (APP_DATA.transactions || [])
    .slice().sort(function(a, b) { return b.data.localeCompare(a.data); })
    .forEach(function(t) {
      var acc = typeof getConto === 'function' ? getConto(t.contoId) : null;
      rows.push([
        t.data,
        '"' + (t.descrizione || '').replace(/"/g, '""') + '"',
        t.importo.toFixed(2).replace('.', ','),
        t.categoria || '',
        acc ? '"' + acc.nome.replace(/"/g, '""') + '"' : ''
      ].join(';'));
    });
  _downloadCSV(rows.join('\n'), 'transazioni_' + new Date().toISOString().slice(0, 10) + '.csv');
}

function _downloadCSV(content, filename) {
  var blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  if (typeof showToast === 'function') showToast('File scaricato', 'success');
}
