import {
  formatAmount,
  formatPrice,
  type PriceBucket,
} from "./csv";

type Props = {
  buckets: PriceBucket[];
  spot?: number | null;
};

function shortLbtc(n: number): string {
  if (n === 0) return "0";
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6).replace(/\.?0+$/, "");
}

export default function BuyVolumeChart({ buckets, spot }: Props) {
  const maxLbtc = Math.max(...buckets.map((b) => b.lbtc), 0);
  const totalLbtc = buckets.reduce((s, b) => s + b.lbtc, 0);
  const chartH = 180;
  const padTop = 28;
  const padBottom = 36;
  const padLeft = 8;
  const padRight = 8;
  const barGap = 6;
  const innerH = chartH - padTop - padBottom;
  const n = buckets.length;
  const width = Math.max(320, n * 56);
  const barW = Math.max(18, (width - padLeft - padRight) / n - barGap);

  const spotBucket =
    spot != null && Number.isFinite(spot)
      ? buckets.find((b) => spot >= b.from && spot < b.to)
      : undefined;

  return (
    <div className="buy-chart">
      <div className="buy-chart-head">
        <div>
          <span className="price-label">Volume comprado por faixa de BTC</span>
          <p className="price-unit" style={{ margin: "4px 0 0" }}>
            L-BTC comprado em bandas de 5k USDT (0–5k, 5k–10k, …)
          </p>
        </div>
        <div className="stat" style={{ textAlign: "right" }}>
          <strong className="mono-stat">{formatAmount(totalLbtc)}</strong>
          <span>L-BTC total nas barras</span>
        </div>
      </div>

      <div className="buy-chart-scroll">
        <svg
          className="buy-chart-svg"
          viewBox={`0 0 ${width} ${chartH}`}
          role="img"
          aria-label="Histograma de L-BTC comprado por faixa de preço USDT"
        >
          {buckets.map((b, i) => {
            const x = padLeft + i * (barW + barGap);
            const h =
              maxLbtc > 0 ? Math.max(b.lbtc > 0 ? 3 : 0, (b.lbtc / maxLbtc) * innerH) : 0;
            const y = padTop + innerH - h;
            const isSpot = spotBucket?.from === b.from;
            return (
              <g key={b.from}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={4}
                  className={
                    isSpot
                      ? "buy-bar buy-bar--spot"
                      : b.lbtc > 0
                        ? "buy-bar"
                        : "buy-bar buy-bar--empty"
                  }
                >
                  <title>
                    {b.label} USDT · {formatAmount(b.lbtc)} L-BTC ·{" "}
                    {formatPrice(b.usdt)} USDT · {b.trades} trade
                    {b.trades === 1 ? "" : "s"}
                  </title>
                </rect>
                {b.lbtc > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="buy-bar-val"
                  >
                    {shortLbtc(b.lbtc)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={chartH - 14}
                  textAnchor="middle"
                  className="buy-bar-label"
                >
                  {b.label}
                </text>
                {isSpot && (
                  <text
                    x={x + barW / 2}
                    y={chartH - 2}
                    textAnchor="middle"
                    className="buy-bar-spot"
                  >
                    spot
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="buy-chart-legend">
        {buckets
          .filter((b) => b.lbtc > 0)
          .map((b) => (
            <div key={b.from} className="buy-legend-row">
              <span className="mono">{b.label}</span>
              <span className="mono">{formatAmount(b.lbtc)} L-BTC</span>
              <span className="muted">{b.trades} tx</span>
            </div>
          ))}
      </div>
    </div>
  );
}
