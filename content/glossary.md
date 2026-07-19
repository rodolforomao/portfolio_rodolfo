---
title: "Glossário técnico"
slug: glossario
type: glossary
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "58 termos extraídos do conteúdo real do site e do currículo (auditoria de entidades, 2026-07-18). Cada entrada segue o padrão: definição, sinônimos, relacionados, pilar. Link interno = para qual pilar/artigo este termo aponta quando publicado."
---

# Glossário técnico

Termos usados neste site, explicados no nível de detalhe que um leitor precisa para entender o resto do conteúdo — não é um glossário genérico de blockchain/dev, é o vocabulário específico dos projetos reais listados em [/project](/project) e no [currículo](/resume).

## Pilar 1 — Blockchain, Liquid Network & DeFi

**Liquid Network** — Sidechain do Bitcoin com transações confidenciais e liquidação mais rápida que a mainnet. *Sinônimos:* Liquid, Elements Sidechain. *Relacionados:* L-BTC, Elements, Confidential Transactions. Usada em [LiquidX.pro](/content/experience-articles/liquid-network-depix-payment-gateway) e no [Market Maker](/content/experience-articles/market-maker-liquid-network).

**L-BTC** — Representação do Bitcoin nativa da Liquid Network; o ativo que circula na rede em vez do BTC da mainnet diretamente. *Sinônimos:* Liquid Bitcoin. *Relacionados:* Liquid Network, UTXO.

**Elements** — Software/protocolo de código aberto por trás da Liquid Network; usado para gestão automatizada de carteiras. *Sinônimos:* Elements Core. *Relacionados:* Liquid Network, Wallet RPC.

**SideSwap** — DEX (exchange descentralizada) que opera sobre a Liquid Network; onde o Market Maker deste site posiciona ordens. *Relacionados:* DEX, Liquid Network, Wallet RPC.

**DEX** — Exchange descentralizada: negociação de ativos sem uma entidade central custodiando ordens. *Sinônimos:* Decentralized Exchange. *Relacionados:* AMM, DEX Aggregator, Liquidity Pool.

**DEX Aggregator** — Serviço que agrega liquidez de múltiplos DEXs para oferecer melhor execução; o ispbanking (parte do trabalho na LiquidX) é um exemplo. *Sinônimos:* Agregador de liquidez. *Relacionados:* DEX, Bridge, AMM.

**AMM (Automated Market Maker)** — Mecanismo de precificação/liquidez algorítmico, sem livro de ordens central; a base conceitual do sistema descrito em [O que aprendi construindo um Market Maker](/content/experience-articles/market-maker-liquid-network). *Relacionados:* DEX, Liquidity Pool, Slippage.

**Bridge (cross-chain)** — Mecanismo que conecta/transfere valor entre blockchains diferentes; usado para ligar Liquid Network, Polygon e Solana no ispbanking. *Sinônimos:* Ponte cross-chain. *Relacionados:* DEX Aggregator, Liquid Network, Polygon, Solana.

**Wallet RPC** — Interface de chamada remota para operar uma carteira blockchain programaticamente, sem interface gráfica. *Relacionados:* Elements, Vault, Signer Service.

**Stablecoin** — Token cujo valor é atrelado a um ativo estável (geralmente uma moeda fiduciária). *Sinônimos:* Moeda estável. *Relacionados:* DePix, PIX.

**DePix** — Stablecoin brasileira que roda sobre a Liquid Network, recebida via PIX no gateway da LiquidX. *Relacionados:* Stablecoin, PIX, Liquid Network.

**PIX** — Sistema de pagamento instantâneo do Banco Central do Brasil; o "trilho" fiat que o gateway da LiquidX converte em DePix. *Relacionados:* DePix, BitBooking, Stablecoin.

**Bitcoin** — Criptomoeda/rede base sobre a qual a Liquid Network opera como sidechain. *Sinônimos:* BTC. *Relacionados:* Liquid Network, L-BTC.

**Polygon** — Blockchain compatível com EVM, integrada ao bridge do ispbanking. *Sinônimos:* Matic. *Relacionados:* Bridge, Solana, DeFi.

**Solana** — Blockchain de alta performance, integrada ao bridge do ispbanking. *Sinônimos:* SOL. *Relacionados:* Bridge, Polygon, DeFi.

**DeFi** — Finanças descentralizadas: categoria geral de aplicações financeiras sem intermediário central. *Sinônimos:* Decentralized Finance. *Relacionados:* AMM, DEX, Liquidity Pool.

**Confidential Transactions** — Recurso nativo da Liquid Network que oculta o valor movimentado em uma transação, mantendo-o privado mesmo em uma rede pública. *Sinônimos:* CT. *Relacionados:* Liquid Network, UTXO.

**UTXO** — Modelo de contabilidade ("unspent transaction output") usado por Bitcoin e Liquid Network para representar saldo como um conjunto de saídas não gastas. *Relacionados:* Bitcoin, L-BTC, Confidential Transactions.

