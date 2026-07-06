import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { isValidCPF, isValidCNPJ, onlyDigits } from "./validators";
import { detectLocale, t } from "./i18n";
import { PLATFORM_PROJECTS, WORK_PROJECTS, projectText } from "./projectsData";
import "./ProjectsLive.css";

// Seção "explore este projeto" para /system.
// Duas demos ao vivo (CPF/CNPJ), 100% client-side, sem rede/backend, usando os
// validadores puros de ./validators. Abaixo, o mesmo menu de projetos real do
// site (mesma lista/links de src/components/Projects/Projects.js, rota
// /project), como grid de cards estático — nunca depende de rede, nunca quebra a UI.

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function ValidatorPlayground({ title, hint, placeholder, maxLength, validate, locale }) {
  const [value, setValue] = useState("");
  const digits = onlyDigits(value);
  const isComplete = digits.length === maxLength;
  const valid = isComplete && validate(value);

  let status = "idle";
  if (digits.length > 0) {
    status = isComplete ? (valid ? "valid" : "invalid") : "typing";
  }

  const statusLabel = {
    idle: t(locale, "projectsLive.statusIdle"),
    typing: t(locale, "projectsLive.statusTyping")(digits.length, maxLength),
    valid: t(locale, "projectsLive.statusValid"),
    invalid: t(locale, "projectsLive.statusInvalid"),
  }[status];

  function handleChange(event) {
    const raw = onlyDigits(event.target.value).slice(0, maxLength);
    setValue(raw);
  }

  return (
    <div className={`projects-live-playground projects-live-playground-${status}`}>
      <h3 className="projects-live-playground-title">{title}</h3>
      <p className="projects-live-playground-hint">{hint}</p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="projects-live-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        aria-label={title}
      />
      <span className="projects-live-status" role="status" aria-live="polite">
        {statusLabel}
      </span>
    </div>
  );
}

function ProjectCard({ project, locale }) {
  const href = project.website || project.ghLink;
  const linkLabel = project.website
    ? t(locale, "projectsLive.websiteLabel")
    : t(locale, "projectsLive.githubLabel");

  return (
    <motion.a
      className="projects-live-card projects-live-card-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variants={cardVariants}
      transition={{ duration: 0.35 }}
    >
      <h4 className="projects-live-card-name">{project.name}</h4>
      <p className="projects-live-card-description">{projectText(locale, project)}</p>
      <span className="projects-live-card-cta">{linkLabel} ↗</span>
    </motion.a>
  );
}

function ProjectGroup({ heading, projects, locale }) {
  return (
    <div className="projects-live-grid-wrapper">
      <h3 className="projects-live-grid-heading">{heading}</h3>
      <motion.div
        className="projects-live-grid"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={gridVariants}
      >
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} locale={locale} />
        ))}
      </motion.div>
    </div>
  );
}

function ProjectsLive() {
  const locale = useMemo(() => detectLocale(), []);

  return (
    <section className="projects-live" aria-label="Live projects">
      <p className="projects-live-eyebrow">projects.explore()</p>
      <h2 className="projects-live-heading">{t(locale, "projectsLive.heading")}</h2>
      <p className="projects-live-subheading">{t(locale, "projectsLive.subheading")}</p>

      <div className="projects-live-playgrounds">
        <ValidatorPlayground
          title={t(locale, "projectsLive.cpfTitle")}
          hint={t(locale, "projectsLive.cpfHint")}
          placeholder={t(locale, "projectsLive.cpfPlaceholder")}
          maxLength={11}
          validate={isValidCPF}
          locale={locale}
        />
        <ValidatorPlayground
          title={t(locale, "projectsLive.cnpjTitle")}
          hint={t(locale, "projectsLive.cnpjHint")}
          placeholder={t(locale, "projectsLive.cnpjPlaceholder")}
          maxLength={14}
          validate={isValidCNPJ}
          locale={locale}
        />
      </div>

      <ProjectGroup
        heading={t(locale, "projectsLive.platformsHeading")}
        projects={PLATFORM_PROJECTS}
        locale={locale}
      />
      <ProjectGroup
        heading={t(locale, "projectsLive.worksHeading")}
        projects={WORK_PROJECTS}
        locale={locale}
      />

      <Link className="projects-live-full-menu" to="/project">
        {t(locale, "projectsLive.viewFullMenu")}
      </Link>
    </section>
  );
}

export default ProjectsLive;
