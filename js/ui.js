/* =====================================================
   ui.js — Funzioni di rendering HTML per ogni sezione
   Restituiscono stringhe HTML; nessuna manipolazione DOM diretta.
   ===================================================== */

/* ===== HELPER: logo o monogramma titolo ===== */
function logoBox(item) {
  if (item.logoImg) {
    return `<div class="port-logo">
      <img src="${item.logoImg}" alt="${item.name}"
           onerror="this.closest('.port-logo').innerHTML='<span>${item.logoKey || item.name.charAt(0)}</span>'">
    </div>`;
  }
  const color = TYPE_COLORS[item.type];
  return `<div class="port-logo" style="color:${color};border-color:${color}22;background:${color}12;">
    ${item.logoKey || item.name.charAt(0)}
  </div>`;
}

/* ===== HELPER: riga transazione ===== */
function txnRowHTML(txn) {
  // Compatibile con nuovo formato Fase 5 (categoria/importo/descrizione/contoId)
  const catKey = txn.categoria || txn.cat || 'altro';
  let color, icon;
  if (typeof CATEGORIE !== 'undefined' && CATEGORIE[catKey]) {
    color = CATEGORIE[catKey].colore;
    icon  = CATEGORIE[catKey].icona;
  } else {
    color = (CAT_COLORS && CAT_COLORS[catKey]) || '#888780';
    icon  = (CAT_ICONS  && CAT_ICONS[catKey])  || 'ti-circle';
  }
  const amt    = txn.importo !== undefined ? txn.importo : txn.amount;
  const desc   = txn.descrizione || txn.desc    || '';
  const accNm  = txn.contoId
    ? (typeof getConto === 'function' && getConto(txn.contoId) ? getConto(txn.contoId).nome : txn.contoId)
    : (txn.account || '');
  const sign   = amt >= 0 ? '+' : '';
  const amtStr = `${sign}${eur(amt, 2)}`;
  const cls    = amt >= 0 ? 'text-gain' : 'text-loss';
  return `
    <div class="txn-row">
      <div class="txn-icon" style="background:${color}20;color:${color};">
        <i class="ti ${icon}" aria-hidden="true"></i>
      </div>
      <div class="txn-info">
        <div class="txn-desc">${desc}</div>
        <div class="txn-acc">${accNm}</div>
      </div>
      <div class="txn-amount ${cls}">${amtStr}</div>
    </div>`;
}

/* ===== HELPER: legenda allocazione ===== */
function allocLegendHTML() {
  return allocation.map(s => `
    <div class="alloc-legend-item">
      <span class="alloc-dot" style="background:${s.color};"></span>
      <span class="alloc-lbl">${s.label}</span>
      <span class="alloc-val">${eur(s.value)}</span>
    </div>`).join('');
}

/* ===== HELPER: blocco G/P complessivo (solo desktop) ===== */
function glBlockHTML() {
  const { pV, pC, pGL, pGLP } = totals;
  const cls  = glClass(pGL);
  const barW = Math.min(Math.max((pV / pC - 1) * 200 + 40, 0), 100);
  return `
    <div class="card">
      <div class="section-title">G/P complessivo</div>
      <div class="metric-value ${cls}" style="font-size:28px;">${pct(pGLP)}</div>
      <div class="metric-sub ${cls}" style="font-size:14px;margin-top:4px;">
        ${pGL >= 0 ? '+' : ''}${eur(pGL, 2)}
      </div>
      <div class="gl-bar-wrap">
        <div class="gl-bar" style="width:${barW}%;background:${glColor(pGL)};"></div>
      </div>
      <div class="split-row" style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
        <span>Carico: ${eur(pC)}</span>
        <span>Attuale: ${eur(pV)}</span>
      </div>
    </div>`;
}

/* =====================================================
   DASHBOARD
   ===================================================== */
