/* =====================================================
   app.js — Router, navigazione, init app
   - Rimossi placeholder Fase 5 (addTransaction/importCSV) e showToast
     duplicati: vengono da ui-accounts-transactions.js
   - Auto-connect a Drive dopo unlock se già connesso in passato
   - Auto-avvio worker quotazioni se configurato
   ===================================================== */

const state = { section: 'dashboard', filter: 'Tutti' };

function $(id)    { return document.getElementById(id); }
function $$(sel)  { return document.querySelectorAll(sel); }
function isDesk() { return window.innerWidth >= 768; }

/* =====================================================
   NAVIGAZIONE
   ===================================================== */
function navigate(section) {
  state.section = section;
  renderApp();
}

function setFilter(filter) {
  state.filter = filter;
  const c = $('section-portfolio');
  if (c) {
    destroyAllCharts();
    c.innerHTML = renderPortfolio(filter);
    setTimeout(() => initBarChart('perf-bar'), 50);
  }
}

/* =====================================================
   RENDER
   ===================================================== */
function renderApp() {
  if (!auth.isUnlocked()) return;
  const desk  = isDesk();
  const sec   = state.section;
  const title = SECTION_TITLES[sec];

  const ptEl = $('page-title');    if (ptEl) ptEl.textContent = title;
  const psEl = $('page-subtitle'); if (psEl) psEl.textContent = new Date().toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
  const dtEl = $('desktop-title'); if (dtEl) dtEl.textContent = title;
  const stEl = $('sidebar-total'); if (stEl) stEl.textContent = eur(patrimony);

  $$('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === sec));
  $$('.section').forEach(s => s.classList.remove('active'));

  destroyAllCharts();
  const container = $(`section-${sec}`);
  if (!container) return;
  container.classList.add('active');

  switch (sec) {
    case 'dashboard':
      container.innerHTML = renderDashboard(desk);
      setTimeout(() => {
        initDonut('donut-chart');
        animateCounter('hero-val', patrimony);
        if (typeof getPatrimonyHistory === 'function') {
          initLineChart('perf-line', getPatrimonyHistory(6));
        }
      }, 50);
      break;
    case 'portfolio':
      container.innerHTML = renderPortfolio(state.filter);
      setTimeout(() => initBarChart('perf-bar'), 50);
      break;
    case 'accounts':     container.innerHTML = renderAccounts();              break;
    case 'transactions': container.innerHTML = renderTransactions();          break;
    case 'settings':     container.innerHTML = renderSettings();              break;
  }
}

/* =====================================================
   ANIMAZIONE CONTATORE
   ===================================================== */
function animateCounter(elId, target, duration = 1200) {
  const el = $(elId);
  if (!el) return;
  const start = performance.now();
  function tick(now) {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = eur(Math.round(ease * target));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* =====================================================
   GESTIONE EVENTI AUTH
   Flusso unlock:
   1. Mostra loader
   2. AUTO-CONNECT a Drive se configurato (in parallelo)
   3. Carica dati (da Drive se connesso, altrimenti sessionStorage)
   4. Avvia auto-refresh quotazioni se Worker configurato
   ===================================================== */
window.addEventListener('auth:unlocked', async (e) => {
  const isFresh = e.detail?.fresh;
  AUTH_UI.hide();
  showGlobalLoader('Caricamento dati…');

  /* ---- 1. Auto-connect Drive (silenzioso, senza popup) ---- */
  // Avvia subito; verrà completato in background tramite l'evento drive:connected
  if (drive.getClientId() && localStorage.getItem('pf_drive_connected')) {
    drive.autoConnect();
  }

  /* ---- 2. Carica dati ---- */
  if (!isFresh) {
    try {
      // Aspetta brevemente che Drive si connetta (max 2.5s)
      // così load() può scaricare dal cloud invece che dalla sola sessione
      await _waitForDriveOrTimeout(2500);
      const data = await storage.load();
      if (data) setAppData(data);
    } catch (err) {
      console.warn('[app] Caricamento dati fallito:', err.message);
      showToast('⚠ Dati non caricati: ' + err.message, 'error');
    }
  } else {
    // Primo setup PIN: salva i dati di default
    await storage.save();
  }

  hideGlobalLoader();
  renderApp();

  /* ---- 3. Avvia auto-refresh quotazioni se Worker configurato ---- */
  if (typeof QUOTES !== 'undefined' && QUOTES.isConfigured()) {
    QUOTES.startAutoRefresh();
    // Refresh immediato se i dati sono vecchi (> 10 min) o mai aggiornati
    const lastUpd = APP_DATA.lastQuoteUpdate;
    const stale   = !lastUpd || (Date.now() - new Date(lastUpd)) > 10 * 60_000;
    if (stale) setTimeout(() => QUOTES.refresh(), 1500);
  }
});

/* Aspetta che Drive si connetta o scada il timeout */
function _waitForDriveOrTimeout(ms) {
  return new Promise(resolve => {
    if (!drive.getClientId() || !localStorage.getItem('pf_drive_connected')) {
      resolve(); return;
    }
    if (drive.isConnected()) { resolve(); return; }
    const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
    function onConn()  { cleanup(); resolve(); }
    function onErr()   { cleanup(); resolve(); }
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('drive:connected',     onConn);
      window.removeEventListener('drive:error',         onErr);
      window.removeEventListener('drive:silent_failed', onErr);
    }
    window.addEventListener('drive:connected',     onConn);
    window.addEventListener('drive:error',         onErr);
    window.addEventListener('drive:silent_failed', onErr);
  });
}

/* Quando Drive si connette, sincronizza i dati */
window.addEventListener('drive:connected', async () => {
  showToast('✓ Google Drive connesso', 'success');
  try { await storage.sync(); } catch (e) { console.warn('[app] sync post-connect:', e.message); }
  renderApp();
});

window.addEventListener('drive:disconnected', () => {
  showToast('Drive disconnesso', 'info');
  renderApp();
});

window.addEventListener('drive:need_client_id', () => {
  navigate('settings');
  showToast('Configura il Client ID Google in Impostazioni.', 'info');
});

window.addEventListener('drive:error', (e) => {
  showToast('Errore Drive: ' + (e.detail || 'sconosciuto'), 'error');
});

/* Silent refresh fallito: l'utente dovrà ri-cliccare "Connetti" */
window.addEventListener('drive:silent_failed', () => {
  console.warn('[app] Drive auto-connect silenzioso non riuscito');
});

/* Token scaduto: prova un refresh silenzioso */
window.addEventListener('drive:token_expired', () => {
  if (drive.getClientId() && localStorage.getItem('pf_drive_connected')) {
    drive.autoConnect();
  }
});

/* =====================================================
   LOADER GLOBALE
   (showToast è definita in ui-accounts-transactions.js)
   ===================================================== */
function showGlobalLoader(msg) {
  let el = $('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:8500;color:white;font-size:15px;';
    document.body.appendChild(el);
  }
  el.textContent    = msg || 'Caricamento…';
  el.style.display  = 'flex';
}

function hideGlobalLoader() {
  const el = $('global-loader');
  if (el) el.style.display = 'none';
}

/* =====================================================
   AZIONI IMPOSTAZIONI
   ===================================================== */

/* --- Drive --- */
function connectDrive()    { drive.signIn(); }
function disconnectDrive() { drive.signOut(); }
function saveClientId() {
  const input = $('drive-client-id');
  if (!input?.value.trim()) return;
  drive.setClientId(input.value.trim());
  showToast('Client ID salvato', 'success');
  renderApp();
}

/* --- Quotazioni --- */
function saveWorkerUrl() {
  const input = $('worker-url-input');
  if (!input?.value.trim()) return;
  QUOTES.setWorkerUrl(input.value.trim());
  showToast('Worker URL salvato', 'success');
  QUOTES.startAutoRefresh();
  // Primo refresh immediato per validare la configurazione
  setTimeout(() => QUOTES.refresh(), 500);
  renderApp();
}

function clearWorkerUrl() {
  QUOTES.clearWorkerUrl();
  QUOTES.stopAutoRefresh();
  showToast('Worker URL rimosso', 'info');
  renderApp();
}

function setAutoRefresh(min) {
  QUOTES.setAutoRefresh(parseInt(min));
  QUOTES.startAutoRefresh();
  showToast(parseInt(min) > 0 ? `Auto-refresh ogni ${min} min` : 'Auto-refresh disattivato', 'info');
}

function saveCustomUrl(ticker) {
  const key = ticker.replace(/\./g, '_');
  const input = $(`curl-${key}`);
  if (!input) return;
  const url = input.value.trim();
  const item = APP_DATA.portfolio.find(i => i.ticker === ticker);
  if (item) {
    item.customUrl = url || null;
    storage.save();
    showToast(url ? `URL salvato per ${ticker}` : `URL rimosso per ${ticker}`, 'success');
  }
}

/* --- Sicurezza --- */
function refreshQuotes()  {
  if (typeof QUOTES === 'undefined' || !QUOTES.isConfigured()) {
    showToast('Configura prima il Worker URL in Impostazioni', 'info');
    navigate('settings');
    return;
  }
  QUOTES.refresh();
}

function changePIN()      { auth.lock(); AUTH_UI.show('setup'); }
function lockApp()        { auth.lock(); }
function resetApp() {
  if (!confirm('Eliminare tutti i dati e la configurazione?')) return;
  if (typeof QUOTES !== 'undefined') QUOTES.stopAutoRefresh();
  auth.reset();
  sessionStorage.clear();
  // Rimuovi anche le configurazioni accessorie
  ['pf_worker_url', 'pf_auto_refresh', 'pf_drive_client_id'].forEach(k => localStorage.removeItem(k));
  location.reload();
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */
function initNavigation() {
  $$('[data-section]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.section); });
  });
}

function initDesktopButtons() {
  const r  = $('desktop-refresh'); if (r)  r.addEventListener('click', refreshQuotes);
  const a  = $('desktop-add');
  if (a) a.addEventListener('click', () => {
    if      (state.section === 'transactions') addTransaction();
    else if (state.section === 'portfolio')    showAddPortfolioModal();
    else if (state.section === 'accounts')     showAddContoModal();
    else showToast('Seleziona una sezione per aggiungere.', 'info');
  });
  const mr = $('btn-refresh'); if (mr) mr.addEventListener('click', refreshQuotes);
  const lk = $('btn-profile'); if (lk) lk.addEventListener('click', lockApp);
}

let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(renderApp, 150);
});

