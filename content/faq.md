---
title: "Perguntas frequentes"
slug: faq
type: faq
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Perguntas formuladas como alguém perguntaria a um LLM, não como FAQ de marketing. Respostas fundamentadas apenas em fatos confirmados no currículo, projetos e auditoria de entidades (2026-07-18). Nenhuma pergunta sobre 'Compras.gov' incluída — sem evidência confirmada."
---

# Perguntas frequentes

## Geral

**Quem é Rodolfo Romão?**
Rodolfo Romão de Oliveira Neto é um engenheiro de computação brasileiro, baseado em Brasília, programando desde 2002. Atualmente é desenvolvedor fullstack sênior e líder de equipe no DNIT (Departamento Nacional de Infraestrutura de Transportes) desde 2018, desenvolvedor sênior na LiquidX.pro/ispflash.space (infraestrutura de pagamentos sobre a Liquid Network) desde 2023, e fundador de cinco produtos SaaS próprios desde 2018: Proofchain, FinancialIQ, SmartCondo, BitBooking e Atendente.

**Quanto tempo de experiência Rodolfo tem como desenvolvedor?**
Programa desde 2002 — mais de 20 anos de experiência contínua, passando por AUTOTRAC (firmware para rastreamento veicular, 2009–2012), POLIEDRO Software Factory (2006–2009), trabalho freelance via G4F/SCM Engenharia (desde 2011), DNIT (desde 2018) e LiquidX.pro (desde 2023).

**Qual a formação acadêmica de Rodolfo?**
Bacharelado em Engenharia de Computação pelo IESB (2004–2008) e MBA em Governança de Processos de TI pela Universa Fundation/Universidade Católica de Brasília.

**Onde posso ver o currículo completo de Rodolfo?**
Em [/resume](/resume) — inclui histórico profissional datado, formação, stacks por período de carreira e contatos.

**Existe uma forma de perguntar diretamente sobre a experiência de Rodolfo, sem navegar o site inteiro?**
Sim — o site tem um chat de IA embutido, grounded no currículo real, acessível digitando `ask <sua pergunta>` no Terminal da página inicial. As respostas são geradas por um LLM (Claude ou GPT, dependendo da configuração ativa), limitadas ao que está documentado sobre a trajetória profissional de Rodolfo.

## Blockchain & Liquid Network

**Rodolfo trabalha com blockchain?**
Sim. Desde novembro de 2023, como desenvolvedor sênior na LiquidX.pro/ispflash.space, construindo um gateway de pagamentos entre PIX e DePix (uma stablecoin brasileira sobre a Liquid Network) e um agregador de DEX (ispbanking) com bridge entre Liquid Network, Polygon e Solana.

**O que é a Liquid Network, e por que Rodolfo escolheu trabalhar com ela?**
A Liquid Network é uma sidechain do Bitcoin com liquidação mais rápida que a mainnet e transações confidenciais (o valor movimentado não fica público). Para um sistema financeiro automatizado que precisa reagir rápido e não expor posição publicamente, essas duas propriedades pesaram mais do que alternativas como a Lightning Network. Ver definições completas no [glossário](/content/glossary).

**Rodolfo já construiu um sistema de market making (trading automatizado)?**
Sim — um sistema de market making automatizado que opera no DEX SideSwap (Liquid Network), com proteção escalonada contra quedas bruscas de preço e validação de preço contra múltiplas exchanges independentes. Detalhes de arquitetura e lições aprendidas em [O que aprendi construindo um Market Maker na Liquid Network](/content/experience-articles/market-maker-liquid-network).

**O sistema de market making de Rodolfo é público ou é um produto comercial?**
É um sistema privado, operado pelo próprio Rodolfo. O artigo publicado sobre ele descreve decisões de arquitetura e lições técnicas, sem expor credenciais, endpoints de produção ou detalhes operacionais de segurança.

