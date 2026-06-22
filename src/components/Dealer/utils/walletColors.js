/** Paleta estável para identificar carteiras visualmente. */
const WALLET_PALETTE = [
  { bg: 'rgba(63, 185, 80, 0.14)', border: '#3fb950', text: '#56d364' },
  { bg: 'rgba(88, 166, 255, 0.14)', border: '#58a6ff', text: '#79c0ff' },
  { bg: 'rgba(199, 112, 240, 0.14)', border: '#c770f0', text: '#d2a8ff' },
  { bg: 'rgba(210, 153, 34, 0.14)', border: '#d29922', text: '#e3b341' },
  { bg: 'rgba(248, 81, 73, 0.14)', border: '#f85149', text: '#ff7b72' },
  { bg: 'rgba(57, 197, 207, 0.14)', border: '#39c5cf', text: '#56d4dd' },
  { bg: 'rgba(163, 113, 247, 0.14)', border: '#a371f7', text: '#bc8cff' },
  { bg: 'rgba(255, 166, 87, 0.14)', border: '#ffa657', text: '#ffb77a' },
];

/** Cores fixas para carteiras conhecidas do projeto. */
const KNOWN_WALLET_INDEX = {
  depix_pool: 0,
  amm_lbtc: 1,
  amm_depix: 2,
  depix_amm: 2,
};

function hashWallet(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getWalletColor(walletName) {
  const key = String(walletName || '').trim().toLowerCase();
  if (!key || key === '—' || key === 'none') {
    return { ...WALLET_PALETTE[0], key: '' };
  }

  const known = KNOWN_WALLET_INDEX[key];
  const idx = known != null ? known : hashWallet(key) % WALLET_PALETTE.length;
  return { ...WALLET_PALETTE[idx], key };
}

export function walletColorStyle(walletName) {
  const c = getWalletColor(walletName);
  return {
    '--wallet-accent': c.border,
    '--wallet-bg': c.bg,
    '--wallet-text': c.text,
  };
}
