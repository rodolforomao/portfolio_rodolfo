function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px "Segoe UI", "Helvetica Neue", sans-serif`;
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
  setFont(ctx, size * 0.42, 700);
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2 + size * 0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function canonAsset(code) {
  const name = String(code || '').trim().toUpperCase().replace(/-/g, '');
  if (name === 'USDT' || name === 'USDt') return 'USDT';
  if (name === 'DEPIX') return 'DEPIX';
  if (name === 'LBTC') return 'BTC';
  if (name === 'USD' || name === 'US$' || name === 'DOLAR' || name === 'DÓLAR') return 'USD';
  if (name === 'BRL' || name === 'REAL' || name === 'REAIS') return 'BRL';
  return name || 'USDT';
}

function ethDiamond(ctx, x, y, size) {
  const cx = x + size / 2;
  const top = y + size * 0.22;
  const mid = y + size * 0.48;
  const waist = y + size * 0.56;
  const bottom = y + size * 0.8;
  const half = size * 0.24;
  ctx.fillStyle = '#fff';
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

export function paintAsset(ctx, asset, x, y, size) {
  const code = canonAsset(asset);
  if (code === 'BRL') {
    disc(ctx, x, y, size, '#009B3A');
    glyph(ctx, x, y, size, 'R$');
    return;
  }
  if (code === 'USD') {
    disc(ctx, x, y, size, '#1F7A4D');
    glyph(ctx, x, y, size, '$');
    return;
  }
  if (code === 'DEPIX') {
    disc(ctx, x, y, size, '#0E8F6E');
    glyph(ctx, x, y, size, 'D');
    return;
  }
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
  if (code === 'USDT') {
    disc(ctx, x, y, size, '#26A17B');
    glyph(ctx, x, y, size, '₮');
    return;
  }
  disc(ctx, x, y, size, '#3D4A46');
  glyph(ctx, x, y, size, code.slice(0, 1));
}

export function paintNetwork(ctx, network, x, y, size) {
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
    ctx.lineWidth = Math.max(1, size * 0.07);
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
  if (name === 'ERC20') {
    disc(ctx, x, y, size, '#627EEA');
    ethDiamond(ctx, x, y, size);
    return;
  }
  if (name === 'Arbitrum') {
    disc(ctx, x, y, size, '#213147');
    ctx.strokeStyle = '#12AAFF';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + size * 0.28, y + size * 0.7);
    ctx.lineTo(x + size * 0.5, y + size * 0.28);
    ctx.lineTo(x + size * 0.72, y + size * 0.7);
    ctx.stroke();
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
    ['#9945FF', '#14F195', '#00D1FF'].forEach((color, i) => {
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
  if (name === 'Bitcoin') {
    disc(ctx, x, y, size, '#F7931A');
    glyph(ctx, x, y, size, '₿');
    return;
  }
  if (name === 'Liquid') {
    disc(ctx, x, y, size, '#0B3A8C');
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
  disc(ctx, x, y, size, '#5E6D68');
  glyph(ctx, x, y, size, (name || '?').slice(0, 1).toUpperCase());
}

/** Moeda em cima da rede: a rede ocupa o círculo e o símbolo fica no canto. */
export function paintPair(ctx, asset, network, x, y, size) {
  if (!network) {
    paintAsset(ctx, asset, x, y, size);
    return;
  }
  paintNetwork(ctx, network, x, y, size);
  const badge = size * 0.46;
  const bx = x + size - badge * 0.78;
  const by = y + size - badge * 0.78;
  ctx.beginPath();
  ctx.arc(bx + badge / 2, by + badge / 2, badge / 2 + size * 0.035, 0, Math.PI * 2);
  ctx.fillStyle = '#F4F7F6';
  ctx.fill();
  paintAsset(ctx, asset, bx, by, badge);
}
