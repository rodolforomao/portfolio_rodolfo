import React, { useCallback, useEffect, useMemo, useState } from "react";
import { detectLocale, t } from "./i18n";
import "./DeveloperMode.css";

// Overlay oculto de "Developer Mode" para /system.
// Toggle via Ctrl+Shift+D (também fecha com Escape ou botão de fechar).
// Mostra:
//   - Info client-side, lida direto do window.performance/navigator do visitante (nunca lança
//     exceção se a API não existir no browser).
//   - Info server-side de GET /api/portfolio/dev-metrics (uptime, request_count, github stats),
//     com estados de loading/erro que nunca derrubam o componente.
// Autocontido: gerencia seu próprio open/closed, não afeta layout da página quando fechado.

function readClientPerf() {
  const result = {
    pageLoadMs: null,
    resourceCount: null,
    userAgent: null,
  };

  try {
    if (typeof navigator !== "undefined" && navigator.userAgent) {
      result.userAgent = navigator.userAgent;
    }
  } catch (e) {
    // ignora — nunca deve quebrar o overlay
  }

  try {
    if (typeof performance !== "undefined") {
      if (typeof performance.getEntriesByType === "function") {
        const navEntries = performance.getEntriesByType("navigation");
        if (navEntries && navEntries.length > 0 && navEntries[0].loadEventEnd > 0) {
          result.pageLoadMs = Math.round(navEntries[0].loadEventEnd);
        }

        const resourceEntries = performance.getEntriesByType("resource");
        if (resourceEntries) {
          result.resourceCount = resourceEntries.length;
        }
      }

      if (result.pageLoadMs === null && performance.timing) {
        const t = performance.timing;
        if (t.loadEventEnd > 0 && t.navigationStart > 0) {
          result.pageLoadMs = t.loadEventEnd - t.navigationStart;
        }
      }
    }
  } catch (e) {
    // ignora — API indisponível/incompleta, mantém defaults null
  }

  return result;
}

function DeveloperMode() {
  const locale = useMemo(() => detectLocale(), []);
  const [open, setOpen] = useState(false);
  const [clientPerf, setClientPerf] = useState(null);
  const [serverMetrics, setServerMetrics] = useState(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (event.key === "Escape") {
        setOpen((prev) => (prev ? false : prev));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    setClientPerf(readClientPerf());

    let cancelled = false;
    setLoadingServer(true);
    setServerError(false);

    async function loadServerMetrics() {
      try {
        const res = await fetch("/api/portfolio/dev-metrics");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setServerMetrics(data);
          setLoadingServer(false);
        }
      } catch (err) {
        if (!cancelled) {
          setServerError(true);
          setLoadingServer(false);
        }
      }
    }

    loadServerMetrics();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="devmode-overlay" role="dialog" aria-label="Developer Mode">
      <div className="devmode-panel">
        <div className="devmode-header">
          <span className="devmode-title">
            <span className="devmode-dot" /> DEVELOPER MODE
          </span>
          <button
            type="button"
            className="devmode-close"
            onClick={close}
            aria-label="Fechar Developer Mode"
          >
            [x]
          </button>
        </div>

        <div className="devmode-body">
          <section className="devmode-section">
            <h3 className="devmode-section-title">client // performance</h3>
            <dl className="devmode-kv">
              <dt>page load</dt>
              <dd>{clientPerf && clientPerf.pageLoadMs !== null ? `${clientPerf.pageLoadMs} ms` : "—"}</dd>

              <dt>resources loaded</dt>
              <dd>{clientPerf && clientPerf.resourceCount !== null ? clientPerf.resourceCount : "—"}</dd>

              <dt>user agent</dt>
              <dd className="devmode-kv-wrap">{(clientPerf && clientPerf.userAgent) || "—"}</dd>
            </dl>
          </section>

          <section className="devmode-section">
            <h3 className="devmode-section-title">server // portfolio_api</h3>
            {loadingServer ? (
              <p className="devmode-note">{t(locale, "devmode.loadingServer")}</p>
            ) : serverError || !serverMetrics ? (
              <p className="devmode-note devmode-note-error">{t(locale, "devmode.serverError")}</p>
            ) : (
              <dl className="devmode-kv">
                <dt>uptime</dt>
                <dd>{serverMetrics.uptime_seconds ?? "—"}s</dd>

                <dt>request count</dt>
                <dd>{serverMetrics.request_count ?? "—"}</dd>

                <dt>github public repos</dt>
                <dd>{serverMetrics.github_public_repos ?? "—"}</dd>

                <dt>github followers</dt>
                <dd>{serverMetrics.github_followers ?? "—"}</dd>
              </dl>
            )}
          </section>

          <p className="devmode-hint">{t(locale, "devmode.closeHint")}</p>
        </div>
      </div>
    </div>
  );
}

export default DeveloperMode;
