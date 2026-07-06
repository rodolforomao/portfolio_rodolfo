// Fonte única da lista real de projetos, espelhando o menu "Projects" em
// src/components/Projects/Projects.js (rota /project). Mantida separada do
// portfolio_context.json de propósito: aquele arquivo alimenta o chat de IA de
// /system com os repositórios técnicos reais do GitHub, um conteúdo diferente
// e igualmente válido. Esta lista é a mesma exibida no menu de projetos do site.

export const PLATFORM_PROJECTS = [
  {
    name: "Proofchain",
    descriptionEn:
      "SaaS platform for blockchain investigation, asset tracing, and court-admissible forensic intelligence. Laravel API, React dashboard, and Python workers deliver cross-chain analysis, entity graphs, confidence scoring, and auditable evidence chains for legal and compliance teams.",
    descriptionPt:
      "Plataforma SaaS de investigação blockchain, rastreamento de ativos e inteligência forense com integridade probatória. API Laravel, painel React e workers Python para análise multi-chain, grafos de entidades, scores de confiança e cadeias de evidência auditáveis para jurídico e compliance.",
    website: "https://proofchain.rodolforomao.com.br",
  },
  {
    name: "FinancialIQ",
    descriptionEn:
      "Enterprise financial intelligence SaaS: cash flow, bank reconciliation, semantic AI categorization, OCR for receipts, smart alerts, and multi-tenant workspaces. Modular Laravel architecture with Telegram/WhatsApp notifications and CFO-grade dashboards.",
    descriptionPt:
      "SaaS financeiro enterprise: fluxo de caixa, conciliação bancária, categorização semântica com IA, OCR de comprovantes, alertas inteligentes e workspaces multi-tenant. Arquitetura modular em Laravel com notificações Telegram/WhatsApp e painéis para decisão financeira.",
    website: "https://financialiq.rodolforomao.com.br",
  },
  {
    name: "Smart Condo",
    descriptionEn:
      "All-in-one condominium management: syndics, administrators, residents, and staff share finance (charges, payables, chart of accounts), notices, service tickets, units, and granular role-based menus in a single Laravel platform.",
    descriptionPt:
      "Gestão condominial completa: síndicos, administradores, moradores e equipe usam financeiro (cobranças, despesas, plano de contas), avisos, ocorrências, unidades e menus com permissões granulares em uma única plataforma Laravel.",
    website: "https://smartcondo.rodolforomao.com.br",
  },
  {
    name: "BitBooking",
    descriptionEn:
      "Short-term rental marketplace with instant PIX checkout, automatic reservation confirmation, host property management, guest bookings, and map-based discovery — built for the Brazilian market with Liquid/Depix settlement for hosts.",
    descriptionPt:
      "Marketplace de aluguel por temporada com checkout PIX instantâneo, confirmação automática de reservas, gestão de imóveis para anfitriões, reservas de hóspedes e busca no mapa — focado no Brasil, com liquidação Liquid/Depix para anfitriões.",
    website: "https://bitbooking.rodolforomao.com.br",
  },
  {
    name: "Atendente",
    descriptionEn:
      "WhatsApp-first customer service SaaS: configurable AI agents, conversation inbox, leads, appointments, PIX billing, analytics, and Telegram integrations — one panel for teams that need speed, control, and human handoff.",
    descriptionPt:
      "SaaS de atendimento via WhatsApp: agentes de IA configuráveis, caixa de conversas, leads, agendamentos, cobrança PIX, métricas e integrações Telegram — um painel para equipes que precisam de velocidade, controle e repasse humano.",
    website: "https://atendente.rodolforomao.com.br",
  },
  {
    name: "Residencial Oliveiras",
    descriptionEn:
      "Hospitality website for a lodging business in Brasília: responsive landing page, apartment photo galleries, WhatsApp and email contact, and a PHP receipt module for booking records.",
    descriptionPt:
      "Site institucional de hospedagem em Brasília: página responsiva, galerias de apartamentos, contato por WhatsApp e e-mail, e módulo PHP de comprovantes de reserva.",
    website: "https://residencialoliveiras.rodolforomao.com.br",
  },
];

