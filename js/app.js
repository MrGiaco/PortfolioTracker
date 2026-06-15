/* =====================================================
   app.js — Router, navigazione, init app
   Fase 4: quotazioni in tempo reale via QUOTES
   ===================================================== */

const state = { section: 'dashboard', filter: 'Tutti' };

function $(id)    { return document.getElementById(id); }
function $$(sel)  { return document.querySelectorAll(sel); }
function isDesk() { return window.innerWidth >= 768; }

/* =====================================================
   NAVIGAZIONE
   ===================================================== */
function navigate(section) {
  if (state.section === section) return;
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
   ===================================================== */
window.addEventListener('auth:unlocked', async (e) => {
  const isFresh = e.detail?.fresh;
  AUTH_UI.hide();

  if (!isFresh) {
    showGlobalLoader('Caricamento dati…');
    try {
      const data = await storage.load();
      if (data) setAppData(data);
    } catch (err) {
      console.warn('[app] Caricamento dati fallito:', err.message);
      showToast('⚠ Dati non caricati: ' + err.message, 'error');
    }
    hideGlobalLoader();
  } else {
    await storage.save();
  }

  renderApp();

  // Avvia auto-refresh se configurato
  if (QUOTES.isConfigured()) {
    QUOTES.startAutoRefresh();
    // Refresh automatico all'avvio se i dati sono vecchi (> 10 min)
    const lastUpd = APP_DATA.lastQuoteUpdate;
    const stale   = !lastUpd || (Date.now() - new Date(lastUpd)) > 10 * 60_000;
    if (stale) setTimeout(() => QUOTES.refresh(), 1500);
  }
});

window.addEventListener('drive:connected',   async () => { showToast('✓ Google Drive connesso', 'success'); await storage.sync(); renderApp(); });
window.addEventListener('drive:disconnected', ()      => { showToast('Drive disconnesso', 'info'); renderApp(); });
window.addEventListener('drive:need_client_id', ()   => { navigate('settings'); showToast('Configura il Client ID Google in Impostazioni.', 'info'); });
window.addEventListener('drive:error',        (e)    => { showToast('Errore Drive: ' + e.detail, 'error'); });

/* =====================================================
   TOAST + LOADER
   ===================================================== */
function showToast(msg, type = 'info') {
  let el = $('global-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-toast';
    el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:10px;font-size:13px;z-index:8000;opacity:0;transition:opacity .2s;max-width:90vw;text-align:center;pointer-events:none;color:white;';
    document.body.appendChild(el);
  }
  el.style.background = { success:'#2E7D32', error:'#D85A30', info:'#378ADD' }[type] || '#1A1A1A';
  el.textContent      = msg;
  el.style.opacity    = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
}

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
function refreshQuotes()  { QUOTES.refresh(); }
function changePIN()      { auth.lock(); AUTH_UI.show('setup'); }
function lockApp()        { auth.lock(); }
function resetApp() {
  if (!confirm('Eliminare tutti i dati e la configurazione?')) return;
  QUOTES.stopAutoRefresh();
  auth.reset();
  sessionStorage.clear();
  location.reload();
}
function addTransaction() { showToast('Inserimento movimenti — Fase 5.', 'info'); }
function importCSV()      { showToast('Import CSV — Fase 5.', 'info'); }

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

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDesktopButtons();
  initAuthKeypad();
  drive.init();

  if (!auth.isSetup()) {
    AUTH_UI.show('setup');
  } else {
    AUTH_UI.show('unlock');
  }
});

/* Esposizione globale per onclick nei template */
window.navigate        = navigate;
window.setFilter       = setFilter;
window.refreshQuotes   = refreshQuotes;
window.addTransaction  = addTransaction;
window.importCSV       = importCSV;
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
window.showExportModal            = showExportModal;
window.exportPortfolioCSV         = exportPortfolioCSV;
window.exportTransactionsCSV      = exportTransactionsCSV;
window.showAddPortfolioModal      = showAddPortfolioModal;
window.showEditPortfolioModal     = showEditPortfolioModal;
window.showUpdatePriceModal       = showUpdatePriceModal;
window.confirmDeletePortfolioItem = confirmDeletePortfolioItem;
