# Oportunidades de Mercado — Operação do Bot

Guia da **Fase 1**: lucro exclusivamente via trades do próprio bot.  
Câmbio para clientes (Fase 2) → ver `SERVICO_DEPIX.md`.

---

## Como começar — passo a passo

### Dia 1

```
1. Definir capital inicial
   Mínimo:     R$ 2.000  (dados escassos)
   Ideal:      R$ 5.000  (dados mais representativos)
   Recomendado: R$ 10.000 se já tiver confiança no bot

2. Dividir o capital
   50% em USDt  (para ordens Sell L-BTC/USDt)
   50% em L-BTC (para ordens Buy  L-BTC/USDt)

3. Configurar 1 PID — L-BTC/USDt
   par:           L-BTC/USDt
   ordens:        BUY + SELL simultâneas
   follow_target: true
   price_min:     0,50%  (conservador para início)
   flash_crash:   true   ← obrigatório

4. Ativar alerta Telegram
   notify_below_market: true
   pares: L-BTC/USDt, USDt/DePix, L-BTC/DePix
   threshold: 1,0%  (conservador para início)

5. Deixar rodar — não mexer nas primeiras 2 semanas
```

### Semanas 2–4

```
→ Executar below-market se alerta aparecer com ≥ 1,0% de desconto
→ Rebalancear manualmente se um lado passar de 70%
→ Anotar: quantos fills/semana? qual spread efetivo?
```

### Mês 2 em diante

```
→ Avaliar dados reais → ajustar price_min
→ Se P&L marcado a mercado positivo: escalar para R$ 10.000
→ Adicionar saída DePix se aparecer DePix no inventário
```

### Quando usar a BTSE

```
Situação: USDt acumulou > 65% do par L-BTC/USDt
          (bot vendeu muito L-BTC, ficou pesado em USDt)

Ação: comprar L-BTC na BTSE para rebalancear rápido
  → depositar USDt na BTSE
  → comprar BTC/USDT (spot)
  → sacar L-BTC via rede Liquid (~R$ 5)
  → depositar L-BTC na carteira SideSwap

Custo: 0,20% trade + R$ 5 saque = R$ 9–45 dependendo do volume
Vantagem: rebalanceia em horas em vez de esperar dias no SideSwap
Limite: capital fica em custódia durante a operação → mínimo necessário
```

---

---

## 1. Como a SideSwap funciona

### Os 3 pares canônicos

| Par | O que é | Ciclo de execução |
|-----|---------|------------------|
| **L-BTC/USDt** | Bitcoin ↔ Dólar | Horas |
| **L-BTC/DePix** | Bitcoin ↔ Real | Dias–semana |
| **USDt/DePix** | Dólar ↔ Real | Dias–semana |

### Como os fills acontecem

Todos os market makers (Buy e Sell) esperam **usuários orgânicos da SideSwap** iniciarem swaps. Buy side e Sell side servem fluxos de usuários **diferentes** — não competem entre si.

```
Par L-BTC/DePix (snapshot 22/06/2026):

  23 ordens Buy (MMs aguardando)          3–4 ordens Sell (emissor + MMs)
  ────────────────────────────            ─────────────────────────────
  Esperam: usuários com L-BTC             Esperam: usuários com DePix
  que querem DePix.                       que querem L-BTC rápido.
```

Quem está em posição 1 no livro atrai mais takers → preço levemente melhor = fills mais rápidos.

### Assimetria DePix — fato central

| Observação (22/06/2026) | Implicação |
|------------------------|-----------|
| 23 Buy vs 3–4 Sell em L-BTC/DePix | Muitos MMs querendo sair de DePix, poucos entrando |
| 12 Buy vs 3 Sell em USDt/DePix | Mesma assimetria |
| Spread USDt/DePix: **1,89%** | Prêmio de iliquidez — não é convite a MM simétrico |
| Spread L-BTC/DePix: **1,43%** | Emissor domina o lado Sell |
| Spread L-BTC/USDt: **0,58%** | Único par com liquidez bilateral — motor principal |