function renderDashboard(isDesktop) {
  const { pV, pGL, pGLP } = totals;

  const hero = `
    <div class="hero-card">
      <p class="hero-label">Patrimonio Totale</p>
      <p class="hero-value" id="hero-val">€0</p>
      <div class="hero-badges">
        <span class="hero-badge">
          <i class="ti ti-trending-up" aria-hidden="true"></i>
          ${pct(pGLP)} portafoglio
        </span>
        <span class="hero-badge">
          <i class="ti ti-calendar" aria-hidden="true"></i>
          ${new Date().toLocaleDateString('it-IT', { day:'numeric', month:'short', year:'numeric' })}
        </span>
      </div>
    </div>`;

  const metrics = `
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-label">
          <i class="ti ti-chart-pie" aria-hidden="true"></i> Portafoglio
        </div>
        <div class="metric-value">${eur(pV)}</div>
        <div class="metric-sub ${glClass(pGL)}">${pct(pGLP)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">
          <i class="ti ti-wallet" aria-hidden="true"></i> Liquidità
        </div>
        <div class="metric-value">${eur(ccTotal)}</div>
        <div class="metric-sub text-secondary">${(APP_DATA.accounts||[]).length} conti</div>
      </div>
    </div>`;

  const alloc = `
    <div class="card">
      <div class="section-title">
        Allocazione
        <button class="btn btn-secondary" style="padding:5px 11px;font-size:12px;" onclick="refreshQuotes()">
          <i class="ti ti-refresh" aria-hidden="true"></i> Aggiorna
        </button>
      </div>
      <div class="alloc-wrap">
        <div class="alloc-chart-box">
          <canvas id="donut-chart" role="img"
            aria-label="Grafico allocazione portafoglio per tipo di asset">
            ${allocation.map(s => `${s.label}: ${eur(s.value)}`).join(', ')}
          </canvas>
        </div>
        <div class="alloc-legend" style="flex:1;">${allocLegendHTML()}</div>
      </div>
    </div>`;

  const recent = `
    <div class="card">
      <div class="section-title">
        Movimenti recenti
        <span class="section-link" onclick="navigate('transactions')">Tutti →</span>
      </div>
      ${APP_DATA.transactions.slice(0, 4).map(txnRowHTML).join('')}
    </div>`;

  /* Grafico liquidità — dichiarato qui per essere disponibile su entrambi i layout */
  const perfLine = `
    <div class="card">
      <div class="section-title" style="margin-bottom:10px;">
        Liquidità — ultimi 6 mesi
      </div>
      <div style="height:140px;position:relative;">
        <canvas id="perf-line"></canvas>
      </div>
    </div>`;

  if (isDesktop) {
    const topAssets = `
      <div class="card">
        <div class="section-title">Titoli principali</div>
        ${[...enriched]
          .sort((a, b) => b.totalValue - a.totalValue)
          .slice(0, 5)
          .map(i => `
            <div class="acc-row">
              ${logoBox(i)}
              <div class="acc-info">
                <div class="acc-name">${i.name}</div>
                <div class="acc-sub">${i.ticker}</div>
              </div>
              <div class="acc-right">
                <div class="acc-balance">${eur(i.totalValue)}</div>
                <div class="acc-gl ${glClass(i.gl)}">${pct(i.glPct)}</div>
              </div>
            </div>`).join('')}
      </div>`;

    return `
      <div class="section-body">
        <div class="dash-grid">
          <div class="dash-col">${hero}${alloc}${recent}</div>
          <div class="dash-col">${metrics}${topAssets}${glBlockHTML()}${perfLine}</div>
        </div>
      </div>`;
  }

  return `
    <div class="section-body">
      ${hero}${metrics}${perfLine}${alloc}${recent}
    </div>`;
}

/* =====================================================
   PORTAFOGLIO
   ===================================================== */
