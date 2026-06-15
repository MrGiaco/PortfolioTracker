/* =====================================================
   ui-portfolio.js — Modali CRUD portafoglio (Fase 6)
   Dipende da: portfolio.js, ui-accounts-transactions.js
   ===================================================== */

var PORT_TYPES = ['ETF', 'Azione', 'Fondo', 'Obbligazione'];
var PORT_BANKS = ['fineco', 'isp', 'ing', 'unicredit', 'bper', 'mediolanum', 'altro'];

function _bankOpts(selected) {
  return PORT_BANKS.map(function(b) {
    var info = (typeof BANCHE !== 'undefined' && BANCHE[b]) || { label: b };
    return '<option value="' + b + '"' + (b === selected ? ' selected' : '') + '>'
      + info.label + '</option>';
  }).join('');
}

function _typeOpts(selected) {
  return PORT_TYPES.map(function(t) {
    return '<option value="' + t + '"' + (t === selected ? ' selected' : '') + '>' + t + '</option>';
  }).join('');
}

/* ── Aggiungi titolo ──────────────────────────────── */

function showAddPortfolioModal() {
  openModal(
    '<div class="modal-hdr"><h3>Aggiungi Titolo</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row2">'
    + '<div><label>Nome titolo</label><input id="p-name" type="text" placeholder="es. ENI SpA"></div>'
    + '<div><label>Ticker / Simbolo</label><input id="p-ticker" type="text" placeholder="es. ENI.MI"></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Tipo</label><select id="p-type">' + _typeOpts('ETF') + '</select></div>'
    + '<div><label>Banca / Conto</label><select id="p-bank">' + _bankOpts('fineco') + '</select></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Quantità</label><input id="p-qty" type="number" step="any" min="0" placeholder="0"></div>'
    + '<div><label>Prezzo medio carico (€)</label><input id="p-cost" type="number" step="0.0001" min="0" placeholder="0.00"></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Prezzo attuale (€)</label><input id="p-price" type="number" step="0.0001" min="0" placeholder="uguale al carico"></div>'
    + '<div><label>Iniziali logo (max 2)</label><input id="p-logo" type="text" maxlength="2" placeholder="es. iS"></div>'
    + '</div>'
    + '<label>URL quotazione personalizzata (opzionale)</label>'
    + '<input id="p-url" type="text" placeholder="https://... (lascia vuoto per Yahoo Finance)">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="_savePortfolioModal(null)">Aggiungi</button>'
    + '</div>'
  );
  setTimeout(function() {
    var el = document.getElementById('p-name');
    if (el) el.focus();
  }, 50);
}

/* ── Modifica titolo ──────────────────────────────── */

function showEditPortfolioModal(id) {
  var item = getPortfolioItem(id);
  if (!item) return;

  openModal(
    '<div class="modal-hdr"><h3>Modifica Titolo</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="form-row2">'
    + '<div><label>Nome titolo</label><input id="p-name" type="text" value="' + _esc(item.name) + '"></div>'
    + '<div><label>Ticker / Simbolo</label><input id="p-ticker" type="text" value="' + _esc(item.ticker) + '"></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Tipo</label><select id="p-type">' + _typeOpts(item.type) + '</select></div>'
    + '<div><label>Banca / Conto</label><select id="p-bank">' + _bankOpts(item.bank) + '</select></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Quantità</label><input id="p-qty" type="number" step="any" min="0" value="' + item.qty + '"></div>'
    + '<div><label>Prezzo medio carico (€)</label><input id="p-cost" type="number" step="0.0001" min="0" value="' + item.avgCost + '"></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Prezzo attuale (€)</label><input id="p-price" type="number" step="0.0001" min="0" value="' + item.price + '"></div>'
    + '<div><label>Iniziali logo (max 2)</label><input id="p-logo" type="text" maxlength="2" value="' + _esc(item.logoKey || '') + '"></div>'
    + '</div>'
    + '<label>URL quotazione personalizzata</label>'
    + '<input id="p-url" type="text" value="' + _esc(item.customUrl || '') + '" placeholder="https://...">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="_savePortfolioModal(\'' + id + '\')">Aggiorna</button>'
    + '</div>'
  );
}

function _savePortfolioModal(id) {
  var name   = (_pval('p-name')   || '').trim();
  var ticker = (_pval('p-ticker') || '').trim().toUpperCase();
  var type   = _pval('p-type')  || 'ETF';
  var bank   = _pval('p-bank')  || 'altro';
  var qty    = parseFloat(_pval('p-qty')   || '0');
  var cost   = parseFloat(_pval('p-cost')  || '0');
  var priceV = parseFloat(_pval('p-price') || '0');
  var logo   = (_pval('p-logo')  || '').trim().slice(0, 2) || null;
  var url    = (_pval('p-url')   || '').trim() || null;

  if (!name)        { alert('Inserisci il nome del titolo.'); return; }
  if (!ticker)      { alert('Inserisci il ticker/simbolo.'); return; }
  if (!qty || qty <= 0) { alert('Inserisci una quantità valida.'); return; }
  if (!cost || cost <= 0) { alert('Inserisci un prezzo di carico valido.'); return; }

  var price = priceV > 0 ? priceV : cost;

  var fields = {
    name:         name,
    ticker:       ticker,
    type:         type,
    bank:         bank,
    qty:          qty,
    avgCost:      cost,
    price:        price,
    logoKey:      logo,
    customUrl:    url,
    priceSource:  'manual',
    priceUpdated: priceV > 0 ? new Date().toISOString() : null,
  };

  if (id) {
    updatePortfolioItem(id, fields);
    showToast('Titolo aggiornato');
  } else {
    addPortfolioItem(fields);
    showToast('Titolo aggiunto');
  }

  closeModal();
  navigate('portfolio');
}

