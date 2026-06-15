/* =====================================================
   data.js — Modello dati, costanti, calcoli
   Fase 4: aggiunti dayChange, priceUpdated, customUrl
   ===================================================== */

let APP_DATA = {

  lastQuoteUpdate: null,

  portfolio: [
    { id:1, name:'iShares Core MSCI World', ticker:'IWDA.AS', type:'ETF',         qty:500,  avgCost:75.00,  price:83.50,  bank:'fineco', logoKey:'iS', logoImg:null,                              customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
    { id:2, name:'ENI SpA',                 ticker:'ENI.MI',  type:'Azione',       qty:500,  avgCost:12.50,  price:14.20,  bank:'fineco', logoKey:'E',  logoImg:null,                              customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
    { id:3, name:'STMicroelectronics',      ticker:'STM.MI',  type:'Azione',       qty:1000, avgCost:15.00,  price:12.30,  bank:'fineco', logoKey:null, logoImg:'assets/logos/stm.png',     customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
    { id:4, name:'Eurizon Fund Bond EUR',   ticker:'EURIZ',   type:'Fondo',        qty:5000, avgCost:16.00,  price:18.50,  bank:'isp',   logoKey:null, logoImg:'assets/logos/eurizon.png', customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
    { id:5, name:'BTP Futura 2030',         ticker:'BTP30',   type:'Obbligazione', qty:250,  avgCost:98.50,  price:101.20, bank:'fineco', logoKey:'IT', logoImg:null,                              customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
    { id:6, name:'Vanguard FTSE All-World', ticker:'VWRL.AS', type:'ETF',          qty:200,  avgCost:95.00,  price:110.40, bank:'ing',   logoKey:'V',  logoImg:null,                              customUrl:null, dayChange:0, dayChangePct:0, priceUpdated:null, priceSource:'manual' },
  ],

  accounts: [
    { id:'acc_1', nome:'Fineco — Investimento', banca:'fineco', tipo:'investimento', saldoPartenza:45000.00, dataPartenza:'2024-01-01', note:'' },
    { id:'acc_2', nome:'ISP — Corrente',         banca:'isp',   tipo:'personale',    saldoPartenza:8500.00,  dataPartenza:'2024-01-01', note:'' },
    { id:'acc_3', nome:'ING — Conto Comune',     banca:'ing',   tipo:'comune',       saldoPartenza:5200.00,  dataPartenza:'2024-01-01', note:'' },
  ],

  transactions: [
    { id:'txn_1',  data:'2024-01-31', descrizione:'Stipendio gennaio',           importo: 3800,  categoria:'stipendio',    contoId:'acc_2', note:'' },
    { id:'txn_2',  data:'2024-02-05', descrizione:'Spesa Esselunga',             importo: -142,  categoria:'spesa',        contoId:'acc_2', note:'' },
    { id:'txn_3',  data:'2024-02-10', descrizione:'Bolletta EGL luce+gas',       importo: -215,  categoria:'bollette',     contoId:'acc_3', note:'' },
    { id:'txn_4',  data:'2024-02-28', descrizione:'Stipendio febbraio',          importo: 3800,  categoria:'stipendio',    contoId:'acc_2', note:'' },
    { id:'txn_5',  data:'2024-03-01', descrizione:'Affitto marzo',               importo: -1200, categoria:'affitto',      contoId:'acc_3', note:'' },
    { id:'txn_6',  data:'2024-03-08', descrizione:'Ristorante Da Vittorio',      importo: -85,   categoria:'ristorante',   contoId:'acc_2', note:'' },
    { id:'txn_7',  data:'2024-03-15', descrizione:'Carburante IP',               importo: -70,   categoria:'carburante',   contoId:'acc_2', note:'' },
    { id:'txn_8',  data:'2024-03-29', descrizione:'Stipendio marzo',             importo: 3800,  categoria:'stipendio',    contoId:'acc_2', note:'' },
    { id:'txn_9',  data:'2024-04-02', descrizione:'Netflix + Spotify',           importo: -28,   categoria:'abbonamenti',  contoId:'acc_2', note:'' },
    { id:'txn_10', data:'2024-04-10', descrizione:'Acquisto IWDA.AS',            importo: -5000, categoria:'investimento', contoId:'acc_1', note:'' },
    { id:'txn_11', data:'2024-04-15', descrizione:'Dividendo ENI',               importo: 320,   categoria:'dividendo',    contoId:'acc_1', note:'' },
    { id:'txn_12', data:'2024-04-30', descrizione:'Stipendio aprile',            importo: 3800,  categoria:'stipendio',    contoId:'acc_2', note:'' },
    { id:'txn_13', data:'2024-05-07', descrizione:'Visita specialistica',        importo: -150,  categoria:'salute',       contoId:'acc_2', note:'' },
    { id:'txn_14', data:'2024-05-20', descrizione:'Palestra annuale',            importo: -480,  categoria:'sport',        contoId:'acc_2', note:'' },
    { id:'txn_15', data:'2024-05-31', descrizione:'Stipendio maggio',            importo: 3800,  categoria:'stipendio',    contoId:'acc_2', note:'' },
  ],
};

/* ===== COSTANTI ===== */
const TYPE_COLORS = {
  ETF:'#378ADD', Azione:'#1D9E75', Fondo:'#BA7517', Obbligazione:'#7F77DD',
};
const BANK_COLORS = { fineco:'#008B00', isp:'#C8102E', ing:'#FF6200' };
const BANK_NAMES  = { fineco:'FIN', isp:'ISP', ing:'ING' };
const CAT_ICONS   = {
  salary:'ti-briefcase', food:'ti-pizza',   invest:'ti-chart-line',
  util:  'ti-bolt',      car: 'ti-car',     div:   'ti-coin',
  shop:  'ti-shopping-cart',
};
const CAT_COLORS = {
  salary:'#1D9E75', food:'#BA7517', invest:'#378ADD',
  util:  '#888780', car: '#7F77DD', div:   '#2E7D32', shop:'#D85A30',
};
const SECTION_TITLES = {
  dashboard:'Dashboard', portfolio:'Portafoglio', accounts:'I miei conti',
  transactions:'Movimenti', settings:'Impostazioni',
};

/* ===== CALCOLI ===== */
function enrichPortfolio(items) {
  return items.map(item => {
    const totalValue = item.qty * item.price;
    const totalCost  = item.qty * item.avgCost;
    const gl         = totalValue - totalCost;
    const glPct      = totalCost > 0 ? (gl / totalCost) * 100 : 0;
    return { ...item, totalValue, totalCost, gl, glPct };
  });
}

function calcPortfolioTotals(enr) {
  const pV   = enr.reduce((s, i) => s + i.totalValue, 0);
  const pC   = enr.reduce((s, i) => s + i.totalCost,  0);
  const pGL  = pV - pC;
  const pGLP = pC > 0 ? (pGL / pC) * 100 : 0;
  return { pV, pC, pGL, pGLP };
}

function calcCCTotal(accs) {
  // Usa calcolo dinamico se accounts.js è già caricato, altrimenti usa saldoPartenza
  if (typeof calcSaldoConto === 'function') {
    return accs.reduce(function(s, a) { return s + calcSaldoConto(a.id); }, 0);
  }
  return accs.reduce(function(s, a) { return s + (a.saldoPartenza || 0); }, 0);
}

function calcAllocation(enr) {
  const order  = ['ETF','Azione','Fondo','Obbligazione'];
  const labels = { ETF:'ETF', Azione:'Azioni', Fondo:'Fondi', Obbligazione:'Obbligazioni' };
  return order.map(t => ({
    type:  t, label: labels[t],
    value: enr.filter(i => i.type === t).reduce((s, i) => s + i.totalValue, 0),
    color: TYPE_COLORS[t],
  })).filter(s => s.value > 0);
}

/* ===== VALORI DERIVATI ===== */
let enriched, totals, ccTotal, patrimony, allocation;

function recalculate() {
  enriched   = enrichPortfolio(APP_DATA.portfolio);
  totals     = calcPortfolioTotals(enriched);
  ccTotal    = calcCCTotal(APP_DATA.accounts);
  patrimony  = totals.pV + ccTotal;
  allocation = calcAllocation(enriched);
}

function setAppData(newData) {
  if (!newData || typeof newData !== 'object') return;
  if (newData.portfolio)       APP_DATA.portfolio       = newData.portfolio;
  if (newData.accounts)        APP_DATA.accounts        = newData.accounts;
  if (newData.transactions)    APP_DATA.transactions    = newData.transactions;
  if (newData.lastQuoteUpdate) APP_DATA.lastQuoteUpdate = newData.lastQuoteUpdate;
  recalculate();
}

/* ===== FORMATTAZIONE ===== */
function eur(v, dec = 0) {
  const sign = v < 0 ? '-' : '';
  const abs  = Math.abs(v).toLocaleString('it-IT', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  });
  return `${sign}€${abs}`;
}
function pct(v)      { return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`; }
function glColor(v)  { return v >= 0 ? 'var(--c-green)' : 'var(--c-coral)'; }
function glClass(v)  { return v >= 0 ? 'text-gain' : 'text-loss'; }

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
}

recalculate();
