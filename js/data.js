/* =====================================================
   data.js — Modello dati, costanti, calcoli
   ===================================================== */

/* ===== DATI MOCK (sostituiti con dati reali in Fase 3+) ===== */
const APP_DATA = {

  portfolio: [
    { id:1, name:'iShares Core MSCI World', ticker:'IWDA.AS', type:'ETF',         qty:500,  avgCost:75.00,  price:83.50,  bank:'fineco', logoKey:'iS',      logoImg:null  },
    { id:2, name:'ENI SpA',                 ticker:'ENI.MI',  type:'Azione',       qty:500,  avgCost:12.50,  price:14.20,  bank:'fineco', logoKey:'E',       logoImg:null  },
    { id:3, name:'STMicroelectronics',      ticker:'STM.MI',  type:'Azione',       qty:1000, avgCost:15.00,  price:12.30,  bank:'fineco', logoKey:null,      logoImg:'assets/logos/stm.png' },
    { id:4, name:'Eurizon Fund Bond EUR',   ticker:'EURIZ',   type:'Fondo',        qty:5000, avgCost:16.00,  price:18.50,  bank:'isp',    logoKey:null,      logoImg:'assets/logos/eurizon.png' },
    { id:5, name:'BTP Futura 2030',         ticker:'BTP30',   type:'Obbligazione', qty:250,  avgCost:98.50,  price:101.20, bank:'fineco', logoKey:'IT',      logoImg:null  },
    { id:6, name:'Vanguard FTSE All-World', ticker:'VWRL.AS', type:'ETF',          qty:200,  avgCost:95.00,  price:110.40, bank:'ing',    logoKey:'V',       logoImg:null  },
  ],

  accounts: [
    { id:1, name:'Fineco Conto',      bank:'fineco', type:'personal', balance:8230  },
    { id:2, name:'ISP Conto Comune',  bank:'isp',    type:'shared',   balance:5680  },
    { id:3, name:'ING Direct',        bank:'ing',    type:'personal', balance:3120  },
  ],

  transactions: [
    { id:1, date:'2026-06-14', desc:'Stipendio giugno',           amount:3200,   cat:'salary', account:'Fineco Conto'       },
    { id:2, date:'2026-06-13', desc:'Supermercato Esselunga',     amount:-145.80,cat:'food',   account:'ISP Conto Comune'   },
    { id:3, date:'2026-06-12', desc:'Acquisto IWDA x10',          amount:-835,   cat:'invest', account:'Fineco Investimenti'},
    { id:4, date:'2026-06-11', desc:'Bolletta gas',               amount:-89.40, cat:'util',   account:'ISP Conto Comune'   },
    { id:5, date:'2026-06-10', desc:'Ristorante Da Mario',        amount:-67.50, cat:'food',   account:'Fineco Conto'       },
    { id:6, date:'2026-06-09', desc:'Dividendo ENI',              amount:142,    cat:'div',    account:'Fineco Conto'       },
    { id:7, date:'2026-06-08', desc:'Carburante Q8',              amount:-55,    cat:'car',    account:'Fineco Conto'       },
    { id:8, date:'2026-06-07', desc:'Amazon Prime',               amount:-4.99,  cat:'shop',   account:'ING Direct'         },
  ],

};

/* ===== COSTANTI ===== */
const TYPE_COLORS = {
  ETF:         '#378ADD',
  Azione:      '#1D9E75',
  Fondo:       '#BA7517',
  Obbligazione:'#7F77DD',
};

/* Colori usati per i monogrammi dei titoli senza logo */
const MONO_COLORS = {
  'iS': '#12263A', // iShares/BlackRock
  'E':  '#003366', // ENI
  'IT': '#009246', // BTP Italia
  'V':  '#760000', // Vanguard
};

const BANK_COLORS = { fineco:'#008B00', isp:'#C8102E', ing:'#FF6200' };
const BANK_NAMES  = { fineco:'FIN', isp:'ISP', ing:'ING' };

const CAT_ICONS = {
  salary:'ti-briefcase',
  food:  'ti-pizza',
  invest:'ti-chart-line',
  util:  'ti-bolt',
  car:   'ti-car',
  div:   'ti-coin',
  shop:  'ti-shopping-cart',
};

const CAT_COLORS = {
  salary:'#1D9E75',
  food:  '#BA7517',
  invest:'#378ADD',
  util:  '#888780',
  car:   '#7F77DD',
  div:   '#2E7D32',
  shop:  '#D85A30',
};

const SECTION_TITLES = {
  dashboard:    'Dashboard',
  portfolio:    'Portafoglio',
  accounts:     'I miei conti',
  transactions: 'Movimenti',
  settings:     'Impostazioni',
};

/* ===== CALCOLI ===== */
function enrichPortfolio(items) {
  return items.map(item => {
    const totalValue = item.qty * item.price;
    const totalCost  = item.qty * item.avgCost;
    const gl         = totalValue - totalCost;
    const glPct      = (gl / totalCost) * 100;
    return { ...item, totalValue, totalCost, gl, glPct };
  });
}

function calcPortfolioTotals(enriched) {
  const pV   = enriched.reduce((s, i) => s + i.totalValue, 0);
  const pC   = enriched.reduce((s, i) => s + i.totalCost,  0);
  const pGL  = pV - pC;
  const pGLP = pC > 0 ? (pGL / pC) * 100 : 0;
  return { pV, pC, pGL, pGLP };
}

function calcCCTotal(accounts) {
  return accounts.reduce((s, a) => s + a.balance, 0);
}

function calcAllocation(enriched) {
  const order = ['ETF', 'Azione', 'Fondo', 'Obbligazione'];
  const labels = { ETF:'ETF', Azione:'Azioni', Fondo:'Fondi', Obbligazione:'Obbligazioni' };
  return order
    .map(t => ({
      type:  t,
      label: labels[t],
      value: enriched.filter(i => i.type === t).reduce((s, i) => s + i.totalValue, 0),
      color: TYPE_COLORS[t],
    }))
    .filter(s => s.value > 0);
}

/* ===== FORMATTAZIONE ===== */
function eur(v, dec = 0) {
  const sign = v < 0 ? '-' : '';
  const abs  = Math.abs(v).toLocaleString('it-IT', {
    minimumFractionDigits:  dec,
    maximumFractionDigits:  dec,
  });
  return `${sign}€${abs}`;
}

function pct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function glColor(v) { return v >= 0 ? 'var(--c-green)' : 'var(--c-coral)'; }
function glClass(v) { return v >= 0 ? 'text-gain' : 'text-loss'; }

function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' });
}

/* ===== DATI CALCOLATI (globali, usati da ui.js e app.js) ===== */
const enriched    = enrichPortfolio(APP_DATA.portfolio);
const totals      = calcPortfolioTotals(enriched);
const ccTotal     = calcCCTotal(APP_DATA.accounts);
const patrimony   = totals.pV + ccTotal;
const allocation  = calcAllocation(enriched);
