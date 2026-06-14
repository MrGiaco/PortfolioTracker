/* =====================================================
   drive.js — Google Drive API (REST + GIS OAuth)
   Scope: drive.file (file visibili all'utente, recuperabili)

   Prerequisiti utente:
   1. Google Cloud project con Drive API abilitata
   2. Credenziali OAuth 2.0 (Applicazione web)
   3. Origini autorizzate: URL del proprio GitHub Pages
   4. Client ID inserito in Impostazioni → Google Drive
   ===================================================== */

const DRIVE_API    = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_NAME    = 'portafoglio-backup.enc';
const FILE_MIME    = 'text/plain';

const drive = {
  _token:       null,
  _tokenClient: null,
  _fileId:      null,      // cache del file ID trovato su Drive
  _userEmail:   null,

  /* === Stato === */
  isConnected: () => drive._token !== null,
  getToken:    () => drive._token,
  getEmail:    () => drive._userEmail,

  getClientId() {
    return localStorage.getItem('pf_drive_client_id') || '';
  },

  setClientId(id) {
    localStorage.setItem('pf_drive_client_id', id.trim());
  },

  /* === Inizializza GIS token client === */
  init() {
    const clientId = this.getClientId();
    if (!clientId || !window.google?.accounts?.oauth2) return false;

    this._tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:     'https://www.googleapis.com/auth/drive.file email profile',
      callback:  async (resp) => {
        if (resp.error) {
          console.error('Drive OAuth error:', resp.error);
          this._token = null;
          window.dispatchEvent(new CustomEvent('drive:error', { detail: resp.error }));
          return;
        }
        this._token = resp.access_token;
        await this._fetchUserInfo();
        localStorage.setItem('pf_drive_connected', '1');
        window.dispatchEvent(new CustomEvent('drive:connected'));
      },
    });
    return true;
  },

  /* === Login OAuth (popup) === */
  signIn() {
    if (!this.init()) {
      window.dispatchEvent(new CustomEvent('drive:need_client_id'));
      return;
    }
    // Se già connesso, usa silent refresh; altrimenti mostra popup
    const prompt = localStorage.getItem('pf_drive_connected') ? '' : 'consent';
    this._tokenClient.requestAccessToken({ prompt });
  },

  /* === Logout === */
  signOut() {
    if (this._token) {
      google.accounts.oauth2.revoke(this._token, () => {});
    }
    this._token     = null;
    this._userEmail = null;
    this._fileId    = null;
    localStorage.removeItem('pf_drive_connected');
    window.dispatchEvent(new CustomEvent('drive:disconnected'));
  },

  /* === Info utente Google === */
  async _fetchUserInfo() {
    try {
      const res = await this._req('https://www.googleapis.com/oauth2/v3/userinfo');
      const d   = await res.json();
      this._userEmail = d.email || null;
    } catch (_) { /* silenzioso */ }
  },

  /* === Wrapper fetch con Authorization header === */
  async _req(url, opts = {}) {
    if (!this._token) throw new Error('Non connesso a Drive');
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${this._token}`,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      this._token = null;
      localStorage.removeItem('pf_drive_connected');
      window.dispatchEvent(new CustomEvent('drive:disconnected'));
      throw new Error('Sessione Drive scaduta. Riconnetti il Drive nelle impostazioni.');
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive API ${res.status}: ${body.slice(0, 120)}`);
    }
    return res;
  },

  /* === Cerca file per nome (usa cache fileId) === */
  async findFile() {
    if (this._fileId) return this._fileId;
    const q   = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await this._req(`${DRIVE_API}/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=1`);
    const d   = await res.json();
    this._fileId = d.files && d.files.length > 0 ? d.files[0].id : null;
    return this._fileId;
  },

  /* === Scarica contenuto del file === */
  async download() {
    const id = await this.findFile();
    if (!id) return null;
    const res = await this._req(`${DRIVE_API}/files/${id}?alt=media`);
    return await res.text();
  },

  /* === Crea nuovo file (multipart) === */
  async _create(content) {
    const meta = JSON.stringify({ name: FILE_NAME, mimeType: FILE_MIME });
    const body = new FormData();
    body.append('metadata', new Blob([meta],    { type: 'application/json' }));
    body.append('media',    new Blob([content], { type: FILE_MIME }));

    const res = await this._req(`${DRIVE_UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST',
      body,
    });
    const d = await res.json();
    this._fileId = d.id;
    return d.id;
  },

  /* === Aggiorna file esistente === */
  async _update(fileId, content) {
    await this._req(`${DRIVE_UPLOAD}/${fileId}?uploadType=media`, {
      method:  'PATCH',
      headers: { 'Content-Type': FILE_MIME },
      body:    content,
    });
  },

  /* === Salva (crea o aggiorna) === */
  async save(content) {
    const id = await this.findFile();
    if (id) {
      await this._update(id, content);
    } else {
      await this._create(content);
    }
  },
};
