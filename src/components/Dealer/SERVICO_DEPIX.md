# Serviço de Câmbio DePix — Fase 2

Guia da **Fase 2**: monetizar DePix recebido de clientes externos.  
Operação do bot (Fase 1) → ver `OPORTUNIDADES.md`.

> Iniciar esta fase somente quando a Fase 1 estiver estável por ≥ 3 meses.

---

## 1. O que é este serviço

O bot assume o papel de **exchange de saída DePix**:

- Cliente tem DePix e quer sair (para USDt ou L-BTC)
- O emissor DePix cobra **1,4–1,5%** para saída imediata
- Nós cobramos **0,9–1,3%** e entregamos em **3–7 dias**
- Nosso custo de saída = **0%** (ordens ao ind_price no livro SideSwap)

```
           Cliente (tem DePix, quer sair do BRL)
                         │
                         │  paga spread 0,9–1,3%
                         ▼
              BOT ← recebe DePix
              BOT → entrega USDt ou L-BTC imediatamente
                         │
                         ▼
           DePix sai via ordens no livro a 0% (ind_price)
           Tempo: ~3–7 dias por 5k / ~1 semana por 10–20k
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Rota A:                Rota B:
        USDt/DePix             L-BTC/DePix → L-BTC/USDt
        Buy USDt a 0%          (usar quando mais barata)
              │                     │
              └──────────┬──────────┘
                         ▼
               Capital volta como USDt / L-BTC
               Ciclo completo. Lucro = spread cobrado − drift FX
```

---

## 2. Nossa vantagem competitiva

| | Emissor DePix | Nosso serviço |
|--|--------------|--------------|
| Custo ao cliente | **1,4–1,5%** | **0,9–1,3%** |
| Velocidade | Imediato | 3–7 dias |
| Custo operacional | — | **0%** (saída ao ind_price) |
| Margem líquida/ciclo | — | ~0,6–1,0% |

Margem líquida = spread cobrado − drift FX (~0,3%) = ~0,7%/ciclo.

---

## 3. Pricing dinâmico

### Fórmula

```
Spread cobrado = Base + Prêmio_inventário + Prêmio_volatilidade

Base:                   0,8%
DePix em carteira >10k: +0,2%
Saída média > 7 dias:   +0,2%
BTC variação > 3%/24h:  +0,3%
Semana macro quente:    +0,3%
Máximo competitivo:     1,45%  (sempre abaixo do emissor)
```

### Tabela prática

| DePix em carteira | Saída recente | Spread cobrado |
|------------------|---------------|----------------|
| < R$ 5k | < 3 dias | **0,8–1,0%** |
| R$ 5k–12k | 3–7 dias | **1,0–1,2%** |
| R$ 12k–20k | 7–10 dias | **1,25–1,45%** |
| > R$ 20k | > 10 dias | Pausar ou 1,8%+ |
| Semana volátil | qualquer | +0,3–0,5 p.p. |

---

## 4. Fluxo operacional por operação

### Antes de aceitar

- [ ] DePix atual < R$ 15k?
- [ ] Tenho ordens Buy USDt e/ou Buy L-BTC ativas?
- [ ] Tenho USDt/L-BTC suficiente para entregar ao cliente?
- [ ] Spread calculado pela fórmula está < 1,45%?
- [ ] Semana calma? (sem COPOM, Fed, eventos políticos)
- [ ] A operação não leva DePix acima de R$ 20k?

### Execução

1. Calcular spread pela fórmula acima
2. Confirmar com o cliente
3. Receber DePix / Entregar USDt ou L-BTC
4. Ativar ordens de saída:
   - Comparar Rota A (DePix→USDt) vs Rota B (DePix→L-BTC→USDt)
   - Usar a mais barata
   - Fracionado: 2–5k DePix/ordem, múltiplas simultâneas

### Rotas de saída do DePix recebido

| Rota | Caminho | Custo | Quando usar |
|------|---------|-------|-------------|
| **A** | DePix → USDt (SideSwap direto) | 0% | Padrão |
| **B** | DePix → L-BTC → USDt | 0% | Quando below-market em L-BTC/DePix ou BTC em alta |
| **C** | USDt Liquid → BTC via BTSE CEX | 0,20% + saque BTC | Emergência ou DePix congestionado |

### Rota C — BTSE CEX