function renderPortfolio(filter) {
  const LABELS = { Tutti:'Tutti', ETF:'ETF', Azione:'Azioni', Fondo:'Fondi', Obbligazione:'Obbligazioni' };
  const filters = ['Tutti', 'ETF', 'Azione', 'Fondo', 'Obbligazione'];
  const items   = filter === 'Tutti' ? enriched : enriched.filter(i => i.type === filter);

  const filterBar = `
    <div class="filter-bar">
      ${filters.map(f => `
        <button class="filter-btn${filter === f ? ' active' : ''}"
                onclick="setFilter('${f}')">${LABELS[f]}</button>`).join('')}
      <button class="filter-btn port-add-btn" onclick="showAddPortfolioModal()" style="margin-left:auto;">
        <i class="ti ti-plus" aria-hidden="true"></i> Aggiungi
      </button>
    </div>`;

  if (!enriched.length) {
    return filterBar + `
      <div class="pf-empty-state" style="margin-top:40px;">
        <i class="ti ti-chart-pie-off"></i>
        <p>Il portafoglio è vuoto.<br>
          <span class="section-link" onclick="showAddPortfolioModal()">Aggiungi il tuo primo titolo →</span>
        </p>
      </div>`;
  }

  const fV   = items.reduce((s, i) => s + i.totalValue, 0);
  const fC   = items.reduce((s, i) => s + i.totalCost,  0);
  const fGL  = fV - fC;
  const fGLP = fC > 0 ? (fGL / fC) * 100 : 0;

  const lastUpdNote = APP_DATA.lastQuoteUpdate
    ? `<div class="quote-note"><i class="ti ti-clock" aria-hidden="true"></i> Quotazioni: ${_timeAgo(APP_DATA.lastQuoteUpdate)} · <span class="section-link" onclick="refreshQuotes()">Aggiorna</span></div>`
    : typeof QUOTES !== 'undefined' && QUOTES.isConfigured()
      ? `<div class="quote-note warn"><i class="ti ti-alert-triangle" aria-hidden="true"></i> Prezzi non aggiornati · <span class="section-link" onclick="refreshQuotes()">Aggiorna ora</span></div>`
      : '';

  const summaryBar = `
    <div class="summary-bar">
      <div class="summary-item">
        <div class="summary-label">Valore mkt</div>
        <div class="summary-value">${eur(fV)}</div>
      </div>
      <div class="summary-sep"></div>
      <div class="summary-item">
        <div class="summary-label">Carico tot.</div>
        <div class="summary-value">${eur(fC)}</div>
      </div>
      <div class="summary-sep"></div>
      <div class="summary-item">
        <div class="summary-label">G/P</div>
        <div class="summary-value ${glClass(fGL)}">${pct(fGLP)}</div>
      </div>
    </div>${lastUpdNote}`;

  const chartHeight = Math.max(items.length * 42, 120);
  const perfChart = `
    <div class="port-perf-card">
      <div class="section-title" style="margin-bottom:10px;">
        Rendimento per titolo
        <span class="section-link" onclick="showExportModal()">
          <i class="ti ti-download" aria-hidden="true"></i> Esporta
        </span>
      </div>
      <div style="height:${chartHeight}px;position:relative;">
        <canvas id="perf-bar"></canvas>
      </div>
    </div>`;

  const portList = `
    <div class="port-list">
      ${items.map(i => {
        const col    = TYPE_COLORS[i.type];
        const hasPrc = i.priceUpdated;
        const dayPos = (i.dayChangePct || 0) >= 0;
        const dayRow = hasPrc ? `
          <div class="port-day">
            <span class="${dayPos ? 'text-gain' : 'text-loss'}">
              <i class="ti ${dayPos ? 'ti-trending-up' : 'ti-trending-down'}" aria-hidden="true"></i>
              ${dayPos ? '+' : ''}${(i.dayChangePct||0).toFixed(2)}%
              (${(i.dayChange||0) >= 0 ? '+' : ''}${eur(i.dayChange||0, 2)})
            </span>
            <span class="price-age">${_timeAgo(i.priceUpdated)}</span>
          </div>` : '';
        return `
          <div class="port-item" style="border-left-color:${col};">
            <div class="port-header">
              ${logoBox(i)}
              <div class="port-name-wrap">
                <div class="port-top">
                  <span class="type-badge" style="background:${col}18;color:${col};">${i.type}</span>
                  <span class="port-name">${i.name}</span>
                </div>
                <div class="port-ticker">${i.ticker}${i.priceSource === 'custom' ? ' <span style="font-size:10px;color:var(--c-amber);">★ custom</span>' : ''}</div>
              </div>
              <div class="port-item-actions">
                <button class="btn-icon" onclick="showUpdatePriceModal('${i.id}')" title="Aggiorna prezzo">
                  <i class="ti ti-currency-euro" aria-hidden="true"></i>
                </button>
                <button class="btn-icon" onclick="showEditPortfolioModal('${i.id}')" title="Modifica">
                  <i class="ti ti-pencil" aria-hidden="true"></i>
                </button>
                <button class="btn-icon danger" onclick="confirmDeletePortfolioItem('${i.id}')" title="Elimina">
                  <i class="ti ti-trash" aria-hidden="true"></i>
                </button>
              </div>
            </div>
            <div class="port-stats">
              <div><div class="stat-lbl">Qtà</div><div class="stat-val">${i.qty.toLocaleString('it-IT')}</div></div>
              <div><div class="stat-lbl">Prezzo</div><div class="stat-val">${eur(i.price, 2)}</div></div>
              <div><div class="stat-lbl">Valore</div><div class="stat-val">${eur(i.totalValue)}</div></div>
              <div><div class="stat-lbl">G/P tot.</div><div class="stat-val ${glClass(i.gl)}">${pct(i.glPct)}</div></div>
            </div>
            ${dayRow}
          </div>`;
      }).join('')}
    </div>`;

  return filterBar + summaryBar + perfChart + portList;
}

