import React, { useEffect, useMemo, useRef, useState } from "react";
import { detectLocale, t } from "./i18n";
import "./StatsPanel.css";

// Painel de estatísticas animadas para /system.
// Busca GET /api/portfolio/stats (mesma origem) e anima cada tile de 0 até o valor final.
// Contrato de resposta (fixo, definido no ROADMAP.md):
// { years_coding, systems_delivered, languages, github_public_repos, github_followers, uptime_seconds }
// Campos null (ex: github_* quando a API do GitHub está fora do ar) renderizam "—".
// Falha de fetch/status não-2xx nunca deve derrubar o componente — cai num estado de placeholder.
// Labels vêm do dicionário i18n (pt-br/en/es/fr, detectado do navegador).

const STAT_KEYS = [
  "years_coding",
  "systems_delivered",
  "languages",
  "github_public_repos",
  "github_followers",
  "uptime_seconds",
];

const ANIMATION_MS = 1200;

function formatValue(n) {
  if (n === null || n === undefined) return "—";
  try {
    return Math.round(n).toLocaleString("pt-BR");
  } catch (e) {
    return String(Math.round(n));
  }
}

// Um tile individual: anima de 0 até `value` via requestAnimationFrame (sem libs extras).
function StatTile({ label, value, loading }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (loading) return undefined;
    if (value === null || value === undefined) {
      setDisplay(null);
      return undefined;
    }

    const target = Number(value) || 0;
    const start = performance.now();
    const from = 0;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / ANIMATION_MS, 1);
      // ease-out cúbico pra desacelerar perto do final
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, loading]);

  const isDash = !loading && (value === null || value === undefined);

  return (
    <div className="stats-tile">
      <div className="stats-tile-value">
        {loading ? (
          <span className="stats-tile-placeholder">—</span>
        ) : isDash ? (
          <span className="stats-tile-placeholder">—</span>
        ) : (
          formatValue(display)
        )}
      </div>
      <div className="stats-tile-label">{label}</div>
    </div>
  );
}

function StatsPanel() {
  const locale = useMemo(() => detectLocale(), []);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const res = await fetch("/api/portfolio/stats");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setErrored(true);
          setLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="stats-panel" aria-label="Stats">
      <div className="stats-panel-grid">
        {STAT_KEYS.map((key) => {
          const value = stats ? stats[key] : undefined;
          return (
            <StatTile
              key={key}
              label={t(locale, `stats.${key}`)}
              value={loading || errored ? (loading ? undefined : null) : value}
              loading={loading}
            />
          );
        })}
      </div>
      {errored && <p className="stats-panel-note">{t(locale, "stats.error")}</p>}
    </section>
  );
}

export default StatsPanel;
