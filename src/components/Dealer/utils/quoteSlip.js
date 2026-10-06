import swapDexMark from '../../../Assets/swap-dex-mark.png';
import { paintAsset, paintPair } from './quoteMarks';
import {
  formatMoney, formatMoneyLabeled, moneyMeta, normalizeHops, partyPaid, payoutLabel, payoutOf, profitCurrencyOf,
  receiveCurrencyOf,
  receivedOf,
  settlementOf, snapshotAmounts,
} from './quoteOrders';

const brandMark = new Image();
brandMark.src = swapDexMark;

export function whenBrandReady() {
  const font = document.fonts?.load?.('600 26px "IBM Plex Sans"')?.catch?.(() => {}) || Promise.resolve();
  const image = brandMark.complete && brandMark.naturalWidth
    ? Promise.resolve()
    : new Promise((resolve) => {
      brandMark.addEventListener('load', () => resolve(), { once: true });
      brandMark.addEventListener('error', () => resolve(), { once: true });
    });
  return Promise.all([font, image]);
}

function drawBrand(ctx, width) {
  const size = 58;
  const pad = 44;
  if (brandMark.complete && brandMark.naturalWidth) {
    ctx.drawImage(brandMark, width - pad - size, 26, size, size);
  }
  return pad + size + 12;
}

const SCALE = 2;
const DESK = '#0C2430';
const TEAL = '#1AA8A4';
const CYAN = '#1A9BB8';
const MIST = '#8FB4B0';
const INK = '#122028';
const MUTED = '#5A7174';
const LINE = '#D0E0DC';
const PAPER = '#F3F7F6';

