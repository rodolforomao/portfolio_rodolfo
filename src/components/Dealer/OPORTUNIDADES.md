# Oportunidades de Mercado — Operação do Bot

Guia da **Fase 1**: lucro exclusivamente via trades do próprio bot.  
Câmbio para clientes (Fase 2) → ver `SERVICO_DEPIX.md`.

---

## 1. Como a SideSwap funciona

### Os 3 pares canônicos

| Par | O que é | Ciclo de execução |
|-----|---------|------------------|
| **L-BTC/USDt** | Bitcoin ↔ Dólar | Horas |
| **L-BTC/DePix** | Bitcoin ↔ Real | Dias–semana |
| **USDt/DePix** | Dólar ↔ Real | Dias–semana |

### Como as ordens se preenchem

Todos os market makers (Buy e Sell) esperam **usuários orgânicos da SideSwap** iniciarem swaps — são os takers. Buy side e Sell side servem fluxos de usuários **diferentes** e não competem entre si.

```
Par L-BTC/DePix (snapshot 22/06/2026):

  23 ordens Buy (MMs aguardando)         3–4 ordens Sell (emissor + MMs)
  ────────────────────────────           ─────────────────────────────
  Esperam: usuários com L-BTC            Esperam: usuários com DePix
  que querem DePix.                      que querem L-BTC rápido.
```

Posição 1 no livro atrai mais takers — preço levemente melhor = fills mais rápidos.

### Assimetria DePix

| Fato | Implicação |
|------|-----------|
| 23 Buy vs 3–4 Sell em L-BTC/DePix | Muitos querendo sair de DePix, poucos entrando |
| 12 Buy vs 3 Sell em USDt/DePix | Mesma assimetria |
| Spread USDt/DePix: **1,89%** | Prêmio de iliquidez, não convite a MM simétrico |
| Spread L-BTC/DePix: **1,43%** | Emissor domina o lado Sell |
| Spread L-BTC/USDt: **0,58%** | Único par líquido bilateral — motor principal do bot |

---

## 2. Dados ao vivo validados (22/06/2026)

> Capturados via WebSocket `wss://api.sideswap.io/json-rpc-ws`.

| Par | Buy | Sell | Spread | ind_price |
|-----|-----|------|--------|-----------|
| L-BTC/USDt | 39 | 18 | **0,58%** | 64.531 USD |
| L-BTC/DePix | 23 | 3–4 | **1,43%** | 331.866 DePix |
| USDt/DePix | 11–12 | 3 | **1,89%** | 5,1457 DePix |

Consistência triangular: desvio −0,06% entre L-BTC/DePix implícito e real → ind_prices confiáveis.

---

## 3. As 3 leis (inegociáveis)

```
LEI 1 — DePix é inventário quente, não reserva
  Entrar, sair — nunca acumular. Plano de saída ANTES de receber DePix.

LEI 2 — O emissor DePix é o seu TETO
  Ele cobra 1,4–1,5% para saída imediata. Nosso custo de saída = 0%
  (ordens ao ind_price). Não cobramos clientes nesta fase — só operamos
  o próprio bot. Saída do DePix próprio leva ~3–7 dias por 5k DePix.

LEI 3 — L-BTC/USDt é o único par com ciclo rápido
  Os outros dois pares envolvem DePix. L-BTC/USDt funciona em horas.
  É o motor de renda recorrente.
```

---

## 4. Alocação de capital

### R$ 20.000 (recomendado)

```
┌────────────────────────┬─────────┬──────────┬──────────────────────┐
│ Bloco                  │ % cap.  │ R$ (20k) │ Função               │
├────────────────────────┼─────────┼──────────┼──────────────────────┤
│ USDt (ordens MM)       │   30%   │  R$ 6.000│ MM L-BTC/USDt Sell   │
│ L-BTC (ordens MM)      │   30%   │  R$ 6.000│ MM L-BTC/USDt Buy    │
│ Reserva below-market   │   15%   │  R$ 3.000│ Sniper oportunidades │
│ DePix buffer           │   15%   │  R$ 3.000│ Saída: Buy USDt/LBTC │
│ Caixa tático           │   10%   │  R$ 2.000│ Rebalanceamento      │
└────────────────────────┴─────────┴──────────┴──────────────────────┘
```

