# Roadmap — Seção /system (Web OS)

Documento vivo. Fonte de verdade pra retomar o trabalho a qualquer momento e para os agentes
saberem o que já existe e o que falta antes de tocar em qualquer código. Ver plano completo em
`/home/black/.claude/plans/vivid-dreaming-rainbow.md` (fora do repo) para o racional completo.

## Regras fixas (não mudam entre fases)

- **Nunca tocar em:** `src/components/Dealer/`, `manager_dealer/` (repo separado),
  `vault_server.py`, `ws_relay_server.py`, `vault_data.db`.
- O backend novo (`portfolio_api_server.py`) é **processo e porta isolados** — nenhum import do
  vault/manager, nenhuma dependência compartilhada além de bibliotecas de terceiros.
- A IA do terminal (`ask <pergunta>`) **não tem tool-calling nem execução de código/comando/SQL**
  — só geração de texto grounded em `public/portfolio_context.json` (arquivo estático, fonte única
  compartilhada: o frontend faz `fetch("/portfolio_context.json")`, o backend lê o mesmo arquivo
  do disco).
- `/api/portfolio/stats` retorna um conjunto **fixo** de campos — sem parâmetros livres, sem
  paths, sem queries arbitrárias.
- Rate limiting obrigatório em `/api/portfolio/ai-chat` (por IP: poucos requests/min e por dia).
- Nenhuma chave de API (LLM, GitHub, etc.) no client — só via env server-side
  (`portfolio_api_server.py` lê de `.env`, nunca exposta ao React).
- **Nenhum agente commita, faz merge ou dá deploy.** Isso é decisão exclusiva do usuário.

## Status por fase

### Fase 0 — Fundação
- [x] `ROADMAP.md` criado
- [x] Rota `/system` criada (shell vazio, isolado, sem afetar rotas existentes)
- [x] `framer-motion` adicionado ao `package.json`
- [x] `portfolio_api_server.py` skeleton com `/health`
- [x] `public/portfolio_context.json` placeholder (fonte única: frontend fetch + backend disk-read)
- [x] `requirements-portfolio.txt` + `scripts/start-portfolio-api.sh`

Status: **done**
Notas: rotas existentes (`/`, `/about`, `/project`, `/resume`, `/macro-dashboard`, `/dealer`)
não foram tocadas. `portfolio_api_server.py` roda isolado na porta `8767` (padrão), sem import
de `vault_server.py`/`ws_relay_server.py`/`manager_dealer`.

### Fase 1 — MVP (Hero + Terminal + Stats + Timeline + IA no terminal)
- [x] Agent A — Hero animado + Terminal interativo (`src/components/SystemOS/Hero.js`,
      `Terminal.js`, `useTerminalAI.js`) — done. Hero: fetch de `portfolio_context.json` com
      fallback hardcoded, fundo de partículas (react-tsparticles) + entrada animada
      (framer-motion), roles em rotação. Terminal: whitelist fixa de comandos (`help`, `about`,
      `skills`, `projects`, `experience`, `contact`, `github`, `timeline`, `ask <pergunta>`,
      `clear`), nunca executa nada arbitrário, fallback amigável em qualquer erro do
      `/api/portfolio/ai-chat`. CSS prefixado `hero-`/`terminal-`, ainda não importados em
      `SystemOS.js` — aguardando quem faz a integração. `CI=true npx react-scripts build`
      passou sem novos erros/warnings.
- [x] Agent B — StatsPanel + Timeline (`StatsPanel.js`, `Timeline.js`): StatsPanel faz
      `fetch('/api/portfolio/stats')` e anima 6 tiles (years_coding, systems_delivered,
      languages, github_public_repos, github_followers, uptime_seconds) via
      requestAnimationFrame, com "—" para null/erro/loading. Timeline faz
      `fetch('/portfolio_context.json')`, ordena `timeline` por ano asc, expande/colapsa no
      clique (framer-motion), e mostra "Timeline em construção" com o array vazio atual.
      Ambos isolados (CSS prefixado `stats-`/`timeline-`), ainda não importados em
      `SystemOS.js` — aguardando quem faz a integração. `CI=true npx react-scripts build`
      passou sem novos erros/warnings.
