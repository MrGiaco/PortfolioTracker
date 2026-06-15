/* =====================================================
   accounts.js — Gestione Conti (Fase 5)
   ===================================================== */

/* ── Metadati banche ──────────────────────────────── */
var BANCHE = {
  fineco:     { label: 'Fineco',      colore: '#00BF63', tc: '#fff' },
  isp:        { label: 'Intesa SP',   colore: '#003087', tc: '#fff' },
  ing:        { label: 'ING',         colore: '#FF6200', tc: '#fff' },
  unicredit:  { label: 'UniCredit',   colore: '#C41230', tc: '#fff' },
  bper:       { label: 'BPER',        colore: '#E30613', tc: '#fff' },
  credem:     { label: 'Credem',      colore: '#005CA9', tc: '#fff' },
  mediolanum: { label: 'Mediolanum',  colore: '#0033A0', tc: '#fff' },
  altro:      { label: 'Altro',       colore: '#666',    tc: '#fff' },
};

var TIPI_CONTO = {
  investimento: { label: 'Investimento', icona: 'ti-briefcase' },
  personale:    { label: 'Personale',    icona: 'ti-user'      },
  comune:       { label: 'Comune',       icona: 'ti-users'     },
};

/* ── CRUD Conti ───────────────────────────────────── */

function getConti() {
  return Array.isArray(APP_DATA.accounts) ? APP_DATA.accounts : [];
}

function getConto(id) {
  return getConti().find(function(a) { return a.id === id; }) || null;
}

function addConto(fields) {
  if (!Array.isArray(APP_DATA.accounts)) APP_DATA.accounts = [];
  var acc = Object.assign({ id: 'acc_' + Date.now() }, fields);
  APP_DATA.accounts.push(acc);
  _accountsSave();
  return acc;
}

function updateConto(id, fields) {
  var list = APP_DATA.accounts || [];
  var i = list.findIndex(function(a) { return a.id === id; });
  if (i < 0) return;
  APP_DATA.accounts[i] = Object.assign({}, APP_DATA.accounts[i], fields);
  _accountsSave();
}

function deleteConto(id) {
  APP_DATA.accounts     = (APP_DATA.accounts     || []).filter(function(a) { return a.id !== id; });
  APP_DATA.transactions = (APP_DATA.transactions || []).filter(function(t) { return t.contoId !== id; });
  _accountsSave();
}

function _accountsSave() {
  if (typeof recalculate === 'function') recalculate();
  if (typeof storage !== 'undefined' && storage.save) storage.save();
}

/* ── Calcolo saldo dinamico ───────────────────────── */

function calcSaldoConto(id) {
  var acc = getConto(id);
  if (!acc) return 0;
  var from = new Date((acc.dataPartenza || '1970-01-01') + 'T00:00:00');
  var delta = (APP_DATA.transactions || [])
    .filter(function(t) {
      return t.contoId === id && new Date(t.data + 'T00:00:00') >= from;
    })
    .reduce(function(s, t) { return s + t.importo; }, 0);
  return (acc.saldoPartenza || 0) + delta;
}

function calcSaldoTotale(tipo) {
  return getConti()
    .filter(function(a) { return !tipo || a.tipo === tipo; })
    .reduce(function(s, a) { return s + calcSaldoConto(a.id); }, 0);
}

/* ── Sparkline 30 giorni ──────────────────────────── */

function getSparklineData(contoId, giorni) {
  giorni = giorni || 30;
  var acc = getConto(contoId);
  if (!acc) return [];

  var dataPartenza = new Date((acc.dataPartenza || '1970-01-01') + 'T00:00:00');
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - giorni);

  // Tutte le transazioni del conto ordinate per data
  var txns = (APP_DATA.transactions || [])
    .filter(function(t) { return t.contoId === contoId; })
    .sort(function(a, b) { return a.data.localeCompare(b.data); });

  // Saldo base = saldoPartenza + transazioni tra dataPartenza e cutoff
  var saldoBase = (acc.saldoPartenza || 0) +
    txns
      .filter(function(t) {
        var d = new Date(t.data + 'T00:00:00');
        return d >= dataPartenza && d < cutoff;
      })
      .reduce(function(s, t) { return s + t.importo; }, 0);

  // Array giornaliero degli ultimi N giorni
  var pts = [];
  var running = saldoBase;
  for (var i = giorni; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var dStr = d.toISOString().slice(0, 10);
    txns
      .filter(function(t) {
        return t.data === dStr && new Date(t.data + 'T00:00:00') >= dataPartenza;
      })
      .forEach(function(t) { running += t.importo; });
    pts.push(running);
  }
  return pts;
}

function sparklineSVG(pts, w, h) {
  w = w || 80; h = h || 28;
  if (!pts || pts.length < 2) {
    return '<svg width="' + w + '" height="' + h + '"></svg>';
  }
  var mn = Math.min.apply(null, pts);
  var mx = Math.max.apply(null, pts);
  var rng = mx - mn || 1;
  var coords = pts.map(function(v, i) {
    var x = (i / (pts.length - 1)) * w;
    var y = h - ((v - mn) / rng) * (h - 4) - 2;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var up  = pts[pts.length - 1] >= pts[0];
  var col = up ? '#1D9E75' : '#D85A30';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<polyline points="' + coords + '" fill="none" stroke="' + col +
    '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
}