### R$ 10.000 (mínimo)

```
┌────────────────────────┬─────────┬──────────┬──────────────────────┐
│ Bloco                  │ % cap.  │ R$ (10k) │ Função               │
├────────────────────────┼─────────┼──────────┼──────────────────────┤
│ USDt (ordens MM)       │   35%   │  R$ 3.500│ MM L-BTC/USDt Sell   │
│ L-BTC (ordens MM)      │   35%   │  R$ 3.500│ MM L-BTC/USDt Buy    │
│ USDt livre             │   15%   │  R$ 1.500│ Sniper below-market  │
│ DePix buffer           │   15%   │  R$ 1.500│ Saída: Buy USDt/LBTC │
└────────────────────────┴─────────┴──────────┴──────────────────────┘
```

### Por regime de mercado

| Regime | L-BTC/USDt MM | Reserva BM | DePix | Caixa |
|--------|--------------|-----------|-------|-------|
| Normal | 60% | 15% | 15% | 10% |
| BTC volátil (>3%/24h) | 40–50% | 20% | 15% | 15–25% |
| DePix congestionado (>15k) | 50% | 15% | reduzir | 20% |
| Mercado calmo | 65–70% | 15% | 10% | 5% |

---

## 5. Motor 1 — Market Making L-BTC/USDt

### Por que apenas L-BTC/USDt

- Único par com liquidez bilateral real (39 Buy + 18 Sell ao vivo)
- Spread real 0,58% > price_min 0,40% → viável
- Ciclo em horas, não dias
- Zero risco de acumular DePix

### Configuração

```yaml
Par: L-BTC/USDt
Ordens: BUY + SELL simultâneas
follow_target: true   # ambos os lados
flash_crash: true     # NUNCA desativar
```

| Volatilidade BTC 24h | price_min |
|---------------------|-----------|
| < 2% | 0,35–0,45% |
| 2–5% | 0,70–0,90% |
| > 5% | 1,50% ou pausar |
| Flash crash ativado | Pausar tudo, aguardar ≥ 30 min |

### Multi-PID (capital ≥ R$ 20.000)

| PID | Capital | price_min | Papel |
|-----|---------|-----------|-------|
| 1 — Conservador | R$ 8.000 | 0,80% | Margem alta em movimentos |
| 2 — Agressivo | R$ 12.000 | 0,25–0,40% | Volume, posição 1–2 no livro |

### Projeção

```
Spread capturado:  0,40%/ciclo
Ticket médio:      ~R$ 1.575 ($300)
Lucro/ciclo:       R$ 6,30
Ciclos/semana:     8–20 (varia com volatilidade BTC)
Lucro mensal:      R$ 200–500 (R$ 12k capital)
```

### Rebalanceamento

Quando um ativo > 70% do par:
1. Cancelar ordem do lado cheio
2. Ser ligeiramente mais agressivo no lado oposto
3. Aguardar reequilíbrio (50% ±10%)
4. Recolocar ambas

---

## 6. Motor 2 — Below-Market Sniper

### O que é

Ordens Sell no livro SideSwap com preço abaixo do `ind_price`. Compra imediata com edge garantido contra a referência no momento da execução.

### Configuração

```
notify_below_market: true
Pares: L-BTC/USDt, USDt/DePix, L-BTC/DePix
Threshold padrão: 0,8%  (0,5% gera muito ruído)
```

| Par | Threshold | Motivo |
|-----|-----------|--------|
| USDt/DePix | 0,8% | Compra USDt com DePix → reduz DePix, melhora inventário |
| L-BTC/DePix | 1,0% | Risco BTC adicional exige desconto maior |
| L-BTC/USDt | 0,7% | Par líquido, saída rápida |
| BTC volátil | +0,3–0,5 p.p. | Compensar movimento do ind_price |

