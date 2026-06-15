/* =====================================================
   quotes.js — Aggiornamento quotazioni in tempo reale
   Fase 4: Yahoo Finance via Worker + URL personalizzati
   ===================================================== */

const QUOTES = {
  _loading:   false,
  _autoTimer: null,

  /* ===== Configurazione ===== */
  getWorkerUrl: ()  => localStorage.getItem('pf_worker_url') || '',
  setWorkerUrl(url) { localStorage.setItem('pf_worker_url', url.trim()); },
  clearWorkerUrl()  { localStorage.removeItem('pf_worker_url'); },
  isConfigured:  () => !!localStorage.getItem('pf_worker_url'),
  isLoading:     () => QUOTES._loading,

  getAutoRefresh:    ()    => parseInt(localStorage.getItem('pf_auto_refresh') || '0'),
  setAutoRefresh(min)      { localStorage.setItem('pf_auto_refresh', String(min)); },

  /* ===== Fetch tutte le quotazioni ===== */
  async fetchAll() {
    const workerUrl = this.getWorkerUrl();
    if (!workerUrl) throw new Error('Worker URL non configurato. Vai in Impostazioni → Quotazioni.');

    const results = {};

    /* --- Titoli Yahoo Finance (senza customUrl) --- */
    const yahooItems = APP_DATA.portfolio.filter(i => !i.customUrl);
    if (yahooItems.length > 0) {
      const symbols = yahooItems.map(i => i.ticker).join(',');
      const res = await fetch(`${workerUrl}?symbols=${encodeURIComponent(symbols)}`);
      if (!res.ok) throw new Error(`Worker non raggiungibile (HTTP ${res.status})`);
      const data = await res.json();
      const list = data?.quoteResponse?.result || [];
      list.forEach(q => {
        if (q.regularMarketPrice) {
          results[q.symbol] = {
            price:     q.regularMarketPrice,
            change:    q.regularMarketChange            || 0,
            changePct: q.regularMarketChangePercent     || 0,
            source:    'yahoo',
          };
        }
      });
    }

    /* --- Titoli con URL personalizzato --- */
    const customItems = APP_DATA.portfolio.filter(i => i.customUrl);
    for (const item of customItems) {
      try {
        const price = await this._fetchCustomUrl(workerUrl, item.customUrl);
        if (price !== null) {
          results[item.ticker] = { price, change: 0, changePct: 0, source: 'custom' };
        }
      } catch (e) {
        console.warn(`[quotes] Custom URL fallito per ${item.ticker}:`, e.message);
      }
    }

    return results;
  },

  /* ===== Applica prezzi ad APP_DATA e ricalcola ===== */
  applyPrices(quotes) {
    const now = new Date().toISOString();
    let n = 0;
    APP_DATA.portfolio = APP_DATA.portfolio.map(item => {
      const q = quotes[item.ticker];
      if (!q) return item;
      n++;
      return {
        ...item,
        price:        q.price,
        dayChange:    q.change,
        dayChangePct: q.changePct,
        priceUpdated: now,
        priceSource:  q.source,
      };
    });
    APP_DATA.lastQuoteUpdate = now;
    recalculate();
    return n;
  },

  /* ===== Ciclo completo: fetch → applica → salva → render ===== */
  async refresh() {
    if (this._loading) return;
    this._loading = true;
    this._setSpinner(true);
    try {
      const quotes = await this.fetchAll();
      const n      = this.applyPrices(quotes);
      if (typeof storage !== 'undefined') await storage.save();
      if (typeof renderApp !== 'undefined') renderApp();
      showToast(`✓ ${n} quotazioni aggiornate`, 'success');
    } catch (err) {
      showToast('⚠ ' + err.message, 'error');
    } finally {
      this._loading = false;
      this._setSpinner(false);
    }
  },

  /* ===== Spinner sui pulsanti refresh ===== */
  _setSpinner(on) {
    document.querySelectorAll('#btn-refresh i, #desktop-refresh i').forEach(i => {
      i.style.animation = on ? 'spin 0.8s linear infinite' : '';
    });
  },

  /* ===== Fetch URL personalizzato via proxy Worker ===== */
  async _fetchCustomUrl(workerUrl, customUrl) {
    const url = `${workerUrl}?url=${encodeURIComponent(customUrl)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const html = await res.text();

    /* Pattern di estrazione prezzo per siti comuni */
    const patterns = [
      /* ZoneBourse */
      /class="cours-instrument[^"]*"[^>]*>\s*<[^>]+>\s*([\d]+[,.][\d]+)/i,
      /"cours"[^:]*:\s*"?([\d]+[,.][\d]+)/i,
      /* Borsa Italiana */
      /data-value="([\d.,]+)"/i,
      /id="last_price"[^>]*>\s*([\d.,]+)/i,
      /* Morningstar / generici */
      /"nav"\s*:\s*([\d.]+)/i,
      /"price"\s*:\s*([\d.]+)/i,
      /* Yahoo Finance HTML */
      /"regularMarketPrice"\s*:\s*([\d.]+)/,
      /* Numero dopo keyword */
      /(?:prezzo|last|nav|valore|cours|price)[^:=>\d]*([\d]+[,.][\d]{2,4})/i,
    ];

    for (const pat of patterns) {
      const m = html.match(pat);
      if (!m) continue;
      /* normalizza separatori: "83,50" → 83.50 */
      const raw   = m[1].replace(/\.(?=\d{3})/g, '').replace(',', '.');
      const price = parseFloat(raw);
      if (!isNaN(price) && price > 0.0001 && price < 1_000_000) return price;
    }
    return null;
  },

  /* ===== Auto-refresh ===== */
  startAutoRefresh() {
    this.stopAutoRefresh();
    const min = this.getAutoRefresh();
    if (min > 0) {
      this._autoTimer = setInterval(() => this.refresh(), min * 60_000);
    }
  },

  stopAutoRefresh() {
    if (this._autoTimer) { clearInterval(this._autoTimer); this._autoTimer = null; }
  },
};

/* ===== Helper: "x min fa" ===== */
function _timeAgo(isoStr) {
  if (!isoStr) return '—';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 60_000);
  if (diff < 1)  return 'Adesso';
  if (diff < 60) return `${diff} min fa`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return `${h}h fa`;
  return new Date(isoStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
