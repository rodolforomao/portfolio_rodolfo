import React, { useMemo } from "react";
import { motion } from "framer-motion";
import ArchitectureFlow from "./ArchitectureFlow";
import ProjectsLive from "./ProjectsLive";
import { detectLocale, t } from "./i18n";
import "./Lab.css";

// Container do "Lab" para /system.
// Agrupa ArchitectureFlow + ProjectsLive sob um único wrapper, pra o orquestrador poder
// dropar apenas <Lab /> em SystemOS.js. Textos vêm do dicionário i18n (pt-br/en/es/fr).

function Lab() {
  const locale = useMemo(() => detectLocale(), []);

  return (
    <section className="lab-section" aria-label="Lab">
      <motion.div
        className="lab-heading-row"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className="lab-heading-eyebrow">lab.mount()</p>
        <h2 className="lab-heading">{t(locale, "lab.heading")}</h2>
        <p className="lab-heading-subtitle">{t(locale, "lab.subtitle")}</p>
      </motion.div>

      <div className="lab-block">
        <ArchitectureFlow />
      </div>

      <div className="lab-block">
        <ProjectsLive />
      </div>
    </section>
  );
}

export default Lab;
