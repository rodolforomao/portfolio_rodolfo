import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { detectLocale, t } from "./i18n";
import "./ArchitectureFlow.css";

// Diagrama de arquitetura genérico e ilustrativo para /system.
// Importante: isto NÃO representa nenhum sistema real hospedado neste domínio. É um
// padrão comum de arquitetura (cliente -> API -> cache -> fila -> workers -> banco ->
// monitoramento), propositalmente genérico, sem hostnames/portas/nomes de serviço reais.
// Textos vêm do dicionário i18n (pt-br/en/es/fr, detectado do navegador).

const NODE_IDS = ["client", "api", "cache", "queue", "workers", "db", "monitoring"];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.16 },
  },
};

const nodeVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const edgeVariants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: { scaleX: 1, opacity: 1 },
};

function ArchitectureFlow() {
  const locale = useMemo(() => detectLocale(), []);

  return (
    <section className="arch-flow" aria-label="Architecture">
      <p className="arch-flow-eyebrow">architecture.render()</p>
      <h2 className="arch-flow-heading">{t(locale, "arch.heading")}</h2>
      <p className="arch-flow-caption">{t(locale, "arch.caption")}</p>

      <motion.div
        className="arch-diagram"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={containerVariants}
      >
        {NODE_IDS.map((id, index) => (
          <React.Fragment key={id}>
            {index > 0 && (
              <motion.div
                className="arch-edge"
                variants={edgeVariants}
                transition={{ duration: 0.4, ease: "easeOut" }}
                aria-hidden="true"
              >
                <span className="arch-edge-arrow">▸</span>
              </motion.div>
            )}
            <motion.div
              className="arch-node"
              variants={nodeVariants}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={{ animationDelay: `${index * 0.3}s` }}
            >
              <span className="arch-node-label">{t(locale, `arch.nodes.${id}.label`)}</span>
              <span className="arch-node-detail">{t(locale, `arch.nodes.${id}.detail`)}</span>
            </motion.div>
          </React.Fragment>
        ))}
      </motion.div>
    </section>
  );
}

export default ArchitectureFlow;