---

## 2. As 3 leis (inegociáveis)

```
LEI 1 — DePix é inventário quente, não reserva
  Plano de saída ANTES de receber DePix.
  DePix buffer é um TETO temporário, não uma alocação-alvo.
  Capital ocioso fica em USDt ou L-BTC, nunca em DePix.

LEI 2 — O emissor DePix é o seu TETO
  Ele cobra 1,4–1,5% para saída imediata.
  Nosso custo de saída = 0% (ordens ao ind_price).
  BTSE não resolve DePix diretamente — apenas acelera L-BTC→USDt.

LEI 3 — L-BTC/USDt é o único par com ciclo rápido
  Os pares DePix medem ciclos em dias. L-BTC/USDt funciona em horas.
  É o motor de renda recorrente. Todo o resto é suporte.
```

---

## 3. Risco principal — seleção adversa no MM

O bot compra L-BTC com spread de 0,40%. Se o BTC cai 1,5% logo depois, o spread é consumido pela variação de preço. Esse é o risco real do market making: **ser executado justamente quando o preço se move contra a posição**.

```
Cenário adverso:
  Bot compra L-BTC: R$ 64.500 (spread 0,40% capturado = R$ 258)
  BTC cai 1,5%:     posição agora vale R$ 63.532
  Perda líquida:    R$ 710 (muito maior que o spread ganho)

Proteção:
  → price_min mais alto em mercados voláteis
  → flash_crash ativo
  → exposição L-BTC < 60% do capital
  → P&L medido sempre por marcação a mercado, não só por dealer_trade
```

---

## 4. Plano de escala em 3 fases

> ⚠️ Não começar com R$ 20.000. Validar primeiro com capital reduzido.

### Fase 0 — Piloto (semanas 1–4)

**Objetivo:** calibrar, não lucrar. Coletar dados reais de operação.

```
Capital:      R$ 2.000–5.000
Operação:     APENAS L-BTC/USDt MM
price_min:    0,50–0,70%  (conservador até validar)
flash_crash:  ativo
DePix:        zero — não acumular nesta fase
Below-market: observar alertas, executar só se desconto > 1,2%
```

**Dados a coletar:**
- Quantos fills/semana reais acontecem?
- Qual spread efetivamente capturado por trade?
- Qual é o drawdown máximo observado?
- DePix (se aparecer): quanto tempo para sair?

**Critério para avançar à Fase 1:**
- ≥ 30 dias de operação
- P&L marcado a mercado positivo (não só dealer_trade)
- Spread médio capturado ≥ 0,35%
- Nenhum evento de seleção adversa > 2% não coberto pelo price_min

---

### Fase 1 — Operação validada (meses 2–3)

**Objetivo:** escalar com dados reais, adicionar below-market.

```
Capital:      R$ 10.000
MM L-BTC/USDt: R$ 7.000 (R$ 3.500/lado)
Reserva BM:    R$ 2.000
Caixa tático:  R$ 1.000
DePix:         teto R$ 1.500 (não meta)
price_min:     0,40–0,50% (ajustar pela volatilidade BTC)
```

**Critério para avançar à Fase 2:**
- ≥ 60 dias com resultado líquido positivo
- Drawdown mensal máximo < 3%
- Tempo médio DePix (se ocorrer) < 7 dias

---

### Fase 2 — Operação plena (mês 4+)

**Objetivo:** capital completo, todos os motores.

```
Capital:      R$ 20.000
MM L-BTC/USDt: R$ 10.000–12.000  (50–60%)
USDt livre:    R$ 4.000–5.000    (20–25%)
Reserva BM:    R$ 2.000–3.000    (10–15%)
DePix:         teto R$ 2.000–3.000 (10–15%) — não alocação inicial
price_min:     0,40% base (dinâmico por volatilidade)
```

