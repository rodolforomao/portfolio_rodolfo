import React, { useState } from "react";
import { Container, Row, Col, Button } from "react-bootstrap";
import { AiOutlineDownload } from "react-icons/ai";
import Particle from "../Particle";

function calculateAge() {
  const today = new Date();
  const birth = new Date(1985, 2, 24);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const AGE = calculateAge();

const CONTENT = {
  en: {
    downloadBtn: "Download CV",
    sections: {
      summary: "Professional Summary",
      experience: "Work Experience",
      education: "Education",
      skills: "Technical Skills",
      languages: "Languages",
    },
    role: "Senior Fullstack Software Developer",
    ageStr: `${AGE} years old`,
    summary: `Fullstack Software Developer with over 12 years of experience building enterprise systems and SaaS products from the ground up. Specialized in web technologies, blockchain forensics, and AI-powered applications. Computer Engineer with an MBA in IT Process Governance.`,
    experience: [
      {
        company: "DNIT — National Department of Transport Infrastructure",
        role: "Senior Fullstack Software Developer",
        period: "2018 – Present",
        location: "Brasília, DF, Brazil",
        bullets: [
          "Led development of SUPRA (Advanced Supervision System), real-time platform for monitoring federal highway construction across Brazil, increasing transparency and decision-making efficiency.",
          "Built the DNIT Citizen Portal, enabling public access to government transport services and information.",
          "Developed the Atlas mobile app (Flutter) for state-by-state highway construction status reporting.",
          "Stack: PHP, Laravel, Python, React, Flutter, Docker, PostgreSQL, Linux.",
        ],
      },
      {
        company: "SCM Engenharia",
        role: "Freelance Fullstack Developer",
        period: "2013 – Present",
        location: "Brasília, DF, Brazil (Remote)",
        bullets: [
          "Developed the DICI system for Anatel (Brazil's telecom regulator), enabling mandatory data reporting from all national telecom providers across economic, infrastructure, and service dimensions.",
          "Stack: PHP, JavaScript, SQL Server, HTML, CSS.",
        ],
      },
      {
        company: "Independent SaaS Products",
        role: "Founder & Lead Developer",
        period: "2018 – Present",
        location: "Remote",
        bullets: [
          "Proofchain — Blockchain forensics and court-admissible asset tracing (Laravel, React, Python).",
          "FinancialIQ — Enterprise finance platform with AI categorization and OCR for receipts (Laravel).",
          "SmartCondo — Condominium management SaaS for syndics, residents, and administrators.",
          "BitBooking — Short-term rental marketplace with instant PIX checkout for the Brazilian market.",
          "Atendente — WhatsApp-first customer service SaaS with configurable AI agents.",
        ],
      },
    ],
    education: [
      {
        degree: "B.Sc. Computer Engineering",
        institution: "Catholic University of Brasília (UCB)",
      },
      {
        degree: "MBA — IT Process Governance",
        institution: "Universa Foundation / Catholic University of Brasília",
      },
    ],
    skillGroups: [
      { label: "Primary", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter"] },
      { label: "Secondary / DB", skills: ["Java", "C++", "HTML", "CSS", "SQL Server", "PostgreSQL"] },
      { label: "Tools", skills: ["Docker", "Linux", "Git", "VS Code", "Postman", "Apache"] },
    ],
    humanLanguages: [
      { lang: "Portuguese", level: "Native" },
      { lang: "English", level: "Professional" },
    ],
  },

  "pt-br": {
    downloadBtn: "Baixar Currículo",
    sections: {
      summary: "Resumo Profissional",
      experience: "Experiência Profissional",
      education: "Formação Acadêmica",
      skills: "Habilidades Técnicas",
      languages: "Idiomas",
    },
    role: "Desenvolvedor de Software Fullstack Sênior",
    ageStr: `${AGE} anos`,
    summary: `Desenvolvedor de Software Fullstack com mais de 12 anos de experiência na construção de sistemas corporativos e produtos SaaS. Especializado em tecnologias web, forense blockchain e aplicações com inteligência artificial. Engenheiro de Computação com MBA em Governança de Processos de TI.`,
    experience: [
      {
        company: "DNIT — Departamento Nacional de Infraestrutura de Transportes",
        role: "Desenvolvedor de Software Fullstack Sênior",
        period: "2018 – Presente",
        location: "Brasília, DF, Brasil",
        bullets: [
          "Liderou o desenvolvimento do SUPRA (Sistema de Supervisão Avançada), plataforma em tempo real para monitoramento de obras de rodovias federais, aumentando a transparência e a eficiência nas tomadas de decisão.",
          "Desenvolveu o Portal Cidadão DNIT, viabilizando o acesso público a serviços e informações de transporte.",
          "Criou o aplicativo Atlas (Flutter) para download de relatórios de obras por estado.",
          "Stack: PHP, Laravel, Python, React, Flutter, Docker, PostgreSQL, Linux.",
        ],
      },
      {
        company: "SCM Engenharia",
        role: "Desenvolvedor Fullstack Freelancer",
        period: "2013 – Presente",
        location: "Brasília, DF, Brasil (Remoto)",
        bullets: [
          "Desenvolveu o sistema DICI para a Anatel (reguladora de telecomunicações do Brasil), permitindo o reporte obrigatório de dados de todos os provedores nacionais nas dimensões econômica, de infraestrutura e de serviços.",
          "Stack: PHP, JavaScript, SQL Server, HTML, CSS.",
        ],
      },
      {
        company: "Produtos SaaS Próprios",
        role: "Fundador & Desenvolvedor Principal",
        period: "2018 – Presente",
        location: "Remoto",
        bullets: [
          "Proofchain — Forense blockchain e rastreamento de ativos com integridade probatória (Laravel, React, Python).",
          "FinancialIQ — Plataforma financeira enterprise com categorização por IA e OCR de comprovantes (Laravel).",
          "SmartCondo — SaaS de gestão condominial para síndicos, moradores e administradores.",
          "BitBooking — Marketplace de aluguel por temporada com checkout PIX instantâneo.",
          "Atendente — SaaS de atendimento via WhatsApp com agentes de IA configuráveis.",
        ],
      },
    ],
    education: [
      {
        degree: "Engenharia de Computação",
        institution: "Universidade Católica de Brasília (UCB)",
      },
      {
        degree: "MBA — Governança de Processos de TI",
        institution: "Fundação Universa / Universidade Católica de Brasília",
      },
    ],
    skillGroups: [
      { label: "Primárias", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter"] },
      { label: "Secundárias / BD", skills: ["Java", "C++", "HTML", "CSS", "SQL Server", "PostgreSQL"] },
      { label: "Ferramentas", skills: ["Docker", "Linux", "Git", "VS Code", "Postman", "Apache"] },
    ],
    humanLanguages: [
      { lang: "Português", level: "Nativo" },
      { lang: "Inglês", level: "Profissional" },
    ],
  },

  es: {
    downloadBtn: "Descargar CV",
    sections: {
      summary: "Perfil Profesional",
      experience: "Experiencia Laboral",
      education: "Educación",
      skills: "Habilidades Técnicas",
      languages: "Idiomas",
    },
    role: "Desarrollador de Software Fullstack Senior",
    ageStr: `${AGE} años`,
    summary: `Desarrollador de Software Fullstack con más de 12 años de experiencia construyendo sistemas empresariales y productos SaaS. Especializado en tecnologías web, forensia blockchain y aplicaciones con inteligencia artificial. Ingeniero en Computación con MBA en Gobernanza de Procesos de TI.`,
    experience: [
      {
        company: "DNIT — Departamento Nacional de Infraestructura de Transporte (Brasil)",
        role: "Desarrollador de Software Fullstack Senior",
        period: "2018 – Presente",
        location: "Brasilia, DF, Brasil",
        bullets: [
          "Lideró el desarrollo de SUPRA, plataforma en tiempo real para monitoreo de obras viales federales, aumentando la transparencia y eficiencia en la toma de decisiones.",
          "Desarrolló el Portal Ciudadano DNIT para acceso público a servicios de transporte.",
          "Creó la app Atlas (Flutter) para descarga de informes de obras por estado.",
          "Stack: PHP, Laravel, Python, React, Flutter, Docker, PostgreSQL, Linux.",
        ],
      },
      {
        company: "SCM Engenharia",
        role: "Desarrollador Fullstack Freelance",
        period: "2013 – Presente",
        location: "Brasilia, DF, Brasil (Remoto)",
        bullets: [
          "Desarrolló el sistema DICI para Anatel (regulador brasileño de telecomunicaciones), habilitando el reporte obligatorio de datos de todos los proveedores nacionales.",
          "Stack: PHP, JavaScript, SQL Server, HTML, CSS.",
        ],
      },
      {
        company: "Productos SaaS Independientes",
        role: "Fundador y Desarrollador Principal",
        period: "2018 – Presente",
        location: "Remoto",
        bullets: [
          "Proofchain — Forensia blockchain y rastreo de activos con validez legal (Laravel, React, Python).",
          "FinancialIQ — Plataforma financiera enterprise con categorización por IA y OCR de comprobantes.",
          "SmartCondo — SaaS de gestión de condominios para síndicos, residentes y administradores.",
          "BitBooking — Marketplace de alquiler vacacional con pago PIX instantáneo.",
          "Atendente — SaaS de atención al cliente vía WhatsApp con agentes de IA configurables.",
        ],
      },
    ],
    education: [
      {
        degree: "Ingeniería en Computación",
        institution: "Universidad Católica de Brasilia (UCB)",
      },
      {
        degree: "MBA — Gobernanza de Procesos de TI",
        institution: "Fundación Universa / Universidad Católica de Brasilia",
      },
    ],
    skillGroups: [
      { label: "Primarios", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter"] },
      { label: "Secundarios / BD", skills: ["Java", "C++", "HTML", "CSS", "SQL Server", "PostgreSQL"] },
      { label: "Herramientas", skills: ["Docker", "Linux", "Git", "VS Code", "Postman", "Apache"] },
    ],
    humanLanguages: [
      { lang: "Portugués", level: "Nativo" },
      { lang: "Inglés", level: "Profesional" },
    ],
  },

  fr: {
    downloadBtn: "Télécharger CV",
    sections: {
      summary: "Profil Professionnel",
      experience: "Expérience Professionnelle",
      education: "Formation",
      skills: "Compétences Techniques",
      languages: "Langues",
    },
    role: "Développeur Logiciel Fullstack Senior",
    ageStr: `${AGE} ans`,
    summary: `Développeur Logiciel Fullstack avec plus de 12 ans d'expérience dans la création de systèmes d'entreprise et de produits SaaS. Spécialisé dans les technologies web, la forensique blockchain et les applications d'intelligence artificielle. Ingénieur en Informatique avec un MBA en Gouvernance des Processus IT.`,
    experience: [
      {
        company: "DNIT — Département National des Infrastructures de Transport (Brésil)",
        role: "Développeur Logiciel Fullstack Senior",
        period: "2018 – Présent",
        location: "Brasilia, DF, Brésil",
        bullets: [
          "A dirigé le développement de SUPRA, plateforme temps réel pour le suivi des chantiers routiers fédéraux, améliorant la transparence et l'efficacité décisionnelle.",
          "A développé le Portail Citoyen DNIT pour l'accès public aux services de transport.",
          "A créé l'application Atlas (Flutter) pour le téléchargement de rapports de chantiers par État.",
          "Stack : PHP, Laravel, Python, React, Flutter, Docker, PostgreSQL, Linux.",
        ],
      },
      {
        company: "SCM Engenharia",
        role: "Développeur Fullstack Freelance",
        period: "2013 – Présent",
        location: "Brasilia, DF, Brésil (Télétravail)",
        bullets: [
          "A développé le système DICI pour Anatel (régulateur brésilien des télécoms), permettant le reporting obligatoire des données de tous les fournisseurs nationaux.",
          "Stack : PHP, JavaScript, SQL Server, HTML, CSS.",
        ],
      },
      {
        company: "Produits SaaS Indépendants",
        role: "Fondateur & Développeur Principal",
        period: "2018 – Présent",
        location: "Télétravail",
        bullets: [
          "Proofchain — Forensique blockchain et traçabilité d'actifs à valeur probante (Laravel, React, Python).",
          "FinancialIQ — Plateforme financière enterprise avec catégorisation IA et OCR de reçus.",
          "SmartCondo — SaaS de gestion de copropriété pour syndics, résidents et administrateurs.",
          "BitBooking — Marketplace de location saisonnière avec paiement PIX instantané.",
          "Atendente — SaaS de service client WhatsApp avec agents IA configurables.",
        ],
      },
    ],
    education: [
      {
        degree: "Ingénierie Informatique",
        institution: "Université Catholique de Brasilia (UCB)",
      },
      {
        degree: "MBA — Gouvernance des Processus IT",
        institution: "Fondation Universa / Université Catholique de Brasilia",
      },
    ],
    skillGroups: [
      { label: "Principaux", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter"] },
      { label: "Secondaires / BD", skills: ["Java", "C++", "HTML", "CSS", "SQL Server", "PostgreSQL"] },
      { label: "Outils", skills: ["Docker", "Linux", "Git", "VS Code", "Postman", "Apache"] },
    ],
    humanLanguages: [
      { lang: "Portugais", level: "Natif" },
      { lang: "Anglais", level: "Professionnel" },
    ],
  },
};

const LANG_LABELS = { en: "EN", "pt-br": "PT-BR", es: "ES", fr: "FR" };

function ResumeSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#c770f0",
          borderBottom: "1px solid #ddd",
          paddingBottom: 5,
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function ResumeNew() {
  const [lang, setLang] = useState("en");

  const c = CONTENT[lang];

  const [downloading, setDownloading] = useState(false);

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("resume-printable");
      await html2pdf()
        .set({
          margin: 10,
          filename: `Rodolfo-Romao-CV-${lang.toUpperCase()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <Container fluid className="resume-section">
        <Particle />

        {/* Controls */}
        <Row className="justify-content-center align-items-center g-2" style={{ paddingBottom: "20px" }}>
          <Col xs={12} sm="auto" className="d-flex justify-content-center flex-wrap" style={{ gap: 6 }}>
            {Object.entries(LANG_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setLang(key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 4,
                  border: lang === key ? "2px solid #c770f0" : "1px solid #666",
                  background: lang === key ? "#c770f0" : "transparent",
                  color: lang === key ? "#fff" : "#c770f0",
                  cursor: "pointer",
                  fontWeight: lang === key ? 700 : 400,
                  fontSize: 13,
                  minWidth: 60,
                }}
              >
                {label}
              </button>
            ))}
          </Col>
          <Col xs={12} sm="auto" className="d-flex justify-content-center">
            <Button
              variant="primary"
              onClick={downloadPDF}
              disabled={downloading}
              style={{ minWidth: 160 }}
            >
              <AiOutlineDownload />
              &nbsp;{downloading ? "Gerando..." : c.downloadBtn}
            </Button>
          </Col>
        </Row>

        {/* Resume */}
        <Row className="justify-content-center" style={{ paddingBottom: "30px" }}>
          <Col xs={12} md={10} lg={8} xl={7}>
            <div
              id="resume-printable"
              style={{
                background: "#fff",
                color: "#222",
                padding: "40px 48px",
                borderRadius: 8,
                fontFamily: "'Segoe UI', Arial, sans-serif",
                lineHeight: 1.6,
                fontSize: 14,
              }}
            >
              {/* Header */}
              <div
                style={{
                  marginBottom: 24,
                  borderBottom: "3px solid #c770f0",
                  paddingBottom: 16,
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(20px, 5vw, 26px)",
                    fontWeight: 700,
                    color: "#1a1a2e",
                    margin: 0,
                  }}
                >
                  Rodolfo Romão
                </h1>
                <p
                  style={{
                    fontSize: "clamp(13px, 3vw, 15px)",
                    color: "#c770f0",
                    fontWeight: 600,
                    margin: "4px 0",
                  }}
                >
                  {c.role}
                </p>
                <p style={{ fontSize: "clamp(11px, 2.5vw, 12px)", color: "#666", margin: "4px 0" }}>
                  Brasília, DF, Brazil &nbsp;·&nbsp; {c.ageStr}
                </p>
                <p style={{ fontSize: "clamp(10px, 2vw, 12px)", color: "#666", margin: "4px 0", wordBreak: "break-word" }}>
                  engenheirorodolforomao@gmail.com &nbsp;·&nbsp; +55 61 98111-9944
                  <br />
                  linkedin.com/in/rodolfo-romao-oliveira &nbsp;·&nbsp; github.com/rodolforomao
                </p>
              </div>

              {/* Summary */}
              <ResumeSection title={c.sections.summary}>
                <p style={{ margin: 0, color: "#333", fontSize: 13 }}>
                  {c.summary}
                </p>
              </ResumeSection>

              {/* Experience */}
              <ResumeSection title={c.sections.experience}>
                {c.experience.map((exp, i) => (
                  <div key={i} style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 4,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontWeight: 700,
                            color: "#1a1a2e",
                            margin: 0,
                            fontSize: 14,
                          }}
                        >
                          {exp.company}
                        </p>
                        <p
                          style={{
                            color: "#c770f0",
                            margin: "2px 0",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {exp.role}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: "#777" }}>
                        <p style={{ margin: 0 }}>{exp.period}</p>
                        <p style={{ margin: 0 }}>{exp.location}</p>
                      </div>
                    </div>
                    <ul
                      style={{
                        margin: "8px 0 0 0",
                        paddingLeft: 18,
                        color: "#444",
                      }}
                    >
                      {exp.bullets.map((b, j) => (
                        <li key={j} style={{ fontSize: 12, marginBottom: 3 }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </ResumeSection>

              {/* Education */}
              <ResumeSection title={c.sections.education}>
                {c.education.map((edu, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <p
                      style={{
                        fontWeight: 700,
                        color: "#1a1a2e",
                        margin: 0,
                        fontSize: 13,
                      }}
                    >
                      {edu.degree}
                    </p>
                    <p style={{ color: "#666", margin: "2px 0", fontSize: 12 }}>
                      {edu.institution}
                    </p>
                  </div>
                ))}
              </ResumeSection>

              {/* Skills */}
              <ResumeSection title={c.sections.skills}>
                {c.skillGroups.map((group, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        minWidth: 130,
                        color: "#555",
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {group.label}:
                    </span>
                    <span style={{ fontSize: 12, color: "#333" }}>
                      {group.skills.join(" · ")}
                    </span>
                  </div>
                ))}
              </ResumeSection>

              {/* Human Languages */}
              <ResumeSection title={c.sections.languages}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  {c.humanLanguages.map((l, i) => (
                    <span key={i} style={{ fontSize: 12, color: "#333" }}>
                      <strong>{l.lang}</strong>: {l.level}
                    </span>
                  ))}
                </div>
              </ResumeSection>
            </div>
          </Col>
        </Row>

        {/* Bottom download */}
        <Row className="justify-content-center" style={{ paddingBottom: "20px" }}>
          <Col xs={12} sm="auto" className="d-flex justify-content-center">
            <Button
              variant="primary"
              onClick={downloadPDF}
              disabled={downloading}
              style={{ minWidth: 160 }}
            >
              <AiOutlineDownload />
              &nbsp;{downloading ? "Gerando..." : c.downloadBtn}
            </Button>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default ResumeNew;
