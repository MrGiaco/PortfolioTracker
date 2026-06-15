/* =====================================================
   ui-accounts-transactions.js (Fase 5 — v2)
   Modali completamente ridisegnati, bug fixes.
   ===================================================== */

var PERIODO_LABEL = {
  '30d': '30 gg', '90d': '3 mesi', 'ytd': 'Anno', '1y': '12 mesi', 'all': 'Tutto'
};

var MESI_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
               'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

/* ── Utility date ─────────────────────────────────── */

function _fmtData(iso) {
  if (!iso) return '—';
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function _fmtMese(ym) {
  var p = ym.split('-');
  return MESI_IT[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

/* ── Modal ────────────────────────────────────────── */

function openModal(html) {
  var overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
  }
  /* pill di trascinamento aggiunto automaticamente */
  overlay.innerHTML =
    '<div class="modal-box" onclick="event.stopPropagation()">'
    + '<div class="modal-pill"><span></span></div>'
    + html
    + '</div>';
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  window._csvPending = null;
}

/* ── Toast ────────────────────────────────────────── */

function showToast(msg, tipo) {
  tipo = tipo || 'success';
  /* normalizza 'error' → 'danger' (compat. con quotes.js) */
  if (tipo === 'error') tipo = 'danger';
  var t = document.createElement('div');
  t.className = 'pf-toast pf-toast-' + tipo;
  var ico = tipo === 'success' ? 'ti-check'
          : tipo === 'danger'  ? 'ti-alert-circle'
          : 'ti-info-circle';
  t.innerHTML = '<i class="ti ' + ico + '"></i> ' + msg;
  document.body.appendChild(t);
  setTimeout(function() { t.classList.add('pf-toast-show'); }, 10);
  setTimeout(function() {
    t.classList.remove('pf-toast-show');
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
  }, 3200);
}

/* ══════════════════════════════════════════════════════
   SEZIONE CONTI
   ══════════════════════════════════════════════════════ */

function renderAccounts() {
  var conti  = getConti();
  var totale = calcSaldoTotale();

  var html = '<div class="section-header">'
    + '<div><h2>Conti</h2>'
    + '<div class="section-subtotal">' + eur(totale) + ' patrimonio liquido</div></div>'
    + '<button class="btn btn-primary" onclick="showAddContoModal()">'
    + '<i class="ti ti-plus" aria-hidden="true"></i> Aggiungi</button>'
    + '</div>';

  if (!conti.length) {
    html += '<div class="pf-empty-state">'
      + '<i class="ti ti-wallet-off"></i>'
      + '<p>Nessun conto aggiunto.<br>Clicca <strong>Aggiungi</strong> per iniziare.</p>'
      + '</div>';
    return '<div class="section-body-f5">' + html + '</div>';
  }

  var tipi = ['investimento', 'personale', 'comune'];
  tipi.forEach(function(tipo) {
    var gruppo = conti.filter(function(c) { return c.tipo === tipo; });
    if (!gruppo.length) return;
    var meta = TIPI_CONTO[tipo];
    var totGruppo = calcSaldoTotale(tipo);

    html += '<div class="acc-group">'
      + '<div class="acc-group-hdr">'
      + '<i class="ti ' + meta.icona + '" aria-hidden="true"></i> ' + meta.label
      + '<span class="acc-group-tot">' + eur(totGruppo) + '</span>'
      + '</div>';

    gruppo.forEach(function(acc) { html += _renderContoCard(acc); });
    html += '</div>';
  });

  return '<div class="section-body-f5">' + html + '</div>';
}

function _renderContoCard(acc) {
  var saldo  = calcSaldoConto(acc.id);
  var banca  = BANCHE[acc.banca] || BANCHE.altro;
  var pts    = getSparklineData(acc.id);
  var svg    = sparklineSVG(pts);
  var trend  = pts.length >= 2 ? pts[pts.length - 1] - pts[0] : 0;
  var tColor = trend >= 0 ? '#1D9E75' : '#D85A30';
  var tStr   = (trend >= 0 ? '+' : '') + eur(trend);

  var txns  = (APP_DATA.transactions || []).filter(function(t) { return t.contoId === acc.id; });
  var ultima = txns.sort(function(a, b) { return b.data.localeCompare(a.data); })[0];
  var ulData = ultima ? _fmtData(ultima.data) : '—';

  return '<div class="acc-card">'
    + '<div class="acc-card-l">'
    + '<span class="bank-badge" style="background:' + banca.colore + ';color:' + banca.tc + '">'
    + banca.label + '</span>'
    + '<div class="acc-info">'
    + '<div class="acc-name">' + _esc(acc.nome) + '</div>'
    + '<div class="acc-sub">Ult. mov.: ' + ulData + '</div>'
    + '</div></div>'
    + '<div class="acc-card-m">' + svg
    + '<div class="acc-trend" style="color:' + tColor + '">' + tStr + '</div>'
    + '</div>'
    + '<div class="acc-card-r">'
    + '<div class="acc-saldo">' + eur(saldo) + '</div>'
    + '<div class="acc-actions">'
    + '<button class="btn-icon" onclick="showEditContoModal(\'' + acc.id + '\')" title="Modifica">'
    + '<i class="ti ti-pencil" aria-hidden="true"></i></button>'
    + '<button class="btn-icon danger" onclick="confirmDeleteConto(\'' + acc.id + '\')" title="Elimina">'
    + '<i class="ti ti-trash" aria-hidden="true"></i></button>'
    + '</div></div></div>';
}

/* ── Modal: Aggiungi/Modifica conto ───────────────── */

function showAddContoModal() {
  var bOpt = Object.entries(BANCHE).map(function(e) {
    return '<option value="' + e[0] + '">' + e[1].label + '</option>';
  }).join('');
  var tOpt = Object.entries(TIPI_CONTO).map(function(e) {
    return '<option value="' + e[0] + '">' + e[1].label + '</option>';
  }).join('');
  var oggi = new Date().toISOString().slice(0, 10);

  openModal(
    '<div class="modal-hdr"><h3>Nuovo Conto</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<label>Nome conto</label>'
    + '<input id="m-nome" type="text" placeholder="es. Fineco — Corrente">'
    + '<div class="form-row2">'
    + '<div><label>Banca</label><select id="m-banca">' + bOpt + '</select></div>'
    + '<div><label>Tipo</label><select id="m-tipo">' + tOpt + '</select></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Saldo di partenza (€)</label><input id="m-saldo" type="number" step="0.01" placeholder="0.00"></div>'
    + '<div><label>Data apertura</label><input id="m-datap" type="date" value="' + oggi + '"></div>'
    + '</div>'
    + '<label>Note (opzionale)</label>'
    + '<input id="m-note" type="text" placeholder="">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="saveContoFromModal(null)">Salva</button>'
    + '</div>'
  );
  setTimeout(function() {
    var el = document.getElementById('m-nome');
    if (el) el.focus();
  }, 50);
}

function showEditContoModal(id) {
  var acc = getConto(id);
  if (!acc) return;

  var bOpt = Object.entries(BANCHE).map(function(e) {
    return '<option value="' + e[0] + '"' + (e[0] === acc.banca ? ' selected' : '') + '>' + e[1].label + '</option>';
  }).join('');
  var tOpt = Object.entries(TIPI_CONTO).map(function(e) {
    return '<option value="' + e[0] + '"' + (e[0] === acc.tipo ? ' selected' : '') + '>' + e[1].label + '</option>';
  }).join('');

  openModal(
    '<div class="modal-hdr"><h3>Modifica Conto</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<label>Nome conto</label>'
    + '<input id="m-nome" type="text" value="' + _esc(acc.nome) + '">'
    + '<div class="form-row2">'
    + '<div><label>Banca</label><select id="m-banca">' + bOpt + '</select></div>'
    + '<div><label>Tipo</label><select id="m-tipo">' + tOpt + '</select></div>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Saldo di partenza (€)</label><input id="m-saldo" type="number" step="0.01" value="' + (acc.saldoPartenza || 0) + '"></div>'
    + '<div><label>Data apertura</label><input id="m-datap" type="date" value="' + (acc.dataPartenza || '') + '"></div>'
    + '</div>'
    + '<label>Note</label>'
    + '<input id="m-note" type="text" value="' + _esc(acc.note || '') + '">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="saveContoFromModal(\'' + id + '\')">Aggiorna</button>'
    + '</div>'
  );
}

function saveContoFromModal(id) {
  var nome  = (_val('m-nome')  || '').trim();
  var banca = _val('m-banca')  || 'altro';
  var tipo  = _val('m-tipo')   || 'personale';
  var saldo = parseFloat(_val('m-saldo') || '0') || 0;
  var datap = _val('m-datap')  || new Date().toISOString().slice(0, 10);
  var note  = _val('m-note')   || '';

  if (!nome) { alert('Inserisci il nome del conto.'); return; }

  var fields = { nome: nome, banca: banca, tipo: tipo, saldoPartenza: saldo, dataPartenza: datap, note: note };
  if (id) { updateConto(id, fields); } else { addConto(fields); }

  closeModal();
  navigate('accounts');
  showToast(id ? 'Conto aggiornato' : 'Conto aggiunto');
}

function confirmDeleteConto(id) {
  var acc = getConto(id);
  if (!acc) return;
  var txCount = (APP_DATA.transactions || []).filter(function(t) { return t.contoId === id; }).length;

  var warnHtml = txCount
    ? '<div class="pf-warning" style="margin:0 22px 4px;">'
      + '<i class="ti ti-alert-triangle"></i>'
      + ' Verranno eliminate anche le <strong>' + txCount + ' transazioni</strong> associate.</div>'
    : '';

  openModal(
    '<div class="modal-confirm-ico danger"><i class="ti ti-trash"></i></div>'
    + '<div class="modal-confirm-title">Elimina conto</div>'
    + '<div class="modal-confirm-sub">Vuoi eliminare il conto<br><strong>' + _esc(acc.nome) + '</strong>?</div>'
    + warnHtml
    + '<div class="modal-ftr" style="margin-top:16px;">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn-danger" onclick="_doDeleteConto(\'' + id + '\')">Elimina</button>'
    + '</div>'
  );
}

function _doDeleteConto(id) {
  deleteConto(id);
  closeModal();
  navigate('accounts');
  showToast('Conto eliminato', 'info');
}

/* ══════════════════════════════════════════════════════
   SEZIONE TRANSAZIONI
   ══════════════════════════════════════════════════════ */

function renderTransactions() {
  if (!state.txFilter) state.txFilter = { periodo: '90d', contoId: '', categoria: '' };
  var f = state.txFilter;

  var txns  = getTransazioni(f);
  var conti = getConti();

  /* ── Filtri ── */
  var pillsHtml = Object.keys(PERIODO_LABEL).map(function(p) {
    return '<button class="filter-pill' + (f.periodo === p ? ' active' : '')
      + '" onclick="setTxFilter(\'periodo\',\'' + p + '\')">' + PERIODO_LABEL[p] + '</button>';
  }).join('');

  var contiOpt = '<option value="">Tutti i conti</option>'
    + conti.map(function(c) {
        return '<option value="' + c.id + '"' + (f.contoId === c.id ? ' selected' : '') + '>'
          + _esc(c.nome) + '</option>';
      }).join('');

  var catOpt = '<option value="">Tutte le categorie</option>'
    + Object.entries(CATEGORIE).map(function(e) {
        return '<option value="' + e[0] + '"' + (f.categoria === e[0] ? ' selected' : '') + '>'
          + e[1].label + '</option>';
      }).join('');

  var html = '<div class="section-header">'
    + '<h2>Transazioni</h2>'
    + '<div class="tx-btns-hdr">'
    + '<button class="btn btn-secondary" onclick="showExportModal()">'
    + '<i class="ti ti-download" aria-hidden="true"></i><span> Esporta</span></button>'
    + '<button class="btn btn-secondary" onclick="importCSV()">'
    + '<i class="ti ti-upload" aria-hidden="true"></i><span> CSV</span></button>'
    + '<button class="btn btn-primary" onclick="addTransaction()">'
    + '<i class="ti ti-plus" aria-hidden="true"></i><span> Aggiungi</span></button>'
    + '</div></div>'
    + '<div class="tx-filters">'
    + '<div class="filter-pills">' + pillsHtml + '</div>'
    + '<select class="filter-sel" onchange="setTxFilter(\'contoId\',this.value)">' + contiOpt + '</select>'
    + '<select class="filter-sel" onchange="setTxFilter(\'categoria\',this.value)">' + catOpt + '</select>'
    + '</div>';

  if (!txns.length) {
    html += '<div class="pf-empty-state">'
      + '<i class="ti ti-list-search"></i>'
      + '<p>Nessuna transazione nel periodo selezionato.</p>'
      + '</div>';
    return '<div class="section-body-f5">' + html + '</div>';
  }

  /* ── Raggruppa per mese ── */
  var groups = {};
  txns.forEach(function(t) {
    var k = t.data.slice(0, 7);
    if (!groups[k]) groups[k] = [];
    groups[k].push(t);
  });

  Object.keys(groups).sort().reverse().forEach(function(mese) {
    var rows = groups[mese];
    var sub  = rows.reduce(function(s, t) { return s + t.importo; }, 0);
    var subC = sub >= 0 ? '#1D9E75' : '#D85A30';
    var subS = (sub >= 0 ? '+' : '') + eur(sub);

    html += '<div class="tx-group-hdr">'
      + '<span>' + _fmtMese(mese) + '</span>'
      + '<span style="color:' + subC + '">' + subS + '</span>'
      + '</div>';

    rows.forEach(function(t) { html += _renderTxRow(t); });
  });

  return '<div class="section-body-f5">' + html + '</div>';
}

function _renderTxRow(t) {
  var cat   = CATEGORIE[t.categoria] || CATEGORIE.altro;
  var acc   = getConto(t.contoId);
  var banca = acc ? (BANCHE[acc.banca] || BANCHE.altro) : null;
  var color = t.importo >= 0 ? '#1D9E75' : 'var(--text-primary)';
  var segno = t.importo >= 0 ? '+' : '';
  var bankBadge = banca
    ? '<span class="bank-mini" style="background:' + banca.colore + ';color:' + banca.tc + '">' + banca.label + '</span>'
    : '';

  return '<div class="tx-row">'
    + '<div class="tx-cat-ico" style="background:' + cat.colore + '22;color:' + cat.colore + '">'
    + '<i class="ti ' + cat.icona + '" aria-hidden="true"></i></div>'
    + '<div class="tx-info">'
    + '<div class="tx-desc">' + _esc(t.descrizione) + '</div>'
    + '<div class="tx-meta">' + _fmtData(t.data) + ' · ' + cat.label + '</div>'
    + '</div>'
    + '<div class="tx-conto">' + bankBadge + '</div>'
    + '<div class="tx-imp" style="color:' + color + '">' + segno + eur(t.importo) + '</div>'
    + '<div class="tx-row-btns">'
    + '<button class="btn-icon" onclick="showEditTxModal(\'' + t.id + '\')">'
    + '<i class="ti ti-pencil" aria-hidden="true"></i></button>'
    + '<button class="btn-icon danger" onclick="confirmDeleteTx(\'' + t.id + '\')">'
    + '<i class="ti ti-trash" aria-hidden="true"></i></button>'
    + '</div></div>';
}

function setTxFilter(key, value) {
  if (!state.txFilter) state.txFilter = { periodo: '90d', contoId: '', categoria: '' };
  state.txFilter[key] = value;
  navigate('transactions');
}

/* ── Modal: Aggiungi/Modifica transazione ─────────── */

function addTransaction() { showAddTxModal(); }

function showAddTxModal() {
  var conti = getConti();
  if (!conti.length) {
    openModal(
      '<div class="modal-confirm-ico info"><i class="ti ti-wallet-off"></i></div>'
      + '<div class="modal-confirm-title">Nessun conto</div>'
      + '<div class="modal-confirm-sub">Aggiungi prima un conto dalla sezione <strong>Conti</strong> per poter registrare transazioni.</div>'
      + '<div class="modal-ftr" style="margin-top:16px;">'
      + '<button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>'
      + '<button class="btn btn-primary" onclick="closeModal();navigate(\'accounts\')">Vai ai Conti</button>'
      + '</div>'
    );
    return;
  }

  var contiOpt = conti.map(function(c) {
    return '<option value="' + c.id + '">' + _esc(c.nome) + '</option>';
  }).join('');
  var catOpt = Object.entries(CATEGORIE).map(function(e) {
    return '<option value="' + e[0] + '">' + e[1].label + '</option>';
  }).join('');
  var oggi = new Date().toISOString().slice(0, 10);

  openModal(
    '<div class="modal-hdr"><h3>Nuova Transazione</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="tipo-toggle">'
    + '<button id="t-entrata" class="tipo-btn active" onclick="setTxTipo(\'entrata\')">'
    + '<i class="ti ti-arrow-down-right"></i> Entrata</button>'
    + '<button id="t-uscita" class="tipo-btn" onclick="setTxTipo(\'uscita\')">'
    + '<i class="ti ti-arrow-up-right"></i> Uscita</button>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Importo (€)</label><input id="m-importo" type="number" step="0.01" min="0" placeholder="0.00"></div>'
    + '<div><label>Data</label><input id="m-data" type="date" value="' + oggi + '"></div>'
    + '</div>'
    + '<label>Descrizione</label>'
    + '<input id="m-desc" type="text" placeholder="es. Stipendio marzo">'
    + '<div class="form-row2">'
    + '<div><label>Categoria</label><select id="m-cat">' + catOpt + '</select></div>'
    + '<div><label>Conto</label><select id="m-conto">' + contiOpt + '</select></div>'
    + '</div>'
    + '<label>Note (opzionale)</label>'
    + '<input id="m-note" type="text">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="saveTxFromModal(null)">Salva</button>'
    + '</div>'
  );
  window._txTipo = 'entrata';
  setTimeout(function() {
    var el = document.getElementById('m-importo');
    if (el) el.focus();
  }, 50);
}

function showEditTxModal(id) {
  var t = (APP_DATA.transactions || []).find(function(x) { return x.id === id; });
  if (!t) return;

  var tipo = t.importo >= 0 ? 'entrata' : 'uscita';
  var contiOpt = getConti().map(function(c) {
    return '<option value="' + c.id + '"' + (c.id === t.contoId ? ' selected' : '') + '>' + _esc(c.nome) + '</option>';
  }).join('');
  var catOpt = Object.entries(CATEGORIE).map(function(e) {
    return '<option value="' + e[0] + '"' + (e[0] === t.categoria ? ' selected' : '') + '>' + e[1].label + '</option>';
  }).join('');

  openModal(
    '<div class="modal-hdr"><h3>Modifica Transazione</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="tipo-toggle">'
    + '<button id="t-entrata" class="tipo-btn' + (tipo === 'entrata' ? ' active' : '') + '" onclick="setTxTipo(\'entrata\')">'
    + '<i class="ti ti-arrow-down-right"></i> Entrata</button>'
    + '<button id="t-uscita" class="tipo-btn' + (tipo === 'uscita' ? ' active' : '') + '" onclick="setTxTipo(\'uscita\')">'
    + '<i class="ti ti-arrow-up-right"></i> Uscita</button>'
    + '</div>'
    + '<div class="form-row2">'
    + '<div><label>Importo (€)</label><input id="m-importo" type="number" step="0.01" min="0" value="' + Math.abs(t.importo) + '"></div>'
    + '<div><label>Data</label><input id="m-data" type="date" value="' + t.data + '"></div>'
    + '</div>'
    + '<label>Descrizione</label>'
    + '<input id="m-desc" type="text" value="' + _esc(t.descrizione) + '">'
    + '<div class="form-row2">'
    + '<div><label>Categoria</label><select id="m-cat">' + catOpt + '</select></div>'
    + '<div><label>Conto</label><select id="m-conto">' + contiOpt + '</select></div>'
    + '</div>'
    + '<label>Note</label>'
    + '<input id="m-note" type="text" value="' + _esc(t.note || '') + '">'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" onclick="saveTxFromModal(\'' + id + '\')">Aggiorna</button>'
    + '</div>'
  );
  window._txTipo = tipo;
}

function setTxTipo(tipo) {
  window._txTipo = tipo;
  var btnE = document.getElementById('t-entrata');
  var btnU = document.getElementById('t-uscita');
  if (btnE) btnE.classList.toggle('active', tipo === 'entrata');
  if (btnU) btnU.classList.toggle('active', tipo === 'uscita');
}

function saveTxFromModal(id) {
  var raw     = parseFloat(_val('m-importo') || '0') || 0;
  var data    = _val('m-data')    || '';
  var desc    = (_val('m-desc')   || '').trim();
  var cat     = _val('m-cat')     || 'altro';
  var contoId = _val('m-conto')   || '';
  var note    = _val('m-note')    || '';

  if (!raw)     { alert('Inserisci un importo.');      return; }
  if (!data)    { alert('Inserisci una data.');         return; }
  if (!desc)    { alert('Inserisci una descrizione.');  return; }
  if (!contoId) { alert('Seleziona un conto.');         return; }

  var importo = window._txTipo === 'uscita' ? -Math.abs(raw) : Math.abs(raw);
  var fields  = { data: data, descrizione: desc, importo: importo, categoria: cat, contoId: contoId, note: note };

  if (id) { updateTransazione(id, fields); } else { addTransazione(fields); }

  closeModal();
  navigate('transactions');
  showToast(id ? 'Transazione aggiornata' : 'Transazione aggiunta');
}

function confirmDeleteTx(id) {
  var t = (APP_DATA.transactions || []).find(function(x) { return x.id === id; });
  if (!t) return;

  openModal(
    '<div class="modal-confirm-ico danger"><i class="ti ti-trash"></i></div>'
    + '<div class="modal-confirm-title">Elimina transazione</div>'
    + '<div class="modal-confirm-sub">Questa operazione è irreversibile.</div>'
    + '<div class="modal-confirm-detail">'
    + '<strong>' + _esc(t.descrizione) + '</strong><br>'
    + '<span style="color:var(--text-secondary);font-size:13px;">'
    + _fmtData(t.data) + ' &nbsp;·&nbsp; '
    + (t.importo >= 0 ? '+' : '') + eur(t.importo)
    + '</span></div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn-danger" onclick="_doDeleteTx(\'' + id + '\')">Elimina</button>'
    + '</div>'
  );
}

function _doDeleteTx(id) {
  deleteTransazione(id);
  closeModal();
  navigate('transactions');
  showToast('Transazione eliminata', 'info');
}

/* ── Import CSV ───────────────────────────────────── */

function importCSV() {
  var conti = getConti();
  if (!conti.length) {
    openModal(
      '<div class="modal-confirm-ico info"><i class="ti ti-upload"></i></div>'
      + '<div class="modal-confirm-title">Nessun conto</div>'
      + '<div class="modal-confirm-sub">Aggiungi prima un conto dalla sezione <strong>Conti</strong>.</div>'
      + '<div class="modal-ftr" style="margin-top:16px;">'
      + '<button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>'
      + '<button class="btn btn-primary" onclick="closeModal();navigate(\'accounts\')">Vai ai Conti</button>'
      + '</div>'
    );
    return;
  }

  var contiOpt = conti.map(function(c) {
    return '<option value="' + c.id + '">' + _esc(c.nome) + '</option>';
  }).join('');

  openModal(
    '<div class="modal-hdr"><h3>Importa CSV</h3>'
    + '<button class="modal-close" onclick="closeModal()"><i class="ti ti-x"></i></button></div>'
    + '<div class="modal-body">'
    + '<label>Conto destinazione</label>'
    + '<select id="csv-conto">' + contiOpt + '</select>'
    + '<label>File CSV</label>'
    + '<div class="file-drop" onclick="document.getElementById(\'csv-file\').click()">'
    + '<i class="ti ti-cloud-upload drop-icon" aria-hidden="true"></i>'
    + '<p>Clicca per selezionare un file</p>'
    + '<small>Formati supportati: Fineco · Intesa SP · ING · generico</small>'
    + '<input type="file" id="csv-file" accept=".csv,.txt" style="display:none" onchange="handleCSVFile(this)">'
    + '</div>'
    + '<div id="csv-preview"></div>'
    + '</div>'
    + '<div class="modal-ftr">'
    + '<button class="btn btn-secondary" onclick="closeModal()">Annulla</button>'
    + '<button class="btn btn-primary" id="csv-ok-btn" style="display:none" onclick="confirmImportCSV()">Importa</button>'
    + '</div>'
  );
}

function handleCSVFile(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var contoId = _val('csv-conto');
      var result  = parseCSV(e.target.result, contoId);
      var acc     = getConto(contoId);
      var from    = acc ? new Date((acc.dataPartenza || '1970-01-01') + 'T00:00:00') : new Date(0);

      var valid   = result.rows.filter(function(r) {
        return new Date(r.data + 'T00:00:00') >= from;
      });
      var skipped = result.rows.length - valid.length;
      window._csvPending = valid;

      var fmtLabel = { fineco:'Fineco', isp:'Intesa San Paolo', ing:'ING', generic:'Generico' };

      var previewHtml = valid.slice(0, 8).map(function(r) {
        var cat = CATEGORIE[r.categoria] || CATEGORIE.altro;
        var col = r.importo >= 0 ? '#1D9E75' : '#D85A30';
        var sgn = r.importo >= 0 ? '+' : '';
        return '<div class="csv-row">'
          + '<span class="csv-d">' + r.data + '</span>'
          + '<span class="csv-desc">' + _esc(r.descrizione.slice(0, 45)) + '</span>'
          + '<span class="csv-cat-ico" style="color:' + cat.colore + '"><i class="ti ' + cat.icona + '"></i></span>'
          + '<span class="csv-imp" style="color:' + col + '">' + sgn + eur(r.importo) + '</span>'
          + '</div>';
      }).join('');

      var skipNote = skipped
        ? ' <span style="color:var(--text-secondary)">(' + skipped + ' ignorate)</span>'
        : '';

      document.getElementById('csv-preview').innerHTML =
        '<div class="csv-summary">'
        + '<span>Formato: <strong>' + (fmtLabel[result.format] || result.format) + '</strong></span>'
        + '<span><strong>' + valid.length + '</strong> transazioni' + skipNote + '</span>'
        + '</div>'
        + previewHtml
        + (valid.length > 8 ? '<div class="csv-more">… e altre ' + (valid.length - 8) + '</div>' : '');

      var btn = document.getElementById('csv-ok-btn');
      if (btn) {
        btn.style.display = '';
        btn.textContent   = 'Importa ' + valid.length;
      }
    } catch (err) {
      document.getElementById('csv-preview').innerHTML =
        '<div class="csv-error"><i class="ti ti-alert-circle"></i> ' + err.message + '</div>';
    }
  };
  reader.readAsText(file, 'utf-8');
}

function confirmImportCSV() {
  var pending = window._csvPending || [];
  if (!pending.length) return;
  pending.forEach(function(r) { addTransazione(r); });
  window._csvPending = null;
  closeModal();
  navigate('transactions');
  showToast(pending.length + ' transazioni importate');
}

/* ── Utility interne ─────────────────────────────── */

function _val(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function _esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