**Multisig** — Esquema de assinatura múltipla, onde mais de uma chave precisa autorizar uma transação. *Sinônimos:* Multi-assinatura. *Relacionados:* Vault, Signer Service, Custódia.

**Vault (custódia)** — Componente responsável por guardar e proteger chaves privadas, isolado do restante do sistema. *Sinônimos:* Cofre de chaves. *Relacionados:* Signer Service, SealedBox, Multisig. Ver o modelo real usado no [artigo sobre o Market Maker](/content/experience-articles/market-maker-liquid-network).

**Signer Service** — Serviço que assina transações em nome de uma carteira, separando a custódia da lógica de negócio. *Sinônimos:* Serviço de assinatura. *Relacionados:* Vault, HSM, Wallet RPC.

**SealedBox** — Primitiva de criptografia de chave pública (baseada em X25519/Curve25519) usada para envelopar segredos de forma que só o dono da chave privada correspondente consiga abrir. *Relacionados:* HKDF, Vault, Signer Service.

**HKDF** — HMAC-based Key Derivation Function: função que deriva uma chave criptográfica forte a partir de um segredo (por exemplo, um valor aleatório), usada em esquemas de custódia de chaves. *Relacionados:* SealedBox, Vault, Criptografia.

**Liquidity Pool** — Reserva de ativos que alimenta um AMM/DEX, permitindo troca sem contraparte direta. *Sinônimos:* Pool de liquidez. *Relacionados:* AMM, DEX, Slippage.

**Slippage** — Diferença entre o preço esperado e o preço efetivamente executado numa troca via AMM/DEX, geralmente por movimento de mercado entre o envio e a execução da ordem. *Sinônimos:* Derrapagem de preço. *Relacionados:* AMM, Liquidity Pool.

**Blockchain Forensics** — Investigação e rastreamento de ativos em blockchain com fins probatórios; a base do produto Proofchain. *Sinônimos:* Forense blockchain. *Relacionados:* Entity Graph, Confidence Scoring.

**Entity Graph** — Grafo de relacionamento entre endereços/entidades usado em investigação blockchain, como no Proofchain. *Sinônimos:* Grafo de entidades. *Relacionados:* Blockchain Forensics.

**Flash Crash Protection** — Conjunto de respostas automáticas e escalonadas (alerta, pausa, cancelamento, bloqueio) a quedas bruscas de preço em curto intervalo de tempo, usado para proteger um sistema de market making. Ver detalhe em [O que aprendi construindo um Market Maker](/content/experience-articles/market-maker-liquid-network). *Relacionados:* AMM, Price Oracle.

**Price Oracle** — Fonte externa de preço usada para validar decisões automatizadas; sistemas robustos consultam múltiplos oráculos independentes em vez de confiar em um só. *Relacionados:* Flash Crash Protection, AMM.

## Pilar 2 — Software Engineering & Full Stack Development

**Laravel** — Framework PHP usado na maioria dos produtos SaaS próprios e em projetos de clientes. *Relacionados:* PHP, CodeIgniter, Multi-tenant.

**CodeIgniter** — Framework PHP mais antigo, ainda em uso em sistemas legados do DNIT (SUPRA, Portal Cidadão) e da Anatel (DICI). *Sinônimos:* CI. *Relacionados:* PHP, Laravel.

**Multi-tenant Architecture** — Arquitetura em que uma única aplicação atende múltiplos clientes com dados isolados logicamente entre si. *Sinônimos:* Multi-inquilino. *Relacionados:* Laravel, SaaS.

**REST API** — Estilo arquitetural de API via HTTP, usado na maioria das integrações do DNIT e dos produtos próprios. *Relacionados:* SOAP API, Wallet RPC.

**SOAP API** — Protocolo de integração baseado em XML, mais antigo que REST, ainda exigido por alguns sistemas terceiros integrados ao DNIT. *Sinônimos:* Simple Object Access Protocol. *Relacionados:* REST API.

**SSR vs. CSR** — Server-Side Rendering vs. Client-Side Rendering: onde o HTML de uma página é gerado — no servidor (SSR) ou no navegador via JavaScript (CSR). Este site é CSR (React sem SSR), o que foi o achado central da auditoria de LLM SEO. *Relacionados:* React, Node.js.

**ETL** — Extract, Transform, Load: pipeline de extração/transformação/carga de dados, usado em migrações como a de Oracle para SQL Server no trabalho de consultoria em TI. *Sinônimos:* Pipeline ETL. *Relacionados:* SQL Server.

**WebSocket** — Protocolo de comunicação bidirecional em tempo real sobre uma única conexão TCP; usado tanto no gateway da LiquidX quanto no console do Market Maker. *Sinônimos:* WS. *Relacionados:* Liquid Network.

