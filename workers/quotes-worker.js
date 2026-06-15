/* =====================================================
   quotes-worker.js — Cloudflare Worker
   Incolla questo codice su cloudflare.com:
   Workers & Pages → Crea Worker → incolla → Deploy

   Due modalità:
   GET /?symbols=IWDA.AS,ENI.MI  → Yahoo Finance
   GET /?url=https://...          → proxy generico (fondi, BTP)
   ===================================================== */

export default {
  async fetch(request) {

    if (request.method === 'OPTIONS') {
      return cors(null, 204);
    }

    const url     = new URL(request.url);
    const symbols = url.searchParams.get('symbols');
    const proxy   = url.searchParams.get('url');

    if (symbols)  return fetchYahoo(symbols);
    if (proxy)    return fetchProxy(proxy);

    return cors(JSON.stringify({ error: 'Parametro mancante: symbols o url' }), 400);
  }
};

/* ===== Yahoo Finance (batch quotes) ===== */
async function fetchYahoo(symbols) {
  const apiUrl =
    'https://query1.finance.yahoo.com/v7/finance/quote' +
    `?symbols=${encodeURIComponent(symbols)}` +
    '&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName,currency' +
    '&lang=it-IT&region=IT';

  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
        'Referer': 'https://finance.yahoo.com/',
      },
    });

    const body = await res.text();
    return cors(body, res.status, 'application/json');

  } catch (err) {
    return cors(JSON.stringify({ error: err.message }), 502);
  }
}

/* ===== Proxy generico (ZoneBourse, Borsa Italiana, ecc.) ===== */
async function fetchProxy(targetUrl) {
  try {
    const decoded = decodeURIComponent(targetUrl);
    const res = await fetch(decoded, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    });
    const body = await res.text();
    return cors(body, res.ok ? 200 : res.status, 'text/html; charset=utf-8');

  } catch (err) {
    return cors(JSON.stringify({ error: err.message }), 502);
  }
}

/* ===== Helper CORS ===== */
function cors(body, status = 200, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type':                contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods':'GET, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
      'Cache-Control':               'public, max-age=60',
    },
  });
}
