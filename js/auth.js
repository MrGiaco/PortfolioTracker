/* =====================================================
   auth.js — Autenticazione PIN + biometria (WebAuthn)
   ===================================================== */

/* ===== SESSIONE (in memoria, cancellata alla chiusura della tab) ===== */
let _key  = null;   // CryptoKey AES-GCM
let _salt = null;   // Uint8Array

const auth = {
  isUnlocked:   () => _key !== null,
  isSetup:      () => localStorage.getItem('pf_setup') === '1',
  getKey:       () => _key,
  getSalt:      () => _salt,

  /* === IMPOSTA PIN (primo avvio) === */
  async setupPIN(pin) {
    const salt    = randomBytes(CRYPTO_CFG.SALT_BYTES);
    const key     = await deriveKey(pin, salt);
    const pinHash = await hashPIN(pin, salt);
    localStorage.setItem('pf_salt',    b64encode(salt));
    localStorage.setItem('pf_pinhash', pinHash);
    localStorage.setItem('pf_setup',   '1');
    _key  = key;
    _salt = salt;
    return key;
  },

  /* === VERIFICA PIN e apre sessione === */
  async unlock(pin) {
    const saltB64 = localStorage.getItem('pf_salt');
    if (!saltB64) throw new Error('App non configurata. Usa il PIN di setup.');
    const salt    = b64decode(saltB64);
    const pinHash = await hashPIN(pin, salt);
    const stored  = localStorage.getItem('pf_pinhash');
    if (pinHash !== stored) throw new Error('PIN errato');
    _key  = await deriveKey(pin, salt);
    _salt = salt;
    return _key;
  },

  /* === BLOCCA === */
  lock() {
    _key  = null;
    _salt = null;
    AUTH_UI.show('unlock');
  },

  /* === RESET COMPLETO (per test o logout) === */
  reset() {
    _key  = null;
    _salt = null;
    ['pf_salt','pf_pinhash','pf_setup','pf_bio_id','pf_drive_connected'].forEach(k => localStorage.removeItem(k));
  },
};

/* =====================================================
   INTERFACCIA UTENTE — tastierino PIN
   ===================================================== */