---

## 5. Motor 1 — Market Making L-BTC/USDt

### Por que apenas este par

- Único par com liquidez bilateral real (39 Buy + 18 Sell ao vivo)
- Spread real 0,58% > price_min 0,40% → viável
- Ciclo em horas — sem risco de acumular DePix

### Configuração

```yaml
Par: L-BTC/USDt
Ordens: BUY + SELL simultâneas
follow_target: true   # ambos os lados
flash_crash: true     # NUNCA desativar
```

| Volatilidade BTC 24h | price_min | Fase |
|---------------------|-----------|------|
| < 2% | 0,40–0,50% | Fase 1/2 |
| < 2% | 0,50–0,70% | Fase 0 (piloto) |
| 2–5% | 0,70–0,90% | todas |
| > 5% | 1,50% ou pausar | todas |
| Flash crash | Pausar tudo, aguardar ≥ 30 min | todas |

### Multi-PID (Fase 2, capital ≥ R$ 20.000)

| PID | Capital | price_min | Papel |
|-----|---------|-----------|-------|
| 1 — Conservador | R$ 5.000 | 0,80% | Captura movimentos, margem alta |
| 2 — Agressivo | R$ 7.000 | 0,40–0,50% | Volume, posição 1–2 no livro |

### Projeção conservadora (Fase 2)

```
Spread capturado:   0,40–0,50%/ciclo
Ciclos/semana:      5–15 (conservador, não 8–20)
Ticket médio:       ~R$ 1.500
Lucro/ciclo:        R$ 6–7,50
Lucro mensal:       R$ 150–450 (1,5–4,5% sobre R$ 10.000)
```

> ⚠️ Projeção otimista possível, mas yield **inicial realista: 0,5–2,0%/mês** até haver histórico de 60+ dias.

### Rebalanceamento

Quando um ativo > 70% do par:
1. Cancelar ordem do lado cheio
2. Ser levemente mais agressivo no lado oposto
3. Aguardar reequilíbrio (50% ±10%) antes de recolocar

---

## 6. Motor 2 — Below-Market Sniper

### O que é

Ordens Sell no livro com preço abaixo do `ind_price`. Edge garantido contra a referência no momento da compra. Não é lucro realizado garantido — o ind_price pode mover antes da saída.

### Configuração

```
notify_below_market: true
Pares: L-BTC/USDt, USDt/DePix, L-BTC/DePix
Threshold inicial (Fase 0): 1,2%  (conservador)
Threshold Fase 1/2:          0,8%
BTC volátil: +0,3–0,5 p.p.
```

| Par | Threshold Fase 1/2 | Motivo |
|-----|--------------------|--------|
| USDt/DePix | 0,8% | Compra USDt com DePix → reduz DePix |
| L-BTC/DePix | 1,0% | Risco BTC adicional exige desconto maior |
| L-BTC/USDt | 0,7% | Par líquido, saída rápida |

### Prioridade de execução

| # | Oportunidade | Ação |
|---|-------------|------|
| 1 | Comprar USDt com DePix abaixo do ind | Imediato — reduz DePix, melhora inventário |
| 2 | Comprar L-BTC com DePix abaixo do ind | Executar se exposição BTC < 60% |
| 3 | Comprar L-BTC com USDt abaixo do ind | Executar se desconto > volatilidade esperada |
| 4 | Qualquer coisa que aumenta DePix | Só com desconto excepcional + saída clara |

---

## 7. Motor 3 — Saída de DePix

### As rotas disponíveis

| Rota | Caminho | Custo | Quando usar |
|------|---------|-------|-------------|
| **A** | DePix → USDt (SideSwap) | 0% | Padrão — verificar primeiro |
| **B** | DePix → L-BTC → USDt (SideSwap, 2 swaps) | 0% | Quando below-market em L-BTC/DePix ou BTC em alta |
| **C** | L-BTC → USDT via BTSE CEX | 0,20% spot + R$ 5 saque | Quando já tem L-BTC e quer converter rápido |