/* =====================================================
   CONTI
   ===================================================== */
function renderAccounts() {
  const personal = APP_DATA.accounts.filter(a => a.type === 'personal');
  const shared   = APP_DATA.accounts.filter(a => a.type === 'shared');

  function accRows(list) {
    return list.map(a => `
      <div class="acc-row">
        <div class="bank-badge" style="background:${BANK_COLORS[a.bank]};">${BANK_NAMES[a.bank]}</div>
        <div class="acc-info">
          <div class="acc-name">${a.name}</div>
          <div class="acc-sub">${a.type === 'shared' ? 'Condiviso con moglie' : 'Conto personale'}</div>
        </div>
        <div class="acc-right">
          <div class="acc-balance">${eur(a.balance)}</div>
        </div>
      </div>`).join('');
  }

  return `
    <div class="section-body">

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-chart-pie" aria-hidden="true"></i> Portafoglio Investimenti
          </span>
        </div>
        <div class="acc-row">
          <div class="bank-badge" style="background:${BANK_COLORS.fineco};">${BANK_NAMES.fineco}</div>
          <div class="acc-info">
            <div class="acc-name">Fineco Investimenti</div>
            <div class="acc-sub">${enriched.length} titoli in portafoglio</div>
          </div>
          <div class="acc-right">
            <div class="acc-balance">${eur(totals.pV)}</div>
            <div class="acc-gl ${glClass(totals.pGL)}">${pct(totals.pGLP)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-user" aria-hidden="true"></i> Conti Personali
          </span>
        </div>
        ${accRows(personal)}
      </div>

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-users" aria-hidden="true"></i> Conto Comune
          </span>
        </div>
        ${accRows(shared)}
      </div>

      <div class="card split-row">
        <div>
          <div class="metric-label"><i class="ti ti-wallet" aria-hidden="true"></i> Liquidità</div>
          <div class="metric-value">${eur(ccTotal)}</div>
        </div>
        <div style="text-align:right;">
          <div class="metric-label">Patrimonio totale</div>
          <div class="metric-value text-blue">${eur(patrimony)}</div>
        </div>
      </div>

    </div>`;
}

/* =====================================================
   MOVIMENTI
   ===================================================== */
function renderTransactions() {
  const grouped = {};
  APP_DATA.transactions.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });

  const groups = Object.entries(grouped)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, txns]) => `
      <div class="date-hdr">${formatDateLong(date)}</div>
      ${txns.map(txnRowHTML).join('')}`)
    .join('');

  return `
    <div class="section-body">
      <div class="btn-group">
        <button class="btn btn-primary" onclick="addTransaction()">
          <i class="ti ti-plus" aria-hidden="true"></i> Nuovo movimento
        </button>
        <button class="btn btn-secondary" onclick="importCSV()">
          <i class="ti ti-upload" aria-hidden="true"></i> Importa CSV
        </button>
      </div>
      <div class="card">${groups}</div>
    </div>`;
}

/* =====================================================
   IMPOSTAZIONI (Fase 3: Drive + PIN)
   ===================================================== */