- [x] Agent C — backend completo: `GET /api/portfolio/stats`,
      `POST /api/portfolio/ai-chat` (rate limit + proxy LLM, sem tools). `stats` retorna
      `{years_coding:int, systems_delivered:int, languages:int, github_public_repos:int|null,
      github_followers:int|null, uptime_seconds:int}` (constantes hardcoded + GitHub public API
      com cache de 10min, nunca falha o endpoint mesmo se GitHub estiver fora). `ai-chat` valida
      `message` (400 se ausente/vazio/>500 chars), rate limit por IP em memória (5/min, 20/dia,
      429 se estourar), lê `public/portfolio_context.json` do disco a cada chamada, chama
      Anthropic SDK (`claude-haiku-4-5-20251001`, sem tools/tool_choice) lendo
      `PORTFOLIO_AI_API_KEY` do `.env`; confirmado que com a chave ausente retorna 503
      `{"error":"IA indisponível no momento"}` de forma graciosa (sem crash/500). `anthropic`
      adicionado a `requirements-portfolio.txt`.

- [x] Integração — `SystemOS.js` agora renderiza `Hero` + `Terminal` + `StatsPanel` + `Timeline`
      (`SystemOS.css` ajustado de skeleton centralizado pra layout vertical com
      `.system-os-section`, max-width 960px). `src/setupProxy.js` criado (dev-only) com duas
      regras explícitas: `/api/vault` → `:8766`, `/api/portfolio` → `:8767` — o antigo
      `"proxy": "http://localhost:8766"` no `package.json` foi **removido** porque era um
      catch-all impreciso (baseado em heurística de header `Accept`) que capturava
      `/api/portfolio/*` e mandava pro alvo errado; as novas regras são estritamente mais
      precisas e preservam o mesmo alvo/comportamento pra `/api/vault/*` (único path que o
      frontend do Dealer realmente usa via proxy — confirmado em `vaultApi.js`).

Status: **done**
Notas: build de produção (`CI=true npx react-scripts build`) passou sem novos erros/warnings.
Testado localmente via CRA dev server: `/system` renderiza via SPA fallback, `/api/portfolio/stats`
e `/api/portfolio/ai-chat` respondem corretamente via proxy, `/dealer` e `/` continuam
funcionando normalmente. **Não** foi testado com `vault_server.py` rodando de verdade (não
iniciei o sistema de produção) — o roteamento do proxy pra `/api/vault` foi verificado por
inspeção de código + teste de que a requisição chega no alvo `:8766` (connection-refused
esperado, já que o vault não estava rodando neste teste).
Pendências antes de ir pra produção: preencher `public/portfolio_context.json` com dados reais
(hoje é placeholder — sem isso `about`/`skills`/`projects`/`experience`/`timeline`/IA ficam vazios
ou genéricos); definir `PORTFOLIO_AI_API_KEY` no `.env` real (a IA fica em 503 gracioso até lá);
ajustar `STATS_CONSTANTS` em `portfolio_api_server.py` (`years_coding`/`systems_delivered`/
`languages` são placeholders); revisar visualmente no navegador (não foi possível abrir um
browser real nesta sessão, só testado via curl/build).

### Fase 2 — Arquiteturas animadas + Projetos vivos + Lab de experimentos
Base compartilhada criada pelo orquestrador antes dos agentes (evita duplicação/corrida):
`src/components/SystemOS/validators.js` (isValidCPF/isValidCNPJ, mod-11 puro, testado com casos
conhecidos). `public/portfolio_context.json` populado com projetos reais de
github.com/rodolforomao (auto-extraído da API pública do GitHub — descrições são inferências
curtas a partir do nome do repo, sem inventar métricas).

- [x] Agent D — `ArchitectureFlow.js`/`.css`: diagrama animado (framer-motion) genérico
      `Cliente → API → Cache → Fila → Workers → Banco de Dados → Monitoramento`, nós/edges
      surgindo em sequência via `whileInView` + stagger, glow pulsante em CSS, legenda
      "já apliquei em sistemas de automação, blockchain e APIs financeiras" — sem
      hostnames/portas/nomes de serviço reais, sem citar Dealer/vault/manager_dealer/SideSwap.
      `ProjectsLive.js`/`.css`: duas demos ao vivo (CPF/CNPJ) 100% client-side usando
      `isValidCPF`/`isValidCNPJ` de `validators.js` (indicador de válido/inválido atualiza a
      cada tecla), mais grid de cards a partir de `fetch('/portfolio_context.json')` (`projects`),
      linkando pro `link` quando existe; falha de fetch só oculta o grid, nunca quebra a UI.
      `Lab.js`/`.css`: container que renderiza `<ArchitectureFlow />` + `<ProjectsLive />` sob
      "Laboratório", pronto pra a integração dropar `<Lab />` em `SystemOS.js`. CSS escopado
      (`arch-`/`projects-live-`/`lab-`). Nenhuma dependência nova; `SystemOS.js`/`validators.js`
      não foram tocados. `CI=true npx react-scripts build` passou sem novos erros/warnings
      (único warning é preexistente, de sourcemap ausente do `html2pdf.js`).

