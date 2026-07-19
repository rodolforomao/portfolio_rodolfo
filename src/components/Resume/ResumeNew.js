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
const EXPERIENCE_YEARS = "20+";

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
    role: "Computer Engineer · Senior Full Stack Developer · Blockchain & AI",
    ageStr: `${AGE} years old`,
    lastUpdated: "Last updated: July 2026",
    summary: `Computer Engineer and Senior Full Stack Developer with ${EXPERIENCE_YEARS} years of experience, programming since 2002. Builds enterprise systems, government platforms, and SaaS products. Specialized in web technologies, blockchain/DeFi, and AI-powered applications. MBA in IT Process Governance.`,
    experience: [
      {
        company: "LiquidX.pro / ispflash.space — Liquid Network AMM",
        role: "Senior Fullstack Developer",
        period: "Jan 2024 – Present",
        location: "Remote",
        bullets: [
          "Built LiquidX gateway enabling companies to receive DePix (Liquid Network tokens) via PIX (BRL).",
          "Developed DEX aggregator (ispbanking) with liquidity and bridge services across Liquid Network, Polygon, Solana, and other blockchains.",
          "Implemented ERP synchronization for token payment processing and automated wallet management (Elements, SideSwap).",
          "Stack: PHP, Python, Rust, Laravel, Flask, WebSocket, Debian, Apache2.",
        ],
      },
      {
        company: "DNIT — National Department of Transport Infrastructure",
        role: "Team Leader & Senior Fullstack Developer",
        period: "Jul 2018 – Present",
        location: "Brasília, DF, Brazil",
        bullets: [
          "Led development of SUPRA (Advanced Supervision System), real-time platform for monitoring federal highway, rail, and waterway construction across Brazil.",
          "Built SIMA, SUPRA, and the DNIT Citizen Portal; system recognized by government control agencies (CGU, TCU) for transparency.",
          "Developed the Atlas mobile app (Flutter) and architected REST/SOAP APIs for backend, frontend, mobile, and third-party integrations.",
          "Stack: PHP, CodeIgniter, Java, Python, React, Node.js, Flutter, Docker, SQL Server, Linux.",
        ],
      },
      {
        company: "G4F Services / Defender / SCM Engenharia",
        role: "Freelance Fullstack Developer",
        period: "Dec 2011 – Present",
        location: "Brasília, DF, Brazil (Remote)",
        bullets: [
          "Developed DICI web application for Anatel (dici.scmengenharia.com.br) and SCM Mobile app (Flutter) on Google Play.",
          "Built Human Automation system for ANATEL regulatory processes and ETL scripts (Java) for Oracle to SQL Server migration.",
          "Stack: PHP (CodeIgniter, Laravel), Flutter, C#/.NET, Java, SQL Server, Docker.",
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
      {
        company: "AUTOTRAC",
        role: "Fullstack Developer",
        period: "Jan 2009 – Sep 2012",
        location: "Brazil",
        bullets: [
          "Developed firmware for OBC 4 and OBC 5 vehicle tracking hardware and communication protocols for satellite/cellular trackers.",
          "Created Giga testing application for OBC hardware validation.",
          "Stack: C#, .NET, ASP.NET, C/C++, CodeWarrior, Linux.",
        ],
      },
      {
        company: "POLIEDRO Software Factory",
        role: "Software Developer",
        period: "Dec 2006 – Jan 2009",
        location: "Brazil",
        bullets: [
          "RTA — Annual Electricity Tariff Readjustment system (Poliedro – ANEEL).",
          "Espaço do Passageiro — Passenger Space system (SEBRAE-ANAC).",
          "Stack: C#, VB.NET, ASP.NET, Java, PHP, Oracle, T-SQL.",
        ],
      },
    ],
    education: [
      {
        degree: "Specialization — Work Safety Engineering",
        institution: "Estácio de Sá University",
        period: "2017 – 2018",
      },
      {
        degree: "B.Sc. Civil Engineering",
        institution: "Instituto de Ensino Planalto (IESPLAN)",
        period: "2010 – 2012",
      },
      {
        degree: "MBA — IT Process Governance",
        institution: "Universa Foundation / Catholic University of Brasília",
        period: "2009 – 2010",
      },
      {
        degree: "B.Sc. Computer Engineering",
        institution: "Instituto de Ensino Superior de Brasília (IESB)",
        period: "2004 – 2008",
      },
    ],
    skillGroups: [
      { label: "Languages", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript", "Java", "Rust", "C/C++"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter", "Flask", "CodeIgniter", ".NET"] },
      { label: "Blockchain", skills: ["Bitcoin", "Liquid Network", "Polygon", "Solana", "DeFi", "Wallet/RPC"] },
      { label: "AI / ML", skills: ["OpenAI API", "Speech-to-Text", "Prompt Engineering", "Async/Queue pipelines"] },
      { label: "Databases", skills: ["SQL Server", "MySQL", "PostgreSQL", "Oracle", "SQLite"] },
      { label: "DevOps", skills: ["Docker", "Linux", "Git", "Apache", "Nginx", "CI/CD"] },
    ],
    humanLanguages: [
      { lang: "Portuguese", level: "Native" },
      { lang: "English", level: "Upper Intermediate (B2) — EFSET certified" },
      { lang: "Spanish", level: "Advanced" },
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
    role: "Engenheiro de Computação · Desenvolvedor Full Stack Sênior · Blockchain & IA",
    ageStr: `${AGE} anos`,
    lastUpdated: "Última atualização: julho de 2026",
    summary: `Engenheiro de Computação e Desenvolvedor Full Stack Sênior com ${EXPERIENCE_YEARS} anos de experiência, programando desde 2002. Constrói sistemas corporativos, plataformas governamentais e produtos SaaS. Especializado em tecnologias web, blockchain/DeFi e aplicações com inteligência artificial. MBA em Governança de Processos de TI.`,
    experience: [
      {
        company: "LiquidX.pro / ispflash.space — Liquid Network AMM",
        role: "Desenvolvedor Fullstack Sênior",
        period: "Jan 2024 – Presente",
        location: "Remoto",
        bullets: [
          "Desenvolveu gateway LiquidX para empresas receberem DePix (tokens Liquid Network) via PIX (BRL).",
          "Criou agregador DEX (ispbanking) com liquidez e bridge entre Liquid Network, Polygon, Solana e outras blockchains.",
          "Implementou sincronização com ERP para pagamentos em tokens e gestão automatizada de carteiras (Elements, SideSwap).",
          "Stack: PHP, Python, Rust, Laravel, Flask, WebSocket, Debian, Apache2.",
        ],
      },
      {
        company: "DNIT — Departamento Nacional de Infraestrutura de Transportes",
        role: "Líder de Equipe & Desenvolvedor Fullstack Sênior",
        period: "Jul 2018 – Presente",
        location: "Brasília, DF, Brasil",
        bullets: [
          "Liderou o desenvolvimento do SUPRA (Sistema de Supervisão Avançada), plataforma em tempo real para monitoramento de obras rodoviárias, ferroviárias e hidroviárias federais.",
          "Desenvolveu SIMA, SUPRA e Portal Cidadão DNIT; sistema reconhecido pelos órgãos de controle (CGU, TCU) pela transparência.",
          "Criou o aplicativo Atlas (Flutter) e arquitetou APIs REST/SOAP para backend, frontend, mobile e integrações externas.",
          "Stack: PHP, CodeIgniter, Java, Python, React, Node.js, Flutter, Docker, SQL Server, Linux.",
        ],
      },
      {
        company: "G4F Services / Defender / SCM Engenharia",
        role: "Desenvolvedor Fullstack Freelancer",
        period: "Dez 2011 – Presente",
        location: "Brasília, DF, Brasil (Remoto)",
        bullets: [
          "Desenvolveu aplicação web DICI para a Anatel (dici.scmengenharia.com.br) e app SCM Mobile (Flutter) na Google Play.",
          "Criou sistema de Automação Humana para processos regulatórios da ANATEL e scripts ETL (Java) para migração Oracle → SQL Server.",
          "Stack: PHP (CodeIgniter, Laravel), Flutter, C#/.NET, Java, SQL Server, Docker.",
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
      {
        company: "AUTOTRAC",
        role: "Desenvolvedor Fullstack",
        period: "Jan 2009 – Set 2012",
        location: "Brasil",
        bullets: [
          "Desenvolveu firmware para hardware de rastreamento veicular OBC 4 e OBC 5 e protocolos de comunicação para rastreadores satelitais/celulares.",
          "Criou aplicação de testes Giga para validação de hardware OBC.",
          "Stack: C#, .NET, ASP.NET, C/C++, CodeWarrior, Linux.",
        ],
      },
      {
        company: "Fábrica de Software POLIEDRO",
        role: "Desenvolvedor de Software",
        period: "Dez 2006 – Jan 2009",
        location: "Brasil",
        bullets: [
          "RTA — Sistema de Reajuste Tarifário Anual de Energia Elétrica (Poliedro – ANEEL).",
          "Espaço do Passageiro — Sistema para SEBRAE-ANAC.",
          "Stack: C#, VB.NET, ASP.NET, Java, PHP, Oracle, T-SQL.",
        ],
      },
    ],
    education: [
      {
        degree: "Especialização — Engenharia de Segurança do Trabalho",
        institution: "Universidade Estácio de Sá",
        period: "2017 – 2018",
      },
      {
        degree: "Engenharia Civil",
        institution: "Instituto de Ensino Planalto (IESPLAN)",
        period: "2010 – 2012",
      },
      {
        degree: "MBA — Governança de Processos de TI",
        institution: "Fundação Universa / Universidade Católica de Brasília",
        period: "2009 – 2010",
      },
      {
        degree: "Engenharia de Computação",
        institution: "Instituto de Ensino Superior de Brasília (IESB)",
        period: "2004 – 2008",
      },
    ],
    skillGroups: [
      { label: "Linguagens", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript", "Java", "Rust", "C/C++"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter", "Flask", "CodeIgniter", ".NET"] },
      { label: "Blockchain", skills: ["Bitcoin", "Liquid Network", "Polygon", "Solana", "DeFi", "Wallet/RPC"] },
      { label: "IA / ML", skills: ["OpenAI API", "Speech-to-Text", "Prompt Engineering", "Pipelines assíncronos"] },
      { label: "Bancos de dados", skills: ["SQL Server", "MySQL", "PostgreSQL", "Oracle", "SQLite"] },
      { label: "DevOps", skills: ["Docker", "Linux", "Git", "Apache", "Nginx", "CI/CD"] },
    ],
    humanLanguages: [
      { lang: "Português", level: "Nativo" },
      { lang: "Inglês", level: "Intermediário avançado (B2) — certificado EFSET" },
      { lang: "Espanhol", level: "Avançado" },
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
    role: "Ingeniero en Computación · Desarrollador Full Stack Senior · Blockchain & IA",
    ageStr: `${AGE} años`,
    lastUpdated: "Última actualización: julio de 2026",
    summary: `Ingeniero en Computación y Desarrollador Full Stack Senior con ${EXPERIENCE_YEARS} años de experiencia, programando desde 2002. Construye sistemas empresariales, plataformas gubernamentales y productos SaaS. Especializado en tecnologías web, blockchain/DeFi y aplicaciones con inteligencia artificial. MBA en Gobernanza de Procesos de TI.`,
    experience: [
      {
        company: "LiquidX.pro / ispflash.space — Liquid Network AMM",
        role: "Desarrollador Fullstack Senior",
        period: "Ene 2024 – Presente",
        location: "Remoto",
        bullets: [
          "Desarrolló gateway LiquidX para que empresas reciban DePix (tokens Liquid Network) vía PIX (BRL).",
          "Creó agregador DEX (ispbanking) con liquidez y bridge entre Liquid Network, Polygon, Solana y otras blockchains.",
          "Implementó sincronización con ERP para pagos en tokens y gestión automatizada de wallets (Elements, SideSwap).",
          "Stack: PHP, Python, Rust, Laravel, Flask, WebSocket, Debian, Apache2.",
        ],
      },
      {
        company: "DNIT — Departamento Nacional de Infraestructura de Transporte (Brasil)",
        role: "Líder de Equipo y Desarrollador Fullstack Senior",
        period: "Jul 2018 – Presente",
        location: "Brasilia, DF, Brasil",
        bullets: [
          "Lideró el desarrollo de SUPRA, plataforma en tiempo real para monitoreo de obras viales, ferroviarias e hidroviarias federales.",
          "Desarrolló SIMA, SUPRA y Portal Ciudadano DNIT; sistema reconocido por organismos de control (CGU, TCU) por su transparencia.",
          "Creó la app Atlas (Flutter) y arquitectó APIs REST/SOAP para backend, frontend, móvil e integraciones externas.",
          "Stack: PHP, CodeIgniter, Java, Python, React, Node.js, Flutter, Docker, SQL Server, Linux.",
        ],
      },
      {
        company: "G4F Services / Defender / SCM Engenharia",
        role: "Desarrollador Fullstack Freelance",
        period: "Dic 2011 – Presente",
        location: "Brasilia, DF, Brasil (Remoto)",
        bullets: [
          "Desarrolló aplicación web DICI para Anatel (dici.scmengenharia.com.br) y app SCM Mobile (Flutter) en Google Play.",
          "Creó sistema de Automatización Humana para procesos regulatorios de ANATEL y scripts ETL (Java) para migración Oracle → SQL Server.",
          "Stack: PHP (CodeIgniter, Laravel), Flutter, C#/.NET, Java, SQL Server, Docker.",
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
      {
        company: "AUTOTRAC",
        role: "Desarrollador Fullstack",
        period: "Ene 2009 – Sep 2012",
        location: "Brasil",
        bullets: [
          "Desarrolló firmware para hardware de rastreo vehicular OBC 4 y OBC 5 y protocolos de comunicación para rastreadores satelitales/celulares.",
          "Creó aplicación de pruebas Giga para validación de hardware OBC.",
          "Stack: C#, .NET, ASP.NET, C/C++, CodeWarrior, Linux.",
        ],
      },
      {
        company: "Fábrica de Software POLIEDRO",
        role: "Desarrollador de Software",
        period: "Dic 2006 – Ene 2009",
        location: "Brasil",
        bullets: [
          "RTA — Sistema de Reajuste Tarifario Anual de Energía Eléctrica (Poliedro – ANEEL).",
          "Espaço do Passageiro — Sistema para SEBRAE-ANAC.",
          "Stack: C#, VB.NET, ASP.NET, Java, PHP, Oracle, T-SQL.",
        ],
      },
    ],
    education: [
      {
        degree: "Especialización — Ingeniería de Seguridad del Trabajo",
        institution: "Universidad Estácio de Sá",
        period: "2017 – 2018",
      },
      {
        degree: "Ingeniería Civil",
        institution: "Instituto de Enseñanza Planalto (IESPLAN)",
        period: "2010 – 2012",
      },
      {
        degree: "MBA — Gobernanza de Procesos de TI",
        institution: "Fundación Universa / Universidad Católica de Brasilia",
        period: "2009 – 2010",
      },
      {
        degree: "Ingeniería en Computación",
        institution: "Instituto de Enseñanza Superior de Brasilia (IESB)",
        period: "2004 – 2008",
      },
    ],
    skillGroups: [
      { label: "Lenguajes", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript", "Java", "Rust", "C/C++"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter", "Flask", "CodeIgniter", ".NET"] },
      { label: "Blockchain", skills: ["Bitcoin", "Liquid Network", "Polygon", "Solana", "DeFi", "Wallet/RPC"] },
      { label: "IA / ML", skills: ["OpenAI API", "Speech-to-Text", "Prompt Engineering", "Pipelines asíncronos"] },
      { label: "Bases de datos", skills: ["SQL Server", "MySQL", "PostgreSQL", "Oracle", "SQLite"] },
      { label: "DevOps", skills: ["Docker", "Linux", "Git", "Apache", "Nginx", "CI/CD"] },
    ],
    humanLanguages: [
      { lang: "Portugués", level: "Nativo" },
      { lang: "Inglés", level: "Intermedio alto (B2) — certificado EFSET" },
      { lang: "Español", level: "Avanzado" },
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
    role: "Ingénieur Informatique · Développeur Full Stack Senior · Blockchain & IA",
    ageStr: `${AGE} ans`,
    lastUpdated: "Dernière mise à jour : juillet 2026",
    summary: `Ingénieur Informatique et Développeur Full Stack Senior avec ${EXPERIENCE_YEARS} ans d'expérience, programmant depuis 2002. Crée des systèmes d'entreprise, plateformes gouvernementales et produits SaaS. Spécialisé dans les technologies web, la blockchain/DeFi et les applications d'intelligence artificielle. MBA en Gouvernance des Processus IT.`,
    experience: [
      {
        company: "LiquidX.pro / ispflash.space — Liquid Network AMM",
        role: "Développeur Fullstack Senior",
        period: "Jan 2024 – Présent",
        location: "Télétravail",
        bullets: [
          "A développé la passerelle LiquidX permettant aux entreprises de recevoir des DePix (tokens Liquid Network) via PIX (BRL).",
          "A créé l'agrégateur DEX (ispbanking) avec liquidité et bridge entre Liquid Network, Polygon, Solana et autres blockchains.",
          "A implémenté la synchronisation ERP pour les paiements en tokens et la gestion automatisée de portefeuilles (Elements, SideSwap).",
          "Stack : PHP, Python, Rust, Laravel, Flask, WebSocket, Debian, Apache2.",
        ],
      },
      {
        company: "DNIT — Département National des Infrastructures de Transport (Brésil)",
        role: "Chef d'Équipe & Développeur Fullstack Senior",
        period: "Juil 2018 – Présent",
        location: "Brasilia, DF, Brésil",
        bullets: [
          "A dirigé le développement de SUPRA, plateforme temps réel pour le suivi des chantiers routiers, ferroviaires et fluviaux fédéraux.",
          "A développé SIMA, SUPRA et le Portail Citoyen DNIT ; système reconnu par les organismes de contrôle (CGU, TCU) pour sa transparence.",
          "A créé l'application Atlas (Flutter) et architecturé les APIs REST/SOAP pour backend, frontend, mobile et intégrations tierces.",
          "Stack : PHP, CodeIgniter, Java, Python, React, Node.js, Flutter, Docker, SQL Server, Linux.",
        ],
      },
      {
        company: "G4F Services / Defender / SCM Engenharia",
        role: "Développeur Fullstack Freelance",
        period: "Déc 2011 – Présent",
        location: "Brasilia, DF, Brésil (Télétravail)",
        bullets: [
          "A développé l'application web DICI pour Anatel (dici.scmengenharia.com.br) et l'app SCM Mobile (Flutter) sur Google Play.",
          "A créé le système d'Automatisation Humaine pour les processus réglementaires ANATEL et des scripts ETL (Java) pour migration Oracle → SQL Server.",
          "Stack : PHP (CodeIgniter, Laravel), Flutter, C#/.NET, Java, SQL Server, Docker.",
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
      {
        company: "AUTOTRAC",
        role: "Développeur Fullstack",
        period: "Jan 2009 – Sep 2012",
        location: "Brésil",
        bullets: [
          "A développé le firmware pour les traceurs véhiculaires OBC 4 et OBC 5 et les protocoles de communication satellite/cellulaire.",
          "A créé l'application de tests Giga pour la validation du matériel OBC.",
          "Stack : C#, .NET, ASP.NET, C/C++, CodeWarrior, Linux.",
        ],
      },
      {
        company: "Usine Logicielle POLIEDRO",
        role: "Développeur Logiciel",
        period: "Déc 2006 – Jan 2009",
        location: "Brésil",
        bullets: [
          "RTA — Système de Réajustement Tarifaire Annuel de l'Électricité (Poliedro – ANEEL).",
          "Espaço do Passageiro — Système pour SEBRAE-ANAC.",
          "Stack : C#, VB.NET, ASP.NET, Java, PHP, Oracle, T-SQL.",
        ],
      },
    ],
    education: [
      {
        degree: "Spécialisation — Ingénierie de la Sécurité du Travail",
        institution: "Université Estácio de Sá",
        period: "2017 – 2018",
      },
      {
        degree: "Ingénierie Civile",
        institution: "Institut d'Enseignement Planalto (IESPLAN)",
        period: "2010 – 2012",
      },
      {
        degree: "MBA — Gouvernance des Processus IT",
        institution: "Fondation Universa / Université Catholique de Brasilia",
        period: "2009 – 2010",
      },
      {
        degree: "Ingénierie Informatique",
        institution: "Institut d'Enseignement Supérieur de Brasilia (IESB)",
        period: "2004 – 2008",
      },
    ],
    skillGroups: [
      { label: "Langages", skills: ["PHP", "Python", "C#", "JavaScript", "TypeScript", "Java", "Rust", "C/C++"] },
      { label: "Frameworks", skills: ["Laravel", "React", "Node.js", "Flutter", "Flask", "CodeIgniter", ".NET"] },
      { label: "Blockchain", skills: ["Bitcoin", "Liquid Network", "Polygon", "Solana", "DeFi", "Wallet/RPC"] },
      { label: "IA / ML", skills: ["OpenAI API", "Speech-to-Text", "Prompt Engineering", "Pipelines asynchrones"] },
      { label: "Bases de données", skills: ["SQL Server", "MySQL", "PostgreSQL", "Oracle", "SQLite"] },
      { label: "DevOps", skills: ["Docker", "Linux", "Git", "Apache", "Nginx", "CI/CD"] },
    ],
    humanLanguages: [
      { lang: "Portugais", level: "Natif" },
      { lang: "Anglais", level: "Intermédiaire supérieur (B2) — certifié EFSET" },
      { lang: "Espagnol", level: "Avancé" },
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
                  Rodolfo Romão de Oliveira Neto
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
                  <a href="mailto:engenheirorodolforomao@gmail.com" style={{ color: "#666" }}>engenheirorodolforomao@gmail.com</a>
                  &nbsp;·&nbsp;
                  <a href="tel:+5561981119944" style={{ color: "#666" }}>+55 61 98111-9944</a>
                  <br />
                  <a href="https://rodolforomao.com.br" target="_blank" rel="noopener noreferrer" style={{ color: "#666" }}>rodolforomao.com.br</a>
                  &nbsp;·&nbsp;
                  <a href="https://github.com/rodolforomao" target="_blank" rel="noopener noreferrer" style={{ color: "#666" }}>github.com/rodolforomao</a>
                  &nbsp;·&nbsp;
                  <a href="https://linkedin.com/in/rodolfo-romao-oliveira" target="_blank" rel="noopener noreferrer" style={{ color: "#666" }}>linkedin.com/in/rodolfo-romao-oliveira</a>
                </p>
                <p style={{ fontSize: "10px", color: "#999", margin: "8px 0 0" }}>
                  {c.lastUpdated}
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
                      {edu.period ? ` · ${edu.period}` : ""}
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