export const WORK_PROJECTS = [
  {
    name: "Supra",
    descriptionEn:
      "Advanced Supervision System developed and implemented at DNIT, bringing real-time transparency to federal road construction data and enabling faster, more assertive decision-making.",
    descriptionPt:
      "Sistema de Supervisão Avançada, desenvolvido e implementado no DNIT, trazendo transparência em tempo real das informações de obras rodoviárias federais e permitindo decisões mais assertivas.",
    website: "https://supra.dnit.gov.br",
  },
  {
    name: "Portal Cidadão",
    descriptionEn:
      "DNIT's Citizen Portal — the online portal for citizens to access information and services related to Brazil's National Department of Transport Infrastructure.",
    descriptionPt:
      "Portal Cidadão do DNIT — portal online para cidadãos acessarem informações e serviços do Departamento Nacional de Infraestrutura de Transportes.",
    website: "https://servicos.dnit.gov.br/portalcidadao",
  },
  {
    name: "SCM - DICI",
    descriptionEn:
      "Anatel's telecommunications sector data collection system — mandatory reporting for all providers on services, economic, and infrastructure data.",
    descriptionPt:
      "Sistema de coleta de dados setoriais de telecomunicações da Anatel — envio obrigatório para todos os provedores de dados de serviços, econômicos e de infraestrutura.",
    website: "http://dici.scmengenharia.com.br",
  },
  {
    name: "Atlas - App",
    descriptionEn:
      "Mobile app to download a state-by-state PDF of Brazilian highway construction works and their status, for strategic decision-making.",
    descriptionPt:
      "Aplicativo mobile para download de PDF por estado com as obras de construção de rodovias e sua situação, para tomada de decisão estratégica.",
    website:
      "https://play.google.com/store/apps/details?id=br.gov.dnit.supra.atlas&pcampaignid=web_share",
  },
  {
    name: "Portal Cidadão - App",
    descriptionEn:
      "Mobile companion to the DNIT Citizen Portal, giving citizens on-the-go access to transport infrastructure services.",
    descriptionPt:
      "Aplicativo mobile complementar ao Portal Cidadão do DNIT, levando os serviços de infraestrutura de transportes ao celular do cidadão.",
    website:
      "https://play.google.com/store/apps/details?id=br.gov.dnit.servicos.portalcidadao&pcampaignid=web_share",
  },
  {
    name: "SCM Engenharia - DICI - App",
    descriptionEn:
      "Mobile app for Anatel's DICI sector data collection system, for providers to report service, economic, and infrastructure data on the go.",
    descriptionPt:
      "App mobile do sistema DICI da Anatel, para provedores enviarem dados de serviços, econômicos e de infraestrutura pelo celular.",
    website:
      "https://play.google.com/store/apps/details?id=br.com.scmengenharia.dicii&pcampaignid=web_share",
  },
  {
    name: "Polybit",
    descriptionEn:
      "Web platform for weekly raffles built in Laravel, inspired by the Mega-Sena model.",
    descriptionPt:
      "Plataforma web em Laravel para sorteios semanais, inspirada no modelo da Mega-Sena.",
    ghLink: "https://github.com/rodolforomao/polybit",
  },
  {
    name: "Smart Condo (Laravel 11)",
    descriptionEn:
      "Complete condominium management system rebuilt on Laravel 11, centralizing the entire condominium routine in a single digital platform.",
    descriptionPt:
      "Sistema de gestão condominial reconstruído em Laravel 11, centralizando toda a rotina do condomínio em uma única plataforma digital.",
    ghLink: "https://github.com/rodolforomao/smart_condo",
  },
  {
    name: "DICI Simples (Anatel/SCM)",
    descriptionEn:
      "Simplified interface for Anatel's DICI sector-data system, built with React, TypeScript, and Vite.",
    descriptionPt:
      "Interface simplificada do sistema DICI da Anatel, construída com React, TypeScript e Vite.",
    ghLink: "https://github.com/RodrigoSCM1/dici-simples-anatel-scm-engenharia",
  },
];

export function projectText(locale, project) {
  return locale === "pt-br" ? project.descriptionPt : project.descriptionEn;
}
