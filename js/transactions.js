/* =====================================================
   transactions.js — Transazioni + CSV Parser (Fase 5)
   ===================================================== */

/* ── Categorie ────────────────────────────────────── */
var CATEGORIE = {
  stipendio:       { label: 'Stipendio',     icona: 'ti-cash',               colore: '#1D9E75' },
  bonus:           { label: 'Bonus',          icona: 'ti-gift',               colore: '#1D9E75' },
  dividendo:       { label: 'Dividendo',      icona: 'ti-coin',               colore: '#2563EB' },
  investimento:    { label: 'Investimento',   icona: 'ti-chart-line',         colore: '#2563EB' },
  rimborso:        { label: 'Rimborso',       icona: 'ti-arrow-back-up',      colore: '#6B7280' },
  spesa:           { label: 'Spesa',          icona: 'ti-shopping-cart',      colore: '#D85A30' },
  cibo:            { label: 'Cibo & Bar',     icona: 'ti-pizza',              colore: '#D85A30' },
  ristorante:      { label: 'Ristorante',     icona: 'ti-tools-kitchen-2',    colore: '#D85A30' },
  casa:            { label: 'Casa',           icona: 'ti-home',               colore: '#7C3AED' },
  affitto:         { label: 'Affitto',        icona: 'ti-building',           colore: '#7C3AED' },
  auto:            { label: 'Auto',           icona: 'ti-car',                colore: '#B45309' },
  carburante:      { label: 'Carburante',     icona: 'ti-gas-station',        colore: '#B45309' },
  salute:          { label: 'Salute',         icona: 'ti-heart-rate-monitor', colore: '#DC2626' },
  sport:           { label: 'Sport',          icona: 'ti-run',                colore: '#059669' },
  abbonamenti:     { label: 'Abbonamenti',    icona: 'ti-device-tv',          colore: '#6366F1' },
  viaggi:          { label: 'Viaggi',         icona: 'ti-plane',              colore: '#0891B2' },
  intrattenimento: { label: 'Svago',          icona: 'ti-confetti',           colore: '#DB2777' },
  bollette:        { label: 'Bollette',       icona: 'ti-bolt',               colore: '#D97706' },
  telefono:        { label: 'Telefono',       icona: 'ti-phone',              colore: '#6B7280' },
  istruzione:      { label: 'Istruzione',     icona: 'ti-school',             colore: '#0369A1' },
  tasse:           { label: 'Tasse',          icona: 'ti-receipt',            colore: '#991B1B' },
  trasferimento:   { label: 'Trasferimento',  icona: 'ti-transfer',           colore: '#6B7280' },
  altro:           { label: 'Altro',          icona: 'ti-dots',               colore: '#6B7280' },
};

/* ── CRUD Transazioni ─────────────────────────────── */

function getTransazioni(filtri) {
  filtri = filtri || {};
  var periodo   = filtri.periodo   || 'all';
  var contoId   = filtri.contoId   || '';
  var categoria = filtri.categoria || '';

  var txns = (APP_DATA.transactions || []).slice();

  if (contoId)   txns = txns.filter(function(t) { return t.contoId   === contoId;   });
  if (categoria) txns = txns.filter(function(t) { return t.categoria === categoria; });

  if (periodo && periodo !== 'all') {
    var from = new Date();
    if      (periodo === '30d') { from.setDate(from.getDate() - 30); }
    else if (periodo === '90d') { from.setDate(from.getDate() - 90); }
    else if (periodo === 'ytd') { from = new Date(from.getFullYear(), 0, 1); }
    else if (periodo === '1y')  { from.setFullYear(from.getFullYear() - 1); }
    txns = txns.filter(function(t) { return new Date(t.data + 'T00:00:00') >= from; });
  }

  return txns.sort(function(a, b) { return b.data.localeCompare(a.data); });
}