> **BTSE (Rota C) não resolve DePix diretamente.** A BTSE não opera DePix. O fluxo correto é:
> ```
> DePix → L-BTC (SideSwap, lento) → depositar L-BTC na BTSE → vender por USDT (rápido)
> ```
> A BTSE acelera apenas a **segunda perna** (L-BTC→USDT), não a saída de DePix em si.

### Validação ao vivo (22/06/2026)

```
Rota A: 5,1301 DePix/USDt
Rota B: 5,1651 DePix/USDt  (+0,68% mais cara)
→ Usar Rota A neste snapshot. Comparar sempre antes de executar.
```

### Configuração das ordens de saída

```yaml
Par A: USDt/DePix  (Buy USDt — gasta DePix)
  price_min: 0%
  follow_target: true
  amount_DePix: 2.000–5.000 por ordem
  Múltiplas ordens simultâneas

Par B: L-BTC/DePix  (Buy L-BTC — gasta DePix)
  price_min: 0%
  follow_target: true
  amount_DePix: 2.000–5.000 por ordem
  Ativar em paralelo ao Par A

NUNCA colocar SELL em pares DePix.
```

### Micro-posicionamento (dado ao vivo)

```
USDt/DePix — gap de 0,30% entre melhor Buy (5,1301) e ind (5,1457):
  Colocar ordem a 5,1450 → posição 1 no livro, custo adicional ≈ zero
  Usar quando melhor Buy estiver > 0,20% abaixo do ind

L-BTC/DePix — cluster a +0,14% acima do ind:
  Tática opcional (DePix > R$ 10k): 1–2 ordens a +0,07% acima do ind
  → posição 2–3, fill mais rápido, custo ≈ 0,07%
```

---

## 8. BTSE — rebalanceamento USDt → L-BTC

### Papel único

A BTSE opera **BTC/USDT** — não opera DePix. Seu único uso nesta estratégia é rebalancear o par L-BTC/USDt quando USDt acumula demais:

```
USDt > 65% do par L-BTC/USDt?
  → Comprar L-BTC na BTSE com o excesso de USDt
  → Sacar L-BTC via rede Liquid (R$ 5)
  → Depositar L-BTC na carteira SideSwap
  → Par rebalanceado em horas
```

### Taxas

| Operação | Taxa |
|----------|------|
| Spot BTC/USDT (maker) | **0,20%** — cai para **0%** com 100 BTSE staked |
| Saque **L-BTC** (rede Liquid) | **0,000015 BTC ≈ R$ 5** |
| Saque **BTC** (mainnet) | **0,00005 BTC ≈ R$ 17** |
| Depósito USDt / L-BTC Liquid | Gratuito |

> Sempre sacar via **Liquid** — direto para a carteira do bot, sem conversão.

### Custo de rebalanceamento

| Volume rebalanceado | Trade 0,20% | Saque Liquid | **Total** | % |
|--------------------|------------|-------------|---------|---|
| R$ 2.000 | R$ 4 | R$ 5 | **R$ 9** | **0,45%** |
| R$ 5.000 | R$ 10 | R$ 5 | **R$ 15** | **0,30%** |
| R$ 10.000 | R$ 20 | R$ 5 | **R$ 25** | **0,25%** |

Com maker 0% (100 BTSE staked): custo = apenas R$ 5 (só a taxa de saque).

### Quando vale o custo

```
Rebalanceamento custou 0,30% (R$ 15 em R$ 5.000)
Bot volta a operar com capital equilibrado (50/50)
Ciclos extras gerados pelo rebalanceamento rápido > 0,30%?
→ Sim na maioria dos casos — esperar dias no SideSwap tem custo de oportunidade
```

### API

- Documentação: `https://btsecom.github.io/docs/`
- Endpoint preço: `GET /api/v3.2/market_summary`

---

## 9. Gestão de risco

