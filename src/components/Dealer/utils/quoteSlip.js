import { paintAsset, paintPair } from './quoteMarks';
import {
  formatMoney, formatMoneyLabeled, moneyMeta, normalizeHops, partyPaid, payoutLabel, payoutOf, profitCurrencyOf,
  receiveCurrencyOf,
  receivedOf,
  settlementOf, snapshotAmounts,
} from './quoteOrders';

const SCALE = 2;
const INK = '#1A2421';
const MUTED = '#5E6D68';
const LINE = '#D5E0DC';
const PAPER = '#F4F7F6';
const RECEIVE = '#0F6E56';

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

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px "Segoe UI", "Helvetica Neue", sans-serif`;
  ctx.textBaseline = 'top';
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
  const width = 640;
  const mark = MARK_BAND;
  const address = String(quote.clientAddress || '').trim();
  const height = (address ? 590 : 520) + mark;
  const { canvas, ctx } = setup(width, height);
  const x = 48;

  ctx.fillStyle = RECEIVE;
  ctx.fillRect(0, 0, 8, height);

  setFont(ctx, 26, 600);
  ctx.fillText('Cotação do cliente', x, 40);
  setFont(ctx, 14, 500);
  ctx.fillStyle = MUTED;
  const who = quote.clientName ? `Para ${quote.clientName} · ` : '';
  ctx.fillText(`${who}válida até ${formatWhen(quote.expiresAt)}`, x, 76);
  rule(ctx, x, 112, width - 96);

  const sent = receivedOf(quote);
  let y = drawBlock(
    ctx, x, 136,
    'Você envia',
    formatMoney(sent.amount, sent.code),
    sent.code === 'BRL' ? 'BRL' : `equivale a ${formatMoney(calc.brl, 'BRL')}`,
  );
  y = drawBlock(
    ctx, x, y + 8,
    'Você recebe',
    formatMoney(calc.client, quote.asset),
    `${moneyMeta(quote.asset).code} · rede ${quote.network}`,
    RECEIVE,
  );
  if (address) {
    setFont(ctx, 13, 500);
    ctx.fillStyle = MUTED;
    ctx.fillText('Endereço de recebimento', x, y);
    ctx.fillStyle = INK;
    fillFit(ctx, address, x, y + 20, 15, 500, width - 96, 11);
  }

  setFont(ctx, 13, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText('O valor a receber usa a cotação travada nesta proposta.', x, height - mark - 52);
  drawCornerMarks(ctx, width, height, quote);
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

  ctx.fillStyle = '#1A2421';
  ctx.fillRect(0, 0, 8, height);

  setFont(ctx, 26, 600);
  ctx.fillText(title, x, 40);
  setFont(ctx, 14, 500);
  ctx.fillStyle = MUTED;
  const who = quote.clientName ? `Cliente ${quote.clientName}` : 'Cliente';
  ctx.fillText(who, x, 76);
  rule(ctx, x, 112, width - 96);

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
    RECEIVE,
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