function setup(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

const FACE = '"IBM Plex Sans", "Segoe UI", sans-serif';

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px ${FACE}`;
  ctx.textBaseline = 'top';
}

function wrapMeasured(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function fillFit(ctx, text, x, y, size, weight, maxWidth, minSize = 16) {
  let current = size;
  setFont(ctx, current, weight);
  while (current > minSize && ctx.measureText(text).width > maxWidth) {
    current -= 1;
    setFont(ctx, current, weight);
  }
  ctx.fillText(text, x, y);
}

function rule(ctx, x, y, width) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

function formatWhen(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRate(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatPct(n) {
  return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

/** Selo da rede e da moeda que entrou, no canto. Pequeno o bastante para não competir com o valor. */
const MARK_BAND = 76;
const PAIR_SIZE = 44;
const COIN_SIZE = 36;

function drawCornerMarks(ctx, width, height, quote) {
  const pad = 18;
  const gap = 8;
  const y = height - pad - PAIR_SIZE;
  const right = width - pad - PAIR_SIZE;
  const delivery = quote.asset || 'USDT';
  const incoming = receiveCurrencyOf(quote);
  paintPair(ctx, delivery, quote.network, right, y, PAIR_SIZE, '#F4F7F6');
  if (incoming && incoming !== delivery) {
    const coinY = y + (PAIR_SIZE - COIN_SIZE);
    paintAsset(ctx, incoming, right - gap - COIN_SIZE, coinY, COIN_SIZE);
  }
}

function drawBlock(ctx, x, y, label, value, detail, valueColor) {
  setFont(ctx, 13, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(label, x, y);
  ctx.fillStyle = valueColor || INK;
  fillFit(ctx, value, x, y + 22, 28, 600, 544);
  let next = y + 60;
  if (detail) {
    setFont(ctx, 14, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText(detail, x, y + 58);
    next = y + 84;
  }
  return next;
}

/** Proposta do cliente: enviado, recebido, rede. Sem a mesa. */
export function drawClientSlip(quote, calc) {
  const width = 720;
  const x = 36;
  const address = String(quote.clientAddress || '').trim();
  const name = String(quote.clientName || '').trim();
  const sent = receivedOf(quote);
  const asset = quote.asset || 'USDT';
  const meta = moneyMeta(asset);
  const network = quote.network || '';
  const showEquiv = sent.code !== 'BRL' && Number.isFinite(Number(calc?.brl));

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `500 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const addressLines = address ? wrapMeasured(measure, address, width - x * 2) : [];

  const headerH = name ? 150 : 124;
  const height = headerH
    + 36
    + 24 + 44 + (showEquiv ? 26 : 0) + 22
    + 24 + 54 + 52
    + (addressLines.length ? 26 + addressLines.length * 22 + 18 : 0)
    + 72;

  const { canvas, ctx } = setup(width, height);
  ctx.fillStyle = DESK;
  ctx.fillRect(0, 0, width, headerH);

  const markSize = 68;
  if (brandMark.complete && brandMark.naturalWidth) {
    ctx.drawImage(brandMark, x, 28, markSize, markSize);
  }

  ctx.fillStyle = '#F4F7F5';
  setFont(ctx, 26, 600);
  ctx.fillText('SWAP DEX', 120, 34);
  ctx.fillStyle = '#8FB3A8';
  setFont(ctx, 15, 500);
  ctx.fillText('OTC trading desk', 120, 68);
  if (name) {
    ctx.fillStyle = '#D7E6DF';
    fillFit(ctx, `Para ${name}`, 120, 100, 16, 500, width - 300, 13);
  }

  const until = formatWhen(quote.expiresAt);
  setFont(ctx, 13, 500);
  ctx.fillStyle = '#8EA89F';
  const validLabel = 'Válida até';
  ctx.fillText(validLabel, width - x - ctx.measureText(validLabel).width, 36);
  setFont(ctx, 16, 600);
  ctx.fillStyle = '#F4F7F5';
  ctx.fillText(until, width - x - ctx.measureText(until).width, 58);

  let y = headerH + 32;
  ctx.fillStyle = MUTED;
  setFont(ctx, 15, 500);
  ctx.fillText('Você envia', x, y);
  y += 24;
  ctx.fillStyle = INK;
  fillFit(ctx, formatMoney(sent.amount, sent.code), x, y, 32, 600, width - x * 2, 20);
  y += 44;
  if (showEquiv) {
    ctx.fillStyle = MUTED;
    setFont(ctx, 15, 500);
    ctx.fillText(`Equivale a ${formatMoney(calc.brl, 'BRL')}`, x, y);
    y += 26;
  }
  y += 18;

  ctx.fillStyle = MUTED;
  setFont(ctx, 15, 500);
  ctx.fillText('Você recebe', x, y);
  y += 24;
  ctx.fillStyle = TEAL;
  fillFit(ctx, formatMoney(calc.client, asset), x, y, 40, 600, width - x * 2, 22);
  y += 52;

  const pairSize = 40;
  paintPair(ctx, asset, network, x, y, pairSize, PAPER);
  ctx.fillStyle = INK;
  setFont(ctx, 16, 500);
  ctx.fillText(network ? `${meta.code} na rede ${network}` : meta.code, x + pairSize + 12, y + 11);
  y += pairSize + 20;

  if (addressLines.length) {
    ctx.fillStyle = MUTED;
    setFont(ctx, 15, 500);
    ctx.fillText('Recebe neste endereço', x, y);
    y += 26;
    ctx.fillStyle = INK;
    ctx.font = '500 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    addressLines.forEach((line) => {
      ctx.fillText(line, x, y);
      y += 22;
    });
    y += 16;
  }

  rule(ctx, x, y, width - x * 2);
  y += 18;
  ctx.fillStyle = INK;
  setFont(ctx, 16, 600);
  ctx.fillText(`1 ${meta.symbol} = R$ ${formatRate(calc.rate)}`, x, y);
  y += 28;
  ctx.fillStyle = MUTED;
  setFont(ctx, 14, 500);
  ctx.fillText('Preço travado nesta proposta.', x, y);

  return canvas;
}

function snapshotText(split, asset, skipCode) {
  return snapshotAmounts(split, asset)
    .filter((part) => part.code !== skipCode)
    .map((part) => (
      part.code === 'BRL' ? formatMoney(part.amount, 'BRL') : formatMoneyLabeled(part.amount, part.code)
    ))
    .join('   ');
}

function divisionLabel(quote) {
  const code = profitCurrencyOf(quote);
  if (code === 'BRL') return 'reais';
  if (code === (quote.asset || 'USDT')) return `${code}, a moeda do cliente`;
  return code;
}

