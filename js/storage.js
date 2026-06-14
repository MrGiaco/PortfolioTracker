/* =====================================================
   storage.js — Salvataggio / caricamento dati cifrati
   Flusso: APP_DATA ↔ AES-256-GCM ↔ Google Drive
   Fallback locale: sessionStorage (perso alla chiusura tab)
   ===================================================== */

const STORAGE_VER = 1;
const SESSION_KEY = 'pf_local_enc'; // cache sessionStorage

const storage = {

  /* ===================================================
     SALVA — cifra APP_DATA e carica su Drive
     =================================================== */
  async save() {
    const key = auth.getKey();
    if (!key) return; // Non sbloccato

    const plain = JSON.stringify(APP_DATA);
    const { iv, data } = await encryptData(plain, key);

    const saltB64 = auth.getSalt() ? b64encode(auth.getSalt()) : localStorage.getItem('pf_salt');

    const payload = JSON.stringify({
      ver:  STORAGE_VER,
      ts:   new Date().toISOString(),
      salt: saltB64,
      iv,
      data,
    });

    // Sempre salva in sessionStorage (fallback immediato)
    sessionStorage.setItem(SESSION_KEY, payload);

    // Salva su Drive se connesso
    if (drive.isConnected()) {
      try {
        await drive.save(payload);
      } catch (e) {
        console.warn('[storage] Salvataggio Drive fallito:', e.message);
        this._showSyncError();
      }
    }
  },

  /* ===================================================
     CARICA — scarica da Drive e decifra
     =================================================== */
  async load() {
    let raw = null;

    // 1. Prova da Drive
    if (drive.isConnected()) {
      try {
        raw = await drive.download();
      } catch (e) {
        console.warn('[storage] Download Drive fallito:', e.message);
      }
    }

    // 2. Fallback: sessionStorage
    if (!raw) {
      raw = sessionStorage.getItem(SESSION_KEY);
    }

    if (!raw) return null; // Prima volta, nessun dato

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw new Error('Dati corrotti nel file di backup.');
    }

    // Salva salt in localStorage se siamo su un nuovo dispositivo
    if (parsed.salt && !localStorage.getItem('pf_salt')) {
      localStorage.setItem('pf_salt', parsed.salt);
    }

    const key = auth.getKey();
    if (!key) throw new Error('App non sbloccata');

    let plaintext;
    try {
      plaintext = await decryptData(parsed.iv, parsed.data, key);
    } catch (_) {
      throw new Error('Impossibile decifrare i dati. PIN errato o file corrotto.');
    }

    try {
      return JSON.parse(plaintext);
    } catch (_) {
      throw new Error('Struttura dati non valida nel backup.');
    }
  },

  /* ===================================================
     SYNC — carica da Drive e aggiorna APP_DATA
     Chiamato dopo connessione Drive o all'avvio
     =================================================== */
  async sync() {
    try {
      const data = await this.load();
      if (data) {
        setAppData(data);
        if (typeof renderApp !== 'undefined') renderApp();
      } else {
        // Prima volta su Drive: salva i dati attuali
        await this.save();
      }
      this._setSyncStatus('ok');
    } catch (e) {
      console.error('[storage] Sync fallita:', e.message);
      this._setSyncStatus('error', e.message);
    }
  },

  /* ===== Indicatore stato sync nella sidebar === */
  _setSyncStatus(status, msg) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const icons = { ok: '✓', error: '⚠', loading: '…' };
    el.textContent = icons[status] || '';
    el.title = msg || '';
    el.className = `sync-status sync-${status}`;
  },

  _showSyncError() {
    this._setSyncStatus('error', 'Salvataggio Drive non riuscito — dati in sessione locale');
  },
};
