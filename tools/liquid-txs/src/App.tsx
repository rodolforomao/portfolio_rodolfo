import { useEffect, useMemo, useState, type FocusEvent, type MouseEvent } from "react";
import { fetchBtcSpot, type SpotQuote } from "./btcPrice";
import BuyVolumeChart from "./BuyVolumeChart";
import PotsPanel from "./PotsPanel";
import {
  avgPriceFromTxs,
  blockstreamTxUrl,
  buyVolumeByPriceBucket,
  compareToBtcSpot,
  formatAmount,
  formatDateGroupLabel,
  formatDateTime,
  formatFee,
  formatPct,
  formatPrice,
  liquidScanTxUrl,
  parseCsv,
  toDateKey,
  txUsdtPerLbtc,
  type LiquidTx,
} from "./csv";
import {
  createWallet,
  findMatchingWallet,
  loadWalletTxs,
  loadWallets,
  renameWallet,
  updateWalletImport,
  type Wallet,
} from "./wallets";

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

function openDatePicker(e: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  try {
    el.showPicker?.();
  } catch {
    /* iframe / browser sem suporte — o clique nativo ainda tenta abrir */
  }
}

export default function App() {
  const [txs, setTxs] = useState<LiquidTx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [btc, setBtc] = useState<SpotQuote | null>(null);
  const [btcError, setBtcError] = useState<string | null>(null);
  const [btcLoading, setBtcLoading] = useState(true);

  const [wallets, setWallets] = useState<Wallet[]>(() => loadWallets());
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  const activeWallet = useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? null,
    [wallets, activeWalletId]
  );

  /** Detecta a carteira pelo overlap de txids; se não achar, pede um nome (nova carteira). */
  function resolveWalletForImport(parsed: LiquidTx[]): Wallet {
    const match = findMatchingWallet(parsed);
    if (match) {
      const updated = updateWalletImport(match.id, parsed);
      setWallets(loadWallets());
      return updated;
    }
    const name =
      window.prompt(
        "Não reconheci essa carteira pelas transações. Como quer chamá-la?",
        wallets.length === 0 ? "Carteira 1" : ""
      ) || "";
    const created = createWallet(name, parsed);
    setWallets(loadWallets());
    return created;
  }

  function renameActiveWallet() {
    if (!activeWallet) return;
    const name = window.prompt("Novo nome para a carteira:", activeWallet.name);
    if (!name || !name.trim() || name.trim() === activeWallet.name) return;
    renameWallet(activeWallet.id, name);
    setWallets(loadWallets());
  }

  function switchWallet(id: string) {
    const cached = loadWalletTxs(id);
    setActiveWalletId(id);
    const sorted = [...cached].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setTxs(sorted);
    setSelected(new Set());
    setOnlySelected(false);
    if (sorted.length) {
      setDateRange(
        toDateKey(sorted[sorted.length - 1].timestamp),
        toDateKey(sorted[0].timestamp),
        true
      );
    }
  }

  function setDateRange(from: string, to: string, apply = true) {
    setDateFrom(from);
    setDateTo(to);
    if (apply) {
      setAppliedFrom(from);
      setAppliedTo(to);
    }
  }

  function applyDateFilter() {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  }

  const dateFilterPending =
    dateFrom !== appliedFrom || dateTo !== appliedTo;

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
        const wallet = resolveWalletForImport(parsed);
        if (cancelled) return;
        setActiveWalletId(wallet.id);
        setTxs(parsed);
        if (parsed.length) {
          setDateRange(
            toDateKey(parsed[parsed.length - 1].timestamp),
            toDateKey(parsed[0].timestamp),
            true
          );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (appliedFrom && day < appliedFrom) return false;
      if (appliedTo && day > appliedTo) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      if (onlySelected && !selected.has(tx.txid)) return false;
      if (q) {
        const hay = `${tx.txid} ${tx.type} ${tx.memo}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txs, appliedFrom, appliedTo, typeFilter, query, onlySelected, selected]);

  /** Dias mais recentes com transações, priorizando os que tiveram mais atividade (repetidos). */
  const recentDateShortcuts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of txs) {
      const key = toDateKey(tx.timestamp);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14)
      .map(([dateKey, count]) => ({ dateKey, count }));
  }, [txs]);

  const isSingleDayFilter = appliedFrom !== "" && appliedFrom === appliedTo;

  function applyDayShortcut(dateKey: string) {
    setDateRange(dateKey, dateKey, true);
  }

  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; txs: LiquidTx[] }[] = [];
    for (const tx of filtered) {
      const dateKey = toDateKey(tx.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.dateKey === dateKey) last.txs.push(tx);
      else groups.push({ dateKey, txs: [tx] });
    }
    return groups;
  }, [filtered]);

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
      const wallet = resolveWalletForImport(parsed);
      setActiveWalletId(wallet.id);
      setTxs(parsed);
      setSelected(new Set());
      setOnlySelected(false);
      if (parsed.length) {
        setDateRange(
          toDateKey(parsed[parsed.length - 1].timestamp),
          toDateKey(parsed[0].timestamp),
          true
        );
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

      {wallets.length > 0 && (
        <div className="wallet-bar">
          <div className="wallet-bar-select">
            <div className="field">
              <label htmlFor="wallet">Carteira</label>
              <select
                id="wallet"
                value={activeWalletId ?? ""}
                onChange={(e) => switchWallet(e.target.value)}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.txCount} tx)
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn"
              onClick={renameActiveWallet}
              disabled={!activeWallet}
              title="Renomear esta carteira"
            >
              ✏️ Renomear carteira
            </button>
          </div>
          <p className="file-hint">
            Detectada automaticamente pelas transações do CSV. Cada carteira
            guarda seus próprios potes e histórico.
            {activeWallet
              ? ` Última importação: ${formatDateTime(activeWallet.lastImportedAt)}.`
              : ""}
          </p>
        </div>
      )}

      <section className="panel">
        <div className="filters">
          <div className="field">
            <label htmlFor="from">De</label>
            <input
              id="from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyDateFilter();
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="to">Até</label>
            <input
              id="to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={openDatePicker}
              onFocus={openDatePicker}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyDateFilter();
              }}
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
              className={`btn btn-primary${dateFilterPending ? " btn-pulse" : ""}`}
              onClick={applyDateFilter}
              title="Aplica as datas De/Até na lista"
            >
              Aplicar filtro
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (txs.length) {
                  setDateRange(
                    toDateKey(txs[txs.length - 1].timestamp),
                    toDateKey(txs[0].timestamp),
                    true
                  );
                } else {
                  setDateRange("", "", true);
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

      {recentDateShortcuts.length > 0 && (
        <section className="panel date-shortcuts">
          <p className="file-hint" style={{ margin: "0 0 10px" }}>
            Dias mais recentes (repetidos = mais transações). Clique para
            filtrar só aquele dia.
          </p>
          <div className="date-shortcuts-list">
            {recentDateShortcuts.map(({ dateKey, count }) => (
              <button
                key={dateKey}
                type="button"
                className={`date-chip${count > 1 ? " date-chip--busy" : ""}${
                  isSingleDayFilter && appliedFrom === dateKey ? " date-chip--active" : ""
                }`}
                onClick={() => applyDayShortcut(dateKey)}
                title={`Filtrar ${dateKey} (${count} transaç${count === 1 ? "ão" : "ões"})`}
              >
                {dateKey}
                <span className="date-chip-count">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

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

      <PotsPanel
        selectedTxs={selectedTxs}
        spot={btc?.price ?? null}
        walletId={activeWalletId}
        walletName={activeWallet?.name ?? null}
        walletTxs={txs}
      />

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
              {groupedByDate.map((group) => (
              <tbody key={group.dateKey}>
                <tr className="date-group-row">
                  <td colSpan={10}>
                    {formatDateGroupLabel(group.dateKey)}
                    <span className="date-group-count">
                      {group.txs.length} transaç{group.txs.length === 1 ? "ão" : "ões"}
                    </span>
                  </td>
                </tr>
                {group.txs.map((tx) => {
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
              ))}
            </table>
          )}
        </div>
      )}
    </div>
  );
}
