import { useEffect, useMemo, useState } from "react";
import { fetchBtcSpot, type SpotQuote } from "./btcPrice";
import BuyVolumeChart from "./BuyVolumeChart";
import {
  avgPriceFromTxs,
  blockstreamTxUrl,
  buyVolumeByPriceBucket,
  compareToBtcSpot,
  formatAmount,
  formatFee,
  formatPct,
  formatPrice,
  liquidScanTxUrl,
  parseCsv,
  toDateKey,
  txUsdtPerLbtc,
  type LiquidTx,
} from "./csv";

type TypeFilter = "all" | "Received" | "Sent" | "Swap";

function shortTx(txid: string): string {
  return `${txid.slice(0, 8)}…${txid.slice(-6)}`;
}

function amountClass(n: number): string {
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "muted";
}

function typeBadge(type: string): string {
  const t = type.toLowerCase();
  if (t === "received") return "badge badge-received";
  if (t === "sent") return "badge badge-sent";
  if (t === "swap") return "badge badge-swap";
  return "badge";
}

export default function App() {
  const [txs, setTxs] = useState<LiquidTx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [btc, setBtc] = useState<SpotQuote | null>(null);
  const [btcError, setBtcError] = useState<string | null>(null);
  const [btcLoading, setBtcLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data.csv`);
        if (!res.ok) throw new Error(`Falha ao carregar CSV (${res.status})`);
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseCsv(text).sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp)
        );
        setTxs(parsed);
        if (parsed.length) {
          setDateFrom(toDateKey(parsed[parsed.length - 1].timestamp));
          setDateTo(toDateKey(parsed[0].timestamp));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao ler CSV");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const quote = await fetchBtcSpot();
        if (cancelled) return;
        setBtc(quote);
        setBtcError(null);
      } catch (e) {
        if (!cancelled) {
          setBtcError(
            e instanceof Error ? e.message : "Falha ao buscar BTC spot"
          );
        }
      } finally {
        if (!cancelled) setBtcLoading(false);
      }
    }

    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs.filter((tx) => {
      const day = toDateKey(tx.timestamp);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (onlySelected && !selected.has(tx.txid)) return false;
      if (q) {
        const hay = `${tx.txid} ${tx.type} ${tx.memo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txs, dateFrom, dateTo, typeFilter, query, onlySelected, selected]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((tx) => selected.has(tx.txid));

  function toggleOne(txid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(txid)) next.delete(txid);
      else next.add(txid);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const tx of filtered) next.delete(tx.txid);
      } else {
        for (const tx of filtered) next.add(tx.txid);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setOnlySelected(false);
  }

  function openSelectedOnBlockstream() {
    const ids = [...selected];
    if (!ids.length) return;
    // Browser may block many popups; open first few + copy rest
    const openCount = Math.min(ids.length, 5);
    for (let i = 0; i < openCount; i++) {
      window.open(blockstreamTxUrl(ids[i]), "_blank", "noopener,noreferrer");
    }
    if (ids.length > openCount) {
      const rest = ids.slice(openCount).map(blockstreamTxUrl).join("\n");
      void navigator.clipboard.writeText(rest);
      alert(
        `Abertas ${openCount} abas. Os ${ids.length - openCount} links restantes foram copiados.`
      );
    }
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text).sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp)
      );
      setTxs(parsed);
      setSelected(new Set());
      setOnlySelected(false);
      if (parsed.length) {
        setDateFrom(toDateKey(parsed[parsed.length - 1].timestamp));
        setDateTo(toDateKey(parsed[0].timestamp));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ler arquivo");
    } finally {
      setLoading(false);
    }
  }

  const selectedCount = selected.size;

  const selectedTxs = useMemo(
    () => txs.filter((tx) => selected.has(tx.txid)),
    [txs, selected]
  );

  const avgPrice = useMemo(
    () => avgPriceFromTxs(selectedTxs),
    [selectedTxs]
  );

  const vsBtc = useMemo(() => {
    if (!btc || avgPrice.pricedCount === 0) return null;
    return compareToBtcSpot(avgPrice, btc.price);
  }, [avgPrice, btc]);

  const buyBuckets = useMemo(
    () => buyVolumeByPriceBucket(selectedTxs),
    [selectedTxs]
  );

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">
          <h1>Liquid TXs</h1>
          <p>
            Histórico Liquid ordenado do mais recente. Filtre por data, marque
            as que quiser e abra no Blockstream Explorer.
          </p>
        </div>
        <div className="stats">
          <div className="stat">
            <strong>{txs.length}</strong>
            <span>no CSV</span>
          </div>
          <div className="stat">
            <strong>{filtered.length}</strong>
            <span>filtradas</span>
          </div>
          <div className="stat">
            <strong>{selectedCount}</strong>
            <span>marcadas</span>
          </div>
          <div className="stat">
            <strong>
              {btc
                ? formatPrice(btc.price)
                : btcLoading
                  ? "…"
                  : "—"}
            </strong>
            <span>BTC spot USDT</span>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="filters">
          <div className="field">
            <label htmlFor="from">De</label>
            <input
              id="from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="to">Até</label>
            <input
              id="to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="type">Tipo</label>
            <select
              id="type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">Todos</option>
              <option value="Received">Received</option>
              <option value="Sent">Sent</option>
              <option value="Swap">Swap</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="q">Busca</label>
            <input
              id="q"
              type="search"
              placeholder="txid, memo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="csv">Outro CSV</label>
            <input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (txs.length) {
                  setDateFrom(toDateKey(txs[txs.length - 1].timestamp));
                  setDateTo(toDateKey(txs[0].timestamp));
                }
                setTypeFilter("all");
                setQuery("");
                setOnlySelected(false);
              }}
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className={`btn ${onlySelected ? "btn-primary" : ""}`}
              onClick={() => setOnlySelected((v) => !v)}
              disabled={selectedCount === 0}
            >
              Só marcadas
            </button>
          </div>
        </div>
        <p className="file-hint" style={{ margin: "12px 0 0" }}>
          Carrega <code>public/data.csv</code> por padrão. Você também pode
          escolher outro arquivo exportado.
        </p>
      </section>

      <div className="selection-bar">
        <div>
          {selectedCount > 0 ? (
            <>
              <strong>{selectedCount}</strong> selecionada
              {selectedCount === 1 ? "" : "s"}
            </>
          ) : (
            "Marque linhas com o checkbox para ver o preço médio USDT/L-BTC"
          )}
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={toggleAllFiltered}
            disabled={filtered.length === 0}
          >
            {allFilteredSelected ? "Desmarcar filtradas" : "Marcar filtradas"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={clearSelection}
            disabled={selectedCount === 0}
          >
            Limpar seleção
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openSelectedOnBlockstream}
            disabled={selectedCount === 0}
          >
            Abrir no Blockstream
          </button>
        </div>
      </div>

      {selectedCount > 0 && (
        <section className="panel price-panel" aria-live="polite">
          {vsBtc && btc && (
            <div className={`btc-compare btc-compare--${vsBtc.label}`}>
              <div className="price-main">
                <span className="price-label">vs BTC spot</span>
                <strong className="price-value vs-value">
                  {vsBtc.label === "aumentando"
                    ? "Aumentando"
                    : vsBtc.label === "diminuindo"
                      ? "Diminuindo"
                      : "Empatado"}{" "}
                  <span className="vs-pct">{formatPct(vsBtc.vsHoldPct)}</span>
                </strong>
                <span className="price-unit">
                  {vsBtc.side === "buy"
                    ? "Posição líquida comprada · lucro/prejuízo vs custo"
                    : vsBtc.side === "sell"
                      ? "Posição líquida vendida · vs ter segurado o BTC"
                      : "Volume equilibrado · usa VWAP misto"}
                </span>
              </div>
              <div className="stat">
                <strong>{formatPrice(vsBtc.reference)}</strong>
                <span>
                  seu preço (
                  {vsBtc.side === "buy"
                    ? "compras"
                    : vsBtc.side === "sell"
                      ? "vendas"
                      : "VWAP"}
                  )
                </span>
              </div>
              <div className="stat">
                <strong>{formatPrice(btc.price)}</strong>
                <span>BTC agora</span>
              </div>
              <div className="stat">
                <strong className={amountClass(vsBtc.spotVsMePct)}>
                  {formatPct(vsBtc.spotVsMePct)}
                </strong>
                <span>spot vs seu preço</span>
              </div>
              <div className="stat">
                <strong className="mono-stat">
                  {formatPrice(Math.abs(btc.price - vsBtc.reference))}
                </strong>
                <span>diferença USDT</span>
              </div>
              <div className="stat">
                <strong className="file-hint" style={{ fontSize: "0.85rem" }}>
                  {btc.source}
                </strong>
                <span>
                  atualiza ~30s
                  {btcError ? ` · ${btcError}` : ""}
                </span>
              </div>
            </div>
          )}

          {!vsBtc && avgPrice.pricedCount > 0 && (
            <p className="file-hint" style={{ margin: "0 0 12px" }}>
              {btcLoading
                ? "Buscando cotação atual do BTC…"
                : btcError
                  ? `Não deu para buscar BTC: ${btcError}`
                  : "Sem cotação BTC para comparar."}
            </p>
          )}

          {buyBuckets.length > 0 ? (
            <BuyVolumeChart buckets={buyBuckets} spot={btc?.price ?? null} />
          ) : (
            avgPrice.pricedCount > 0 && (
              <p className="file-hint" style={{ margin: "0 0 16px" }}>
                Nenhuma compra de L-BTC nas selecionadas para o gráfico (só
                entram swaps em que você recebeu L-BTC).
              </p>
            )
          )}

          <div className="price-grid">
            <div className="price-main">
              <span className="price-label">Preço médio (VWAP)</span>
              <strong className="price-value">
                {avgPrice.vwap !== null
                  ? `${formatPrice(avgPrice.vwap)} USDT`
                  : "—"}
              </strong>
              <span className="price-unit">por 1 L-BTC · Σ|USDT| ÷ Σ|L-BTC|</span>
            </div>
            <div className="stat">
              <strong>
                {avgPrice.buyVwap !== null
                  ? formatPrice(avgPrice.buyVwap)
                  : "—"}
              </strong>
              <span>VWAP compras</span>
            </div>
            <div className="stat">
              <strong>
                {avgPrice.sellVwap !== null
                  ? formatPrice(avgPrice.sellVwap)
                  : "—"}
              </strong>
              <span>VWAP vendas</span>
            </div>
            <div className="stat">
              <strong>
                {avgPrice.min !== null && avgPrice.max !== null
                  ? `${formatPrice(avgPrice.min)} – ${formatPrice(avgPrice.max)}`
                  : "—"}
              </strong>
              <span>min – max</span>
            </div>
            <div className="stat">
              <strong>{avgPrice.pricedCount}</strong>
              <span>
                swaps com preço
                {avgPrice.skippedCount > 0
                  ? ` · ${avgPrice.skippedCount} ignorada${avgPrice.skippedCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            </div>
            <div className="stat">
              <strong className="mono-stat">
                {avgPrice.totalLbtc > 0
                  ? formatAmount(avgPrice.totalLbtc)
                  : "—"}
              </strong>
              <span>L-BTC no volume</span>
            </div>
            <div className="stat">
              <strong className="mono-stat">
                {avgPrice.soldLbtc > 0 ? formatAmount(avgPrice.soldLbtc) : "—"}
              </strong>
              <span>L-BTC vendido</span>
            </div>
            <div className="stat">
              <strong className="mono-stat">
                {avgPrice.boughtLbtc > 0
                  ? formatAmount(avgPrice.boughtLbtc)
                  : "—"}
              </strong>
              <span>L-BTC comprado</span>
            </div>
          </div>
          {avgPrice.pricedCount === 0 && (
            <p className="file-hint" style={{ margin: "12px 0 0" }}>
              Só entram Swaps com L-BTC e USDT em sentidos opostos (mín.
              0,00001 L-BTC e 1 USDT). Received/Sent e dust não entram no
              preço.
            </p>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="empty">Carregando CSV…</p>}

      {!loading && !error && (
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <p className="empty">Nenhuma transação neste filtro.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFiltered}
                      aria-label="Selecionar todas filtradas"
                    />
                  </th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>TX</th>
                  <th className="num">Preço</th>
                  <th className="num">L-BTC</th>
                  <th className="num">USDT</th>
                  <th className="num">BRX</th>
                  <th className="num">Pix</th>
                  <th className="num">Fee</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isSel = selected.has(tx.txid);
                  const price = txUsdtPerLbtc(tx);
                  return (
                    <tr key={tx.txid} className={isSel ? "selected" : undefined}>
                      <td className="check-col">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleOne(tx.txid)}
                          aria-label={`Selecionar ${shortTx(tx.txid)}`}
                        />
                      </td>
                      <td className="mono">{tx.timestamp}</td>
                      <td>
                        <span className={typeBadge(tx.type)}>{tx.type}</span>
                      </td>
                      <td>
                        <div className="txid">
                          <span className="txid-hash" title={tx.txid}>
                            {shortTx(tx.txid)}
                          </span>
                          <div className="txid-links">
                            <a
                              href={blockstreamTxUrl(tx.txid)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Blockstream
                            </a>
                            <a
                              href={liquidScanTxUrl(tx.txid)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Liquid.network
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="amount-cell">
                        {price !== null ? (
                          <span title="USDT por 1 L-BTC">{formatPrice(price)}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className={`amount-cell ${amountClass(tx.liquidBitcoin)}`}>
                        {formatAmount(tx.liquidBitcoin)}
                      </td>
                      <td className={`amount-cell ${amountClass(tx.tetherUsd)}`}>
                        {formatAmount(tx.tetherUsd, 8)}
                      </td>
                      <td className={`amount-cell ${amountClass(tx.brxAsset)}`}>
                        {formatAmount(tx.brxAsset, 2)}
                      </td>
                      <td
                        className={`amount-cell ${amountClass(tx.decentralizedPix)}`}
                      >
                        {formatAmount(tx.decentralizedPix)}
                      </td>
                      <td className="amount-cell muted">
                        {formatFee(tx.networkFee)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