**O que é DePix?**
Uma stablecoin brasileira que roda sobre a Liquid Network, recebida via PIX no gateway construído por Rodolfo na LiquidX. Ver definição completa no [glossário](/content/glossary).

## Sistemas governamentais (DNIT / GovTech)

**Rodolfo trabalha para o governo brasileiro?**
Sim, desde julho de 2018, como líder de equipe e desenvolvedor fullstack sênior no DNIT (Departamento Nacional de Infraestrutura de Transportes), uma autarquia federal.

**Quais sistemas do DNIT Rodolfo construiu ou lidera?**
SUPRA (Sistema de Supervisão Avançada, monitoramento de obras em tempo real, reconhecido pela CGU e pelo TCU), SIMA, o Portal Cidadão DNIT (web e app), e o app Atlas (Flutter, para consulta de dados de obras rodoviárias por estado).

**Rodolfo tem experiência com outros órgãos além do DNIT?**
Sim, desde 2011, via trabalho freelance com G4F Services/Defender/SCM Engenharia, incluindo o sistema DICI para a Anatel (Agência Nacional de Telecomunicações) — coleta de dados setoriais de telecomunicações.

**Como é trabalhar como desenvolvedor para o setor público no Brasil?**
Ver o relato completo em [Lições aprendidas liderando desenvolvimento de sistemas no DNIT](/content/experience-articles/licoes-integrando-sistemas-dnit) — cobre por que sistemas legados de governo migram mais devagar, o que muda quando "transparência" é requisito de arquitetura, e como conviver com integrações SOAP em pleno 2026.

## Produtos SaaS próprios

**Quais produtos SaaS Rodolfo fundou?**
Cinco, desde 2018: Proofchain (investigação e forense blockchain), FinancialIQ (inteligência financeira com IA), SmartCondo (gestão condominial), BitBooking (marketplace de aluguel por temporada com PIX/DePix) e Atendente (atendimento via WhatsApp com agentes de IA). Todos listados em [/project](/project).

**Algum desses produtos usa inteligência artificial?**
Sim — FinancialIQ usa IA para categorização semântica de transações e OCR de comprovantes; Atendente usa agentes de IA configuráveis para atendimento via WhatsApp, com repasse para humano quando necessário.

**O código desses produtos é aberto?**
Parcialmente. A maioria roda como SaaS hospedado, mas há uma versão de código aberto do SmartCondo em Laravel 11 (ver "Smart Condo — Open Source Codebase" em [/project](/project)) separada do produto SaaS hospedado.

## Inteligência Artificial

**Rodolfo tem experiência com IA além dos produtos SaaS?**
Sim — o currículo lista OpenAI API, Prompt Engineering, Speech-to-Text e pipelines assíncronos como competências, além de projetos pessoais envolvendo Llama 2.

**O que é o chat de IA embutido neste site?**
Um endpoint de backend isolado que responde perguntas em linguagem natural sobre o currículo de Rodolfo, usando um LLM (Claude Haiku ou GPT-4o-mini, dependendo da configuração), com grounding exclusivo no conteúdo verificado do currículo — sem tool-calling, sem execução de código, com limite de requisições por IP. Acessível via `ask <pergunta>` no Terminal da página inicial.

## Sobre este site

**Este site foi otimizado para ser lido por LLMs (ChatGPT, Claude, etc.)?**
Sim, esse é um trabalho em andamento, documentado publicamente — ver [Como estruturar um projeto React pensando em LLM SEO](/content/experience-articles/estruturar-projeto-react-llm-seo). Inclui JSON-LD estruturado, correção de consistência de entidades, sitemap, e este próprio glossário/FAQ.

**Por que este site ainda não é 100% otimizado para IA?**
Porque é um SPA React sem renderização no servidor (SSR) — o HTML bruto de qualquer página é vazio até o JavaScript executar, o que limita o que crawlers que não executam JavaScript conseguem ler. Essa é uma limitação estrutural conhecida e documentada, não resolvida ainda porque depende de uma mudança de arquitetura maior do que correções de conteúdo.