### Prioridade de execução

| # | Oportunidade | Ação |
|---|-------------|------|
| 1 | Comprar USDt com DePix abaixo do ind | Executar imediatamente — reduz DePix |
| 2 | Comprar L-BTC com DePix abaixo do ind | Executar se exposição BTC < 60% |
| 3 | Comprar L-BTC com USDt abaixo do ind | Executar se desconto > volatilidade esperada |
| 4 | Operação que aumenta DePix | Só com desconto excepcional e saída clara |

### Como agir ao receber alerta

1. Abrir **Oportunidades → Abaixo do mercado**
2. Confirmar desconto ainda ativo (livro é dinâmico)
3. Se ≥ threshold: executar com capital livre (nunca capital em ordens abertas)

### Projeção

```
Desconto típico:   0,8–1,5%
Capital/operação:  R$ 500–1.500
Lucro/evento:      R$ 4–22
Frequência:        2–6 eventos/mês
Lucro mensal:      R$ 20–80
```

---

## 7. Motor 3 — Saída de DePix (próprio)

### Rotas disponíveis

| Rota | Caminho | Custo | Quando usar |
|------|---------|-------|-------------|
| **A** | DePix → USDt (SideSwap direto) | 0% | Padrão — verificar primeiro |
| **B** | DePix → L-BTC → USDt (dois swaps) | 0% | Quando Below-market em L-BTC/DePix ou BTC em alta |
| **C** | USDt Liquid → BTC via BTSE CEX | 0,20% spot + taxa saque | Emergência ou quando SideSwap sem liquidez — ver seção 8 |

**Regra:** sempre comparar Rota A vs Rota B antes de executar.

Validação 22/06/2026:
```
Rota A:  5,1301 DePix/USDt
Rota B:  5,1651 DePix/USDt  (+0,68% pior)
→ Usar Rota A neste snapshot
```

### Configuração das ordens de saída

```yaml
Par A: USDt/DePix  (Buy USDt — gasta DePix, recebe USDt)
  price_min: 0%          # ind_price — mais atrativo que o emissor
  follow_target: true
  amount_DePix: 2.000–5.000 por ordem
  Múltiplas ordens simultâneas

Par B: L-BTC/DePix  (Buy L-BTC — gasta DePix, recebe L-BTC)
  price_min: 0%          # idem
  follow_target: true
  amount_DePix: 2.000–5.000 por ordem
  Ativar em paralelo ao Par A

REGRA ABSOLUTA: NUNCA colocar SELL em pares DePix
```

### Micro-posicionamento (dado ao vivo)

**USDt/DePix** — gap de 0,30% entre melhor Buy e ind_price:
```
Best Buy atual:  5,1301  (0,30% abaixo do ind 5,1457)
Tática:          colocar ordem a 5,1450 (0,01% abaixo do ind)
Resultado:       posição 1 no livro com custo adicional ≈ zero
Quando aplicar:  se melhor Buy estiver > 0,20% abaixo do ind
```

**L-BTC/DePix** — cluster a +0,14% acima do ind:
```
Outros MMs:  332.340 (+0,14% acima do ind 331.866)
Nossa ordem a 0% (ind_price): posição 5+

Tática opcional (DePix > 10k):
  1–2 ordens a 332.100–332.200 (+0,07% acima do ind)
  → posição 2–3, custo ≈ 0,07% sobre o valor
```

---

## 8. Rota C — BTSE CEX

### Posicionamento

Na BTSE, o capital fica **em custódia de terceiros** (exchange centralizada). Risco de contraparte, bloqueio, hack. Por isso preferimos SideSwap por padrão — mas o custo real da BTSE via Liquid é baixo o suficiente para ser uma rota regular quando SideSwap está lento.

### Taxas BTSE (rede Liquid)

