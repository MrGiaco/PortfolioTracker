/* =====================================================
   app.js — Router, navigazione, init app
   Fase 3: integrazione auth + Drive + storage
   ===================================================== */

/* ===== STATO APPLICAZIONE ===== */
const state = {
  section: 'dashboard',
  filter:  'Tutti',
};

/* ===== UTILITÀ DOM ===== */
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
  if (c) c.innerHTML = renderPortfolio(filter);
}

/* =====================================================
   RENDER PRINCIPALE
   ===================================================== */
function renderApp() {
  if (!auth.isUnlocked()) return; // Non renderizzare se bloccato

  const desk  = isDesk();
  const sec   = state.section;
  const title = SECTION_TITLES[sec];

  // Titolo topbar mobile
  const ptEl = $('page-title');    if (ptEl) ptEl.textContent = title;
  const psEl = $('page-subtitle'); if (psEl) psEl.textContent = 'dom 14 giugno 2026';

  // Titolo header desktop
  const dtEl = $('desktop-title'); if (dtEl) dtEl.textContent = title;

  // Patrimonio sidebar
  const stEl = $('sidebar-total'); if (stEl) stEl.textContent = eur(patrimony);

  // Nav items attivi
  $$('[data-section]').forEach(el => el.classList.toggle('active', el.dataset.section === sec));

  // Nascondi tutte le sezioni
  $$('.section').forEach(s => s.classList.remove('active'));

  // Rendi sezione attiva
  destroyDonut();
  const container = $(`section-${sec}`);
  if (!container) return;
  container.classList.add('active');

  switch (sec) {
    case 'dashboard':
      container.innerHTML = renderDashboard(desk);
      setTimeout(() => {
        initDonut('donut-chart');
        animateCounter('hero-val', patrimony);
      }, 50);
      break;
    case 'portfolio':    container.innerHTML = renderPortfolio(state.filter); break;
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

// Sblocco completato (PIN corretto o setup terminato)
window.addEventListener('auth:unlocked', async (e) => {
  const isFresh = e.detail?.fresh; // true = nuovo setup

  AUTH_UI.hide();

  // Carica dati da Drive (se connesso) o da cache locale
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
    // Primo avvio: salva i dati mock su Drive (se connesso)
    await storage.save();
  }

  renderApp();
});

// Drive connesso → sincronizza
window.addEventListener('drive:connected', async () => {
  showToast('✓ Google Drive connesso', 'success');
  await storage.sync();
  renderApp(); // Aggiorna sezione impostazioni
});

// Drive disconnesso
window.addEventListener('drive:disconnected', () => {
  showToast('Drive disconnesso', 'info');
  renderApp();
});

// Client ID non configurato
window.addEventListener('drive:need_client_id', () => {
  navigate('settings');
  showToast('Configura prima il Client ID Google in Impostazioni.', 'info');
});

/* =====================================================
   TOAST NOTIFICHE
   ===================================================== */
function showToast(msg, type = 'info') {
  let toastEl = $('global-toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'global-toast';
    toastEl.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:#1A1A1A;color:white;padding:10px 18px;border-radius:10px;
      font-size:13px;z-index:8000;opacity:0;transition:opacity .2s;
      max-width:90vw;text-align:center;pointer-events:none;
    `;
    document.body.appendChild(toastEl);
  }
  const colors = { success:'#2E7D32', error:'#D85A30', info:'#378ADD' };
  toastEl.style.background = colors[type] || '#1A1A1A';
  toastEl.textContent      = msg;
  toastEl.style.opacity    = '1';
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => { toastEl.style.opacity = '0'; }, 3000);
}

/* =====================================================
   LOADER GLOBALE
   ===================================================== */
function showGlobalLoader(msg) {
  let el = $('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.45);
      display:flex;align-items:center;justify-content:center;
      z-index:8500;color:white;font-size:15px;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg || 'Caricamento…';
  el.style.display = 'flex';
}

function hideGlobalLoader() {
  const el = $('global-loader');
  if (el) el.style.display = 'none';
}

/* =====================================================
   PLACEHOLDER AZIONI
   ===================================================== */
function refreshQuotes()    { showToast('Aggiornamento quotazioni — Fase 4.',   'info'); }
function addTransaction()   { showToast('Inserimento movimenti — Fase 5.',      'info'); }
function importCSV()        { showToast('Import CSV — Fase 5.',                 'info'); }
function changePIN()        { auth.lock(); AUTH_UI.show('setup'); }
function lockApp()          { auth.lock(); }
function resetApp() {
  if (!confirm('Eliminare tutti i dati e la configurazione?')) return;
  auth.reset();
  sessionStorage.clear();
  location.reload();
}

/* =====================================================
   IMPOSTAZIONI — Drive e PIN
   ===================================================== */
function saveClientId() {
  const input = $('drive-client-id');
  if (!input || !input.value.trim()) return;
  drive.setClientId(input.value.trim());
  showToast('Client ID salvato', 'success');
  renderApp();
}

function connectDrive()    { drive.signIn();  }
function disconnectDrive() { drive.signOut(); }

/* =====================================================
   EVENT LISTENERS
   ===================================================== */
function initNavigation() {
  $$('[data-section]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.section); });
  });
}

function initDesktopButtons() {
  const r = $('desktop-refresh'); if (r) r.addEventListener('click', refreshQuotes);
  const a = $('desktop-add');
  if (a) a.addEventListener('click', () => {
    if (state.section === 'transactions') addTransaction();
    else if (state.section === 'portfolio') showToast('Aggiungi titolo — Fase 5.', 'info');
    else showToast('Aggiungi — Fase 5.', 'info');
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
   INIZIALIZZAZIONE
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDesktopButtons();
  initAuthKeypad();          // auth.js
  drive.init();              // drive.js — tenta init se clientId presente

  if (!auth.isSetup()) {
    AUTH_UI.show('setup');   // Prima volta: crea PIN
  } else {
    AUTH_UI.show('unlock');  // Login normale
  }
});

/* Esposizione globale funzioni chiamate da onclick nei template HTML */
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