**Flutter** — Framework multiplataforma usado nos apps móveis Atlas (DNIT), SCM Mobile e Portal Cidadão App. *Relacionados:* Mobile, DNIT.

## Pilar 3 — Government Systems / GovTech

**DNIT** — Departamento Nacional de Infraestrutura de Transportes: autarquia federal brasileira, empregadora desde 2018. *Relacionados:* SUPRA, SIMA, Portal Cidadão.

**SUPRA** — Sistema de Supervisão Avançada: plataforma de monitoramento de obras públicas em tempo real do DNIT, reconhecida pela CGU e pelo TCU pela transparência que oferece. *Relacionados:* DNIT, CGU, TCU.

**SIMA** — Sistema desenvolvido para o DNIT, voltado a monitoramento de infraestrutura. *Relacionados:* DNIT, SUPRA.

**Portal Cidadão** — Portal público do DNIT para acesso a informações e serviços por cidadãos. *Sinônimos:* Portal Cidadão DNIT. *Relacionados:* DNIT, SUPRA, Transparência.

**DICI** — Sistema de Dados, Informações, Conhecimento e Inteligência da Anatel; coleta de dados setoriais de telecomunicações, obrigatória para todos os provedores. *Relacionados:* Anatel, SCM Engenharia.

**CGU** — Controladoria-Geral da União: órgão de controle federal brasileiro que reconheceu o SUPRA pela transparência. *Sinônimos:* Controladoria-Geral da União. *Relacionados:* TCU, SUPRA.

**TCU** — Tribunal de Contas da União: órgão de controle federal brasileiro. *Sinônimos:* Tribunal de Contas da União. *Relacionados:* CGU, SUPRA.

**SEI** — Sistema Eletrônico de Informações: sistema de processo administrativo do governo brasileiro, tema de uma extensão de navegador construída como projeto pessoal. *Sinônimos:* Sistema Eletrônico de Informações. *Relacionados:* GovTech.

## Pilar 4 — Artificial Intelligence & LLMs

**OpenAI API** — API de modelos de linguagem da OpenAI, usada na categorização por IA do FinancialIQ e nos agentes do Atendente. *Sinônimos:* GPT API. *Relacionados:* Prompt Engineering, LLM.

**Prompt Engineering** — Prática de desenhar instruções para obter respostas confiáveis e previsíveis de um modelo de linguagem. *Sinônimos:* Engenharia de prompt. *Relacionados:* OpenAI API, LLM, RAG.

**LLM** — Large Language Model: modelo de linguagem de grande escala, treinado para gerar e entender texto. *Sinônimos:* Modelo de linguagem. *Relacionados:* OpenAI API, Llama 2, Prompt Engineering.

**RAG** — Retrieval-Augmented Generation: técnica que combina busca em uma base de conhecimento com geração de texto via LLM, para que a resposta seja fundamentada em dados reais em vez de só "memória" do modelo. É exatamente o padrão usado pelo chat de IA deste site (grounded no JSON de contexto do currículo). *Sinônimos:* Geração aumentada por recuperação. *Relacionados:* LLM, Knowledge Base, Prompt Engineering.

**OCR** — Optical Character Recognition: reconhecimento óptico de caracteres, usado para extrair dados de comprovantes no FinancialIQ. *Sinônimos:* Reconhecimento óptico de caracteres. *Relacionados:* FinancialIQ, IA.

**Llama 2** — Modelo de linguagem de código aberto, usado em um projeto pessoal de chatbot. *Sinônimos:* LLaMA 2. *Relacionados:* LLM, OpenAI API.

**LLM SEO / GEO** — Otimização de conteúdo para ser encontrado, entendido e citado por modelos de linguagem e motores de busca generativos, em vez de (ou além de) motores de busca tradicionais. Este próprio site é objeto de um processo documentado de LLM SEO — ver [Como estruturar um projeto React pensando em LLM SEO](/content/experience-articles/estruturar-projeto-react-llm-seo). *Sinônimos:* Generative Engine Optimization, GEO. *Relacionados:* JSON-LD, Entity SEO, Knowledge Graph.

## Pilar 5 — DevOps & Infraestrutura

**Docker** — Plataforma de containerização, usada em projetos do DNIT e em produtos próprios. *Relacionados:* CI/CD, Linux.

**CI/CD** — Continuous Integration / Continuous Delivery: automação de build, teste e implantação de software. *Sinônimos:* Integração e entrega contínua. *Relacionados:* Docker, Git.

**HestiaCP** — Painel de controle de hospedagem usado no deploy de sites institucionais em VPS. *Sinônimos:* Hestia Control Panel. *Relacionados:* VPS, Apache, Nginx.

**Debian / Ubuntu** — Distribuições Linux usadas em produção, tanto no gateway da LiquidX (Debian) quanto no toolstack geral. *Sinônimos:* Linux. *Relacionados:* Apache2, Nginx.