### Flash crash (obrigatório)

Nunca desativar. Em flash crash BTC:
1. Bot cancela ordens automaticamente
2. Não recolocar por ≥ 30 minutos
3. Só recolocar quando spread voltou ao normal e ind_price estabilizou

### price_min dinâmico

| Volatilidade BTC 24h | Fase 0 | Fase 1/2 |
|---------------------|--------|---------|
| < 2% | 0,50–0,70% | 0,40–0,50% |
| 2–5% | 0,90–1,20% | 0,70–0,90% |
| > 5% | Pausar | 1,50% ou pausar |

### Limites DePix

| Nível DePix | Ação |
|-------------|------|
| < R$ 5k | Normal |
| R$ 5k–10k | Aumentar agressividade das ordens de saída |
| R$ 10k–15k | Subir threshold DePix buffer |
| R$ 15k–20k | Pausar entradas; saída em modo acelerado |
| > R$ 20k | Bloquear toda entrada; saída emergencial |
| > 7 dias sem execução | Cancelar ordens antigas, recolocar mais próximas do ind |

### Exposição L-BTC

Máximo 60% do capital. L-BTC pode cair 15% em minutos.

---

## 10. KPIs

> **Medir sempre por marcação a mercado**, não só por `dealer_trade`. O bot pode mostrar lucro em swaps e perder valor por carregar L-BTC ou DePix em condições desfavoráveis.

| KPI | Meta Fase 0 | Meta Fase 1/2 | Alarme |
|-----|------------|--------------|--------|
| **P&L marcado a mercado** | > 0 | ≥ 0,5%/mês | Negativo → pausar e revisar |
| **Drawdown mensal máximo** | < 5% | < 3% | > 3% → reduzir exposição |
| **Spread líquido capturado** | ≥ 0,35% | ≥ 0,35% | < 0,30% → elevar price_min |
| Tempo médio DePix em trânsito | — | < 7 dias | > 10 dias → fragmentar |
| DePix em carteira | 0 | < R$ 20k teto | > R$ 15k → modo emergência |
| Exposição L-BTC | < 50% | < 60% | > 60% → pausar Buy L-BTC/USDt |
| Capital livre (reserva) | ≥ 30% | ≥ 15% | < 10% → rebalancear |
| Ordens saída DePix ativas | — | ≥ 2 | 0 ordens → recolocar |
| Fills/semana L-BTC/USDt | coletar dados | ≥ 5 ciclos | < 3 → revisar price_min |

> **KPI principal Fase 0:** fills/semana reais + spread efetivo capturado.  
> **KPI principal Fase 1/2:** P&L marcado a mercado + tempo médio DePix.

---

## 11. Rotina operacional

### Todo dia — manhã (5 min)

```
① Telegram: below-market overnight?
   → Verificar se ainda ativo → executar se ≥ threshold

② Saldo DePix > R$ 5k?
   → Ordens de saída ativas e próximas do ind_price?

③ L-BTC/USDt: BUY + SELL com follow_target ativos?

④ BTC variou > 3% ontem?
   → Sim: elevar price_min para faixa 2–5% da tabela
```

### Toda semana — sexta (10 min)

```
⑤ P&L marcado a mercado desta semana (não só dealer_trade)
⑥ Drawdown máximo observado?
⑦ DePix há > 7 dias? → Cancelar/recolocar ordens
⑧ Rota A ou B foi mais barata? → Ajustar padrão próxima semana
⑨ Capital livre ≥ meta da fase atual?
⑩ Emissor mudou spread? → Verificar livro L-BTC/DePix
```

### Todo mês

```
⑪ Critérios de avanço de fase atingidos?
⑫ Ajustar price_min com base no histórico real de fills
⑬ Revisar thresholds below-market
⑭ Calcular yield real (P&L marcado a mercado / capital inicial)
```

---

## 12. Checklist antes de qualquer nova ordem

