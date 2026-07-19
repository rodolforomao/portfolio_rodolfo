import React from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col } from "react-bootstrap";
import ProjectCard from "./ProjectCards";
import Particle from "../Particle";
import logoProofchain from "../../Assets/Projects/proofchain.png";
import logoFinancialiq from "../../Assets/Projects/financialiq.png";
import logoSmartcondo from "../../Assets/Projects/smartcondo.png";
import logoBitbooking from "../../Assets/Projects/bitbooking.png";
import logoAtendente from "../../Assets/Projects/atendente.png";
import logoResidencialOliveiras from "../../Assets/Projects/residencial-oliveiras.png";
import logoSupra from "../../Assets/Projects/supra.png";
import logoPortalCidadao from "../../Assets/Projects/portalcidadao.png";
import logoScm from "../../Assets/Projects/scm.png";
import logoAtlasApp from "../../Assets/Projects/smart-phone-atlas-app.png";
import logoPortalApp from "../../Assets/Projects/smart-phone-portalcidadao-app.png";
import logoScmApp from "../../Assets/Projects/smart-phone-scm-app.png";
import imgCodeEditor from "../../Assets/Projects/codeEditor.png";

function Projects() {
  return (
    <Container fluid className="project-section">
      <Particle />
      <Container>
        <h1 className="project-heading">
          My <strong className="purple">Platforms</strong> | Minhas{" "}
          <strong className="purple">Plataformas</strong>
        </h1>
        <p style={{ color: "white" }}>
          SaaS products and web platforms I designed and built — blockchain
          forensics, finance, condominiums, hospitality, short-term rentals, and
          AI-powered customer service.
        </p>
        <p style={{ color: "white" }}>
          Produtos SaaS e plataformas web que projetei e desenvolvi — forense
          blockchain, finanças, condomínios, hospedagem, aluguel por temporada e
          atendimento com IA.
        </p>
        <Row style={{ justifyContent: "center", paddingBottom: "10px" }}>
          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoProofchain}
              isBlog={false}
              title="Proofchain"
              description="SaaS platform for blockchain investigation, asset tracing, and court-admissible forensic intelligence. Laravel API, React dashboard, and Python workers deliver cross-chain analysis, entity graphs, confidence scoring, and auditable evidence chains for legal and compliance teams."
              subdescription="Plataforma SaaS de investigação blockchain, rastreamento de ativos e inteligência forense com integridade probatória. API Laravel, painel React e workers Python para análise multi-chain, grafos de entidades, scores de confiança e cadeias de evidência auditáveis para jurídico e compliance."
              website="https://proofchain.rodolforomao.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoFinancialiq}
              isBlog={false}
              title="FinancialIQ"
              description="Enterprise financial intelligence SaaS: cash flow, bank reconciliation, semantic AI categorization, OCR (optical character recognition) for receipts, smart alerts, and multi-tenant workspaces. Modular Laravel architecture with Telegram/WhatsApp notifications and CFO-grade dashboards."
              subdescription="SaaS financeiro enterprise: fluxo de caixa, conciliação bancária, categorização semântica com IA, OCR (reconhecimento óptico de caracteres) de comprovantes, alertas inteligentes e workspaces multi-tenant. Arquitetura modular em Laravel com notificações Telegram/WhatsApp e painéis para decisão financeira."
              website="https://financialiq.rodolforomao.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoSmartcondo}
              isBlog={false}
              title="Smart Condo"
              description="All-in-one condominium management: syndics, administrators, residents, and staff share finance (charges, payables, chart of accounts), notices, service tickets, units, and granular role-based menus in a single Laravel platform."
              subdescription="Gestão condominial completa: síndicos, administradores, moradores e equipe usam financeiro (cobranças, despesas, plano de contas), avisos, ocorrências, unidades e menus com permissões granulares em uma única plataforma Laravel."
              website="https://smartcondo.rodolforomao.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoBitbooking}
              isBlog={false}
              title="BitBooking"
              description="Short-term rental marketplace with instant PIX (Brazil's instant payment system) checkout, automatic reservation confirmation, host property management, guest bookings, and map-based discovery — built for the Brazilian market with Liquid Network/DePix settlement for hosts."
              subdescription="Marketplace de aluguel por temporada com checkout PIX instantâneo, confirmação automática de reservas, gestão de imóveis para anfitriões, reservas de hóspedes e busca no mapa — focado no Brasil, com liquidação em Liquid Network/DePix (stablecoin brasileira sobre a rede Liquid) para anfitriões."
              website="https://bitbooking.rodolforomao.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoAtendente}
              isBlog={false}
              title="Atendente"
              description="WhatsApp-first customer service SaaS: configurable AI agents, conversation inbox, leads, appointments, PIX billing, analytics, and Telegram integrations — one panel for teams that need speed, control, and human handoff."
              subdescription="SaaS de atendimento via WhatsApp: agentes de IA configuráveis, caixa de conversas, leads, agendamentos, cobrança PIX, métricas e integrações Telegram — um painel para equipes que precisam de velocidade, controle e repasse humano."
              website="https://atendente.rodolforomao.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoResidencialOliveiras}
              isBlog={false}
              title="Residencial Oliveiras"
              description="Hospitality website for a lodging business in Brasília: responsive landing page, apartment photo galleries (Owl Carousel), WhatsApp and email contact, and a PHP receipt module for booking records. Built with HTML5, CSS3, Vanilla JavaScript, and jQuery — deployed on VPS with Cloudflare and HestiaCP."
              subdescription="Site institucional de hospedagem em Brasília: página responsiva, galerias de apartamentos (Owl Carousel), contato por WhatsApp e e-mail, e módulo PHP de comprovantes de reserva. Desenvolvido com HTML5, CSS3, JavaScript vanilla e jQuery — em produção na VPS com Cloudflare e HestiaCP."
              website="https://residencialoliveiras.rodolforomao.com.br"
            />
          </Col>
        </Row>

        <h1 className="project-heading" style={{ marginTop: "2.5rem" }}>
          My biggest <strong className="purple">Works</strong> | Maiores{" "}
          <strong className="purple">Trabalhos</strong>
        </h1>
        <p style={{ color: "white" }}>
          Here are a few enterprise projects I&apos;ve worked on recently.
        </p>
        <p style={{ color: "white" }}>
          Aqui estão alguns dos maiores trabalhos corporativos que realizei.
        </p>
        <Row style={{ justifyContent: "center", paddingBottom: "10px" }}>
          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoSupra}
              isBlog={false}
              title="Supra"
              description="The Advanced Supervision System is a computerized process, developed and implemented at DNIT that resulted in transparency and availability of construction information in real time, making monitoring of works more efficient and dynamic, enabling more assertive decision-making and increasing the quality of services provided to society."
              subdescription="O Sistema de Supervisão Avançada é um processo informatizado, desenvolvido e implementado no DNIT que resultou em transparência e disponibilidade de informações de obras em tempo real, tornando o acompanhamento das obras mais eficiente e dinâmico, possibilitando tomadas de decisão mais assertivas e aumento da qualidade dos serviços prestados à sociedade."
              website="https://supra.dnit.gov.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoPortalCidadao}
              isBlog={false}
              title="Portal Cidadão"
              description="The 'DNIT Citizen Portal' refers to the online portal intended for citizens who wish to access information and services related to the National Department of Transport Infrastructure (DNIT) in Brazil. DNIT is responsible for the maintenance and development of federal road infrastructure in the country."
              subdescription="O 'Portal Cidadão DNIT' refere-se ao portal online destinado aos cidadãos que desejam acessar informações e serviços relacionados ao Departamento Nacional de Infraestrutura de Transportes (DNIT) no Brasil. O DNIT é responsável pela manutenção e desenvolvimento da infraestrutura rodoviária federal no país."
              website="https://servicos.dnit.gov.br/portalcidadao"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoScm}
              isBlog={false}
              title="SCM - DICI"
              description="The DICI 'Data, Information, Knowledge and Intelligence System' is Anatel's telecommunications sector data collection system, and it is mandatory for all providers to report data relating to the services provided, in addition to economic and infrastructure data."
              subdescription="O DICI 'Sistema de Dados, Informações, Conhecimento e Inteligência' é o sistema de coleta de dados setoriais de telecomunicações da Anatel, sendo obrigatório a todos os provedores informarem os dados referentes aos serviços prestados, além de dados econômicos e de infraestrutura."
              website="http://dici.scmengenharia.com.br"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoAtlasApp}
              isBlog={false}
              title="Atlas - App"
              description="The Atlas application is used to download a .PDF by state in Brazil, showing all highway construction works and their status, strategic information for decision making."
              subdescription="O aplicativo Atlas é usado para realizar download de um .PDF por estados do Brasil, mostrando todas as obras de construção de rodovias e sua situação, informações estratégias para tomadas de decisão. "
              website="https://play.google.com/store/apps/details?id=br.gov.dnit.supra.atlas&pcampaignid=web_share"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoPortalApp}
              isBlog={false}
              title="Portal Cidadão - App"
              description="The 'App DNIT Citizen Portal' refers to the online portal intended for citizens who wish to access information and services related to the National Department of Transport Infrastructure (DNIT) in Brazil. DNIT is responsible for the maintenance and development of federal road infrastructure in the country."
              subdescription="O 'App do Portal Cidadão DNIT' refere-se ao portal online destinado aos cidadãos que desejam acessar informações e serviços relacionados ao Departamento Nacional de Infraestrutura de Transportes (DNIT) no Brasil. O DNIT é responsável pela manutenção e desenvolvimento da infraestrutura rodoviária federal no país."
              website="https://play.google.com/store/apps/details?id=br.gov.dnit.servicos.portalcidadao&pcampaignid=web_share"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={logoScmApp}
              isBlog={false}
              title="SCM Engenharia - DICI - App"
              description="The app DICI 'Data, Information, Knowledge and Intelligence System' is Anatel's telecommunications sector data collection system, and it is mandatory for all providers to report data relating to the services provided, in addition to economic and infrastructure data."
              subdescription="O app DICI 'Sistema de Dados, Informações, Conhecimento e Inteligência' é o sistema de coleta de dados setoriais de telecomunicações da Anatel, sendo obrigatório a todos os provedores informarem os dados referentes aos serviços prestados, além de dados econômicos e de infraestrutura."
              website="https://play.google.com/store/apps/details?id=br.com.scmengenharia.dicii&pcampaignid=web_share"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={imgCodeEditor}
              isBlog={false}
              title="Polybit"
              description="Web platform for weekly raffles in Laravel, inspired by the Mega-Sena model. PHP 8+, MySQL/MariaDB, Laravel Mix for front-end assets."
              subdescription="Plataforma web em Laravel para sorteios semanais. Requisitos: PHP 8+, MySQL/MariaDB, Composer e Node/NPM para assets."
              ghLink="https://github.com/rodolforomao/polybit"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={imgCodeEditor}
              isBlog={false}
              title="Smart Condo (Open Source Codebase)"
              description="Open-source Laravel 11 codebase underlying the Smart Condo SaaS product above, centralizing the entire condominium routine in a single digital platform. PHP 8+, MySQL, optional Redis."
              subdescription="Código-fonte aberto em Laravel 11 que serve de base para o produto SaaS Smart Condo listado acima: rotinas centralizadas, backend PHP 8+, MySQL (XAMPP), cache e storage configuráveis."
              ghLink="https://github.com/rodolforomao/smart_condo"
            />
          </Col>

          <Col md={4} className="project-card">
            <ProjectCard
              imgPath={imgCodeEditor}
              isBlog={false}
              title="DICI Simples (Anatel/SCM)"
              description="Simplified DICI (Data, Information, Knowledge and Intelligence) interface for Anatel's sector data — a team project built at SCM Engenharia. Built with React, TypeScript, Vite and modern UI (e.g. Radix/shadcn)."
              subdescription="Interface simplificada do sistema DICI da Anatel — projeto em equipe na SCM Engenharia. Stack: React, TypeScript, Vite, formulários e UI moderna."
              ghLink="https://github.com/RodrigoSCM1/dici-simples-anatel-scm-engenharia"
            />
          </Col>
        </Row>

        <p style={{ color: "white", marginTop: "1.5rem" }}>
          Want the full career timeline behind these projects — companies, roles, and dates? See the{" "}
          <Link to="/resume" style={{ color: "#b385f7" }}>complete résumé</Link>, or read more{" "}
          <Link to="/about" style={{ color: "#b385f7" }}>about me</Link>.
        </p>
        <p style={{ color: "white" }}>
          Quer a trajetória completa por trás desses projetos — empresas, cargos e datas? Veja o{" "}
          <Link to="/resume" style={{ color: "#b385f7" }}>currículo completo</Link>, ou saiba mais{" "}
          <Link to="/about" style={{ color: "#b385f7" }}>sobre mim</Link>.
        </p>
      </Container>
    </Container>
  );
}

export default Projects;