| Operação BTSE | Taxa |
|--------------|------|
| Spot trade maker | **0,20%** (cai para **0%** com 100 BTSE em stake) |
| Spot trade taker | **0,20%** |
| Saque **L-BTC** (rede Liquid) | **0,000015 BTC ≈ R$ 5** |
| Saque **BTC** (mainnet) | **0,00005 BTC ≈ R$ 17** |
| Depósito L-BTC/USDt Liquid | Gratuito |

> ⚠️ **Risco de custódia:** capital em poder de terceiros. Usar para operação pontual — não manter saldo permanente. Sempre sacar via **Liquid** (mais barato e compatível com o bot).

Custo real da Rota C (saque via Liquid):

| Volume | Custo total | % do volume |
|--------|------------|------------|
| R$ 2.000 | R$ 9 | **0,45%** |
| R$ 5.000 | R$ 15 | **0,30%** |
| R$ 10.000 | R$ 25 | **0,25%** |
| R$ 20.000 | R$ 45 | **0,23%** |

Com maker 0% (100 BTSE staked): custo = apenas R$ 5 (taxa de rede Liquid).

Quando usar:
- DePix congestionado (> 7 dias sem saída) + risco FX relevante
- Urgência de liquidez
- Preço BTC na BTSE melhor que SideSwap

---

## 5. Controle de inventário DePix

| Nível | Ação |
|-------|------|
| < R$ 10k | Aceitar clientes normalmente |
| R$ 10k–15k | Subir spread (+0,2–0,3 p.p.) |
| R$ 15k–20k | Pausar novos clientes; saída em modo acelerado |
| > R$ 20k | Bloquear toda entrada; saída emergencial (Rota C se necessário) |
| > 7 dias sem execução | Cancelar ordens antigas, recolocar mais próximas do ind_price |

---

## 6. KPIs do serviço

| KPI | Meta |
|-----|------|
| Tempo médio DePix em trânsito | < 7 dias |
| DePix em carteira | < R$ 20k |
| Spread médio cobrado | 1,0–1,2% |
| Margem líquida/ciclo | ≥ 0,6% |
| Volume mensal de câmbio | — (crescer mês a mês) |
| Clientes atendidos/mês | — |

---

## 7. Projeção com clientes

> ⚠️ Estimativas teóricas. Dependem do volume de clientes captados.

```
10 clientes/mês × R$ 1.000:
  Receita (1,0%):    R$ 100
  Risco FX (0,3%):   −R$ 30
  Margem líquida:    ≈ R$ 70/mês

50 clientes/mês × R$ 1.000:
  Receita (1,0%):    R$ 500
  Risco FX (0,3%):   −R$ 150
  Margem líquida:    ≈ R$ 350/mês

100 clientes/mês × R$ 1.000:
  Margem líquida:    ≈ R$ 700/mês  (+3,5% sobre R$ 20k capital)
```

Combinado com Fase 1 (bot sozinho 1,7–4,8%) → potencial total de **5–8%/mês** com volume.

---

## 8. Canal de captação (pré-requisito)

O bot **não capta clientes sozinho**. Para escalar o Motor 3:

- Telegram público com cotações ao vivo
- Indicações boca-a-boca da comunidade DePix
- Site ou landing page simples com formulário de cotação
- Parcerias com projetos que usam DePix

Sem canal de distribuição, este documento não tem impacto prático.

---

## 9. Checklist operacional

### Antes de aceitar cada operação

```
[ ] DePix atual < R$ 15k?
[ ] Spread calculado pela fórmula?
[ ] Spread < 1,45% (abaixo do emissor)?
[ ] Tenho ativo para entregar ao cliente?
[ ] Ordens de saída DePix ativas?
[ ] Semana calma (sem COPOM, Fed)?
[ ] A operação não leva DePix acima de R$ 20k?
```

### Após cada operação

```
[ ] Comparar Rota A vs B → usar a mais barata
[ ] Colocar ordens de saída fracionadas (2–5k/ordem)
[ ] Registrar no histórico: volume, spread, data
[ ] Monitorar execução — cancelar/recolocar se > 7 dias
```

---

## 10. Referência

| Arquivo | Função |
|---------|--------|
| `OPORTUNIDADES.md` | Fase 1 — operação do bot sem clientes |
| `utils/marketBargain.js` | Detecção de below-market |
| `utils/sideswapBook.js` | Livro de ordens, ind_prices, pares |
| BTSE API docs | `https://btsecom.github.io/docs/` |
| BTSE deposit/withdrawal fees | `https://www.btse.com/en/deposit-withdrawal-fees` |
| BTSE spot trading fees | `https://support.btse.com/en/support/solutions/articles/43000587197-spot-trading-fees` |