```
[ ] MM L-BTC/USDt:
    → price_min adequado à fase e volatilidade atual
    → follow_target ativo em ambos os lados
    → flash_crash ativo ← NUNCA desabilitar

[ ] Ordens de saída DePix (se houver DePix):
    → price_min = 0% (ind_price)
    → Fracionadas em 2–5k DePix/ordem
    → ≥ 2 ordens simultâneas

[ ] Par DePix → só Buy (gasta DePix). NUNCA Sell em par DePix.
[ ] DePix total < teto da fase atual?
[ ] Capital livre ≥ meta da fase?
[ ] Comparei Rota A vs B antes de reciclar DePix?
[ ] BTSE: tenho L-BTC (não DePix) para usar Rota C?
[ ] P&L marcado a mercado ainda positivo?
```

---

## 13. Projeção realista por fase

> ⚠️ Estimativas teóricas, **não backtestadas**. Tratar como ordem de grandeza.

```
Fase 0 (R$ 2–5k, 30 dias):
  Objetivo: validar, não lucrar
  Yield esperado: 0% a +1,0%  (aceitar qualquer resultado positivo)
  Aprendizado tem mais valor que o retorno nesta fase

Fase 1 (R$ 10k, meses 2–3):
  MM L-BTC/USDt:    R$ 80–250/mês
  Below-market:      R$ 10–40/mês
  Total estimado:    R$ 90–290/mês  (0,9–2,9%)

Fase 2 (R$ 20k, mês 4+):
  MM L-BTC/USDt:    R$ 150–450/mês
  Below-market:      R$ 40–120/mês
  Total estimado:    R$ 190–570/mês  (0,95–2,85%)
  Com clientes (Fase 2 + SERVICO_DEPIX): potencial 4–6%/mês
```

---

## 14. Roadmap técnico

### Prioridade 1 — Comparação automática Rota A vs B

```
useMarketScan já tem os 3 livros em tempo real.
  1. Calcular custo A vs B a cada tick
  2. Alertar Telegram quando diferença ≥ 0,30%
  3. Executar automaticamente quando discrepância ≥ 1,0%
```

### Prioridade 2 — Integrar preço BTSE na comparação de rotas

```
Adicionar Rota C na comparação automática:
  Custo: 0,20% spot + R$ 5 saque L-BTC Liquid (~0,25–0,45% total)
  Quando DePix congestionado + L-BTC disponível → comparar Rota C
  vs esperar SideSwap
  API: GET /api/v3.2/market_summary (preço BTC-USDT em tempo real)
```

### Prioridade 3 — P&L marcado a mercado no dashboard

```
KPI atual: dealer_trade (lucro realizado em swaps)
KPI faltante: valorização/desvalorização do inventário total
Cálculo: (saldo_atual_em_USD) − (saldo_inicial_em_USD)
Exibir no painel de Histórico → Carteiras
```

### Prioridade 4 — Score v2 para pares DePix

```
Score atual ignora: assimetria Buy/Sell, tempo de saída, risco FX
Penalidades a adicionar:
  − Assimetria > 5:1
  − DePix em carteira > R$ 10k
  − Tempo médio saída > 7 dias
  − Volatilidade BTC > 3%
```

---

## 15. Referência no código

| Arquivo | Função |
|---------|--------|
| `useMarketScan.js` | WebSocket SideSwap, assinatura dos 3 pares |
| `MarketOpportunities.js` | Spread, score, sugestão de entrada, `BelowMarketCard` |
| `utils/marketBargain.js` | `findBelowMarketSells`, `BELOW_MARKET_PAIR_OPTIONS` |
| `utils/orderMargin.js` | Cálculo de margem por trade |
| `settings/TelegramSettings.js` | `notify_below_market`, thresholds, pares |
| `utils/sideswapBook.js` | `SIDESWAP_CANONICAL_PAIRS`, `assetIdForName` |
| BTSE API | `https://btsecom.github.io/docs/` |