function renderSettings() {

  /* === Blocco Google Drive === */
  const connected  = typeof drive !== 'undefined' && drive.isConnected();
  const email      = connected && drive.getEmail() ? drive.getEmail() : null;
  const clientId   = typeof drive !== 'undefined' ? drive.getClientId() : '';
  const hasBio     = !!localStorage.getItem('pf_bio_id');

  const driveBlock = connected
    ? `<div class="drive-status connected">
        <i class="ti ti-brand-google-drive" aria-hidden="true"></i>
        <div class="drive-status-info">
          <div class="drive-status-name">${email || 'Drive connesso'}</div>
          <div class="drive-status-sub">Backup automatico attivo</div>
        </div>
        <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;"
                onclick="disconnectDrive()">Disconnetti</button>
      </div>`
    : `<div class="drive-status disconnected">
        <i class="ti ti-cloud-off" aria-hidden="true"></i>
        <div class="drive-status-info">
          <div class="drive-status-name">Drive non connesso</div>
          <div class="drive-status-sub">I dati sono solo in questa sessione</div>
        </div>
      </div>
      ${clientId
        ? `<button class="btn btn-primary btn-full" onclick="connectDrive()">
             <i class="ti ti-brand-google-drive" aria-hidden="true"></i> Connetti Google Drive
           </button>`
        : `<div>
             <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
               Inserisci il <strong>Client ID OAuth 2.0</strong> del tuo progetto Google Cloud:
             </p>
             <div class="settings-input-row">
               <input type="text" id="drive-client-id" placeholder="xxxxx.apps.googleusercontent.com"
                      value="${clientId}">
               <button class="btn btn-primary" onclick="saveClientId()">Salva</button>
             </div>
             <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">
               <i class="ti ti-info-circle" aria-hidden="true"></i>
               <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--c-blue);">
                 Google Cloud Console
               </a> → APIs → Drive API → Credenziali → Client OAuth
             </p>
           </div>`}`;

  /* === Righe impostazioni generali === */
  const workerUrl    = typeof QUOTES !== 'undefined' ? QUOTES.getWorkerUrl() : '';
  const autoRefresh  = typeof QUOTES !== 'undefined' ? QUOTES.getAutoRefresh() : 0;

  const quoteBlock = workerUrl ? `
    <div class="drive-status connected" style="margin-bottom:12px;">
      <i class="ti ti-activity" aria-hidden="true"></i>
      <div class="drive-status-info">
        <div class="drive-status-name">Worker attivo</div>
        <div class="drive-status-sub" style="word-break:break-all;">${workerUrl}</div>
      </div>
      <button class="btn btn-secondary" style="padding:5px 10px;font-size:12px;flex-shrink:0;"
              onclick="clearWorkerUrl()">Rimuovi</button>
    </div>` : `
    <div style="margin-bottom:10px;">
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
        Incolla l'URL del tuo Cloudflare Worker per le quotazioni in tempo reale:
      </p>
      <div class="settings-input-row">
        <input type="text" id="worker-url-input"
               placeholder="https://pf-quotes.USERNAME.workers.dev"
               value="${workerUrl}">
        <button class="btn btn-primary" onclick="saveWorkerUrl()">Salva</button>
      </div>
    </div>`;

  const autoRow = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:0.5px solid var(--border);">
      <div style="font-size:13px;">Auto-aggiornamento</div>
      <select onchange="setAutoRefresh(this.value)"
              style="padding:5px 8px;border:0.5px solid var(--border-md);border-radius:var(--r-sm);font-size:13px;font-family:var(--font);">
        <option value="0"  ${autoRefresh===0  ?'selected':''}>Disattivato</option>
        <option value="5"  ${autoRefresh===5  ?'selected':''}>Ogni 5 min</option>
        <option value="15" ${autoRefresh===15 ?'selected':''}>Ogni 15 min</option>
        <option value="30" ${autoRefresh===30 ?'selected':''}>Ogni 30 min</option>
      </select>
    </div>`;

  const tickerRows = `
    <div style="padding-top:10px;border-top:0.5px solid var(--border);">
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
        <i class="ti ti-link" aria-hidden="true"></i>
        URL personalizzati per titoli non su Yahoo Finance (fondi, BTP, ecc.)
      </div>
      ${APP_DATA.portfolio.map(item => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span class="type-badge"
                style="background:${TYPE_COLORS[item.type]}18;color:${TYPE_COLORS[item.type]};flex-shrink:0;">
            ${item.ticker}
          </span>
          <input type="text"
                 id="curl-${item.ticker.replace(/\./g,'_')}"
                 placeholder="URL ZoneBourse / Borsa Italiana / Morningstar"
                 value="${item.customUrl || ''}"
                 style="flex:1;padding:6px 10px;border:0.5px solid var(--border-md);border-radius:var(--r-sm);font-size:12px;font-family:var(--font);">
          <button class="btn btn-secondary"
                  style="padding:5px 10px;font-size:12px;flex-shrink:0;"
                  onclick="saveCustomUrl('${item.ticker}')">✓</button>
        </div>`).join('')}
    </div>`;

  const rowsHTML = '';

  return `
    <div class="section-body">

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-brand-google-drive" aria-hidden="true"></i> Google Drive
          </span>
        </div>
        ${driveBlock}
      </div>

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-shield-lock" aria-hidden="true"></i> Sicurezza
          </span>
        </div>
        <div class="settings-row" onclick="changePIN()">
          <div class="settings-left">
            <div class="settings-icon" style="background:#7F77DD18;color:#7F77DD;">
              <i class="ti ti-lock" aria-hidden="true"></i>
            </div>
            <div>
              <div class="settings-name">Cambia PIN</div>
              <div class="settings-sub">Modifica il PIN di accesso a 6 cifre</div>
            </div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text-tertiary);" aria-hidden="true"></i>
        </div>
        <div class="settings-row" onclick="lockApp()">
          <div class="settings-left">
            <div class="settings-icon" style="background:#BA751718;color:#BA7517;">
              <i class="ti ti-lock-access" aria-hidden="true"></i>
            </div>
            <div>
              <div class="settings-name">Blocca app</div>
              <div class="settings-sub">${hasBio ? 'Sblocco con impronta disponibile' : 'Richiederà il PIN al prossimo accesso'}</div>
            </div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text-tertiary);" aria-hidden="true"></i>
        </div>
        <div class="settings-row" onclick="resetApp()" style="color:var(--c-coral);">
          <div class="settings-left">
            <div class="settings-icon" style="background:#D85A3018;color:#D85A30;">
              <i class="ti ti-trash" aria-hidden="true"></i>
            </div>
            <div>
              <div class="settings-name" style="color:var(--c-coral);">Reset completo</div>
              <div class="settings-sub">Elimina PIN, configurazione e dati locali</div>
            </div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text-tertiary);" aria-hidden="true"></i>
        </div>
      </div>

      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-activity" aria-hidden="true"></i> Quotazioni
          </span>
        </div>
        ${quoteBlock}
        ${autoRow}
        ${tickerRows}
      </div>


      <div class="card">
        <div class="section-title">
          <span style="display:flex;align-items:center;gap:8px;">
            <i class="ti ti-download" aria-hidden="true"></i> Esportazione dati
          </span>
        </div>
        <div class="settings-row" onclick="exportPortfolioCSV()">
          <div class="settings-left">
            <div class="settings-icon" style="background:rgba(55,138,221,.12);color:var(--c-blue);">
              <i class="ti ti-table-export" aria-hidden="true"></i>
            </div>
            <div>
              <div class="settings-name">Esporta Portafoglio CSV</div>
              <div class="settings-sub">Ticker, quantità, prezzi, G/P</div>
            </div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text-tertiary);" aria-hidden="true"></i>
        </div>
        <div class="settings-row" onclick="exportTransactionsCSV()">
          <div class="settings-left">
            <div class="settings-icon" style="background:rgba(29,158,117,.12);color:var(--c-teal);">
              <i class="ti ti-receipt-2" aria-hidden="true"></i>
            </div>
            <div>
              <div class="settings-name">Esporta Transazioni CSV</div>
              <div class="settings-sub">Data, descrizione, importo, categoria</div>
            </div>
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text-tertiary);" aria-hidden="true"></i>
        </div>
      </div>

      <div class="info-box">
        <i class="ti ti-shield-check" style="color:var(--c-green);" aria-hidden="true"></i>
        Dati cifrati AES-256-GCM · PIN non memorizzato · Nessun server di terze parti
      </div>

    </div>`;
}