| Operação | Taxa |
|----------|------|
| Spot trade (maker) | **0,20%** — cai para **0%** com 100 BTSE staked |
| Spot trade (taker) | **0,20%** |
| Saque **L-BTC** (rede Liquid) | **0,000015 BTC ≈ R$ 5** |
| Saque **BTC** (mainnet Bitcoin) | **0,00005 BTC ≈ R$ 17** |
| Depósito L-BTC / USDt Liquid | Gratuito |

> Preferir sempre saque via **Liquid** — 3× mais barato que mainnet e compatível direto com a carteira do bot.

### Custo real por volume

**Via Liquid (recomendado):**

| Volume | Trade 0,20% | Saque L-BTC | **Total** | % do volume |
|--------|------------|------------|---------|------------|
| R$ 2.000 | R$ 4 | R$ 5 | **R$ 9** | **0,45%** |
| R$ 5.000 | R$ 10 | R$ 5 | **R$ 15** | **0,30%** |
| R$ 10.000 | R$ 20 | R$ 5 | **R$ 25** | **0,25%** |
| R$ 20.000 | R$ 40 | R$ 5 | **R$ 45** | **0,23%** |

Com maker fee = 0% (100 BTSE staked): custo = apenas R$ 5 (taxa de rede).

### Quando usar Rota C vs SideSwap

| Situação | Rota escolhida |
|----------|---------------|
| DePix saindo em < 7 dias no SideSwap | Rota A ou B (custo 0%) |
| DePix congestionado (> 7 dias), urgência baixa | Rota A ou B com micro-posicionamento |
| DePix > R$ 15k, risco FX > 0,30%/semana | **Rota C** (0,25–0,45% é melhor que 1+ semana de drift) |
| Necessidade de liquidez imediata | **Rota C** |
| Preço BTC na BTSE melhor que SideSwap | **Rota C** |

### Acesso via API

BTSE tem API REST + WebSocket:
- `GET /api/v3.2/market_summary` — preço e volume BTC-USDT
- `POST /api/v3.2/order` — criar ordem
- Documentação: `https://btsecom.github.io/docs/`

> **Roadmap:** integrar preço BTSE na comparação automática de rotas (Rota A vs B vs C). Com saque Liquid barato, Rota C pode ser a mais econômica quando DePix está congestionado.

---

## 9. Gestão de risco

### Flash crash (L-BTC/USDt)

Nunca desativar. Em flash crash:
1. Bot cancela ordens automaticamente
2. Não recolocar por ≥ 30 minutos
3. Verificar ind_price e spread estabilizados
4. Recolocar apenas quando spread voltou ao nível normal

### price_min dinâmico

| Volatilidade BTC 24h | price_min L-BTC/USDt |
|---------------------|---------------------|
| < 2% | 0,35–0,45% |
| 2–5% | 0,70–0,90% |
| > 5% | 1,50% ou pausar |

### Limites DePix

| Nível DePix | Ação |
|-------------|------|
| < R$ 10k | Operação normal |
| R$ 10k–15k | Aumentar agressividade das ordens de saída |
| R$ 15k–20k | Pausar entradas; saída em modo acelerado |
| > R$ 20k | Bloquear toda entrada; saída emergencial (considerar Rota C) |
| > 7 dias sem execução | Cancelar ordens antigas, recolocar mais próximas do ind_price |

### Exposição L-BTC

Máximo 60% do capital total. BTC pode cair 15% em minutos.

### Lucro vs capital operacional

Separar `dealer_trade` (lucro de swap) de `external_deposit` (capital). Retirar apenas `dealer_trade` quando acumulado ≥ 2% do capital.

---

## 10. KPIs

| KPI | Meta | Alarme |
|-----|------|--------|
| **Tempo médio DePix em trânsito** | < 7 dias | > 10 dias → fragmentar + micro-posicionar |
| DePix em carteira | < R$ 20k | > R$ 15k → modo emergência |
| Yield mensal (bot sozinho) | ≥ 1,7% | < 1,2% por 2 semanas → revisar |
| Spread capturado L-BTC/USDt | ≥ 0,35%/trade | < 0,30% → elevar price_min |
| Exposição L-BTC | < 60% | > 65% → pausar Buy L-BTC/USDt |
| Capital livre (reserva) | ≥ 15% | < 10% → rebalancear |
| Ordens saída DePix ativas | ≥ 2 simultâneas | 0 ordens → recolocar imediatamente |
| Rota de saída | sempre a mais barata | verificar toda sexta |

