/* =====================================================
   crypto.js — Crittografia AES-256-GCM
   Richiede un contesto sicuro (HTTPS o localhost)
   ===================================================== */

const CRYPTO_CFG = {
  PBKDF2_ITERATIONS: 200_000,
  SALT_BYTES:  16,
  IV_BYTES:    12,
  KEY_BITS:   256,
};

/* ===== BASE64 ===== */
function b64encode(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function b64decode(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

/* ===== RANDOM ===== */
function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

/* ===== DERIVAZIONE CHIAVE (PBKDF2 → AES-256-GCM) ===== */
async function deriveKey(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt,
      iterations: CRYPTO_CFG.PBKDF2_ITERATIONS,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: CRYPTO_CFG.KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ===== CIFRA plaintext → { iv, data } (entrambi base64) ===== */
async function encryptData(plaintext, key) {
  const iv  = randomBytes(CRYPTO_CFG.IV_BYTES);
  const enc = new TextEncoder();
  const ct  = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return {
    iv:   b64encode(iv),
    data: b64encode(new Uint8Array(ct)),
  };
}

/* ===== DECIFRA → stringa plaintext (lancia su chiave errata) ===== */
async function decryptData(iv_b64, data_b64, key) {
  const iv = b64decode(iv_b64);
  const ct = b64decode(data_b64);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );
  return new TextDecoder().decode(pt);
}

/* ===== HASH PIN per verifica locale (non è la chiave crittografica) ===== */
async function hashPIN(pin, salt) {
  const enc = new TextEncoder();
  const input = enc.encode(pin + ':' + b64encode(salt));
  const buf   = await crypto.subtle.digest('SHA-256', input);
  return b64encode(new Uint8Array(buf));
}
