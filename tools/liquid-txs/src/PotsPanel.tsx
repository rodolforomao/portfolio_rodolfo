import { useEffect, useMemo, useState } from "react";
import {
  formatAmount,
  formatDateTime,
  formatPct,
  formatPrice,
  type LiquidTx,
} from "./csv";
import {
  buildPotFromSelection,
  createPotRemote,
  deletePotRemote,
  fetchPotsState,
  loadLocalPots,
  newLocalId,
  potPnl,
  realizePotRemote,
  saveLocalPots,
  syncPotsWithWallet,
  syncPotsRemote,
  type LiquidPot,
} from "./pots";

type Props = {
  selectedTxs: LiquidTx[];
  spot: number | null;
  walletId: string | null;
  walletName: string | null;
  walletTxs: LiquidTx[];
};

export default function PotsPanel({
  selectedTxs,
  spot,
  walletId,
  walletName,
  walletTxs,
}: Props) {
  const [pots, setPots] = useState<LiquidPot[]>(() => loadLocalPots());
  const [label, setLabel] = useState("");
  const [apiOnline, setApiOnline] = useState(false);
  const [tgConfigured, setTgConfigured] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    saveLocalPots(pots);
  }, [pots]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchPotsState();
      if (cancelled) return;
      if (res.ok) {
        setApiOnline(true);
        setPots(res.data.pots || []);
        setTgConfigured(Boolean(res.data.telegram?.configured));
      } else {
        setApiOnline(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-sync this wallet's pots whenever a (re)import refreshes its tx list.
  // Always sync against a freshly-fetched server snapshot (never the local `pots`
  // closure) — PUT replaces the whole remote list, so syncing against a stale/local
  // copy here would silently wipe out pots created elsewhere (other tab, other device,
  // or just moments earlier in this same tab, since effect deps don't include `pots`).
  useEffect(() => {
    if (!walletId || walletTxs.length === 0) return;
    let cancelled = false;
    (async () => {
      const fresh = await fetchPotsState();
      if (cancelled) return;
      if (!fresh.ok) return; // offline — don't sync/overwrite against a guess
      const basePots = fresh.data.pots || [];
      const result = syncPotsWithWallet(basePots, walletId, walletTxs);
      // Só toca no estado local quando há algo de fato para atualizar — evita
      // sobrescrever um pote local recém-criado (ex.: fallback offline) que ainda
      // não tenha chegado ao servidor no momento deste fetch.
      if (result.changed) {
        setPots(result.pots);
        const remote = await syncPotsRemote(result.pots);
        if (!cancelled && remote.ok) setApiOnline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, walletTxs]);

  const walletPots = useMemo(
    () => pots.filter((p) => !p.walletId || p.walletId === walletId),
    [pots, walletId]
  );

  const activeCount = useMemo(
    () => walletPots.filter((p) => !p.realizedAt).length,
    [walletPots]
  );

  async function createPot() {
    const name = label.trim();
    if (!name) {
      setMsg("Informe um label para o pote.");
      return;
    }
    if (selectedTxs.length === 0) {
      setMsg("Selecione ao menos uma transação de liquidação.");
      return;
    }
    const draft = buildPotFromSelection(
      name,
      selectedTxs,
      walletId ? { id: walletId, name: walletName || "Carteira" } : null
    );
    if (!draft) {
      setMsg("Não foi possível calcular preço médio das txs selecionadas.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const remote = await createPotRemote({ ...draft, label: name });
      if (remote.ok) {
        setApiOnline(true);
        setPots(remote.data.pots || []);
        setTgConfigured(Boolean(remote.data.telegram?.configured));
        setLabel("");
        setMsg(
          tgConfigured || remote.data.telegram?.configured
            ? `Pote "${name}" criado e salvo — alertas ±0,5% e ±1% ativos.`
            : `Pote "${name}" criado e salvo. Para receber alertas, configure o Telegram em Menu → Settings.`
        );
      } else {
        const pot: LiquidPot = {
          ...draft,
          id: newLocalId(),
          createdAt: new Date().toISOString(),
          realizedAt: null,
        };
        setPots((prev) => [pot, ...prev]);
        setLabel("");
        setMsg(
          `Pote "${name}" salvo localmente (API offline: ${remote.error}).`
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function realize(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const remote = await realizePotRemote(id, true, spot);
      if (remote.ok) {
        setPots(remote.data.pots || []);
        setMsg("Realização marcada — alertas desligados para este pote.");
      } else {
        setPots((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p;
            const pnl = spot != null ? potPnl(p, spot) : null;
            return {
              ...p,
              realizedAt: new Date().toISOString(),
              realizedValue:
                pnl && spot != null
                  ? {
                      spot,
                      avgPrice: p.avgPrice,
                      usdtPnl: pnl.usdtPnl,
                      vsHoldPct: pnl.vsHoldPct,
                      spotVsMePct: pnl.spotVsMePct,
                    }
                  : null,
            };
          })
        );
        setMsg("Realização salva localmente (API offline).");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reopen(id: string) {
    setBusy(true);
    try {
      const remote = await realizePotRemote(id, false);
      if (remote.ok) setPots(remote.data.pots || []);
      else {
        setPots((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, realizedAt: null, realizedValue: null, firedLevels: {} }
              : p
          )
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este pote?")) return;
    setBusy(true);
    try {
      const remote = await deletePotRemote(id);
      if (remote.ok) setPots(remote.data.pots || []);
      else setPots((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel pots-panel">
      <div className="pots-head">
        <div>
          <h2 className="panel-title">Potes de liquidação</h2>
          <p className="file-hint" style={{ margin: "4px 0 0" }}>
            Agrupe txs com um label. Alertas ±0,5% / ±1%. Realização desliga
            alertas.{" "}
            <span className={apiOnline ? "pos" : "neg"}>
              {apiOnline ? "API online" : "API offline"}
            </span>
            {activeCount > 0 ? ` · ${activeCount} ativo(s)` : ""}
            {" · Telegram: "}
            <span className={tgConfigured ? "pos" : "neg"}>
              {tgConfigured ? "ok" : "não configurado"}
            </span>
            {" — "}
            <a href="/dealer/settings" target="_top" rel="noopener">
              Menu → Settings
            </a>
          </p>
        </div>
      </div>

      <div className="pots-create">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="pot-label">Label do pote</label>
          <input
            id="pot-label"
            type="text"
            placeholder="ex.: Liquidação jan/26"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createPot();
            }}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || selectedTxs.length === 0}
          onClick={() => void createPot()}
          title="Usa as transações atualmente selecionadas"
        >
          Criar pote ({selectedTxs.length})
        </button>
      </div>

      {msg && <p className="pots-msg">{msg}</p>}

      {walletPots.length === 0 ? (
        <p className="empty">
          Nenhum pote {walletName ? `para "${walletName}"` : "ainda"}.
          Selecione txs e crie um.
        </p>
      ) : (
        <div className="pots-list">
          {walletPots.map((pot) => {
            const realized = Boolean(pot.realizedAt);
            const livePnl = spot != null ? potPnl(pot, spot) : null;
            const pnl = realized
              ? pot.realizedValue
                ? {
                    vsHoldPct: pot.realizedValue.vsHoldPct,
                    usdtPnl: pot.realizedValue.usdtPnl,
                  }
                : null
              : livePnl;
            const missingCount = pot.txSummaries.filter((t) => t.missing).length;
            return (
              <article
                key={pot.id}
                className={`pot-card${realized ? " pot-card--done" : ""}`}
              >
                <div className="pot-card-top">
                  <div>
                    <strong className="pot-label">{pot.label}</strong>
                    <div className="file-hint">
                      {pot.txids.length} tx · lado{" "}
                      {pot.side === "buy"
                        ? "compra"
                        : pot.side === "sell"
                          ? "venda"
                          : "misto"}{" "}
                      · médio {formatPrice(pot.avgPrice)}
                      {realized && pot.realizedAt
                        ? ` · realizado em ${formatDateTime(pot.realizedAt)}`
                        : " · ativo"}
                      {realized && pot.realizedValue
                        ? ` · spot na realização ${formatPrice(pot.realizedValue.spot)}`
                        : ""}
                    </div>
                    {missingCount > 0 && (
                      <div className="pot-missing-badge">
                        ⚠ {missingCount} tx não encontrada
                        {missingCount === 1 ? "" : "s"} na última importação
                        {walletName ? ` de "${walletName}"` : ""}
                      </div>
                    )}
                  </div>
                  <div className="actions">
                    {!realized ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void realize(pot.id)}
                      >
                        Realizar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => void reopen(pot.id)}
                      >
                        Reabrir
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void remove(pot.id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <div className="pot-stats">
                  <div className="stat">
                    <strong>{formatAmount(pot.totalLbtc)}</strong>
                    <span>L-BTC</span>
                  </div>
                  <div className="stat">
                    <strong>
                      {pnl ? formatPct(pnl.vsHoldPct) : "—"}
                    </strong>
                    <span>vs spot</span>
                  </div>
                  <div className="stat">
                    <strong className={pnl && pnl.usdtPnl >= 0 ? "pos" : "neg"}>
                      {pnl ? `$${pnl.usdtPnl.toFixed(2)}` : "—"}
                    </strong>
                    <span>ganho/perda</span>
                  </div>
                  <div className="stat">
                    <strong>
                      {realized
                        ? pot.realizedValue
                          ? formatPrice(pot.realizedValue.spot)
                          : "—"
                        : spot != null
                          ? formatPrice(spot)
                          : "—"}
                    </strong>
                    <span>{realized ? "spot na realização" : "spot"}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