/* ── Aggiornamento prezzo rapido ──────────────────── */

function showUpdatePriceModal(id) {
  var item = getPortfolioItem(id);
  if (!item) return;

  openModal(
    '<div class="modal-hdr"><h3>Aggiorna Prezzo</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="modal-price-ticker">'
    + '<div class="modal-price-badge">' + _esc(item.ticker) + '</div>'
    + '<div class="modal-price-name">' + _esc(item.name) + '</div>'
    + '</div>'
    + '<div class="modal-price-current">'
    + '<span class="modal-price-lbl">Prezzo attuale</span>'
    + '<span class="modal-price-val">' + eur(item.price, 4) + '</span>'
    + '</div>'
    + '<label>Nuovo prezzo (€)</label>'
    + '<input id="p-newprice" type="number" step="0.0001" min="0" placeholder="0.0000" autofocus>'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="_applyPriceUpdate(\'' + id + '\')">Aggiorna</button>'
    + '</div>'
  );
  setTimeout(function() {
    var el = document.getElementById('p-newprice');
    if (el) { el.focus(); el.select(); }
  }, 50);
}

function _applyPriceUpdate(id) {
  var raw = parseFloat(_pval('p-newprice') || '0');
  if (!raw || raw <= 0) { alert('Inserisci un prezzo valido.'); return; }

  var item = getPortfolioItem(id);
  var prev = item ? item.price : 0;
  updatePortfolioItem(id, {
    price:        raw,
    dayChange:    raw - prev,
    dayChangePct: prev > 0 ? ((raw - prev) / prev) * 100 : 0,
    priceUpdated: new Date().toISOString(),
    priceSource:  'manual',
  });
  APP_DATA.lastQuoteUpdate = new Date().toISOString();
  closeModal();
  navigate('portfolio');
  showToast('Prezzo aggiornato', 'success');
}

/* ── Elimina titolo ───────────────────────────────── */

function confirmDeletePortfolioItem(id) {
  var item = getPortfolioItem(id);
  if (!item) return;

  var e = enriched ? enriched.find(function(i) { return i.id === id; }) : null;
  var glStr = e ? ((e.gl >= 0 ? '+' : '') + eur(e.gl, 2) + ' (' + (e.glPct >= 0 ? '+' : '') + e.glPct.toFixed(2) + '%)') : '';

  openModal(
    '<div class="modal-confirm-ico danger"><i class="ti ti-chart-pie-off"></i></div>'
    + '<div class="modal-confirm-title">Elimina titolo</div>'
    + '<div class="modal-confirm-sub">Vuoi eliminare questo titolo dal portafoglio?</div>'
    + '<div class="modal-confirm-detail">'
    + '<strong>' + _esc(item.name) + '</strong>'
    + ' <span style="color:var(--text-secondary);font-size:12px;">' + item.ticker + '</span><br>'
    + '<span style="color:var(--text-secondary);font-size:13px;">'
    + item.qty.toLocaleString('it-IT') + ' quote · carico ' + eur(item.avgCost, 2)
    + (glStr ? ' · G/P ' + glStr : '')
    + '</span>'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn-danger" onclick="_doDeletePortfolioItem(\'' + id + '\')">Elimina</button>'
    + '</div>'
  );
}

function _doDeletePortfolioItem(id) {
  deletePortfolioItem(id);
  closeModal();
  navigate('portfolio');
  showToast('Titolo eliminato', 'info');
}

/* ── Export modali ────────────────────────────────── */

function showExportModal() {
  openModal(
    '<div class="modal-hdr"><h3>Esporta Dati</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<p style="font-size:14px;color:var(--text-secondary);margin-bottom:4px;">'
    + 'Scarica i tuoi dati in formato CSV compatibile con Excel.</p>'
    + '<button class="btn btn-secondary btn-full" style="justify-content:flex-start;gap:12px;padding:14px 16px;" onclick="exportPortfolioCSV()">'
    + '<i class="ti ti-table-export" style="font-size:20px;color:var(--c-blue);"></i>'
    + '<span><strong>Portafoglio</strong><br><small style="font-weight:400;color:var(--text-secondary)">Ticker, quantità, prezzi, G/P</small></span>'
    + '</button>'
    + '<button class="btn btn-secondary btn-full" style="justify-content:flex-start;gap:12px;padding:14px 16px;" onclick="exportTransactionsCSV()">'
    + '<i class="ti ti-receipt-2" style="font-size:20px;color:var(--c-teal);"></i>'
    + '<span><strong>Transazioni</strong><br><small style="font-weight:400;color:var(--text-secondary)">Data, descrizione, importo, categoria</small></span>'
    + '</button>'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>'
    + '</div>'
  );
}

/* ── Utility ──────────────────────────────────────── */

function _pval(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

/* _esc è già definita in ui-accounts-transactions.js */