> **KPI principal:** tempo médio DePix em trânsito. Operação saudável = < 7 dias.

---

## 11. Rotina operacional

### Todo dia — manhã (5 min)

```
① Telegram: below-market overnight?
   → Sim: verificar → executar se ainda ativo

② Saldo DePix > R$ 10k?
   → Sim: ordens de saída ativas e próximas do ind_price?

③ L-BTC/USDt: BUY + SELL com follow_target ativos?

④ BTC variou > 4% ontem?
   → Sim: elevar price_min para 0,8%+
```

### Toda semana — sexta (10 min)

```
⑤ Histórico → Carteiras: lucro da semana (dealer_trade)?
⑥ DePix há > 7 dias? → Cancelar/recolocar ordens menores
⑦ Rota A ou B foi mais barata? → Ajustar padrão
⑧ Capital livre ≥ 15%? → Rebalancear se necessário
⑨ Emissor mudou spread? → Verificar livro L-BTC/DePix
```

---

## 12. Checklist antes de qualquer nova ordem

```
[ ] Ordens de saída DePix (par A e B):
    → price_min = 0%  (ind_price)
    → Fracionadas em 2–5k DePix/ordem
    → ≥ 2 ordens simultâneas em cada par

[ ] MM L-BTC/USDt:
    → price_min ≥ 0,40% (ajustar por volatilidade BTC)
    → follow_target ativo em ambos os lados
    → flash_crash ativo ← NUNCA desabilitar

[ ] Par DePix → só Buy (gasta DePix). NUNCA Sell em par DePix.
[ ] DePix total < R$ 20k?
[ ] Capital livre ≥ 15%?
[ ] Comparei Rota A vs Rota B antes de reciclar DePix?
[ ] Custo BTSE justifica uso em vez de SideSwap?
```

---

## 13. Projeção consolidada

> ⚠️ Estimativas teóricas, **não backtestadas**.

```
                          R$ 10.000      R$ 20.000
MM L-BTC/USDt/mês         R$ 150–400     R$ 300–800
Below-market/mês          R$ 20–80       R$ 40–160
                          ──────────     ──────────
Yield passivo estimado    1,7–4,8%       1,7–4,8%
```

Câmbio para clientes (Fase 2) pode adicionar 2–4% extra → ver `SERVICO_DEPIX.md`.

---

## 14. Roadmap técnico

### Prioridade 1 — Comparação automática Rota A vs B

```
useMarketScan já tem os 3 livros em tempo real.
Falta:
  1. Calcular custo A vs B a cada tick
  2. Alertar Telegram quando Rota B < Rota A em ≥ 0,30%
  3. Executar automaticamente quando discrepância ≥ 1,0%
Ganho: 0,3–0,8%/saída × N saídas/mês
```

### Prioridade 2 — Integrar preço BTSE na comparação de rotas

```
Adicionar Rota C na comparação automática:
  BTSE BTC-USDT price + fee (0,20%) + saque L-BTC Liquid (0,000015 BTC ≈ R$ 5)
  vs Rota A (0%) e Rota B (0%)

  Custo real Rota C: ~0,25–0,45% dependendo do volume
  → Quando DePix congestionado e drift FX > 0,25%/semana, Rota C pode ser
    mais barata que esperar 10+ dias no SideSwap
  → Executar automaticamente pela rota mais barata entre as três
```

### Prioridade 3 — Score v2 para pares DePix

O score atual trata spread alto em par DePix como oportunidade. Adicionar:
- Penalidade por assimetria buy/sell > 5:1
- Penalidade por tempo médio saída > 7 dias
- Penalidade por DePix em carteira > 10k
- Bônus por below-market ativo

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