const AUTH_UI = {
  step:     'unlock',   // 'setup' | 'setup_confirm' | 'unlock'
  pinBuf:   [],
  setupPin: '',         // PIN temporaneo nel passaggio 1 di setup

  STEPS: {
    setup:          { title: 'Crea il tuo PIN',      sub: 'Scegli 6 cifre per proteggere i tuoi dati' },
    setup_confirm:  { title: 'Conferma PIN',          sub: 'Reinserisci le 6 cifre per confermare'     },
    unlock:         { title: 'Portafoglio',           sub: 'Inserisci il PIN a 6 cifre'                },
  },

  /* === Mostra overlay con lo step indicato === */
  show(step) {
    this.step   = step;
    this.pinBuf = [];
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('hidden');
    this._updateUI();
    this._updateDots();
    this._clearError();
    document.getElementById('app').classList.add('blurred');
  },

  /* === Nascondi overlay (app sbloccata) === */
  hide() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.getElementById('app').classList.remove('blurred');
  },

  /* === Aggiorna titolo/sottotitolo === */
  _updateUI() {
    const cfg = this.STEPS[this.step] || this.STEPS.unlock;
    const titleEl = document.getElementById('auth-title');
    const subEl   = document.getElementById('auth-sub');
    if (titleEl) titleEl.textContent = cfg.title;
    if (subEl)   subEl.textContent   = cfg.sub;

    // Mostra/nascondi pulsante "Ripristina da Drive" (solo su nuovo dispositivo)
    const driveBtn = document.getElementById('btn-drive-restore');
    if (driveBtn) {
      const noLocal  = !auth.isSetup();
      const hasId    = !!localStorage.getItem('pf_drive_client_id');
      driveBtn.classList.toggle('hidden', !(noLocal && hasId));
    }

    // Mostra biometria se disponibile
    this._updateBioBtn();
  },

  /* === Aggiorna i pallini del PIN === */
  _updateDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < this.pinBuf.length);
      dot.classList.remove('error');
    });
  },

  /* === Mostra errore con animazione shake === */
  _showError(msg) {
    const errEl  = document.getElementById('auth-error');
    const dotsEl = document.getElementById('pin-dots');
    if (errEl) errEl.textContent = msg;
    if (dotsEl) {
      dotsEl.classList.add('shake');
      dotsEl.addEventListener('animationend', () => dotsEl.classList.remove('shake'), { once: true });
    }
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
    setTimeout(() => {
      this.pinBuf = [];
      this._updateDots();
      if (errEl) errEl.textContent = '';
    }, 1200);
  },

  _clearError() {
    const errEl = document.getElementById('auth-error');
    if (errEl) errEl.textContent = '';
  },

  /* === Aggiunge cifra === */
  addDigit(d) {
    if (this.pinBuf.length >= 6) return;
    this.pinBuf.push(d);
    this._updateDots();
    if (this.pinBuf.length === 6) {
      setTimeout(() => this._processPin(this.pinBuf.join('')), 80);
    }
  },

  /* === Cancella ultima cifra === */
  deleteDigit() {
    this.pinBuf.pop();
    this._updateDots();
    this._clearError();
  },

  /* === Gestisce PIN completo in base allo step === */
  async _processPin(pin) {
    this._clearError();

    if (this.step === 'setup') {
      this.setupPin = pin;
      this.pinBuf   = [];
      this.step     = 'setup_confirm';
      this._updateUI();
      this._updateDots();
      return;
    }

    if (this.step === 'setup_confirm') {
      if (pin !== this.setupPin) {
        this.setupPin = '';
        this.step = 'setup';
        this._showError('I PIN non corrispondono. Riprova.');
        this._updateUI();
        return;
      }
      try {
        this._setLoading(true);
        await auth.setupPIN(pin);
        this._setLoading(false);
        window.dispatchEvent(new CustomEvent('auth:unlocked', { detail: { fresh: true } }));
      } catch (e) {
        this._setLoading(false);
        this._showError(e.message);
      }
      return;
    }

    if (this.step === 'unlock') {
      try {
        this._setLoading(true);
        await auth.unlock(pin);
        this._setLoading(false);
        window.dispatchEvent(new CustomEvent('auth:unlocked', { detail: { fresh: false } }));
      } catch (e) {
        this._setLoading(false);
        this.pinBuf = [];
        this._showError(e.message);
      }
      return;
    }
  },

  /* === Loader mentre PBKDF2 gira === */
  _setLoading(on) {
    const keypadEl = document.getElementById('keypad');
    if (keypadEl) keypadEl.style.opacity = on ? '0.4' : '1';
    const subEl = document.getElementById('auth-sub');
    if (subEl && on) subEl.textContent = 'Verificando…';
    else if (subEl && !on) subEl.textContent = this.STEPS[this.step]?.sub || '';
  },

  /* === Biometria WebAuthn === */
  _updateBioBtn() {
    const btn = document.getElementById('key-bio');
    if (!btn) return;
    const hasBio = !!localStorage.getItem('pf_bio_id') && this.step === 'unlock';
    btn.classList.toggle('key-empty', !hasBio);
    btn.style.pointerEvents = hasBio ? 'auto' : 'none';
  },

  async triggerBiometric() {
    const credId = localStorage.getItem('pf_bio_id');
    if (!credId) return;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge:        randomBytes(32),
          allowCredentials: [{ type: 'public-key', id: b64decode(credId) }],
          userVerification: 'required',
          timeout:          60000,
        },
      });
      if (!assertion) return;
      // Biometria superata: legge il PIN cifrato dalla sessione
      const encPin = sessionStorage.getItem('pf_epin');
      if (encPin) {
        const parsed = JSON.parse(encPin);
        const bKey   = await this._getBiometricKey();
        const pin    = await decryptData(parsed.iv, parsed.data, bKey);
        await auth.unlock(pin);
        window.dispatchEvent(new CustomEvent('auth:unlocked', { detail: { fresh: false } }));
      }
    } catch (e) {
      console.warn('Biometria non riuscita:', e.message);
    }
  },

  // Chiave biometrica derivata dal credId (semplificato)
  async _getBiometricKey() {
    const credId = localStorage.getItem('pf_bio_id') || 'default';
    const enc    = new TextEncoder();
    const km     = await crypto.subtle.importKey('raw', enc.encode(credId), 'PBKDF2', false, ['deriveKey']);
    const domainSalt = enc.encode(window.location.hostname || 'portafoglio');
    return crypto.subtle.deriveKey(
      { name:'PBKDF2', salt:domainSalt, iterations:1000, hash:'SHA-256' },
      km,
      { name:'AES-GCM', length:256 },
      false,
      ['encrypt','decrypt']
    );
  },

  /* === Registra biometria dopo unlock con PIN === */
  async registerBiometric(pin) {
    if (!window.PublicKeyCredential) return false;
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge:              randomBytes(32),
          rp:                     { name: 'Portafoglio Personale' },
          user:                   { id: randomBytes(16), name: 'user', displayName: 'Utente' },
          pubKeyCredParams:       [{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
          authenticatorSelection: { authenticatorAttachment:'platform', userVerification:'required' },
          timeout:                60000,
        },
      });
      if (!cred) return false;
      const credId = b64encode(new Uint8Array(cred.rawId));
      localStorage.setItem('pf_bio_id', credId);
      // Cifra il PIN con la chiave biometrica per uso futuro
      const bKey   = await this._getBiometricKey();
      const { iv, data } = await encryptData(pin, bKey);
      sessionStorage.setItem('pf_epin', JSON.stringify({ iv, data }));
      return true;
    } catch (e) {
      console.warn('Registrazione biometria fallita:', e.message);
      return false;
    }
  },
};

/* ===== EVENT LISTENERS TASTIERINO ===== */
function initAuthKeypad() {
  document.querySelectorAll('.key-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => AUTH_UI.addDigit(btn.dataset.key));
  });

  const delBtn = document.getElementById('key-del');
  if (delBtn) delBtn.addEventListener('click', () => AUTH_UI.deleteDigit());

  const bioBtn = document.getElementById('key-bio');
  if (bioBtn) bioBtn.addEventListener('click', () => AUTH_UI.triggerBiometric());

  const driveRestoreBtn = document.getElementById('btn-drive-restore');
  if (driveRestoreBtn) {
    driveRestoreBtn.addEventListener('click', async () => {
      await drive.signIn();
    });
  }
}