/* Quando torno alla tab dopo aver minimizzato, fai un refresh dei dati */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && auth.isUnlocked()) {
    // Se Drive era connesso ma il token potrebbe essere scaduto, ritenta
    if (drive.getClientId() && localStorage.getItem('pf_drive_connected') && !drive.isConnected()) {
      drive.autoConnect();
    }
  }
});

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDesktopButtons();
  initAuthKeypad();

  // Inizializza Drive token client (attende GIS se non ancora caricato)
  drive.init();

  if (!auth.isSetup()) {
    AUTH_UI.show('setup');
  } else {
    AUTH_UI.show('unlock');
  }
});

/* =====================================================
   ESPOSIZIONE GLOBALE per onclick nei template HTML
   ===================================================== */
window.navigate        = navigate;
window.setFilter       = setFilter;
window.refreshQuotes   = refreshQuotes;
window.animateCounter  = animateCounter;
window.changePIN       = changePIN;
window.lockApp         = lockApp;
window.resetApp        = resetApp;
window.connectDrive    = connectDrive;
window.disconnectDrive = disconnectDrive;
window.saveClientId    = saveClientId;
window.saveWorkerUrl   = saveWorkerUrl;
window.clearWorkerUrl  = clearWorkerUrl;
window.setAutoRefresh  = setAutoRefresh;
window.saveCustomUrl   = saveCustomUrl;
// Modali export e portfolio (definite in ui-portfolio.js)
window.showExportModal            = showExportModal;
window.exportPortfolioCSV         = exportPortfolioCSV;
window.exportTransactionsCSV      = exportTransactionsCSV;
window.showAddPortfolioModal      = showAddPortfolioModal;
window.showEditPortfolioModal     = showEditPortfolioModal;
window.showUpdatePriceModal       = showUpdatePriceModal;
window.confirmDeletePortfolioItem = confirmDeletePortfolioItem;
// addTransaction / importCSV / showAddContoModal sono definite in ui-accounts-transactions.js
// e già globali (function dichiarate). Non serve riassegnarle.
