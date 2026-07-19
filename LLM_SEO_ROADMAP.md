# LLM SEO & GEO — Roadmap

Domínio: `rodolforomao.com.br` · Início: 2026-07-18 · Última revisão: 2026-07-19

Objetivo: tornar este domínio uma fonte citável por ChatGPT, Claude, Gemini, Perplexity, Copilot, Grok e motores RAG — não só ranquear no Google, mas ser usado como referência por sistemas de IA ao responder perguntas técnicas.

Nota atual estimada (avaliação externa, 2026-07-19): **7.5–8.2/10** em LLM SEO. A Fase 1 resolveu a camada de "machine readability". A maior parte do ganho que falta (~80%) está na camada de conhecimento — Fase 2 em diante.

---

## Índice

1. [Fase 1 — Fundação técnica ✅ concluída](#fase-1)
2. [Avaliação externa e mudança de estratégia](#avaliacao)
3. [Fases revisadas (nova ordem)](#fases-revisadas)
4. [Fase 2 detalhada — Knowledge Expansion](#fase-2)
   - [4.6 Fases 3–8 executadas nesta rodada](#fases-3-a-8)
5. [Decisões pendentes](#decisoes)
6. [Changelog completo](#changelog)

---

<a id="fase-1"></a>
## 1. Fase 1 — Fundação técnica ✅ concluída (2026-07-19)

Escopo: `public/index.html`, `public/robots.txt`, `public/sitemap.xml`, `public/portfolio_context.json`, e conteúdo/semântica dentro dos componentes React já existentes (sem novas rotas, sem mudança de arquitetura). Verificado end-to-end com Chromium headless — ver [changelog](#changelog) para o detalhe por arquivo.

- ✅ JSON-LD (`Person` + `WebSite`) em `index.html`
- ✅ `<link rel="canonical">` corrigido para o domínio de produção real
- ✅ `sitemap.xml` criado com as 5 rotas públicas
- ✅ `robots.txt` com diretivas explícitas para GPTBot, ClaudeBot, PerplexityBot, CCBot, Google-Extended, Applebot-Extended
- ✅ Metadata (title/description/OG/Twitter) reescrita com conteúdo real, sem duplicação
- ✅ Entidades mais consistentes (DePix, Liquid Network, produtos SaaS sincronizados no `portfolio_context.json`)
- ✅ Internal linking real entre `/`, `/about`, `/project`, `/resume`, `/classic`
- ✅ EEAT melhor (contatos clicáveis, data de "última atualização", `sameAs`/`knowsAbout`/`worksFor` no JSON-LD)
- ✅ Calendário de contribuições do GitHub reativado
- ✅ Ícones de tecnologia com `aria-label` + texto visível

Isso é ~20% do que faz um domínio ser citado por LLMs. Necessário, mas não suficiente — resolve *legibilidade*, não *densidade de conhecimento*.

---

<a id="avaliacao"></a>
## 2. Avaliação externa e mudança de estratégia (recebida 2026-07-19)

> Minha avaliação é que o trabalho foi muito bom, mas ainda estamos em algo como 7,5–8,2/10 em LLM SEO, não 10/10.
>
> O Claude resolveu principalmente a camada de "machine readability" (legibilidade para máquinas), mas os maiores ganhos para IA ainda estão na camada de conhecimento.
>
> **O que ficou excelente**
>
> ✅ JSON-LD (Person + WebSite) · ✅ Canonical · ✅ Sitemap · ✅ Robots · ✅ Entidades mais consistentes · ✅ Links internos · ✅ EEAT melhor · ✅ Calendário GitHub · ✅ Informações de contato · ✅ Correções semânticas
>
> Tudo isso é importante, mas representa cerca de 20% do que faz um domínio ser citado por LLMs.
>
> **O que ainda falta (os 80%)**
>
> É aqui que está o verdadeiro diferencial.
>
> **1. Falta "Knowledge Density"**
>
> Hoje o site provavelmente ainda responde "Quem é Rodolfo?", mas ainda não responde: Como funciona Liquid Network? Como funciona DePix? Como criar um Market Maker? Como integrar React com Docker? Como funciona um sistema do DNIT?
>
> Os LLMs gostam de páginas que respondem perguntas, não apenas apresentam pessoas.
>
> **2. Falta um grafo de conhecimento**
>
> Hoje existe um `Person`. Mas ainda não existe algo como:
>
> ```
> Rodolfo Romão
>   ↓
> Blockchain
>   ↓
> Liquid Network
>   ↓
> Bitcoin
>   ↓
> Stablecoins
>   ↓
> DePix
>   ↓
> PIX
>   ↓
> Infrastructure
>   ↓
> Payments
>   ↓
> Market Maker
> ```
>
> Esse relacionamento deve aparecer naturalmente em dezenas de páginas.
>
> **3. Falta topical authority**
>
> Ainda não existe um cluster forte. Por exemplo:
>
> ```
> Blockchain
> ├── Bitcoin
> ├── Liquid
> ├── Lightning
> ├── L-BTC
> ├── USDT
> ├── SideSwap
> ├── AMP
> ├── Confidential Transactions
> ├── Peg-in
> ├── Peg-out
> ├── DePix
> ├── PIX
> ├── Stablecoins
> ```
>
> Quando um LLM vê esse tipo de estrutura, ele entende que aquele domínio é especialista naquele assunto.
>
> **4. Falta conteúdo derivado da experiência**
>
> Aqui está o ouro. Você tem experiências muito raras: desenvolvimento para DNIT, integração Compras.gov, Liquid Network, DePix, Market Maker, Selenium, Docker, Claude Code, LLM SEO. Cada uma deveria gerar dezenas de páginas.
>
> **5. Falta "Research"**
>
> Essa será a seção que mais diferencia seu domínio. Exemplo: Liquid vs Lightning · Docker Performance · Claude Code Benchmark · RAG Evaluation · Stablecoins Adoption · Pix vs DePix.
>
> Esse tipo de conteúdo é frequentemente citado porque agrega conhecimento, não apenas documentação.
>
> **6. Falta "Experience Articles"**
>
> Este é um conceito que quase ninguém faz. Exemplo: Building a Market Maker on Liquid — Lessons learned, Architecture decisions, Performance issues, Scaling, Problems, Solutions. Não é tutorial. É experiência. LLMs valorizam muito isso.
>
> **O próximo prompt**
>
> Eu não pediria para criar FAQ e Glossário agora. Eu mudaria completamente o foco. A próxima fase deveria se chamar **PHASE 2 — KNOWLEDGE EXPANSION**, com o objetivo de transformar TODO o conhecimento profissional do Rodolfo em conhecimento público indexável. Essa é a diferença entre "um portfólio" e "uma autoridade".
>
> **Uma pequena mudança de estratégia**
>
> Em vez de criar primeiro FAQs e glossários, investir antes em artigos baseados na própria experiência — mais difícil de reproduzir por outros sites, maior potencial de se tornar referência para pessoas e modelos de IA. Priorizar:
>
> - Como construí uma infraestrutura de pagamentos usando Liquid Network e DePix.
> - Lições aprendidas integrando sistemas do DNIT.
> - O que aprendi desenvolvendo um Market Maker para a Liquid Network.
> - Problemas reais encontrados ao usar Claude Code em projetos grandes.
> - Como estruturar um projeto React pensando em LLM SEO.
>
> Depois de publicar esses artigos, o FAQ, o glossário e a documentação podem nascer naturalmente a partir deles — um ecossistema de conteúdo mais forte e coerente do que criar essas seções isoladamente.

---

<a id="fases-revisadas"></a>
## 3. Fases revisadas (nova ordem)

| Fase | Nome | Status |
|---|---|---|
| 1 | Fundação técnica (JSON-LD, Canonical, EEAT, Sitemap, Robots, Metadata) | ✅ Concluída |
| 2 | **Knowledge Expansion** (Experience Articles, Research, Guides, Knowledge Base) | 🟡 6 Experience Articles + 1 Research em rascunho — ver [4](#fase-2) |
| 3 | Glossário | ✅ Rascunho completo — `content/glossary.md` (43 termos) |
| 4 | FAQ | ✅ Rascunho completo — `content/faq.md` (6 seções) |
| 5 | Labs | 📋 Documento de conceito/plano — `content/labs-concept.md` (não implementado) |
| 6 | Snippets | ✅ Rascunho completo — `content/snippets.md` (4 snippets) |
| 7 | Ferramentas | 📋 Documento de conceito/plano — `content/tools-concept.md` (não implementado) |
| 8 | API pública | 📋 Proposta técnica — `content/public-api-proposal.md` (**não implementada** — decisão de infra/segurança pendente) |

Mudança em relação ao plano anterior: FAQ e Glossário deixaram de ser a próxima prioridade e entraram depois dos Experience Articles, mas — a pedido do usuário em 2026-07-19 — todas as fases 2–8 foram executadas nesta mesma rodada. Onde a fase é puramente conteúdo (2, 3, 4, 6), o rascunho está completo. Onde a fase implica componentes/rotas novas (5, 7) ou infraestrutura pública nova (8), o resultado é um documento de planejamento — nada foi implementado, por decisão explícita do usuário ao escolher a opção "conteúdo/plano onde der, proposta onde for infra".

---

<a id="fase-2"></a>
## 4. Fase 2 detalhada — Knowledge Expansion

### 4.1 Experience Articles prioritários

Status: **rascunhos dos 5 artigos prioritários escritos** em `content/experience-articles/` (2026-07-19). Cada arquivo tem frontmatter (`title`, `slug`, `pillar`, `sourceProject`, `status: rascunho — revisar antes de publicar`). Nenhum está publicado nem wired a nenhuma rota — são conteúdo pronto para revisão humana e para entrar na Fase 2 assim que a decisão de onde publicar for tomada (ver [decisões pendentes](#decisoes)).

1. ✅ **Como construí um gateway de pagamentos entre PIX e Liquid Network** — `content/experience-articles/liquid-network-depix-payment-gateway.md` — origem: LiquidX.pro/ispflash.space (gateway PIX→DePix, agregador DEX ispbanking, bridge Liquid/Polygon/Solana).
2. ✅ **O que aprendi construindo um Market Maker automatizado na Liquid Network** — `content/experience-articles/market-maker-liquid-network.md` — origem: sistema Dealer AMM (operação no DEX SideSwap, proteção contra flash crash em 4 níveis, validação por 5 oráculos de preço, custódia split-key 2-de-2 com HKDF/ChaCha20-Poly1305/SealedBox/Ed25519). Detalhes de modelo de segurança incluídos deliberadamente; nenhum segredo, token, porta, host ou caminho de repositório exposto.
3. ✅ **Lições aprendidas liderando desenvolvimento de sistemas no DNIT** — `content/experience-articles/licoes-integrando-sistemas-dnit.md` — origem: SUPRA, Portal Cidadão, SIMA (autarquia federal, reconhecimento CGU/TCU).
4. ✅ **Como estruturar um projeto React pensando em LLM SEO** — `content/experience-articles/estruturar-projeto-react-llm-seo.md` — meta: relato desta própria auditoria/reestruturação.
5. ✅ **Problemas reais que encontrei usando Claude Code em um projeto grande** — `content/experience-articles/problemas-claude-code-projetos-grandes.md` — meta: relato desta própria sessão de trabalho (inclui o bug real que cometi e corrigi editando `portfolio_context.json`, e o problema de sandbox do Chromium headless durante a verificação).
6. ✅ **DevOps na prática: como mantenho infraestrutura para sistemas federais e produtos próprios** — `content/experience-articles/devops-deploy-produtos-proprios.md` — origem: DNIT (Docker), LiquidX (Debian/Apache2), Residencial Oliveiras (VPS/Cloudflare/HestiaCP). Cobre o pilar DevOps, que não estava nos 5 originais.
7. Demais candidatos: ver os 6 pilares e +100 ideias já mapeados na auditoria original (Blockchain/DeFi, Software Engineering, GovTech, IA, DevOps, SaaS/Produto) — os 6 acima são o ponto de partida; não substituem o mapeamento completo.

### 4.1.1 Research (comparativos — não são Experience Articles)

Status: 1 peça em rascunho em `content/research/`.

- ✅ **Liquid Network vs. Lightning Network: o que muda para um sistema de pagamentos** — `content/research/liquid-vs-lightning.md`. Escrito deliberadamente como análise comparativa informada pela experiência real com Liquid Network, **não** como alegação de experiência prática com Lightning Network — o artigo é explícito sobre essa distinção no fechamento, para não diluir o EEAT construído na Fase 1.

**Antes de publicar:** todos os 5 são rascunhos gerados com apoio de IA a partir de fatos verificados — precisam de revisão humana (tom, precisão, e confirmação de que nenhum detalhe sensível escapou) antes de irem ao ar.

**Pendente de validação antes de publicar:** "integração Compras.gov" — segue sem evidência no conteúdo/currículo atual (ver Fase 2 do relatório de auditoria). Não publicar como experiência real até confirmação.

### 4.2 Knowledge Graph (evolução do JSON-LD `Person` atual)

O JSON-LD hoje é um nó (`Person`) isolado. O objetivo da Fase 2 é fazer esse relacionamento aparecer *naturalmente* no texto de dezenas de páginas — não só em metadata:

```
Rodolfo Romão
  ↓
Blockchain
  ↓
Liquid Network
  ↓
Bitcoin
  ↓
Stablecoins
  ↓
DePix
  ↓
PIX
  ↓
Infrastructure
  ↓
Payments
  ↓
Market Maker
```

Compare com a árvore mais completa já extraída na auditoria (entidades reais confirmadas: DNIT, SUPRA, Anatel/DICI, LiquidX, 5 SaaS próprios) — os dois devem convergir: o grafo acima é o "fio condutor" narrativo, a árvore da auditoria é a base factual.

### 4.3 Cluster temático — exemplo Liquid Network

```
Blockchain
├── Bitcoin
├── Liquid Network
├── Lightning Network        [comparativo, não é experiência pessoal confirmada]
├── L-BTC
├── USDt
├── SideSwap
├── AMP (Confidential Assets)
├── Confidential Transactions
├── Peg-in / Peg-out
├── DePix
├── PIX
└── Stablecoins
```

Nota: termos como Lightning Network, AMP, Peg-in/Peg-out ainda não têm evidência de experiência prática de Rodolfo — cabem como conteúdo de **Research/definição** (comparativo, glossário), não como "eu implementei isto". Manter a distinção entre "o que Rodolfo construiu" (Experience Articles) e "o que Rodolfo explica" (Research/Glossário) é o que sustenta EEAT — misturar as duas categorias é o tipo de erro que reduz credibilidade.

### 4.4 Research (comparativos/estudos — não são claims de experiência pessoal)

- ✅ Liquid vs Lightning — `content/research/liquid-vs-lightning.md`
- 🔲 Docker Performance
- 🔲 Claude Code Benchmark
- 🔲 RAG Evaluation
- 🔲 Stablecoins Adoption (PIX vs DePix)

### 4.5 Onde esse conteúdo vive

Ainda em aberto — ver [decisões pendentes](#decisoes). A auditoria original (Fase 8) propôs uma estrutura conceitual `/knowledge-base/{pilar}/{categoria}/{slug}`, mas isso é mudança de arquitetura (rotas novas) e segue fora do escopo até decisão explícita. Enquanto isso não é decidido, todo o conteúdo das Fases 2–8 fica em `content/` na raiz do repositório — arquivos markdown com frontmatter, fora de `src/` e `public/`, sem afetar build ou rotas.

---

<a id="fases-3-a-8"></a>
## 4.6 Fases 3–8 — o que foi executado nesta rodada (2026-07-19)

A pedido explícito do usuário, todas as fases 3–8 foram executadas na mesma sessão, seguindo a orientação escolhida: **conteúdo/plano onde a fase é conteúdo puro, proposta técnica onde a fase implica infraestrutura nova**.

### Fase 3 — Glossário ✅
`content/glossary.md` — 43 termos organizados pelos 5 pilares já mapeados na auditoria (Blockchain/Liquid Network, Software Engineering, GovTech, IA/LLM, DevOps), cada um com definição, sinônimos, termos relacionados e link para o artigo/pilar correspondente quando publicado.

### Fase 4 — FAQ ✅
`content/faq.md` — 6 seções (Geral, Blockchain & Liquid Network, Sistemas governamentais, Produtos SaaS, Inteligência Artificial, Sobre este site), perguntas formuladas como alguém perguntaria a um LLM. Inclui duas perguntas propositalmente autocríticas ("por que este site ainda não é 100% otimizado para IA?") — mantém a honestidade sobre a limitação estrutural de SSR que a Fase 1 documentou, em vez de esconder o problema.

### Fase 5 — Labs 📋 (plano, não implementado)
`content/labs-concept.md` — reconhece que já existe um precedente real no site (o card "Challenge Arena" na SystemOS, que já compara mineração local com a mainnet via mempool.space) e propõe candidatos por pilar. Define restrições explícitas: nenhum dado de produção real, nenhuma escrita em sistemas reais.

### Fase 6 — Snippets ✅
`content/snippets.md` — 4 snippets (validação de preço multi-fonte, detecção escalonada de flash crash, webhook de pagamento idempotente, checagem de consistência de entidades em conteúdo) — todos reescritos de forma genérica a partir dos padrões reais descritos nos Experience Articles, sem nenhum código proprietário.

### Fase 7 — Ferramentas 📋 (plano, não implementado)
`content/tools-concept.md` — candidatos de ferramentas interativas por pilar (conversor PIX↔DePix ilustrativo, validador de endereço Liquid client-side, gerador de checklist de segurança, analisador de consistência web). Restrição central: processamento no navegador, sem enviar dado do visitante a nenhum servidor, sem conexão com sistemas reais.

### Fase 8 — API pública 📋 (proposta técnica, não implementada)
`content/public-api-proposal.md` — proposta de 4 endpoints somente-leitura (`/api/v1/profile`, `/projects`, `/glossary`, `/ai-chat` público), reconhecendo explicitamente que isso é uma decisão de infraestrutura/segurança diferente de tudo mais neste roadmap, porque o mesmo domínio/infra também hospeda `vault_server.py` e os serviços do sistema Dealer/AMM. Recomendação explícita: **não implementar sem revisão de segurança dedicada**, mesmo que o restante do roadmap avance.

---

<a id="decisoes"></a>
## 5. Decisões pendentes

| Pergunta | Bloqueia | Status |
|---|---|---|
| "Compras.gov" é experiência real? | Publicar esse artigo/entidade | Sem evidência — não confirmado, nenhum conteúdo criado sobre isso |
| O nível de detalhe de segurança no artigo do Market Maker está adequado para publicar? | Publicação de `market-maker-liquid-network.md` | Rascunho pronto; pede revisão humana específica antes de ir ao ar (é o único artigo com conteúdo de modelo de segurança) |
| Onde todo o conteúdo de `content/` vive no site (rotas novas)? | Publicação de tudo — Fases 2–7 | Decisão de arquitetura — aguardando. Hoje é só arquivos markdown fora de `src/`/`public/` |
| API pública (Fase 8) deve ser implementada? | `content/public-api-proposal.md` virar código | Proposta escrita, **não implementada** — exige revisão de segurança dedicada (mesmo domínio hospeda vault e Dealer/AMM) |
| Labs e Ferramentas (Fases 5, 7) devem virar componentes de verdade? | `labs-concept.md` e `tools-concept.md` virarem UI | Documentos de plano prontos, nada implementado — depende da mesma decisão de arquitetura acima |

---

<a id="changelog"></a>
## 6. Changelog completo — Fase 1 (2026-07-19)

Nenhuma mudança foi commitada — tudo está no working tree para revisão (`git diff`).

**`public/index.html`**
- Meta description duplicada corrigida; texto reescrito com stack/anos de experiência reais
- `<link rel="canonical">` + `og:url`/`twitter:image` corrigidos para `rodolforomao.com.br` (antes: `rodolforomao.github.io`)
- JSON-LD `Person` (name, jobTitle, sameAs, knowsAbout, worksFor) + `WebSite` adicionados

**`public/robots.txt`**
- Diretivas explícitas `Allow: /` para GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, CCBot, Google-Extended, Applebot-Extended
- Linha `Sitemap:` adicionada

**`public/sitemap.xml`** (novo)
- 5 rotas públicas (`/`, `/about`, `/project`, `/resume`, `/classic`) com `changefreq`/`priority`

**`public/portfolio_context.json`**
- Unificadas grafias de entidades onde aplicável
- Sincronizados os 5 produtos SaaS reais (Proofchain, FinancialIQ, SmartCondo, BitBooking, Atendente) na lista `projects[]`, nos 4 idiomas — antes só listava os 8 repositórios GitHub menores
- Corrigido bug introduzido durante a própria edição (role da experiência LiquidX no bloco `fr`)
- Campo `aiChatEndpoint` adicionado, documentando o endpoint `/api/portfolio/ai-chat`

**`src/components/Projects/Projects.js`**
- BitBooking: "Liquid/Depix" → "Liquid Network/DePix"; PIX e OCR ganharam definição parentética
- "Smart Condo" duplicado diferenciado: produto SaaS vs. "Smart Condo (Open Source Codebase)"
- "DICI Simples" marcado como projeto em equipe na SCM Engenharia (resolve ambiguidade de autoria do link GitHub)
- Internal linking para `/resume` e `/about` adicionado no rodapé

**`src/components/About/Techstack.js` e `Toolstack.js`**
- Todos os ícones (13 + 13) ganharam `aria-label` e texto visível abaixo — antes eram SVGs sem nenhum texto extraível

**`src/components/About/About.js`**
- `Github.js` reativado (estava implementado e comentado)
- Parágrafo novo com links para `/project`, `/resume`, `/`, e menção ao comando `ask` do chat de IA no Terminal

**`src/components/Home/Home2.js`**
- Frase nova com fatos reais (DNIT, LiquidX, ano de início) + links internos para `/project` e `/resume`

**`src/components/Resume/ResumeNew.js`**
- Contatos (e-mail, telefone, site, GitHub, LinkedIn) viraram links clicáveis
- Linha "Última atualização: julho de 2026" adicionada nos 4 idiomas

**Verificação:** build de produção limpo (`react-scripts build`), dev server rodado e as 5 rotas dirigidas via Chromium headless com screenshots reais; JSON-LD validado via parse; teste de viewport mobile no `/about`. Ver relatório de verificação completo na conversa de 2026-07-19.