function addTransazione(txn) {
  if (!Array.isArray(APP_DATA.transactions)) APP_DATA.transactions = [];
  txn.id = 'txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
  APP_DATA.transactions.push(txn);
  if (typeof recalculate === 'function') recalculate();
  if (typeof storage !== 'undefined' && storage.save) storage.save();
  return txn;
}

function updateTransazione(id, fields) {
  var list = APP_DATA.transactions || [];
  var i = list.findIndex(function(t) { return t.id === id; });
  if (i < 0) return;
  APP_DATA.transactions[i] = Object.assign({}, APP_DATA.transactions[i], fields);
  if (typeof recalculate === 'function') recalculate();
  if (typeof storage !== 'undefined' && storage.save) storage.save();
}

function deleteTransazione(id) {
  APP_DATA.transactions = (APP_DATA.transactions || []).filter(function(t) { return t.id !== id; });
  if (typeof recalculate === 'function') recalculate();
  if (typeof storage !== 'undefined' && storage.save) storage.save();
}

/* ── Auto-detection formato CSV ───────────────────── */

function detectCSVFormat(text) {
  var sample = text.slice(0, 800).toLowerCase();
  if (sample.includes('data operazione') || (sample.includes('entrate') && sample.includes('uscite'))) return 'fineco';
  if (sample.includes('data registrazione') || sample.includes('descrizione operazione'))               return 'isp';
  if (sample.includes('causale abi') || sample.includes('saldo iniziale'))                              return 'ing';
  // Fallback: se usa ";" probabilmente è un export bancario italiano
  return text.slice(0, 300).includes(';') ? 'fineco' : 'generic';
}

/* ── Parser Fineco ────────────────────────────────── */
// Header atteso: "Data operazione";"Data valuta";"Entrate";"Uscite";"Descrizione";"Causale";"...