/** Visão da mesa: snapshot, enviado, recebido e a parte de cada um. */
export function drawMesaSlip(quote, calc, title = 'Cotação da mesa') {
  const width = 760;
  const rows = calc.splits.length;
  const hops = normalizeHops(quote.hops);
  const clientAddress = String(quote.clientAddress || '').trim();
  const routeLines = hops.length + (clientAddress ? 1 : 0);
  const mark = MARK_BAND;
  const height = 640 + rows * 28 + routeLines * 36 + mark;
  const { canvas, ctx } = setup(width, height);
  const x = 48;
  const quoteAsset = moneyMeta(quote.asset);
  const brl = moneyMeta('BRL');
  const headerH = 112;

  ctx.fillStyle = DESK;
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = CYAN;
  ctx.fillRect(0, 0, 8, height);
  const brand = drawBrand(ctx, width);

  setFont(ctx, 26, 600);
  ctx.fillStyle = '#F4F7F5';
  fillFit(ctx, title, x, 32, 26, 600, width - x - brand);
  setFont(ctx, 15, 500);
  ctx.fillStyle = MIST;
  const who = quote.clientName ? `Cliente ${quote.clientName}` : 'Cliente';
  fillFit(ctx, who, x, 68, 15, 500, width - x - brand, 12);

  setFont(ctx, 13, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText('Snapshot da cotação', x, 132);
  ctx.fillStyle = INK;
  fillFit(ctx, `${quoteAsset.symbol} ${quote.asset} / ${brl.symbol} ${brl.code}`, x, 154, 22, 600, 544);
  setFont(ctx, 16, 500);
  ctx.fillStyle = INK;
  ctx.fillText(`1 ${quoteAsset.symbol} = ${brl.symbol} ${formatRate(calc.rate)}`, x, 188);
  setFont(ctx, 13, 500);
  ctx.fillStyle = MUTED;
  const usdtSnap = quote.asset !== 'USDT' && calc.usdtRate
    ? ` · 1 ₮ = R$ ${formatRate(calc.usdtRate)}`
    : '';
  ctx.fillText(`Binance · ${formatWhen(quote.createdAt)}${usdtSnap}`, x, 214);
  rule(ctx, x, 248, width - 96);

  const sent = receivedOf(quote);
  let y = drawBlock(
    ctx, x, 268,
    'Cliente enviou',
    formatMoney(sent.amount, sent.code),
    sent.code === 'BRL' ? brl.code : `equivale a ${formatMoney(calc.brl, 'BRL')}`,
  );
  y = drawBlock(
    ctx, x, y,
    'Cliente recebe',
    formatMoneyLabeled(calc.client, quote.asset),
    `rede ${quote.network}`,
    TEAL,
  );
  if (routeLines) {
    hops.forEach((hop) => {
      setFont(ctx, 13, 500);
      ctx.fillStyle = MUTED;
      ctx.fillText(`Intermediário · ${hop.network}`, x, y);
      ctx.fillStyle = INK;
      fillFit(ctx, hop.address || '—', x, y + 16, 13, 500, width - 96, 11);
      y += 36;
    });
    if (clientAddress) {
      setFont(ctx, 13, 500);
      ctx.fillStyle = MUTED;
      ctx.fillText(`Cliente · ${quote.network || 'rede'}`, x, y);
      ctx.fillStyle = INK;
      fillFit(ctx, clientAddress, x, y + 16, 13, 500, width - 96, 11);
      y += 36;
    }
  }

  rule(ctx, x, y, width - 96);
  setFont(ctx, 14, 600);
  ctx.fillStyle = INK;
  const pay = payoutLabel(payoutOf(quote)).toLowerCase();
  ctx.fillText(
    `Mesa ${formatPct(calc.feePct)} · divisão em ${divisionLabel(quote)} · ${pay}`,
    x,
    y + 16,
  );

  let rowY = y + 48;
  calc.splits.forEach((split, index) => {
    setFont(ctx, 15, 500);
    ctx.fillStyle = MUTED;
    const settlement = settlementOf(split, quote);
    const main = settlement.amount == null
      ? '—'
      : settlement.code === 'BRL'
        ? formatMoney(settlement.amount, 'BRL')
        : formatMoneyLabeled(settlement.amount, settlement.code);
    const rest = snapshotText(split, quote.asset, settlement.code);
    const right = `${formatPct(split.pct)}   ${main}${rest ? `   ${rest}` : ''}`;
    const rightWidth = ctx.measureText(right).width;
    ctx.fillText(right, width - 48 - rightWidth, rowY);
    ctx.fillStyle = INK;
    const paid = partyPaid(quote.parties?.[index], quote);
    let name = `${split.name} · ${paid ? 'pago' : 'a pagar'}`;
    const maxName = width - 96 - rightWidth - 16;
    while (ctx.measureText(name).width > maxName && name.replace(/…$/, '').length > 1) {
      const bare = name.endsWith('…') ? name.slice(0, -1) : name;
      name = `${bare.slice(0, -1)}…`;
    }
    ctx.fillText(name, x, rowY);
    rowY += 28;
  });

  drawCornerMarks(ctx, width, height, quote);
  return canvas;
}

export async function shareCanvas(canvas, filename) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/png');
  });
  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename.replace(/\.png$/, '') });
    return 'shared';
  }
  if (navigator.clipboard?.write && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      return 'copied';
    } catch {
      /* clipboard bloqueado: baixa o arquivo */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