Status: **done**

### Fase 3 — Code Battles / "Desafie meu código"
- [x] Agent E — `ChallengeArena.js` + `ChallengeArena.css`: dois cartões ("Quebre o
      validador de CPF" / "Quebre o validador de CNPJ") usando `isValidCPF`/`isValidCNPJ`
      de `validators.js` (import, sem reimplementar lógica). Feedback ao vivo enquanto
      digita e no submit ("✅ passou! (raro — me avisa como!)" / "❌ inválido, tente
      outro"), animado com `framer-motion`. Contador de tentativas por desafio
      (`system_os_cpf_challenge_attempts` / `system_os_cnpj_challenge_attempts`) persistido
      em `localStorage`, com leitura/escrita protegidas por try/catch — se `localStorage`
      estiver indisponível (aba anônima/storage desabilitado), cai pro state do React em
      memória sem quebrar. 100% client-side, zero chamada de rede, zero dependência nova.
      CSS prefixado `challenge-`, sem seletor de elemento bare. Ainda não importado em
      `SystemOS.js` — aguardando integração. `CI=true npx react-scripts build` passou sem
      novos erros/warnings (só os warnings pré-existentes de browserslist/sourcemap do
      html2pdf.js).

Status: **done**

### Fase 4 — Developer Mode + decisão final sobre a Home
- [x] Agent F — `DeveloperMode.js` (overlay Ctrl+Shift+D) com métricas seguras: perf do
      client (Performance API) + novo `GET /api/portfolio/dev-metrics` isolado em
      `portfolio_api_server.py` (uptime, contagem de requests — nunca dados do Dealer/vault)

Status: **done** (falta só a decisão do usuário sobre a Home, abaixo)
Notas: `GET /api/portfolio/dev-metrics` adicionado a `portfolio_api_server.py` (endpoints
`/health`, `/api/portfolio/stats`, `/api/portfolio/ai-chat` mantidos intactos), retornando
exatamente `{uptime_seconds:int, request_count:int, github_public_repos:int|null,
github_followers:int|null}`. Reusa `PROCESS_START_TIME` e o cache de `_fetch_github_stats()`
já existentes (sem duplicar fetch/cache); `request_count` é um contador em memória
(`_REQUEST_COUNT`, module-level) incrementado por um middleware aiohttp
(`request_counter_middleware`) registrado uma vez em `build_app()` — conta toda request que
chega neste processo isolado, nada relacionado a Dealer/vault. Endpoint nunca 500 (GitHub
stats com fallback `None` em qualquer falha, mesmo estilo defensivo de `/api/portfolio/stats`).
Testado localmente: `/health`, `/api/portfolio/stats` e `/api/portfolio/dev-metrics` responderam
corretamente via curl (`request_count` incrementando a cada chamada), servidor de teste
finalizado ao fim da verificação.
`src/components/SystemOS/DeveloperMode.js` + `DeveloperMode.css` (prefixo `devmode-`) criados:
overlay `position: fixed`, HUD dark/monospace verde-âmbar, autocontido (`useState` próprio,
retorna `null` quando fechado — zero impacto de layout). Toggle via `Ctrl+Shift+D`
(`event.preventDefault()` no keydown), fecha com `Escape` ou botão `[x]`. Mostra client-side:
`performance.getEntriesByType('navigation')`/`performance.timing` (page load ms, com fallback
entre as duas APIs), `performance.getEntriesByType('resource').length`, `navigator.userAgent`
— tudo lido defensivamente em try/catch, nunca lança. Mostra server-side: fetch de
`/api/portfolio/dev-metrics` com estados de loading/erro que nunca derrubam o componente.
Não foi importado em `SystemOS.js` (fora do escopo deste agente) — pronto para ser adicionado
como `<DeveloperMode />` pelo orquestrador. `CI=true npx react-scripts build` passou sem novos
erros (só os warnings pré-existentes de browserslist/sourcemap do html2pdf.js).
Pendência: a decisão de substituir `/` pela nova experiência é do usuário — não foi feita
automaticamente ao final desta fase.

## Integração final (Fases 2-4)

`SystemOS.js` agora renderiza, em ordem: `Hero`, `Terminal`, `StatsPanel`, `Timeline`, `Lab`
(arquitetura + projetos vivos), `ChallengeArena` (desafie meu código), `DeveloperMode`
(overlay, sempre montado mas invisível até Ctrl+Shift+D). `public/portfolio_context.json`
populado com projetos reais extraídos de `github.com/rodolforomao` (API pública) — `experience`
e `timeline` seguem vazios de propósito (nunca inventamos datas/empresas/cargos).

Verificação final rodada pelo orquestrador:
- `CI=true npx react-scripts build` — sem novos erros/warnings.
- `portfolio_api_server.py` local: `/health`, `/api/portfolio/stats`, `/api/portfolio/dev-metrics`
  (contador incrementando a cada chamada) e `/api/portfolio/ai-chat` (503 gracioso sem chave)
  todos responderam corretamente via curl; processo de teste finalizado, porta liberada.
- Checagem estática de imports de `portfolio_api_server.py`: nenhum import de
  `vault_server`/`ws_relay_server`/`manager_dealer`.
- `git status`: nenhum arquivo fora do escopo desta seção foi tocado (`Dealer/`, `manager_dealer`,
  `vault_server.py`, `ws_relay_server.py`, `vault_data.db` intactos).

**Não testado**: navegador real (sem GUI nesta sessão — só curl/build/inspeção de código);
`vault_server.py` rodando de verdade em paralelo (não iniciei o sistema de produção, por regra).

### IA do terminal — dois provedores suportados
`ai_chat()` em `portfolio_api_server.py` agora suporta **OpenAI** (prioridade, se `OPENAI_API_KEY`
estiver definida — usa `_call_openai()` via aiohttp direto na Chat Completions API, sem SDK novo,
sem tools) **ou Anthropic** (fallback, `PORTFOLIO_AI_API_KEY`, inalterado). `OPENAI_MODEL`
(padrão `gpt-4o-mini`) e `OPENAI_BASE_URL` (padrão `https://api.openai.com/v1`) configuráveis.
Testado ao vivo com a chave OpenAI real do usuário: `/api/portfolio/ai-chat` respondeu 200 com
texto grounded em `portfolio_context.json`, sem tool-calling.
**Nota de segurança corrigida nesta sessão**: o usuário colou a chave OpenAI real em
`.env.example` (arquivo versionado) por engano — movida para `.env` (gitignored,
`.gitignore` linha `.env.*`), `.env.example` restaurado para placeholder. `.env` confirmado
não-rastreado pelo git (`git ls-files` não lista).

### Pendências antes de divulgar publicamente (resolvidas — ver seções abaixo)
1. ~~Chave de IA~~ — `OPENAI_API_KEY` real configurada no `.env`, testada e funcionando.
2. ~~`STATS_CONSTANTS`~~ — `years_coding` calculado (`CODING_SINCE_YEAR=2002`), `systems_delivered=18`,
   `languages=8` batem com o currículo real.
3. ~~`experience`/`timeline`/`linkedin`/`email`~~ — preenchidos com dados reais do currículo.
4. Descrições de projeto em `portfolio_context.json` — auto-extraídas do GitHub, ainda não
   curadas manualmente (item aberto, baixa prioridade).
5. ~~Teste visual~~ — feito via Playwright headless (ver seção "Verificação visual real" abaixo).

## Fase 5 — Deploy em produção (pipeline pronto, deploy real ainda não executado)

Backend `portfolio_api_server.py` seguia sem caminho de deploy pra VPS (só existia deploy de
vault/relay). Criado o espelho do padrão `deploy-vault-services.sh`:

- `scripts/deploy-portfolio-api.sh` — rsync de `portfolio_api_server.py` +
  `requirements-portfolio.txt` + `scripts/hestia-nginx-portfolio.conf` +
  `scripts/systemd/portfolio-api.service` pra VPS; cria `.env.portfolio` remoto (porta 8767 +
  chaves de IA vindas do `.env` local), venv + pip install, instala systemd unit, instala
  snippet nginx (`nginx.ssl.conf_portfolio`/`nginx.conf_portfolio`), reload nginx, e roda
  `verify-portfolio-prod.sh` no final.
- `scripts/deploy-production.sh` agora tem 3 passos: `[1/3]` frontend, `[2/3]` vault/relay,
  `[3/3]` portfolio-api (controlável via `DEPLOY_WITH_PORTFOLIO_API=0` pra pular).
- `.env.example` documentado com `DEPLOY_PORTFOLIO_PATH` e `DEPLOY_WITH_PORTFOLIO_API`.

**Não executado**: nenhum deploy real foi rodado (regra do projeto — deploy é decisão exclusiva
do usuário). Próximo passo é o usuário rodar `bash scripts/deploy-production.sh` (ou só
`deploy-portfolio-api.sh` pra isolar) quando quiser publicar.

## Decisão da Home (resolvida)

`/` agora é o Web OS (`SystemOS`) — decisão do usuário. A home antiga (`Home.js`) moveu para
`/classic`, acessível pelo item "Clássico" na Navbar (antigo item "System" foi removido/reaproveitado
pra isso, já que "/" agora cumpre esse papel). `/system` vira redirect (`Navigate to="/"`) pra não
quebrar quem já tinha esse link. Rotas `/about`, `/project`, `/resume`, `/macro-dashboard`,
`/dealer/*` não mudaram. Footer segue oculto em `/` (mesmo comportamento que tinha em `/system`)
e continua visível em `/classic` e nas demais páginas. Testado via curl com `Accept: text/html`
(SPA fallback) em `/`, `/classic`, `/system`, `/about`, `/dealer` — todos 200. Build de produção
sem novos erros/warnings.

Nada foi commitado em nenhuma fase.

## Atualizações pós-lançamento (i18n, currículo real, sazonal, easter eggs)

- **Currículo real**: `public/portfolio_context.json` validado contra `src/components/Resume/ResumeNew.js`.
  `years_coding` agora é calculado dinamicamente (`CODING_SINCE_YEAR = 2002` em
  `portfolio_api_server.py`), `systems_delivered = 18` e `languages = 8` batem com o currículo real
  (18 sistemas nomeados, 8 linguagens no grupo "Languages"). `experience[]`/`timeline[]` preenchidos
  com dados reais (cargos/empresas/períodos do currículo), nada inventado. `contact.email`/`linkedin`
  também vêm do currículo (já públicos em `/resume`).
- **i18n 4 idiomas**: `src/components/SystemOS/i18n.js` — `detectLocale()` (navigator.language ->
  pt-br/en/es/fr, default en) + dicionário de UI. `public/portfolio_context.json` reestruturado:
  `pt-br`/`en`/`es`/`fr` (chave `pt` renomeada pra `pt-br`; es/fr reaproveitam as traduções reais já
  existentes no Resume). Hero/ArchitectureFlow/ProjectsLive/StatsPanel/Timeline/ChallengeArena/
  DeveloperMode todos atualizados pra usar o dicionário + bloco de idioma detectado.
  **Exceção**: `Terminal.js` continua sempre em inglês (chrome/comandos reais) — simulação de
  terminal de verdade — exceto as respostas dos easter eggs, que são localizadas.
- **IA multilíngue**: system prompt do `ai_chat()` agora instrui o modelo a responder no mesmo
  idioma da pergunta (testado em PT e EN) e usa `current_year`/`codingSinceYear` pra calcular anos
  de experiência com precisão em vez de estimar.
- **Easter eggs no terminal**: comandos ocultos (não aparecem em `help`, como num terminal real):
  `ls`, `pwd`, `whoami`, `sudo`, `reboot`, `rm`, `cat`, `matrix`, `sl`, `exit`, `vi`/`vim`, `man` —
  respostas engraçadas, localizadas via `i18n.js`.
- **Tema sazonal**: `src/components/SystemOS/seasonalTheme.js` — só datas neutras/não-controversas
  (Copa do Mundo 2026: 11/jun–19/jul; São João: 12–24/jun; Natal: 15–26/dez; Ano Novo: 28/dez–3/jan).
  Aplica só um acento de cor nas partículas do Hero + um selinho discreto — não reestiliza o site
  inteiro. Explicitamente sem temas políticos/partidários/pautas sociais, por pedido do usuário.
- **Home**: `/` agora é o Web OS; `/classic` é a home antiga (item "Home Classic" na Navbar, 2ª
  posição). Menu (`Nav`) centralizado (`mx-auto` no lugar de `ms-auto`).
- **Segurança**: chave OpenAI real que foi parar em `.env.example` (versionado) por engano foi
  movida pra `.env` (confirmado não-rastreado pelo git); `ai_chat()` agora suporta OpenAI
  (prioridade, `gpt-4o-mini`) e Anthropic (fallback), ambos sem tool-calling.
- **Verificado**: build de produção limpo; backend reiniciado com o código mais recente e testado
  ao vivo (`/api/portfolio/stats` com números reais, `/api/portfolio/ai-chat` respondendo em PT e
  EN corretamente); processo antigo (rodando código desatualizado) identificado e substituído.

## Correções de carreira (direto do usuário, validado)

- Graduação IESB: adicionado marco "2008" na timeline (formado em Engenharia de Computação),
  em complemento ao "2004" (início) já existente — currículo já tinha o período 2004–2008 correto.
- LiquidX.pro / ispflash.space: data de início corrigida de Jan/2024 para **Nov/2023** (experience
  + timeline, todos os 4 idiomas).
- Novas entradas de experiência/timeline adicionadas (confirmadas pelo usuário como TI/software):
  - **SCM Engenharia** — Consultor de TI, 2016–presente.
  - **Locar Engenharia** — Desenvolvedor de TI, 2012–2018.
  - **Oec Empreendimentos** — Fundador, empresa própria, 2016–presente.
- Todas as adições em `public/portfolio_context.json`, replicadas nos 4 blocos de idioma
  (pt-br/en/es/fr), JSON validado (`python3 -m json.tool`), testado via `/api/portfolio/ai-chat`
  (IA já reflete as novas empresas/datas corretamente).

## Verificação visual real (Playwright + Chromium headless)

Rodei o dev server (`npm start`, :3000) + `portfolio_api_server.py` (:8767) e naveguei de
verdade em `/system` com Playwright, tirando screenshots de cada seção (Hero, Terminal + `help`,
Stats, Timeline, Lab/ArchitectureFlow/ProjectsLive, Challenge Arena, Developer Mode via
Ctrl+Shift+D) em desktop (1440×900) e mobile (390×844), e capturando `console --errors`.

**Bugs reais encontrados e corrigidos:**
- `Timeline.js` usava `key={entry.year}` — com duas entradas em "2016" (SCM Engenharia + Oec
  Empreendimentos) isso gerava `Warning: Encountered two children with the same key` no console.
  Corrigido pra `key={ano-título-índice}` (`toggleYear` virou `toggleEntry`, estado
  `openYear` virou `openKey`).
- `StatsPanel.css` usava `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))` — com 6
  tiles isso deixava a última linha com só 1 item e o resto da linha exposto como um retângulo
  verde vazio (o fundo do grid, sem tile por cima). Trocado pra `repeat(3, 1fr)` fixo (2 colunas
  em telas <640px) — grid 3×2 sempre completo, sem buracos.

Depois da correção: novo round de screenshots confirmou `console --errors: none`, grid de stats
sem buraco, timeline com as 12 entradas em ordem cronológica sem warning. Visual geral: estética
dark/monospace/verde consistente (Bloomberg/Palantir), responsivo em mobile, todas as seções
renderizando com dados reais (currículo, GitHub, stats do backend).

## Correção adicional: textos em PT vazando com navegador em inglês

Usuário reportou texto em português mesmo com navegador em inglês. Busca sistemática
(`grep` por palavras/acentos em PT fora do `i18n.js`) achou 2 arquivos esquecidos na passada
de i18n:
- `Lab.js` — cabeçalho "Laboratório" e subtítulo estavam hardcoded em PT, sem passar pelo
  dicionário (só `ArchitectureFlow`/`ProjectsLive`, os filhos, tinham sido atualizados).
  Corrigido: novo namespace `lab.heading`/`lab.subtitle` no `i18n.js` (4 idiomas), `Lab.js`
  agora usa `detectLocale()` + `t()`.
- `useTerminalAI.js` — `FALLBACK_MESSAGE` (erro de rede ao chamar `/api/portfolio/ai-chat`)
  estava hardcoded em PT. Como o Terminal é sempre em inglês por design, corrigido pra inglês
  (`"AI unavailable right now, please try again later."`), consistente com o outro fallback
  já em inglês no próprio `Terminal.js`.

Verificado com Playwright forçando `locale="en-US"` no contexto do browser: screenshot confirma
"Lab" / "Architecture, code, and live demos — all running in this browser right now." em
inglês, `console --errors: none`. Build de produção limpo.
