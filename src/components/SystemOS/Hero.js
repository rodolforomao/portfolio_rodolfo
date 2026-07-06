import React, { useEffect, useMemo, useState } from "react";
import Particles from "react-tsparticles";
import { motion, AnimatePresence } from "framer-motion";
import { detectLocale, t } from "./i18n";
import { getActiveTheme } from "./seasonalTheme";
import "./Hero.css";

// Hero animado da seção /system (Web OS).
// Busca public/portfolio_context.json em runtime, lendo o bloco do idioma detectado do
// navegador (pt-br/en/es/fr, default en); nunca lança/derruba a UI se falhar.
// Tema sazonal (opcional, neutro/não-controverso): ver ./seasonalTheme.

const DEFAULT_CONTEXT = {
  name: "Rodolfo Romão",
  title: "Senior Full Stack Developer",
  roles: ["Computer Engineer", "Blockchain Engineer", "AI Engineer", "Full Stack Developer"],
};

const ROLE_INTERVAL_MS = 2600;

function buildParticlesOptions(accent) {
  return {
    fullScreen: { enable: false },
    background: { color: "transparent" },
    particles: {
      number: {
        value: 70,
        density: { enable: true, value_area: 900 },
      },
      color: { value: accent },
      shape: { type: "circle" },
      opacity: {
        value: 0.35,
        anim: { enable: true, speed: 0.4, opacity_min: 0.08 },
      },
      size: { value: 2, random: true },
      line_linked: {
        enable: true,
        distance: 140,
        color: accent,
        opacity: 0.15,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.6,
        direction: "none",
        random: true,
        straight: false,
        out_mode: "out",
      },
    },
    interactivity: {
      events: {
        onhover: { enable: true, mode: "grab" },
        onclick: { enable: false },
        resize: true,
      },
      modes: {
        grab: {
          distance: 160,
          line_linked: { opacity: 0.3 },
        },
      },
    },
    retina_detect: true,
  };
}

function mergeHeroContext(data, locale) {
  const block = data && typeof data[locale] === "object" && data[locale] !== null ? data[locale] : {};
  const name =
    data && typeof data.name === "string" && data.name.trim() ? data.name : DEFAULT_CONTEXT.name;
  const title =
    typeof block.title === "string" && block.title.trim() ? block.title : DEFAULT_CONTEXT.title;
  const roles =
    Array.isArray(block.roles) && block.roles.length
      ? block.roles.filter((role) => typeof role === "string" && role.trim())
      : DEFAULT_CONTEXT.roles;

  return {
    name,
    title,
    roles: roles.length ? roles : DEFAULT_CONTEXT.roles,
  };
}

function Hero() {
  const locale = useMemo(() => detectLocale(), []);
  const theme = useMemo(() => getActiveTheme(), []);
  const accent = theme ? theme.accent : "#3ddc84";
  const heroParticlesOptions = useMemo(() => buildParticlesOptions(accent), [accent]);

  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch("/portfolio_context.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`unexpected status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setContext(mergeHeroContext(data, locale));
        }
      })
      .catch(() => {
        // Fetch falhou ou JSON inválido: mantém os defaults, nunca quebra a UI.
        if (!cancelled) {
          setContext(DEFAULT_CONTEXT);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    if (context.roles.length <= 1) {
      return undefined;
    }

    const timer = setInterval(() => {
      setRoleIndex((prev) => (prev + 1) % context.roles.length);
    }, ROLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [context.roles]);

  const currentRole = context.roles[roleIndex % context.roles.length];

  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <section className="hero-section">
      <div className="hero-particles" aria-hidden="true">
        <Particles id="hero-tsparticles" params={heroParticlesOptions} />
      </div>

      <div className="hero-scanline" aria-hidden="true" />

      <motion.div
        className="hero-content"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.16 } },
        }}
      >
        <motion.p
          className="hero-eyebrow"
          variants={{ hidden: { opacity: 0, y: -8 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.5 }}
        >
          system.boot() // portfolio-os
        </motion.p>

        {theme && (
          <motion.p
            className="hero-seasonal-badge"
            variants={{ hidden: { opacity: 0, y: -8 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5 }}
            style={{ color: theme.accent2 }}
          >
            {theme.badge[locale] || theme.badge.en}
          </motion.p>
        )}

        <motion.h1
          className="hero-name"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
        >
          {context.name}
        </motion.h1>

        <motion.h2
          className="hero-title"
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.05 }}
        >
          {context.title}
        </motion.h2>

        <div className="hero-role-row">
          <span className="hero-role-caret" aria-hidden="true">
            &gt;
          </span>
          <AnimatePresence exitBeforeEnter>
            <motion.span
              key={currentRole}
              className="hero-role-text"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              {currentRole}
            </motion.span>
          </AnimatePresence>
          <span className="hero-role-cursor" aria-hidden="true" />
        </div>

        <motion.div
          className="hero-hint"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {t(locale, "hero.hint")}: <code>help</code>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default Hero;