function parseCSVFineco(text) {
  var lines = text.split('\n');
  var headerIdx = lines.findIndex(function(l) { return /data.operazione/i.test(l); });
  if (headerIdx < 0) throw new Error('Intestazione Fineco non trovata. Verifica il file CSV.');

  var delim  = lines[headerIdx].includes(';') ? ';' : ',';
  var header = splitCSVLine(lines[headerIdx], delim).map(function(h) {
    return h.toLowerCase().replace(/"/g, '').trim();
  });

  var iData    = header.findIndex(function(h) { return h.includes('data operazione') || h === 'data'; });
  var iEntrate = header.findIndex(function(h) { return h.includes('entrate') || h.includes('entrata'); });
  var iUscite  = header.findIndex(function(h) { return h.includes('uscite')  || h.includes('uscita');  });
  var iDesc    = header.findIndex(function(h) { return h.includes('descrizione'); });

  var rows = [];
  for (var i = headerIdx + 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = splitCSVLine(line, delim).map(function(c) { return c.replace(/"/g, '').trim(); });
    if (cols.length < 3) continue;

    var data   = parseItalianDate(cols[iData] || '');
    if (!data) continue;

    var entS   = (cols[iEntrate] || '').replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, '');
    var uscS   = (cols[iUscite]  || '').replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, '');
    var desc   = cols[iDesc] || '';
    var importo = 0;
    if (entS && parseFloat(entS)) importo =  parseFloat(entS);
    else if (uscS && parseFloat(uscS)) importo = -parseFloat(uscS);
    if (importo === 0) continue;

    rows.push({ data: data, descrizione: desc, importo: importo, categoria: guessCategoria(desc, importo) });
  }
  return rows;
}

/* ── Parser ISP (Intesa San Paolo) ───────────────── */
// Header atteso: "Data Registrazione";"Descrizione operazione";"Importo";"..."

function parseCSVISP(text) {
  var lines = text.split('\n');
  var headerIdx = lines.findIndex(function(l) { return /data.registrazione|data valuta/i.test(l); });
  if (headerIdx < 0) throw new Error('Intestazione Intesa SP non trovata. Verifica il file CSV.');

  var delim  = lines[headerIdx].includes(';') ? ';' : ',';
  var header = splitCSVLine(lines[headerIdx], delim).map(function(h) {
    return h.toLowerCase().replace(/"/g, '').trim();
  });

  var iData    = header.findIndex(function(h) { return h.includes('data'); });
  var iDesc    = header.findIndex(function(h) { return h.includes('descrizione'); });
  var iImporto = header.findIndex(function(h) { return h.includes('importo'); });

  var rows = [];
  for (var i = headerIdx + 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = splitCSVLine(line, delim).map(function(c) { return c.replace(/"/g, '').trim(); });
    if (cols.length < 3) continue;

    var data    = parseItalianDate(cols[iData] || '');
    if (!data) continue;
    var desc    = cols[iDesc]    || '';
    var importoS = (cols[iImporto] || '').replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, '');
    var importo  = parseFloat(importoS);
    if (isNaN(importo) || importo === 0) continue;

    rows.push({ data: data, descrizione: desc, importo: importo, categoria: guessCategoria(desc, importo) });
  }
  return rows;
}

/* ── Parser ING Direct ────────────────────────────── */
// Header atteso: "Data";"Descrizione";"Tipo transazione";"Importo"

function parseCSVING(text) {
  var lines = text.split('\n');
  var headerIdx = lines.findIndex(function(l) { return /^"?data"?[;,]/i.test(l.trim()); });
  if (headerIdx < 0) throw new Error('Intestazione ING non trovata. Verifica il file CSV.');

  var delim  = lines[headerIdx].includes(';') ? ';' : ',';
  var header = splitCSVLine(lines[headerIdx], delim).map(function(h) {
    return h.toLowerCase().replace(/"/g, '').trim();
  });

  var iData    = header.findIndex(function(h) { return h === 'data' || h === 'date'; });
  var iDesc    = header.findIndex(function(h) { return h.includes('descrizione') || h.includes('description'); });
  var iImporto = header.findIndex(function(h) { return h.includes('importo') || h.includes('amount'); });

  var rows = [];
  for (var i = headerIdx + 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = splitCSVLine(line, delim).map(function(c) { return c.replace(/"/g, '').trim(); });
    if (cols.length < 3) continue;

    // ING spesso usa formato YYYY-MM-DD
    var data = parseISODate(cols[iData] || '') || parseItalianDate(cols[iData] || '');
    if (!data) continue;
    var desc     = cols[iDesc]    || '';
    // ING usa punto migliaia e virgola decimale: "1.234,56" → 1234.56
    var importoS = (cols[iImporto] || '').replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, '');
    var importo  = parseFloat(importoS);
    if (isNaN(importo) || importo === 0) continue;

    rows.push({ data: data, descrizione: desc, importo: importo, categoria: guessCategoria(desc, importo) });
  }
  return rows;
}

/* ── Parser generico (fallback) ───────────────────── */

function parseCSVGeneric(text) {
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  if (lines.length < 2) throw new Error('File CSV vuoto o non valido.');

  var delim  = lines[0].includes(';') ? ';' : ',';
  var header = splitCSVLine(lines[0], delim).map(function(h) {
    return h.toLowerCase().replace(/"/g, '').trim();
  });

  var iData    = header.findIndex(function(h) { return h.includes('data') || h.includes('date'); });
  var iDesc    = header.findIndex(function(h) { return h.includes('descrizione') || h.includes('description') || h.includes('causale'); });
  var iImporto = header.findIndex(function(h) { return h.includes('importo') || h.includes('amount') || h.includes('valore'); });

  if (iData < 0 || iImporto < 0) throw new Error('Impossibile riconoscere le colonne del CSV.\nServono almeno: data e importo.');

  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = splitCSVLine(line, delim).map(function(c) { return c.replace(/"/g, '').trim(); });

    var data     = parseItalianDate(cols[iData] || '') || parseISODate(cols[iData] || '');
    if (!data) continue;
    var desc     = iDesc >= 0 ? (cols[iDesc] || '') : '';
    var importoS = (cols[iImporto] || '').replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, '');
    var importo  = parseFloat(importoS);
    if (isNaN(importo) || importo === 0) continue;

    rows.push({ data: data, descrizione: desc, importo: importo, categoria: guessCategoria(desc, importo) });
  }
  return rows;
}

/* ── Dispatcher ───────────────────────────────────── */

function parseCSV(text, contoId) {
  var fmt = detectCSVFormat(text);
  var rows;
  if      (fmt === 'fineco')  rows = parseCSVFineco(text);
  else if (fmt === 'isp')     rows = parseCSVISP(text);
  else if (fmt === 'ing')     rows = parseCSVING(text);
  else                        rows = parseCSVGeneric(text);

  return {
    format: fmt,
    rows: rows.map(function(r) { return Object.assign({ contoId: contoId, note: '' }, r); })
  };
}

/* ── Utility ──────────────────────────────────────── */

function splitCSVLine(line, delimiter) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === delimiter && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

function parseItalianDate(s) {
  // DD/MM/YYYY  o  DD-MM-YYYY  o  DD/MM/YY
  var m = (s || '').trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  var d = m[1], mo = m[2], y = m[3];
  if (y.length === 2) y = '20' + y;
  var dt = new Date(+y, +mo - 1, +d);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

function parseISODate(s) {
  // YYYY-MM-DD  o  YYYY/MM/DD
  var m = (s || '').trim().match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  var dt = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

/* ── Classificazione automatica categoria ─────────── */

function guessCategoria(desc, importo) {
  var d = (desc || '').toLowerCase();

  if (importo > 0) {
    if (/stipendio|salary|retribuzione|emolumenti/.test(d))   return 'stipendio';
    if (/dividendo|dividend/.test(d))                          return 'dividendo';
    if (/bonus|premio|tredicesima|quattordicesima/.test(d))    return 'bonus';
    if (/rimborso|restituzione/.test(d))                       return 'rimborso';
    if (/investimento|etf|fondo|azione/.test(d))               return 'investimento';
    return 'altro';
  }

  if (/affitto|locazione|fitto|canone/.test(d))                return 'affitto';
  if (/mutuo|rata/.test(d))                                    return 'casa';
  if (/esselunga|carrefour|conad|lidl|aldi|eurospin|supermercato|coop /.test(d)) return 'spesa';
  if (/ristorante|trattoria|pizzeria|osteria|mcdonald|burger/.test(d)) return 'ristorante';
  if (/bar |caffe|caffè|pasticceria|gelateria/.test(d))        return 'cibo';
  if (/amazon|ebay|zalando|privalia|shein/.test(d))            return 'spesa';
  if (/\bip\b|agip|eni |total|q8|carburante|benzina|diesel/.test(d)) return 'carburante';
  if (/bollo|revisione|officina|gomme|parcheggio|autostrada|telepass/.test(d)) return 'auto';
  if (/enel|iren|hera|a2a|sorgenia|luce|gas |bolletta/.test(d)) return 'bollette';
  if (/netflix|spotify|amazon prime|dazn|disney|now tv|apple/.test(d)) return 'abbonamenti';
  if (/farmacia|medico|dottore|ospedale|analisi|clinica/.test(d)) return 'salute';
  if (/palestra|fitness|sport|piscina|tennis|calcio/.test(d))  return 'sport';
  if (/trenitalia|italo|ryanair|easyjet|wizz|hotel|airbnb|booking/.test(d)) return 'viaggi';
  if (/\btim\b|wind|vodafone|iliad|fastweb|telecom|telefon/.test(d)) return 'telefono';
  if (/imu|tari|irpef|tassa|tributo|agenzia entrate|f24/.test(d)) return 'tasse';
  if (/università|corso|libri|scolastico/.test(d))             return 'istruzione';
  if (/investimento|etf|fondo|borsa|titolo/.test(d))           return 'investimento';
  return 'altro';
}
