import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { detectLocale, t } from "./i18n";
import { PLATFORM_PROJECTS, WORK_PROJECTS, projectText } from "./projectsData";
import "./ProjectsLive.css";

// Seção "explore este projeto" para /system: o mesmo menu de projetos real do
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

function ProjectCard({ project, locale }) {
  const href = project.website || project.ghLink;

  if (!href) {
    return (
      <motion.div
        className="projects-live-card"
        variants={cardVariants}
        transition={{ duration: 0.35 }}
      >
        <h4 className="projects-live-card-name">{project.name}</h4>
        <p className="projects-live-card-description">{projectText(locale, project)}</p>
      </motion.div>
    );
  }

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
