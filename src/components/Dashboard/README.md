# MacroDash — Global Liquidity & Market Cycles Dashboard

Dashboard interativo de análise macro global, integrado ao portfólio em [`rodolforomao.com.br`](https://rodolforomao.com.br). Acessível pelo menu **MacroDash** na navbar.

Todos os dados são **reais e em tempo quase real** — sem mocks, sem dados hardcoded. Cada módulo carrega diretamente das APIs do Federal Reserve (FRED) e CoinGecko.

---

## Sumário

- [Arquitetura Técnica](#arquitetura-técnica)
- [Configuração](#configuração)
- [Módulos](#módulos)
  1. [Fed Net Liquidity](#1-fed-net-liquidity)
  2. [Credit Markets](#2-credit-markets)
  3. [Monetary Policy](#3-monetary-policy)
  4. [Yield Curve](#4-yield-curve)
  5. [Dollar / DXY](#5-dollar--dxy)
  6. [Markets](#6-markets)
  7. [Bitcoin](#7-bitcoin)
  8. [Correlations](#8-correlations)
  9. [Lead-Lag Analysis](#9-lead-lag-analysis)
  10. [Market Regimes](#10-market-regimes)
  11. [Historical Events](#11-historical-events)
  12. [Alerts](#12-alerts)
  13. [Statistical Analysis](#13-statistical-analysis)
- [Fontes de Dados](#fontes-de-dados)
- [Fórmulas e Metodologia](#fórmulas-e-metodologia)

---

## Arquitetura Técnica

```
src/components/Dashboard/
├── index.js                  # Entry point — roteamento entre módulos
├── DashboardLayout.js        # Sidebar com 13 itens de navegação + relógio UTC
├── Dashboard.css             # Tema dark purple (#0c0513 / #c770f0)
├── api/
│   ├── fredApi.js            # Cliente FRED via proxy PHP (CORS bypass)
│   └── coinGeckoApi.js       # Cliente CoinGecko via proxy PHP + cache localStorage
├── utils/
│   ├── statistics.js         # MA, EMA, Z-Score, Bollinger Bands, correlação, lead-lag
│   └── formatters.js         # formatNumber, formatPercent, formatCurrency, formatDate
├── components/
│   ├── MetricCard.js         # Card de métrica única com sparkline opcional
│   └── ChartCard.js          # Wrapper de gráfico com loading/error/retry
└── modules/
    ├── LiquidityModule.js
    ├── CreditModule.js
    ├── MonetaryPolicyModule.js
    ├── YieldCurveModule.js
    ├── DollarModule.js
    ├── MarketModule.js
    ├── BitcoinModule.js
    ├── CorrelationModule.js
    ├── LeadLagModule.js
    ├── RegimeModule.js
    ├── HistoricalEventsModule.js
    ├── AlertsModule.js
    └── StatisticsModule.js
```

### Proxy PHP (`public/proxy.php`)

O browser não pode chamar `api.stlouisfed.org` diretamente por restrições CORS. O `proxy.php` roda no mesmo servidor do site e atua como intermediário:

- `?source=fred` → repassa para `api.stlouisfed.org/fred/series/observations`
- `?source=coingecko` → repassa para `api.coingecko.com/api/v3`

O arquivo `.env` **não é enviado ao servidor** — a variável `REACT_APP_FRED_API_KEY` é embutida no bundle JavaScript em tempo de build.

---

## Configuração

### 1. Obter chave FRED (gratuita)

Crie uma conta gratuita em [fred.stlouisfed.org](https://fred.stlouisfed.org) e gere uma API key.

### 2. Configurar `.env`

```bash
# .env (na raiz do projeto)
REACT_APP_FRED_API_KEY=sua_chave_aqui
```

### 3. Rebuild e deploy

```bash
npm run build
bash scripts/deploy-ssh.sh
```

> A chave é embutida no JS bundle. Toda vez que mudar a chave, é necessário rebuild.

---

## Módulos

---

### 1. Fed Net Liquidity

**Rota de navegação:** Macro → Fed Liquidity  
**Série principal:** Fed Net Liquidity = `WALCL − TGA − RRP`

#### O que é Net Liquidity?

Net Liquidity representa o **dinheiro que o Federal Reserve efetivamente injetou na economia** descontando os dois principais "drenos" de liquidez:

| Componente | Série FRED | Descrição |
|---|---|---|
| **WALCL** | `WALCL` | Total de ativos do Fed (balanço patrimonial) |
| **TGA** | `WTREGEN` | Treasury General Account — conta do Tesouro no Fed |
| **RRP** | `RRPONTSYD` | Reverse Repo overnight — dinheiro estacionado no Fed |

**Frequência:** Semanal (quarta-feira). Unidade: Milhões de USD.

> **Nota técnica:** `RRPONTSYD` é divulgado em bilhões — o código multiplica por 1.000 para converter para a mesma base que `WALCL` (milhões).

#### Gráficos

**Fed Net Liquidity + MA 20 semanas**
Linha principal com média móvel de 20 semanas sobreposta. Permite identificar tendências de expansão (quantitative easing) ou contração (quantitative tightening) da liquidez sistêmica.

- Subida sustentada → mais dinheiro disponível no sistema → tende a elevar ativos de risco
- Queda sustentada → aperto de liquidez → tende a pressionar valuations

**Rate of Change (1ª Derivada)**
Variação semanal da Net Liquidity em pontos absolutos. Indica a velocidade de mudança: picos positivos indicam injeções abruptas (e.g., crise bancária Mar/2023), vales negativos indicam drenos rápidos.

**Acceleration (2ª Derivada)**
Variação da variação — indica quando o ritmo de injeção/retirada está **acelerando ou desacelerando**. Útil para detectar inflexões de regime antes que elas apareçam no gráfico principal.

**Componentes: WALCL, TGA, RRP**
As três séries brutas plotadas individualmente. Permite entender qual componente está dirigindo a mudança na Net Liquidity. Por exemplo: RRP caindo com WALCL estável = aumento de liquidez líquida mesmo sem QE ativo.

---

### 2. Credit Markets

**Rota de navegação:** Macro → Credit  
**Séries FRED:** `BAMLH0A0HYM2`, `BAMLC0A0CM`, `NFCI`, `TEDRATE`

#### O que são spreads de crédito?

Spreads medem o **prêmio de risco** que o mercado exige para emprestar a emissores não-governamentais em vez de comprar Treasuries. Quando os spreads sobem, o mercado está com medo de default.

| Métrica | Série | Descrição |
|---|---|---|
| **HY OAS** | `BAMLH0A0HYM2` | High Yield Option-Adjusted Spread — empresas especulativas |
| **IG OAS** | `BAMLC0A0CM` | Investment Grade Spread — empresas com grau de investimento |
| **NFCI** | `NFCI` | National Financial Conditions Index (Chicago Fed) |
| **TED Spread** | `TEDRATE` | LIBOR 3 meses − T-Bill 3 meses |

#### Gráficos

**High Yield OAS (Option-Adjusted Spread)**
Spread histórico em basis points (bps). Limiares de referência:
- `< 300 bps` → NORMAL (mercado de crédito saudável)
- `300–500 bps` → ELEVATED (cautela)
- `> 500 bps` → STRESS (risco sistêmico de crédito)

O OAS "ajustado de opções" remove o efeito de calls e puts embutidas nos bonds, dando uma visão mais limpa do prêmio de risco puro.

**HY vs IG Spread Comparison**
Dois spreads sobrepostos no mesmo gráfico. O gap entre HY e IG indica a percepção do mercado sobre risco relativo. Gap crescente = mercado diferenciando mais agressivamente entre qualidade. Gap estreito = compressão de spreads típica de bull markets de crédito.

**National Financial Conditions Index (NFCI)**
Índice composto do Chicago Fed que agrega ~100 indicadores financeiros (spreads, alavancagem, volatilidade, etc.):
- `> 0` → condições financeiras mais **apertadas** que a média histórica
- `< 0` → condições mais **frouxas** que a média (estimulativas)
- Picos extremos positivos ocorreram em 2008, 2020 e crises bancárias regionais

**TED Spread**
Diferença entre a taxa interbancária (LIBOR 3m) e o T-Bill 3m. Mede o risco de crédito percebido no sistema bancário:
- Spread baixo (`< 50 bps`) → bancos confiam uns nos outros
- Spread elevado (`> 100 bps`) → estresse sistêmico no crédito interbancário (similar ao que ocorreu em set/2008)

---

### 3. Monetary Policy

**Rota de navegação:** Macro → Monetary Policy  
**Séries FRED:** `FEDFUNDS`, `CPIAUCSL`, `UNRATE`, `T10YIE`  
**Janela histórica:** a partir de 2010

#### Gráficos

**Fed Funds Rate vs CPI Inflation**
As duas séries mais importantes para o ciclo monetário sobrepostas:
- Quando o Fed Funds está **abaixo do CPI** → taxa real negativa → política expansionista (estimula crescimento, pressiona o dólar, favorece ativos reais)
- Quando o Fed Funds está **acima do CPI** → taxa real positiva → política restritiva (desinflação, pressão sobre risco)

**Real Fed Funds Rate**
`Taxa Real = FEDFUNDS − CPI YoY`. Indicador-chave do caráter efetivo da política monetária:
- Positivo → restritivo (Fed está de fato apertando as condições reais)
- Negativo → acomodatício (mesmo com juros nominais altos, a inflação corrói o custo real do capital)

**Unemployment Rate (U-3)**
Taxa de desemprego americano. O Fed usa isso no segundo mandato do "dual mandate". Correlação inversa clássica com o mercado de ativos (desemprego baixo = ciclo tardio, mais risco de aperto).

**10-Year Breakeven Inflation (T10YIE)**
Diferença entre o Treasury de 10 anos nominal e o TIPS de 10 anos. Representa a **inflação que o mercado de bonds está precificando para os próximos 10 anos**. Muito usado como proxy das expectativas de inflação de longo prazo — fundamental para o processo de decisão do Fed.

---

### 4. Yield Curve

**Rota de navegação:** Macro → Yield Curve  
**Séries FRED:** `DGS1MO`, `TB3MS`, `DGS2`, `DGS5`, `DGS10`, `DGS30`, `T10Y2Y`, `T10Y3M`

#### O que é a Yield Curve?

A curva de juros plota os rendimentos dos títulos do Tesouro americano por vencimento (1 mês → 30 anos). Em condições normais, vencimentos mais longos pagam mais (curva inclinada positivamente). Inversões — onde o curto paga mais que o longo — historicamente precedem recessões.

#### Gráficos

**Current Yield Curve Shape**
Snapshot atual da curva completa: 1M, 3M, 2Y, 5Y, 10Y, 30Y em um único gráfico de linha. Permite ver visualmente se a curva está:
- Normal (slope positivo) → crescimento esperado
- Flat (spread próximo de zero) → incerteza
- Invertida (slope negativo) → sinal clássico pré-recessão

**10Y-2Y Spread History (`T10Y2Y`)**
O spread mais monitorado pelo mercado. Cada vez que entrou em território negativo sustentado desde os anos 1970, uma recessão se seguiu — geralmente 12 a 24 meses depois. O gráfico usa cores para destacar visualmente os períodos de inversão.

**10Y-3M Spread History (`T10Y3M`)**
Academicamente considerado o preditor de recessão mais robusto (Federal Reserve de Nova York usa este spread em seu modelo de probabilidade de recessão). Historicamente mais sensível que o 10Y-2Y.

**Treasury Yields: 2Y, 10Y, 30Y**
Os três pontos âncora da curva sobrepostos em uma série histórica. Permite ver as diferentes respostas de cada trecho da curva a eventos macro (e.g., o 2Y é mais sensível às decisões do Fed; o 10Y e 30Y refletem mais as expectativas de crescimento e inflação de longo prazo).

---

### 5. Dollar / DXY

**Rota de navegação:** Macro → Dollar/DXY  
**Séries FRED:** `DTWEXBGS` (DXY broad), `GOLDAMGBD228NLBM` (Gold†), `DCOILWTICO` (Oil), `DEXUSEU` (EUR/USD), `DEXJPUS` (USD/JPY)

> † `GOLDAMGBD228NLBM` foi descontinuada pelo FRED em 2019. O módulo Markets usa esta série, mas o gráfico de normalização usa apenas os dados disponíveis até 2019.

#### Métricas

| Card | Descrição |
|---|---|
| **Broad Dollar Index** | Índice do Fed que pondera o USD contra uma cesta ampla de moedas (mais abrangente que o DXY tradicional) |
| **EUR/USD** | Par de câmbio mais líquido do mundo — mede a força do dólar frente ao euro |
| **USD/JPY** | O yen japonês funciona como moeda de funding (carry trade) — USD/JPY alto indica apetite de risco |
| **DXY Z-Score (1yr)** | Quantas desvios-padrão o índice está acima/abaixo da média de 1 ano |

#### Gráficos

**Broad Dollar Index com MAs (20 e 50 dias)**
Série histórica com médias móveis sobrepostas. Dólar forte pressiona commodities, mercados emergentes e empresas americanas com receitas no exterior. Dólar fraco tende a favorecer ouro, cripto e EM equities.

**DXY Z-Score (252 dias)**
Normalização estatística: quantos desvios-padrão o índice atual está da sua média de 252 dias úteis. Z-Score acima de +2 indica dólar extremamente valorizado (potencial reversão de curto prazo); abaixo de -2 indica dólar extremamente desvalorizado.

**DXY vs Gold vs Oil (Base 100)**
Três séries normalizadas para 100 no início do período. Permite comparar performance relativa e verificar correlações conhecidas:
- Gold tende a se mover inversamente ao dólar
- Oil tem dupla correlação: dólar e demanda global
- Divergências entre as três séries podem sinalizar mudanças de regime

**EUR/USD Exchange Rate**
Taxa de câmbio histórica EUR/USD. Como o EUR tem peso dominante no DXY tradicional (~57%), EUR/USD é essencialmente o inverso do índice.

---

### 6. Markets

**Rota de navegação:** Markets → Markets  
**Séries FRED:** `SP500`, `NASDAQCOM`, `VIXCLS`, `GOLDAMGBD228NLBM`, `DCOILWTICO`

#### Métricas

| Card | Threshold |
|---|---|
| **S&P 500** | Índice de referência do mercado americano (500 maiores empresas) |
| **Nasdaq Composite** | Índice tech-heavy, mais volátil e sensível a taxas de juros |
| **VIX** | `< 15` = complacência; `15–25` = normal; `> 30` = medo; `> 40` = pânico |
| **Gold** | Safe haven; tende a subir em crises e queda do dólar |
| **WTI Crude** | Referência do petróleo americano — proxy de demanda global e inflação |

#### Gráficos

**S&P 500 com MA 200 dias**
O S&P com a média móvel de 200 dias — a média mais usada por gestores institucionais para separar bull market de bear market. Preço acima da MA200 = tendência de alta; abaixo = tendência de baixa.

**VIX — Volatility Index**
O "índice do medo" do mercado. Mede a volatilidade implícita das opções do S&P 500 para os próximos 30 dias. Picos do VIX coincidem com bottoms de mercado (capitulação); vales extremos indicam complacência excessiva. Linhas de referência em 20 e 30.

**Normalized Performance (Base 100)**
S&P 500, Nasdaq, Gold e Oil normalizados para 100 no início do período. Permite comparar diretamente o desempenho acumulado de cada ativo. Um dos gráficos mais intuitivos para entender ciclos de liderança de mercado.

**Gold Price (USD/oz)**
Ouro físico em dólares. Historicamente correlacionado negativamente com juros reais: quando taxas reais sobem, ouro sofre; quando caem (ou ficam negativas), ouro performa.

---

### 7. Bitcoin

**Rota de navegação:** Markets → Bitcoin  
**Fonte:** CoinGecko API (free tier, limite de 365 dias de histórico)

#### Métricas

| Card | Fonte CoinGecko |
|---|---|
| **BTC Price** | `current_price.usd` |
| **Market Cap** | `market_cap.usd` |
| **24h Volume** | `total_volume.usd` |
| **BTC Dominance** | `market_cap_percentage.btc` (global endpoint) |
| **7d / 30d Change** | `price_change_percentage_7d/30d` |
| **ETH Dominance** | `market_cap_percentage.eth` |
| **ATH** | All-time high + data |

#### Gráficos

**Bitcoin Price com Bollinger Bands**
Preço histórico com três sobreposições:
- **MA 20 dias** (rosa) — média de curto prazo
- **MA 50 dias** (verde) — média de médio prazo
- **Bollinger Bands 2σ** (azul tracejado) — ±2 desvios da MA20

Preço tocando a banda superior sugere sobrecompra; tocando a inferior, sobrevenda. O squeeze das bandas indica período de baixa volatilidade que frequentemente precede movimentos explosivos.

O gráfico também marca os **halvings do Bitcoin** (eventos programados a cada ~4 anos que cortam a emissão pela metade). Historicamente correlacionados com bull markets.

Botão **LOG** ativa escala logarítmica — essencial para visualizar a história completa do BTC cujos ciclos variam múltiplas ordens de magnitude.

**Trading Volume (Bilhões USD)**
Volume de negociação diário. Picos de volume em quedas = capitulação (potencial fundo); picos em altas = momentum; volume baixo em altas = rally fraco.

**Market Cap History**
Capitalização de mercado total. Mais estável que preço para medir a adoção/crescimento estrutural do Bitcoin como asset class.

---

### 8. Correlations

**Rota de navegação:** Analytics → Correlations  
**Séries FRED:** `WALCL`, `WTREGEN`, `RRPONTSYD`, `SP500`, `DCOILWTICO`, `DTWEXBGS`  
**Fonte CoinGecko:** BTC Price (365 dias)

**Período de análise:** Últimos 365 dias — mesmo para todos os pares.

> **Decisão de design:** O FRED descontinuou a série de ouro `GOLDAMGBD228NLBM` em 2019. Para manter a matriz relevante, ela foi substituída por **Oil** (`DCOILWTICO`), série ativa e com forte relevância macro.

#### Metodologia

**Resampling semanal:** Net Liquidity tem frequência **semanal** (WALCL é divulgado às quartas). Para calcular correlações com BTC e SP500 (diários), ambas as séries são reamostradas para as datas da Net Liquidity via **forward-fill por busca binária**. Isso evita distorções de frequência.

**Rolling window:** Convertida de dias calendário para semanas: `wkWin = floor(winDays / 7)`. Mínimo de 4 semanas.

#### Gráficos

**Correlation Matrix (5×5)**
Matriz de correlação de Pearson entre Net Liquidity, SP500, Bitcoin, Oil e DXY. Cada célula mostra o coeficiente [-1, +1] com gradiente de cor:
- Verde (`> 0.7`) → correlação forte positiva
- Amarelo (`-0.3` a `+0.3`) → sem correlação ou fraca
- Vermelho (`< -0.7`) → correlação forte negativa

A diagonal principal (correlação de cada série consigo mesma = 1.000) é destacada em branco.

**Rolling Correlation: Liquidity vs BTC & SP500**
Três linhas no mesmo gráfico usando um **único dataset merged** (abordagem necessária para evitar artefatos no recharts quando séries têm tamanhos diferentes):
- `Liq↔BTC` (laranja): correlação rolling entre Net Liquidity e Bitcoin
- `Liq↔SP500` (verde): correlação rolling entre Net Liquidity e S&P 500
- `BTC↔SP500` (roxo): correlação rolling entre Bitcoin e S&P 500

Linhas de referência tracejadas em ±0.7. Botões 90d/180d/365d mudam a janela rolling.

**Scatter: Net Liquidity vs Bitcoin Price**
Cada ponto representa uma semana dos últimos 365 dias. O eixo X mostra Net Liquidity em trilhões de USD (escalado para o range real, não começando em $0). O eixo Y mostra o preço do BTC. A inclinação da nuvem de pontos indica o grau de correlação positiva (se existente).

---

### 9. Lead-Lag Analysis

**Rota de navegação:** Analytics → Lead-Lag  
**Séries FRED:** `WALCL`, `WTREGEN`, `RRPONTSYD`, `SP500`  
**Fonte CoinGecko:** BTC Price (365 dias)

#### O que é análise Lead-Lag?

Mede se uma série **precede ou segue** outra com N dias de defasagem. Para cada valor de lag testado (por exemplo, -180 a +180 dias), calcula a correlação de Pearson entre a série 1 deslocada por esse lag e a série 2.

- **Lag positivo** = a série da esquerda **antecede** a série da direita
- **Lag negativo** = a série da direita **antecede** a série da esquerda
- O lag com **maior correlação absoluta** é o "best lag"

> **Exemplo de interpretação:** Se o best lag entre Net Liquidity e BTC é +30, isso indica que variações na liquidez tendem a se refletir no preço do Bitcoin cerca de 30 dias depois.

#### Gráficos

**Lead-Lag: Net Liquidity vs Bitcoin**
Eixo X: lag em dias (-180 a +180). Eixo Y: coeficiente de correlação de Pearson para cada lag. Uma linha vertical amarela marca o best lag. Assimetria na curva (pico deslocado de zero) indica relação de previsão temporal.

**Lead-Lag: Net Liquidity vs S&P 500**
Mesma análise para o par Liquidez/S&P. O Fed influencia equities pelo canal do crédito e custo de capital — geralmente com defasagem diferente do canal cripto.

**Lead-Lag: Bitcoin vs S&P 500**
Lag menor (-90 a +90) pois ambos são diários. Investiga se BTC lidera ou segue equities. Em momentos de risk-off abrupto, BTC tende a cair antes, potencialmente funcionando como indicador antecedente.

---

### 10. Market Regimes

**Rota de navegação:** Analytics → Regimes  
**Séries FRED:** `WALCL`, `WTREGEN`, `RRPONTSYD`, `VIXCLS`, `T10Y2Y`, `BAMLH0A0HYM2`

#### Metodologia de classificação

O regime é calculado por um sistema de **pontuação composta** usando 4 inputs:

| Variável | Critério | Pontos |
|---|---|---|
| **Net Liquidity (variação)** | `Δ > +2%` / `Δ > 0` / `Δ < 0` / `Δ < -2%` | +2 / +1 / -1 / -2 |
| **VIX** | `< 15` / `< 20` / `> 25` / `> 30` | +2 / +1 / -1 / -2 |
| **10Y-2Y Spread** | `> 0.5%` / `< 0%` | +1 / -2 |
| **HY Spread (OAS)** | `< 300 bps` / `> 400 bps` / `> 500 bps` | +1 / -1 / -2 |

**Classificação final:**

| Score | Regime |
|---|---|
| ≥ 4 | **RISK-ON** (verde) |
| 2 a 3 | **MILD RISK-ON** |
| -1 a 1 | **NEUTRAL** (amarelo) |
| -2 a -3 | **MILD RISK-OFF** |
| ≤ -4 | **RISK-OFF** (vermelho) |

#### Gráficos

**Regime Score History**
Série temporal do score composto ao longo do tempo. Permite visualizar transições entre regimes e identificar períodos prolongados de risk-on/off. O score é plotado como linha com background colorido por regime.

**Regime Indicator: VIX vs Yield Curve**
Dois inputs do modelo sobrepostos: VIX (eixo esquerdo) e o spread 10Y-2Y (eixo direito). A interação entre eles é fundamental para o regime: alta volatilidade + curva invertida = forte sinal risk-off.

**Score Distribution (Last 60 Periods)**
Histograma mostrando a distribuição do tempo em cada regime nos últimos 60 períodos. Útil para entender o "estado médio" do mercado na janela recente.

---

### 11. Historical Events

**Rota de navegação:** Context → Historical Events  
**Séries FRED:** `WALCL`, `WTREGEN`, `RRPONTSYD`, `SP500`  
**Fonte CoinGecko:** BTC Price (365 dias)

#### Gráfico principal

**SP500, BTC, Fed Liquidity (Base 100) + Events**
Três séries normalizadas para 100 no início do período (2016), com marcadores verticais de eventos macro relevantes:

- Crises (COVID-19, SVB collapse, Flash crashes)
- Decisões de política monetária (início/fim de QE, elevações de juros)
- Eventos geopolíticos (conflitos, sanções)
- Marcos do Bitcoin (halvings, regulações, crashes de exchanges)

Os marcadores são clicáveis — ao clicar, uma timeline abaixo exibe detalhes do evento com data, categoria e descrição.

#### Timeline de eventos

Lista filtrada dos eventos sobrepostos no gráfico, com categorias:
- 🔴 **Crisis** — eventos de crise sistêmica
- 🟡 **Fed Policy** — decisões do Federal Reserve
- 🔵 **Geopolitical** — eventos geopolíticos relevantes
- 🟠 **Crypto** — marcos do mercado cripto

---

### 12. Alerts

**Rota de navegação:** Context → Alerts  
**Fontes:** Múltiplas séries FRED + CoinGecko (BTC)

#### Como funcionam

O módulo avalia condições em tempo real e gera alertas quando thresholds definidos são ultrapassados. **Não há configuração manual** — todos os thresholds são baseados em níveis históricos de referência.

#### Thresholds por categoria

**Liquidez (Net Liquidity Z-Score, janela 52 semanas)**
- Z-Score `< -2σ` → `CRITICAL`: liquidez historicamente baixa
- Z-Score `> +2σ` → `INFO`: liquidez historicamente alta (possível sobreaquecimento)
- Z-Score `< -1σ` → `WARNING`: liquidez abaixo da média

**VIX**
- `> 35` → `CRITICAL`: extreme fear
- `> 25` → `WARNING`: elevated volatility
- `< 12` → `INFO`: extreme complacency (risco de pico de volatilidade)

**Yield Curve (10Y-2Y)**
- `< 0` → `WARNING`: inversão — sinal histórico de recessão

**HY Spread (OAS)**
- `> 500 bps` → `CRITICAL`: credit stress
- `> 350 bps` → `WARNING`: acima da média histórica (~350 bps)

**Bitcoin**
- `change_30d > +50%` → `INFO`: bull signal
- `change_30d < -20%` → `WARNING`: bear signal

Se nenhum alerta estiver ativo, exibe **"All Clear"** em verde.

#### Severidades

| Cor | Nível | Significado |
|---|---|---|
| 🔴 Vermelho | CRITICAL | Condição extrema, ação/atenção imediata |
| 🟡 Amarelo | WARNING | Condição elevada, monitorar de perto |
| 🔵 Azul | INFO | Notável mas não urgente |
| 🟢 Verde | SUCCESS | Nenhum alerta — condições normais |

---

### 13. Statistical Analysis

**Rota de navegação:** Analytics → Statistics  
**Séries FRED:** `WALCL`, `WTREGEN`, `RRPONTSYD`, `SP500`, `VIXCLS`, `BAMLH0A0HYM2`, `T10Y2Y`  
**Fonte CoinGecko:** BTC Price (365 dias)

#### Séries disponíveis para análise

| Série | Descrição |
|---|---|
| **Fed Net Liquidity** | WALCL − TGA − RRP |
| **S&P 500** | Índice de equities americano |
| **VIX** | Volatilidade implícita do mercado |
| **HY Credit Spread** | Option-Adjusted Spread de High Yield |
| **10Y-2Y Yield Curve** | Spread da curva de juros |
| **Bitcoin Price** | Preço do BTC em USD |

#### Gráficos (por série selecionada)

**Summary Statistics**
Tabela com: mínimo, máximo, média, mediana, desvio padrão, percentil 25, percentil 75 e o valor atual com seu percentil histórico. O percentil atual contextualiza onde a série está em relação ao seu histórico completo.

**Z-Score (252 dias)**
Série temporal do Z-Score com janela rolling de 252 períodos (~1 ano de dados). Quantifica desvios em termos de desvio-padrão:
- `|Z| > 2` → território extremo (< 5% de ocorrência histórica)
- `|Z| > 1` → acima/abaixo da média por uma margem relevante

Linhas de referência em ±1, ±2 facilitam a leitura.

**Distribution (Histogram)**
Distribuição de frequência histórica dos valores da série. Permite ver se a distribuição é normal, bimodal, com caudas gordas (fat tails), etc. O bar atual é destacado para contextualizar visualmente o valor presente.

**Rolling 20-Period Std Dev**
Volatilidade da série ao longo do tempo (desvio padrão em janela rolling de 20 períodos). Picos indicam regimes de alta incerteza; vales indicam períodos de "normalidade". A volatilidade em si é cíclica — clusters de alta vol tendem a ser seguidos por mais alta vol (volatility clustering).

**Raw Series**
Série histórica completa sem transformações. Permite visualizar o comportamento em toda a janela disponível.

---

## Fontes de Dados

| Fonte | Endpoint | Frequência | Janela |
|---|---|---|---|
| **FRED** (Federal Reserve) | `/fred/series/observations` | Varia por série | 2015–presente |
| **CoinGecko** (free tier) | `/coins/bitcoin/market_chart` | Diário | últimos 365 dias |
| **CoinGecko** | `/coins/bitcoin` | Snapshot atual | — |
| **CoinGecko** | `/global` | Snapshot atual | — |

### Cache

- **FRED:** cache localStorage com TTL de **1 hora**
- **CoinGecko:** cache localStorage com TTL de **15 minutos**

O cache é identificado pelo `series_id + startDate` (FRED) ou pelo path da URL (CoinGecko). Mudar a janela de tempo do gráfico invalida o cache automaticamente, pois gera uma chave diferente.

---

## Fórmulas e Metodologia

Todas implementadas em `utils/statistics.js`:

| Função | Fórmula |
|---|---|
| `calculateMA(series, n)` | Média aritmética dos últimos `n` pontos |
| `calculateEMA(series, n)` | Média exponencial com fator `2/(n+1)` |
| `calculateZScore(series, window)` | `(x − μ) / σ` com janela rolling |
| `calculateBollingerBands(series, n, k)` | `MA(n) ± k × σ(n)` |
| `calculateCorrelation(s1, s2)` | Pearson — alinha séries por data antes de calcular |
| `calculateRollingCorrelation(s1, s2, w)` | Pearson em janela sliding de `w` períodos |
| `calculateLeadLagCorrelation(s1, s2, maxLag)` | Pearson para cada lag de `-maxLag` a `+maxLag` |
| `normalizeBase100(series)` | `(x / x[0]) × 100` |
| `alignSeries(s1, s2)` | Inner join por data exata |

> **Nota sobre frequência mista:** Quando Net Liquidity (semanal) é correlacionada com BTC ou SP500 (diários), as séries diárias são reamostradas para as datas semanais da WALCL por forward-fill com busca binária antes de qualquer cálculo estatístico. Isso garante que os pares estejam no mesmo espaço temporal e evita artefatos de visualização no recharts.
