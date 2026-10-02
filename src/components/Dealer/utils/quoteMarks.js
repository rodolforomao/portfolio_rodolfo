import depixUrl from '../assets/marks/depix.png';
import usdtUrl from '../assets/marks/usdt.png';
import lbtcUrl from '../assets/marks/lbtc.png';
import btcUrl from '../assets/marks/btc.png';
import ethUrl from '../assets/marks/eth.png';
import bnbUrl from '../assets/marks/bnb.png';
import solUrl from '../assets/marks/sol.png';
import trxUrl from '../assets/marks/trx.png';
import polUrl from '../assets/marks/pol.png';
import arbUrl from '../assets/marks/arb.png';
import brlUrl from '../assets/marks/brl.png';

/** DePix, USDT e L-BTC vêm da SideSwap. O restante, da Binance. */
const URLS = {
  depix: depixUrl,
  usdt: usdtUrl,
  lbtc: lbtcUrl,
  btc: btcUrl,
  eth: ethUrl,
  bnb: bnbUrl,
  sol: solUrl,
  trx: trxUrl,
  pol: polUrl,
  arb: arbUrl,
  brl: brlUrl,
};

const NETWORK_KEY = {
  Polygon: 'pol',
  TRC20: 'trx',
  ERC20: 'eth',
  BEP20: 'bnb',
  Solana: 'sol',
  Arbitrum: 'arb',
  Bitcoin: 'btc',
  Liquid: 'lbtc',
};

const loaded = {};

function loadOne(key, url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      loaded[key] = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

let ready;
export function whenMarksReady() {
  if (!ready) {
    ready = Promise.all(Object.entries(URLS).map(([key, url]) => loadOne(key, url)));
  }
  return ready;
}

whenMarksReady();

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px "Source Sans 3", "Segoe UI", sans-serif`;
}

function disc(ctx, x, y, size, fill) {
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function glyph(ctx, x, y, size, text, color = '#fff') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  setFont(ctx, size * (text.length > 1 ? 0.34 : 0.46), 650);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + size * 0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function canonAsset(code) {
  const name = String(code || '').trim().toUpperCase().replace(/-/g, '');
  if (name === 'USDT' || name === 'USDt') return 'USDT';
  if (name === 'DEPIX') return 'DEPIX';
  if (name === 'LBTC' || name === 'LIQUID') return 'LBTC';
  if (name === 'USD' || name === 'US$' || name === 'DOLAR' || name === 'DÓLAR') return 'USD';
  if (name === 'BRL' || name === 'REAL' || name === 'REAIS') return 'BRL';
  return name || 'USDT';
}

function assetKey(code) {
  const name = canonAsset(code);
  if (name === 'DEPIX') return 'depix';
  if (name === 'USDT') return 'usdt';
  if (name === 'LBTC') return 'lbtc';
  if (name === 'BTC') return 'btc';
  if (name === 'ETH') return 'eth';
  if (name === 'BNB') return 'bnb';
  if (name === 'SOL') return 'sol';
  if (name === 'TRX') return 'trx';
  if (name === 'POL' || name === 'MATIC') return 'pol';
  if (name === 'ARB') return 'arb';
  if (name === 'BRL') return 'brl';
  return null;
}

function paintImage(ctx, key, x, y, size) {
  const img = loaded[key];
  if (!img) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
  return true;
}

function paintFiat(ctx, x, y, size) {
  disc(ctx, x, y, size, '#1C2430');
  glyph(ctx, x, y, size, '$', '#e2c27a');
}

function paintBolt(ctx, x, y, size) {
  disc(ctx, x, y, size, '#1C2430');
  ctx.fillStyle = '#e2c27a';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.56, y + size * 0.18);
  ctx.lineTo(x + size * 0.34, y + size * 0.54);
  ctx.lineTo(x + size * 0.48, y + size * 0.54);
  ctx.lineTo(x + size * 0.42, y + size * 0.82);
  ctx.lineTo(x + size * 0.68, y + size * 0.44);
  ctx.lineTo(x + size * 0.52, y + size * 0.44);
  ctx.closePath();
  ctx.fill();
}

function paintBase(ctx, x, y, size) {
  disc(ctx, x, y, size, '#0052FF');
  const r = size * 0.14;
  const bx = x + size * 0.3;
  const by = y + size * 0.3;
  const bw = size * 0.4;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bw, r);
  ctx.arcTo(bx + bw, by + bw, bx, by + bw, r);
  ctx.arcTo(bx, by + bw, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath();
  ctx.fill();
}

export function paintAsset(ctx, asset, x, y, size) {
  const code = canonAsset(asset);
  const key = assetKey(code);
  if (key && paintImage(ctx, key, x, y, size)) return;
  if (code === 'USD') {
    paintFiat(ctx, x, y, size);
    return;
  }
  disc(ctx, x, y, size, '#2C3340');
  glyph(ctx, x, y, size, code.slice(0, 1));
}

export function paintNetwork(ctx, network, x, y, size) {
  const key = NETWORK_KEY[network];
  if (key && paintImage(ctx, key, x, y, size)) return;
  if (network === 'Lightning') {
    paintBolt(ctx, x, y, size);
    return;
  }
  if (network === 'Base') {
    paintBase(ctx, x, y, size);
    return;
  }
  disc(ctx, x, y, size, '#2C3340');
  glyph(ctx, x, y, size, (network || '?').slice(0, 1).toUpperCase());
}

/** Rede em tamanho cheio, moeda sobreposta no canto. O anel acompanha o fundo. */
export function paintPair(ctx, asset, network, x, y, size, ring = '#171c24') {
  if (!network) {
    paintAsset(ctx, asset, x, y, size);
    return;
  }
  const networkKey = NETWORK_KEY[network];
  const coinKey = assetKey(asset);
  const overlay = coinKey && coinKey !== networkKey;
  const badge = overlay ? Math.max(8, size * 0.4) : 0;
  const disc = overlay ? size - badge * 0.42 : size;
  paintNetwork(ctx, network, x, y, disc);
  if (!overlay) return;
  const bx = x + size - badge;
  const by = y + size - badge;
  ctx.beginPath();
  ctx.arc(bx + badge / 2, by + badge / 2, badge / 2 + Math.max(1, size * 0.045), 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  paintAsset(ctx, asset, bx, by, badge);
}
