import {
  formatMoney, formatMoneyLabeled, moneyMeta, normalizeHops, partyPaid, payoutLabel, payoutOf, profitCurrencyOf,
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

function disc(ctx, x, y, size, fill) {
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function glyph(ctx, x, y, size, text, color = '#fff') {
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  setFont(ctx, size * 0.46, 700);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + size * 0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function ethDiamond(ctx, x, y, size, color = '#fff') {
  const cx = x + size / 2;
  const top = y + size * 0.22;
  const mid = y + size * 0.48;
  const waist = y + size * 0.56;
  const bottom = y + size * 0.8;
  const half = size * 0.24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + half, mid);
  ctx.lineTo(cx, waist);
  ctx.lineTo(cx - half, mid);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.moveTo(cx - half, mid);
  ctx.lineTo(cx, waist);
  ctx.lineTo(cx + half, mid);
  ctx.lineTo(cx, bottom);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawAssetMark(ctx, asset, x, y, size) {
  const code = asset || 'USDT';
  if (code === 'BTC') {
    disc(ctx, x, y, size, '#F7931A');
    glyph(ctx, x, y, size, '₿');
    return;
  }
  if (code === 'ETH') {
    disc(ctx, x, y, size, '#627EEA');
    ethDiamond(ctx, x, y, size);
    return;
  }
  disc(ctx, x, y, size, '#26A17B');
  glyph(ctx, x, y, size, '₮');
}

function drawNetworkMark(ctx, network, x, y, size) {
  const name = network || '';
  if (name === 'Polygon') {
    disc(ctx, x, y, size, '#8247E5');
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.28;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = size * 0.07;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    return;
  }
  if (name === 'TRC20') {
    disc(ctx, x, y, size, '#EF0027');
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.34, y + size * 0.28);
    ctx.lineTo(x + size * 0.72, y + size * 0.5);
    ctx.lineTo(x + size * 0.34, y + size * 0.72);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (name === 'ERC20' || name === 'Arbitrum') {
    disc(ctx, x, y, size, name === 'Arbitrum' ? '#213147' : '#627EEA');
    if (name === 'Arbitrum') {
      ctx.strokeStyle = '#12AAFF';
      ctx.lineWidth = size * 0.07;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.7);
      ctx.lineTo(x + size * 0.5, y + size * 0.28);
      ctx.lineTo(x + size * 0.72, y + size * 0.7);
      ctx.stroke();
      return;
    }
    ethDiamond(ctx, x, y, size);
    return;
  }
  if (name === 'BEP20') {
    disc(ctx, x, y, size, '#F3BA2F');
    ctx.fillStyle = '#fff';
    const cx = x + size / 2;
    const cy = y + size / 2;
    const d = size * 0.1;
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
      ctx.save();
      ctx.translate(cx + dx * d * 1.35, cy + dy * d * 1.35);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-d, -d, d * 2, d * 2);
      ctx.restore();
    });
    return;
  }
  if (name === 'Solana') {
    disc(ctx, x, y, size, '#121212');
    const bars = ['#9945FF', '#14F195', '#00D1FF'];
    bars.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      const top = y + size * (0.3 + i * 0.16);
      ctx.moveTo(x + size * 0.28, top);
      ctx.lineTo(x + size * 0.74, top - size * 0.04);
      ctx.lineTo(x + size * 0.74, top + size * 0.06);
      ctx.lineTo(x + size * 0.28, top + size * 0.1);
      ctx.closePath();
      ctx.fill();
    });
    return;
  }
  if (name === 'Lightning') {
    disc(ctx, x, y, size, '#1C1A17');
    ctx.fillStyle = '#F5C451';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.56, y + size * 0.18);
    ctx.lineTo(x + size * 0.34, y + size * 0.54);
    ctx.lineTo(x + size * 0.48, y + size * 0.54);
    ctx.lineTo(x + size * 0.42, y + size * 0.82);
    ctx.lineTo(x + size * 0.68, y + size * 0.44);
    ctx.lineTo(x + size * 0.52, y + size * 0.44);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (name === 'Base') {
    disc(ctx, x, y, size, '#0052FF');
    const r = size * 0.16;
    const bx = x + size * 0.32;
    const by = y + size * 0.32;
    const bw = size * 0.36;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + bw, r);
    ctx.arcTo(bx + bw, by + bw, bx, by + bw, r);
    ctx.arcTo(bx, by + bw, bx, by, r);
    ctx.arcTo(bx, by, bx + bw, by, r);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (name === 'Bitcoin' || name === 'Liquid') {
    disc(ctx, x, y, size, name === 'Liquid' ? '#0B3A8C' : '#F7931A');
    if (name === 'Liquid') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.22);
      ctx.bezierCurveTo(
        x + size * 0.78, y + size * 0.42,
        x + size * 0.7, y + size * 0.78,
        x + size * 0.5, y + size * 0.8,
      );
      ctx.bezierCurveTo(
        x + size * 0.3, y + size * 0.78,
        x + size * 0.22, y + size * 0.42,
        x + size * 0.5, y + size * 0.22,
      );
      ctx.fill();
      return;
    }
    glyph(ctx, x, y, size, '₿');
    return;
  }
  disc(ctx, x, y, size, '#5E6D68');
  glyph(ctx, x, y, size, (name || '?').slice(0, 1).toUpperCase());
}

/** Moeda e rede no canto inferior direito. Cada marca ocupa 30% da largura. */
function drawCornerMarks(ctx, width, height, asset, network) {
  const size = width * 0.3;
  const pad = 18;
  const gap = 10;
  const y = height - pad - size;
  const networkX = width - pad - size;
  const assetX = networkX - gap - size;
  drawAssetMark(ctx, asset, assetX, y, size);
  drawNetworkMark(ctx, network, networkX, y, size);
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
  const mark = width * 0.3;
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

  let y = drawBlock(
    ctx, x, 136,
    'Você envia',
    formatMoney(calc.brl, 'BRL'),
    moneyMeta('BRL').code,
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
  drawCornerMarks(ctx, width, height, quote.asset, quote.network);
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
  const mark = width * 0.3;
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

  let y = drawBlock(
    ctx, x, 268,
    'Cliente enviou',
    formatMoney(calc.brl, 'BRL'),
    brl.code,
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

  drawCornerMarks(ctx, width, height, quote.asset, quote.network);
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
