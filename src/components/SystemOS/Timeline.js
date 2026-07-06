import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { detectLocale, t } from "./i18n";
import "./Timeline.css";

// Timeline interativa ano-a-ano para /system.
// Busca GET /portfolio_context.json (arquivo estático, mesma fonte usada pelo terminal/IA)
// e lê `data[locale].timeline`: [{ year, title, description, tags[] }].
// Ordena ascendente por year. Cada entrada começa colapsada e expande no clique.
// Array vazio -> estado vazio amigável, nunca crash.

function sortByYearAsc(entries) {
  return [...entries].sort((a, b) => {
    const ay = parseInt(a.year, 10);
    const by = parseInt(b.year, 10);
    if (Number.isNaN(ay) || Number.isNaN(by)) {
      return String(a.year).localeCompare(String(b.year));
    }
    return ay - by;
  });
}

function TimelineEntry({ entry, isOpen, onToggle }) {
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  return (
    <li className="timeline-entry">
      <button
        type="button"
        className="timeline-entry-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="timeline-entry-year">{entry.year}</span>
        <span className="timeline-entry-title">{entry.title}</span>
        <span className={`timeline-entry-chevron ${isOpen ? "timeline-entry-chevron-open" : ""}`}>
          ▸
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="timeline-entry-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <p className="timeline-entry-description">{entry.description}</p>
            {tags.length > 0 && (
              <ul className="timeline-entry-tags">
                {tags.map((tag) => (
                  <li key={tag} className="timeline-entry-tag">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Timeline() {
  const locale = useMemo(() => detectLocale(), []);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      try {
        const res = await fetch("/portfolio_context.json");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        const block = data && typeof data[locale] === "object" ? data[locale] : null;
        const timeline = Array.isArray(block && block.timeline) ? block.timeline : [];
        if (!cancelled) {
          setEntries(sortByYearAsc(timeline));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setErrored(true);
          setLoading(false);
        }
      }
    }

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  function toggleEntry(key) {
    setOpenKey((prev) => (prev === key ? null : key));
  }

  return (
    <section className="timeline-panel" aria-label="Timeline">
      {loading && <p className="timeline-status">{t(locale, "timeline.loading")}</p>}

      {!loading && errored && <p className="timeline-status">{t(locale, "timeline.error")}</p>}

      {!loading && !errored && entries.length === 0 && (
        <p className="timeline-status timeline-status-empty">{t(locale, "timeline.empty")}</p>
      )}

      {!loading && !errored && entries.length > 0 && (
        <ul className="timeline-list">
          {entries.map((entry, index) => {
            const key = `${entry.year}-${entry.title}-${index}`;
            return (
              <TimelineEntry
                key={key}
                entry={entry}
                isOpen={openKey === key}
                onToggle={() => toggleEntry(key)}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default Timeline;
