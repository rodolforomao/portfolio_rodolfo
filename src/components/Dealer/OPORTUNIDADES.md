# Lucro na tela "Oportunidades de mercado"

Explicação prática usando o exemplo **USDt/DePix** da aba Oportunidades do Dealer Console.

---

## O que esse mercado está mostrando

No par **USDt/DePix**, o preço é **quantos DePix custa 1 USDt**.

| Campo | Valor (exemplo) | Significado |
|-------|-----------------|-------------|
| Melhor compra | **5,1201** | Alguém no livro **paga até** 5,1201 DePix por USDt |
| Melhor venda | **5,2175445** | Alguém no livro **cobra a partir de** 5,2175445 DePix por USDt |
| Spread | **1,90%** | O “vão” entre compra e venda no livro |
| ind_price | **5,1415** | Preço de referência da SideSwap (meio do mercado) |
| sem cobertura | — | **Você ainda não tem ordens** nesse par |

Hoje existe um buraco: quem quer **comprar** paga no máximo ~5,12, e quem quer **vender** pede no mínimo ~5,22. Quem fica **no meio** desse buraco pode ganhar a diferença.

---

## De onde vem a “Entrada sugerida”

O sistema não manda você colocar ordem no extremo do livro. Ele sugere entrar **um pouco por dentro** do spread (~35% do spread total → margem ~**0,67%**):

| Lado | Preço sugerido | Por quê |
|------|----------------|---------|
| **Buy até 5,15420558** | Um pouco **acima** da melhor compra (5,1201) | Para sua ordem de compra ficar **mais atrativa** que a atual melhor compra |
| **Sell a partir de 5,18278984** | Um pouco **abaixo** da melhor venda (5,2175445) | Para sua ordem de venda ficar **mais barata** que a atual melhor venda |

Visualmente:

```
Melhor compra atual     Sua compra sugerida     ind_price     Sua venda sugerida     Melhor venda atual
    5,1201      →      5,1542        →       5,1415       →      5,1828       →        5,2175
    |___________________________|  |___________________|  |___________________________|
              (outros compram)         (você no meio)              (outros vendem)
```

A margem exibida (`~0,67%`) corresponde a `spread × 0,35` (no código: `entrySuggestion` em `MarketOpportunities.js`).

---

## Como o lucro acontece (exemplo com 100 USDt)

Imagine que você coloca as duas ordens e **as duas são executadas**:

### Passo 1 — Alguém te **vende** USDt (sua ordem Buy executa)

- Você **compra** 100 USDt a **5,1542** DePix/USDt
- Você **gasta**: 100 × 5,1542 = **515,42 DePix**
- Você fica com **100 USDt** na carteira

### Passo 2 — Alguém te **compra** USDt (sua ordem Sell executa)

- Você **vende** 100 USDt a **5,1828** DePix/USDt
- Você **recebe**: 100 × 5,1828 = **518,28 DePix**

### Resultado

```
Recebido  −  Pago  =  Lucro
518,28    − 515,42 = 2,86 DePix
```

Em percentual sobre o que você gastou na compra:

**2,86 ÷ 515,42 ≈ 0,55% de lucro** nesse round-trip (compra + venda).

Isso é parecido com a margem sugerida (~0,67%): você **não captura os 1,90% inteiros** do spread do livro, mas uma fatia menor — ainda assim positiva, e com mais chance de ser executado.

> ⚠️ **Cenário idealizado.** Este exemplo assume round-trip em minutos. Com DePix, o lado Sell pode executar hoje e o Buy só **dias depois** — veja [Realidade do mercado DePix](#realidade-do-mercado-depix--liquidez-assimétrica).

---

## Por que isso é lucro (e não mágica)

Você está fazendo papel de **intermediário (market maker)**:

1. Oferece um preço de **compra** melhor que o resto do livro → atrai quem quer vender USDt
2. Oferece um preço de **venda** melhor que o resto do livro → atrai quem quer comprar USDt
3. Se fizer os dois lados, a diferença entre vender mais caro e comprar mais barato **fica com você**

O lucro **não vem da tela em si** — a tela só indica que o buraco é grande (1,90%), há pouca concorrência em um dos lados (ex.: 3 ordens de venda) e você ainda não está posicionado nesse mercado.

---

## O que precisa acontecer para ganhar de verdade

| Condição | Por quê |
|----------|---------|
| Ter saldo no ativo que **você vai entregar** na execução | Cada lado exige um ativo diferente (DePix, USDt ou L-BTC) |
| Alguém **negociar com você** | Estar no livro não garante execução |
| Conseguir **sair do inventário** depois | Lucro de spread só existe no round-trip — ver seção abaixo |
| Tempo de espera compatível com o par | Em pares com DePix, o ciclo pode levar **dias ou semanas**, não minutos |

**“Sem cobertura”** significa que você ainda não tem ordens ativas naquele par. O lucro só começa **depois** de colocar ordens, elas serem preenchidas **e** você conseguir fechar o ciclo no outro lado (ou em outro par).

> ⚠️ **Premissa errada do market making simétrico:** o exemplo acima (compra + venda em horas) assume liquidez nos **dois lados**. Na prática do ecossistema DePix, isso **não é verdade** — veja a seção seguinte.

---

## Realidade do mercado DePix — liquidez assimétrica

Esta seção documenta o comportamento observado na operação real. Use como base para definir a estratégia ideal.

### O que acontece na prática

| Fato observado | Implicação |
|----------------|------------|
| **Quase ninguém quer comprar DePix** | DePix é ativo de **saída** do mercado, não de destino |
| Trocar **10k DePix → USDt** ou **10k DePix → L-BTC** pode levar **até ~1 semana** | Round-trip tem **horizonte de dias**, não de minutos |
| O livro parece “líquido” só em **um dos lados** | Spread alto no card ≠ oportunidade simétrica |
| Muitas ordens de compra, poucas de venda (ex.: 11 buy · 3 sell) | Demanda concentrada em **sair de DePix** (pegar USDt/L-BTC), não em entrar |
| **Emissor DePix opera o maior MM** do livro (DePix → USDt e DePix → L-BTC) | Spread de referência **~1,4–1,5%** para usuários venderem DePix — ver abaixo |

### O market maker do emissor DePix

O **emissor do DePix** mantém o **maior market maker** nos pares com DePix na SideSwap:

| Par | Papel do emissor | Spread habitual |
|-----|------------------|-----------------|
| **USDt/DePix** | Liquidez para usuário **vender DePix** e receber **USDt** | **~1,4% a 1,5%** |
| **L-BTC/DePix** | Liquidez para usuário **vender DePix** e receber **L-BTC** | **~1,4% a 1,5%** |

Na prática, quando um usuário DePix quer **sair do BRL** (converter DePix → USDt ou DePix → L-BTC), o caminho padrão passa por esse MM do emissor, que normalmente cotiza nessa faixa de **1,4–1,5%** em relação ao preço de referência.

**O que isso significa para nós:**

1. **Piso de mercado** — Spread abaixo de ~1,4% em pares DePix compete diretamente com o maior player; margem difícil de sustentar.
2. **Por que o livro “líquido” é unilateral** — A liquidez estrutural está no sentido **DePix → USDt/L-BTC** (atendida pelo emissor), não no sentido inverso.
3. **Spread de 1,90% no card** — Pode ser spread **acima** do emissor (outros dealers) ou entre ordens que não incluem a melhor cota do MM oficial; sempre comparar com a faixa 1,4–1,5% antes de entrar.
4. **`price_min` recomendado ≥ 1,5%** — Alinha com o piso real do mercado; operar com 0,35–0,67% (como a tela sugere) **perde para o MM do emissor** e acumula DePix sem compensação.

```
Usuário com DePix quer USDt/L-BTC
         │
         ▼
  MM emissor (~1,4–1,5%)  ← maior volume, referência de preço
         │
         ▼
  Outros dealers no livro   ← só capturam fluxo se forem competitivos
                            ou se o emissor estiver offline/lotado
```

**Estratégia implicada:** não tentar “undercut” agressivo contra o emissor. Operar **acima** de 1,5% em margem, em nichos (tamanho, horário, below-market), ou no par **L-BTC/USDt** onde o emissor não domina.

---

```
                    ┌─────────────────────────────────────┐
  Quem TEM DePix    │  Quer USDt ou L-BTC (sair do BRL)   │  ← lado que EXECUTA rápido
  e quer converter  │  Paga DePix, recebe USDt / L-BTC    │
                    └─────────────────────────────────────┘
                                      │
                                      ▼
                    Dealer vende USDt/L-BTC  →  ACUMULA DePix

                    ┌─────────────────────────────────────┐
  Quem precisa      │  Quer DePix (entrar / receber BRL)  │  ← lado que NÃO executa
  DePix             │  Pouquíssima demanda real             │
                    └─────────────────────────────────────┘
                                      │
                                      ▼
                    Dealer compra USDt/L-BTC  →  GASTA DePix  (rebalanceamento lento)
```

**Traduzindo:** o lado que **te dá DePix** (ex.: você vende USDt no par USDt/DePix) tende a executar. O lado que **te tira DePix** ou te deixa **preso em DePix** esperando contraparte é lento.

### Por que o spread de 1,90% existe

O spread largo **não é só margem fácil** — é o prêmio que o mercado cobra por:

1. **Risco de inventário** — ficar sentado em DePix que ninguém quer
2. **Tempo de capital parado** — 7 dias para mover 10k DePix
3. **Contraparte escassa** — poucas ordens no lado oposto (ex.: 3 sells vs 11 buys)
4. **Custo de oportunidade** — enquanto espera, USDt/L-BTC podem ser mais úteis
5. **Referência do MM emissor** — usuários que vendem DePix já têm saída a **~1,4–1,5%**; spread maior no livro público reflete dealers secundários ou desalinhamento temporário, não necessariamente alpha extra

Um spread teórico de 0,67% **não compensa** uma semana de espera **e** fica **abaixo do piso** que o emissor DePix já oferece aos seus usuários.

### Cálculo rápido: spread mínimo vs tempo de hold

| Tempo médio para completar round-trip | Spread mínimo sugerido (além do custo operacional) |
|--------------------------------------|-----------------------------------------------------|
| &lt; 1 hora (USDt/L-BTC puro) | 0,2–0,5% |
| 1–3 dias | 0,8–1,5% |
| ~1 semana (DePix envolvido) | **≥ 2–3%** ou não operar simetricamente |

Exemplo: 0,55% de lucro em 7 dias ≈ **0,08%/dia** — provavelmente abaixo do risco de ficar exposto em DePix ou perder movimento de BTC/câmbio.

### Como ler o card USDt/DePix com essa lente

Dados típicos do card:

```
Melhor compra   5,1201   ← 11 ordens: fila para QUEM quer USDt (paga DePix)
Spread          1,90%    ← prêmio de iliquidez, não convite a MM simétrico
Melhor venda    5,2175   ← 3 ordens: pouca oferta de USDt
Entrada sugerida ~0,67%  ← margem teórica SE round-trip for rápido (não é o caso)
```

| Se você fizer… | O que provavelmente acontece |
|----------------|------------------------------|
| **Sell USDt** (vender USDt, receber DePix) | Executa relativamente rápido — **acumula DePix** |
| **Buy USDt** (comprar USDt, gastar DePix) | Concorrência com 11 ordens — executa devagar ou nunca |
| **Buy + Sell simultâneos (MM clássico)** | Um lado enche rápido (DePix), o outro demora **dias/semana** |
| **Só Buy USDt** quando abaixo do `ind_price` | OK se você **quer USDt** e tem DePix parado |
| **Só Sell USDt** com spread alto | OK se você **tem plano de saída** para o DePix recebido |

### Limites operacionais sugeridos (DePix)

| Regra | Valor sugerido | Motivo |
|-------|----------------|--------|
| **Teto de DePix em inventário** | ≤ 10k DePix “em trânsito” | Acima disso, tempo de saída escala linearmente |
| **Não operar MM simétrico** se DePix &gt; 50% do capital no par | — | Você vira “depósito involuntário” de BRL |
| **Prazo máximo de posição aberta** | 7 dias → revisar/cancelar | Evita DePix esquecido sem plano |
| **Spread mínimo (`price_min`) em pares DePix** | ≥ **1,5%** (piso: MM emissor ~1,4%) | Abaixo disso compete com o maior player sem vantagem |
| **Chunk por ordem** | Fracionar (ex.: 1–2k DePix por ordem) | 10k de uma vez = fila de uma semana |

---

## Riscos que a tela não mostra claramente

1. **Só o lado “rápido” executa** — Você vende USDt, recebe DePix, e fica **semanas** esperando recomprar USDt ou rotear para L-BTC. O lucro de 0,55% vira prejuízo se BTC ou câmbio se moverem nesse intervalo.

2. **Spread alto = armadilha de iliquidez** — Especialmente em pares com DePix. O score “Média/Alta” **não desconta** o tempo de hold.

3. **DePix é o ativo que ninguém quer** — Acumular DePix por market making é o erro mais comum. A estratégia deve **minimizar estoque de DePix**, não equilibrar 50/50 como em FX líquido.

4. **Preço se move durante a espera** — Uma semana com posição aberta em USDt ou L-BTC expõe a volatilidade de BTC e USDBRL.

5. **“Colocar ordem” não automatiza saída** — Colocar ordem é fácil; **desfazer inventário DePix** é o gargalo real.

---

## Como o score e a varredura se relacionam

A aba **Oportunidades** usa `useMarketScan` para assinar o livro público SideSwap nos pares canônicos (L-BTC/DePix, L-BTC/USDt, USDt/DePix). Para cada par, o score considera:

- **Spread** (até 60 pontos) — quanto maior, melhor
- **Profundidade** (até 25 pontos) — menos ordens no livro = mais atrativo
- **Cobertura** (−10 se você já tem ordens no mercado)

Classificação: **Alta** (≥60), **Média** (≥30), **Baixa** (≥10), **Nula** (&lt;10).

### Limitação conhecida do score (DePix)

O score **não considera**:

- Assimetria de liquidez entre buy e sell
- Tempo estimado de round-trip (dias vs minutos)
- Risco de acumular DePix
- Razão buy/sell no livro (ex.: 11:3)

**Interpretação correta em pares com DePix:** score alto + spread alto + poucas ordens de venda = **alerta de iliquidez**, não necessariamente “entrar com Buy + Sell”. Priorize a aba **Abaixo do mercado** ou estratégias unilaterais (seção abaixo).

---

## Resumo em uma frase

No card USDt/DePix, o spread de ~1,90% reflete um mercado **líquido só para quem sai de DePix** — não um convite a market making simétrico com lucro de 0,67% em minutos. Lucro real exige **spread maior, posição menor, horizonte de dias** e plano explícito para **não acumular DePix**.

---

---

## Aba "Abaixo do mercado" — oportunidade de compra imediata

A segunda aba da tela Oportunidades mostra algo diferente: **ordens Sell no livro SideSwap cujo preço está abaixo do `ind_price`** — ou seja, alguém está vendendo mais barato que o mercado.

### Por que isso é uma oportunidade?

O `ind_price` é a referência de mercado calculada pela SideSwap. Se uma ordem Sell está **abaixo** desse valor, você pode comprar o ativo por menos do que o mercado acha que ele vale. Isso é o oposto de market making: em vez de esperar dois lados executarem, você executa **uma compra imediata** com desconto garantido.

### Exemplo — USDt/DePix

| Campo | Valor |
|-------|-------|
| ind_price | 5,1415 DePix por USDt |
| Sell abaixo do mercado | 5,1000 DePix por USDt |
| Desconto | −0,81% |

Você pode **comprar USDt a 5,10** quando o mercado os vale 5,14. Lucro imediato de ~0,81% se você conseguir revender ao preço de mercado.

### Threshold de desconto

O sistema só mostra uma ordem como "abaixo do mercado" quando o desconto for ≥ **0,5%** (padrão). Isso evita falso-positivo por flutuação normal de arredondamento.

Esse limiar é configurável no **Telegram → Alertas → Venda abaixo do preço de mercado** — o mesmo valor usado para os alertas 24/7 do manager_dealer.

### Diferença vs. market making (aba Spread & cobertura)

| | Market making (spread) | Abaixo do mercado |
|---|---|---|
| **Ação** | Coloca ordens e espera execução | Compra imediatamente |
| **Lados** | Buy + Sell (dois lados) | Só Buy |
| **Risco** | Posição aberta se só um lado executa | Fica com o ativo comprado |
| **Lucro** | Captura spread | Compra com desconto |
| **Tempo** | Pode levar horas | Imediato (se a ordem ainda existir) |

### Como agir

1. Acesse **Oportunidades → Abaixo do mercado**
2. Clique em **"Comprar no Swap Market"** — abre o livro diretamente na SideSwap
3. Execute a compra enquanto a ordem ainda estiver no livro

> **Atenção:** o livro SideSwap é público e dinâmico. Ordens podem ser removidas a qualquer momento. O tempo entre o alerta e a execução pode ser suficiente para a oportunidade desaparecer.

### Alertas Telegram — `notify_below_market`

O `manager_dealer` monitora o livro **24/7** e envia alerta pelo Telegram quando detecta uma venda abaixo do threshold. Configure em:

**Configurações → Telegram → Alertas → Avançado → Venda abaixo do preço de mercado**

Campos configuráveis:
- **Pares monitorados**: L-BTC/DePix, L-BTC/USDt, USDt/DePix
- **Desconto mínimo (%)**: padrão 0,5%

> **Nota:** O Telegram notifica quando surge a oportunidade; a tela Oportunidades mostra o estado atual do livro em tempo real. Use os dois em conjunto.

---

## O Bot — o que ele faz e quem são os pares

O `manager_dealer` opera como **market maker passivo na SideSwap DEX** (Liquid Network). Ele coloca ordens no livro público e aguarda que outras pessoas negociem com ele. As negociações são atômicas (swap sem custódia) e a contraparte é anônima.

**Pares ativos:**

| Par | O que é na prática | Volatilidade |
|-----|-------------------|--------------|
| **DePix/USDt** | Câmbio BRL/USD — **liquidez unilateral** | Baixa (~1–3%/dia) · **hold DePix ~7d/10k** |
| **L-BTC/DePix** | Bitcoin em Reais — **saída DePix lenta** | Alta (~3–8%/dia) |

**Ativos em jogo:**
- **DePix** — stablecoin BRL (1 DePix = 1 Real). **Ativo de passagem:** quase ninguém quer comprar; saída de 10k pode levar ~1 semana. O **emissor** opera o maior MM (DePix → USDt / L-BTC) com spread habitual **~1,4–1,5%**.
- **USDt** — stablecoin USD. Exposição ao câmbio USDBRL.
- **L-BTC** — Bitcoin na rede Liquid, lastreado 1:1 com BTC on-chain. Alta volatilidade.

**O que o bot NÃO faz sozinho:** arbitragem entre CEX e SideSwap; gerenciamento de inventário automático; rebalanceamento entre carteiras. Essas alavancas são manuais — as estratégias abaixo ensinam como usá-las.

---

## Estratégias vencedoras — visão geral

```
Liquidez      Alta  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ Baixa
              ────────────────────────────────────────
Par           L-BTC/USDt   USDt/DePix*   L-BTC/DePix*
Spread ideal  0,2–0,5%     ≥1,5% (ref.)  ≥1,5% (ref.)
              ───────────  piso MM emissor DePix: ~1,4–1,5%
Estratégia    Follow+PM    Unilateral    Unilateral / saída
Horizonte     minutos      dias          dias–semana
Risco         Baixo        Inventário    Inventário + BTC

* Pares com DePix: liquidez assimétrica — ver seção "Realidade do mercado DePix"
```

Cinco estratégias são descritas abaixo. **Para DePix/USDt e L-BTC/DePix, ignore a Estratégia 1 clássica** até revisar a **Estratégia 0 (ideal)** no final desta seção.

---

## Estratégia 0 — Ideal para mercado DePix (liquidez unilateral)

**Objetivo:** Operar **somente o lado que executa**, com **plano de saída** antes de colocar ordem, sem assumir round-trip rápido.

### Princípios

1. **DePix é passagem, não destino** — Não acumular DePix “esperando o mercado virar”.
2. **Uma ordem por vez** — Não colocar Buy + Sell simultâneos em pares DePix até o inventário estar equilibrado **e** houver evidência de liquidez nos dois lados.
3. **Spread proporcional ao tempo e ao emissor** — `price_min` ≥ **1,5%** em DePix (MM do emissor ~1,4–1,5%); round-trip semanal exige ≥ 2–3% se não for only below-market.
4. **Tamanho fracionado** — Máx. 1–2k DePix por ordem; 10k ≈ 1 semana de fila.
5. **Rota de saída definida antes da entrada** — Saber em qual par e direção você vai desfazer DePix **antes** de receber DePix.

### Matriz de decisão por par

| Par | Lado que executa (geralmente) | O que fazer | O que evitar |
|-----|------------------------------|-------------|--------------|
| **USDt/DePix** | Sell USDt (recebe DePix) | Só se você **precisa de DePix** ou tem saída imediata planejada | MM simétrico “capturar 0,67%” |
| **USDt/DePix** | Buy USDt (gasta DePix) | **Preferido** se você tem DePix parado e quer USDt | Depende de fila longa — use `follow_target` + pm alto |
| **L-BTC/DePix** | Sell L-BTC (recebe DePix) | Só com target de BTC definido | Acumular DePix sem plano |
| **L-BTC/DePix** | Buy L-BTC (gasta DePix) | Saída natural de DePix → BTC | Ordem grande (10k+) de uma vez |
| **L-BTC/USDt** | Ambos (relativamente) | MM simétrico, follow, spread 0,3–0,5% | Tratar igual aos pares DePix |

### Fluxo operacional recomendado (DePix → USDt)

Quando você **tem DePix** e quer lucro sem ficar preso:

```
1. Monitorar "Abaixo do mercado" (USDt/DePix ou L-BTC/DePix)
2. Comprar USDt ou L-BTC com desconto vs ind_price (execução imediata)
3. Opcional: revender USDt/L-BTC no par L-BTC/USDt (mais líquido) com spread menor
4. NÃO recolocar ordem Sell USDt que devolve DePix até inventário DePix < teto
```

### Fluxo quando você **precisa** fazer market making em DePix

Se a operação exige estar no livro (ex.: pool DePix):

```
1. Colocar APENAS o lado que REDUZ DePix (Buy USDt ou Buy L-BTC)
2. price_min ≥ 1,5%
3. amount fracionado (≤ 2k DePix equivalente)
4. Timer: se não executar em 7 dias → cancelar e reavaliar
5. NUNCA colocar Sell USDt/L-BTC enquanto DePix > 50% do capital
```

### KPIs específicos DePix

| Métrica | Meta | Ação se falhar |
|---------|------|----------------|
| DePix em inventário | &lt; 10k | Pausar ordens que recebem DePix |
| Tempo médio com DePix parado | &lt; 3 dias | Aumentar agressividade no Buy USDt/L-BTC |
| Round-trip completo no par | &gt; 30% em 7 dias | Abandonar MM simétrico naquele par |
| Lucro / dia de capital preso | &gt; 0,15%/dia | Spread atual insuficiente — subir pm |

### Checklist antes de clicar "Colocar ordem" (pares DePix)

- [ ] Sei qual ativo vou **receber** se a ordem executar hoje?
- [ ] Tenho rota de saída se receber DePix?
- [ ] DePix atual + máximo desta ordem &lt; 10k?
- [ ] `price_min` ≥ 1,5% (acima do MM emissor DePix ~1,4%)?
- [ ] Não tenho ordem oposta aberta que formaria MM simétrico involuntário?

---

## Estratégia 1 — Spread Simétrico + Follow Target (somente L-BTC/USDt)

> ⚠️ **Não usar em DePix/USDt ou L-BTC/DePix** sem adaptar à Estratégia 0. A premissa de “10 trades/dia” e inventário 50/50 **não se aplica** quando DePix leva ~1 semana para 10k e ninguém quer comprá-lo.

**Objetivo:** Capturar spread de forma contínua com risco mínimo — **apenas no par L-BTC/USDt** (ou quando DePix/USDt tiver liquidez comprovada nos dois lados por ≥7 dias consecutivos).

### Configuração recomendada (L-BTC/USDt)

```
Par: L-BTC/USDt  (NÃO DePix/USDt por padrão)
Ordens: BUY + SELL simultâneas
follow_target: true  (ambos os lados)
price_min: 0.35–0.5%
```

### Configuração alternativa (DePix/USDt — somente se inventário DePix baixo)

```
Par: DePix/USDt
Ordens: APENAS Buy USDt (gastar DePix) — unilateral
follow_target: true
price_min: 1.5%  (mínimo — ver tabela de hold)
amount: ≤ 2k DePix por ordem
```

### Por que follow_target aqui (L-BTC/USDt)

O livro L-BTC/USDt tem liquidez bilateral razoável. Com `follow_target`, o bot se posiciona **1 tick à frente do melhor concorrente**, sem violar o `price_min`.

### Capital mínimo por lado (L-BTC/USDt)

```
Capital total no par: equivalente a ~$2.000–5.000
Divisão: ~50% L-BTC / ~50% USDt
Reserva: 20% para rebalancear
```

### Ciclo de lucro esperado (L-BTC/USDt — revisado)

Com spread capturado de ~0,4% e **liquidez real nos dois lados**:

```
Lucro por ciclo completo (buy + sell): volume × 0,4%
Meta realista: 2–5 ciclos/dia em par líquido
DePix/USDt: NÃO usar esta projeção — ciclo medido em dias, não horas
```

### Quando rebalancear

Monitore o painel de saldos. Quando um ativo representar >70% do total no par:

1. Cancele a ordem do lado "cheio"
2. Ajuste o preço para ficar ligeiramente mais agressivo no lado oposto
3. Aguarde execução até reequilibrar (>50% + margem de tolerância)
4. Recoloque ambas as ordens — **somente em L-BTC/USDt**

**Em pares DePix:** se DePix > 50%, **não recolocar ordem que recebe DePix** — apenas ordens de saída (Buy USDt / Buy L-BTC).

---

## Estratégia 2 — Spread Assimétrico Baseado em Inventário

**Objetivo:** Usar o spread como ferramenta de rebalanceamento de inventário, não só de lucro.

Quando o bot acumula muito de um ativo, o risco de inventário aumenta. A solução profissional é **skewing** (inclinar o spread):

### Regra prática

| Inventário atual | Ação |
|-----------------|------|
| >65% DePix | Tighten sell spread (facilita venda de DePix), widen buy spread |
| >65% USDt | Tighten buy spread (facilita compra de DePix), widen sell spread |
| >65% L-BTC | Ser mais agressivo no Sell, aceitar menos no Buy |
| Equilibrado | Spread simétrico |

### Implementação no bot

Você não ajusta o spread automaticamente ainda (funcionalidade futura). Faça manualmente:

```
Inventário 70% DePix:
  → ordem SELL DePix/USDt: price_porc = 0.15%  (mais barato que concorrentes)
  → ordem BUY DePix/USDt:  price_porc = 0.60%  (mais caro = menos atrativo)
  
Inventário equilibrado:
  → ambas as ordens: price_porc = 0.35%
```

---

## Estratégia 3 — Segmentação de Capital por Agressividade (Multi-PID)

**Objetivo:** Capturar volume alto E manter um colchão de alta margem, sem conflito entre os dois.

Use **dois dealers diferentes** para o mesmo par:

| PID | Perfil | price_min | Resultado esperado |
|-----|--------|-----------|-------------------|
| PID 1 | Conservador | 0.8% | Poucos trades, margem alta, executa quando mercado se move |
| PID 2 | Agressivo | 0.25% | Muitos trades, margem baixa, captura o fluxo constante |

### Por que funciona

PID 2 (agressivo) está sempre na posição 1 do book e captura a maioria das ordens de mercado. PID 1 (conservador) fica nas posições 3–5 e captura os picos de volatilidade, quando alguém precisa negociar urgente e aceita preços piores.

Na prática: PID 2 faz volume, PID 1 faz margem.

### Capital sugerido para multi-PID

```
Capital total: R$ 20.000
PID 1 (conservador): R$ 8.000  (reserva estratégica)
PID 2 (agressivo): R$ 12.000   (capital de giro)
```

---

## Estratégia 4 — Ciclo BRL → BTC → USD (Aproveitamento de Tendência)

**Objetivo:** Usar o bot para se posicionar na tendência de longo prazo de valorização do Bitcoin.

Esta estratégia é **semi-direcional** — você ainda faz market making, mas ajusta os lados de forma assimétrica conforme a tendência de BTC.

### Lógica do ciclo

```
BTC em tendência de alta:
  L-BTC/DePix:  Priorizar BUY (acumular L-BTC com DePix)
  L-BTC/USDt:   Priorizar SELL quando atingir target de lucro
  DePix/USDt:   Manter equilibrado (reserva de capital)

BTC em queda / lateralização:
  L-BTC/DePix:  Priorizar SELL (descarregar L-BTC, acumular DePix)
  DePix/USDt:   Usar excesso de DePix para comprar USDt barato
                (se USDBRL subiu junto com a queda de BTC)
```

### Sinal de entrada para o ciclo

Use os dados já disponíveis no sistema:
- `ind_price` do par L-BTC/DePix subiu >5% em 24h → modo acumulação
- Flash crash ativado → sair de L-BTC imediatamente (o sistema já faz isso automaticamente)
- `ind_price` estável por >3 dias → voltar a spread simétrico

### Risco desta estratégia

Esta estratégia tem **risco direcional**: se BTC cair enquanto você está acumulado em L-BTC, suas DePix valem menos em BTC. **Não indicado para capital operacional que você precisa retirar no curto prazo.**

---

## Estratégia 5 — Caça a Ordens Abaixo do Mercado (Alpha Garantido)

**Objetivo:** Comprar ativos a preço de desconto sempre que o sistema detectar uma oportunidade.

Esta é a única estratégia com **alpha garantido** no momento da execução — você compra sabendo que está pagando menos que o valor de mercado.

### O fluxo

1. Telegram alerta `notify_below_market` chega
2. Acesse **Oportunidades → Abaixo do mercado**
3. Verifique o desconto (≥0.5% = confirmado)
4. Clique **Comprar no Swap Market** e execute imediatamente
5. Você recebeu o ativo com desconto; o spread de revenda é lucro pré-garantido

### Quanto manter disponível para caça

Mantenha **10–15% do capital total em cada ativo em estado líquido** (sem estar preso em ordens abertas) para poder reagir. Se você tiver 100% do capital em ordens, não consegue comprar quando o alerta chega.

```
Capital total: R$ 50.000
Capital em ordens ativas: ~R$ 42.000 (84%)
Capital livre para caça: ~R$ 8.000 (16%)
```

### Por que as ordens abaixo do mercado existem

- Dealer precisa de liquidez urgente e aceita desconto
- Erro de configuração no concorrente (preço errado)
- Liquidação forçada (alguém saindo de posição grande)
- Oportunidade de arbitragem que já expirou para quem criou a ordem

Em todos os casos, você é o beneficiário.

---

## Gestão de Risco — Regras Operacionais

### Regra 1 — Flash Crash é sagrado

Nunca desative a proteção de flash crash. Ela existe porque o L-BTC pode cair 15% em minutos durante um evento de mercado. O bot já cancela/pausa ordens automaticamente. Quando isso acontecer:

1. **Não recoloque ordens imediatamente** — espere o mercado se estabilizar (≥30 min)
2. Verifique o `ind_price` no painel de Oportunidades
3. Só recoloque quando o spread voltar ao nível normal

### Regra 2 — Nunca opere L-BTC sem price_min adequado

| Volatilidade do dia (BTC) | price_min mínimo |
|--------------------------|-----------------|
| <2% | 0.4% |
| 2–5% | 0.8% |
| >5% | 1.5% ou pausar |

Se BTC estiver volátil e você tiver `price_min = 0.3%`, uma única movimentação de 2% faz você perder muito mais do que ganhou de spread no dia inteiro.

### Regra 3 — DePix é passagem, não reserva operacional

DePix é estável (BRL), mas **iliquido para saída**. Não trate como “âncora” que você acumula via market making.

```
Alocação saudável:
  DePix: mínimo necessário para operar (não acumular via Sell USDt/L-BTC)
  USDt:  reserva + capital de giro em L-BTC/USDt
  L-BTC: conforme estratégia direcional (≤60% se exposto a BTC)

Teto operacional DePix: ≤ 10k em trânsito
Prazo máximo parado: 7 dias → forçar saída via Buy USDt ou Buy L-BTC
```

### Regra 4 — Lucro de swap não é capital operacional

O histórico separa `dealer_trade` (lucro de swap) de `external_deposit` (capital). Não retire o capital operacional confundindo com lucro. Somente retire o acumulado de `dealer_trade` quando atingir um múltiplo razoável (ex.: ≥2% do capital).

---

## KPIs para acompanhar (dashboard de saúde)

| Métrica | Como calcular | Referência saudável |
|---------|--------------|---------------------|
| **Spread médio capturado** | Média de `profit_percent` dos trades | ≥0.3% por trade |
| **Taxa de round-trip** | Trades buy que geraram trade sell no mesmo par/dia | >50% em L-BTC/USDt; **>30% em 7 dias** em pares DePix |
| **Tempo médio DePix parado** | Dias entre receber e sair DePix | **< 3 dias** |
| **DePix em trânsito** | Saldo DePix acima do operacional | **≤ 10k** |
| **Giro de capital** | Volume total / capital em ordens | ≥2x por semana |
| **Sharpe do par** | Lucro médio / desvio de lucro | >1 (lucro consistente) |
| **Exposição a L-BTC** | % do capital total em L-BTC | <60% |

Esses números você extrai do painel **Histórico → Carteiras** filtrando por `dealer_trade`.

---

---

## Modelo de negócio do bot

O bot opera **duas funções complementares**:

1. **Câmbio DePix** — troca DePix do cliente por USDt ou L-BTC (ao preço de mercado com spread). O bot fornece liquidez, o cliente paga o spread.
2. **Market making passivo** — coloca ordens no livro SideSwap e aguarda execução. Qualquer pessoa pode ser a contraparte.

```
           Cliente (tem DePix, quer sair do BRL)
                         │
                         │  paga spread ~1,5–2%
                         ▼
              BOT  ←  recebe DePix
              BOT  →  entrega USDt ou L-BTC
                         │
                         ▼
              DePix acumulado precisa sair
                         │
           ┌─────────────┴───────────────┐
           ▼                             ▼
  Rotar via L-BTC/DePix         Rotar via USDt/DePix
  (Buy L-BTC, gasta DePix)     (Buy USDt, gasta DePix)
           │                             │
           └──────────────┬──────────────┘
                          ▼
               Capital volta como USDt / L-BTC
               Ciclo recomeça
```

---

## Estratégia Vencedora Consolidada — Carteira Piloto

Esta seção sintetiza tudo que o documento ensina em **um plano operacional único**, seguro e com capital mínimo definido. É o ponto de partida real.

### Premissas de mercado (não negociáveis)

Antes de alocar qualquer capital, aceitar estes fatos:

| Fato | Consequência operacional |
|------|--------------------------|
| DePix é ativo de saída — ninguém quer comprar | Nunca acumular DePix; é custo, não reserva |
| Emissor DePix opera MM com ~1,4–1,5% de spread | Spread abaixo de 1,5% perde para o maior player |
| 10k DePix leva ~7 dias para sair via livro SideSwap | Fracionar ordens; máx. 2k DePix por ordem |
| L-BTC/USDt é o par mais líquido dos três | É onde spread simétrico funciona de verdade |
| Flash crash pode tirar 10–15% do L-BTC em minutos | price_min nunca abaixo de 0,4% em L-BTC |

---

### Carteira Piloto — Configuração Mínima

#### Alocação inicial

| Ativo | Quantidade mínima | Equivalente BRL (aprox.) | Papel |
|-------|------------------|-----------------------------|-------|
| **USDt** | **$600** | ~R$ 3.150 | Capital de giro p/ dar clientes e MM L-BTC/USDt |
| **L-BTC** | **$400** equiv. | ~R$ 2.100 | Capital de giro p/ dar clientes e MM L-BTC/USDt |
| **DePix** | **R$ 2.000** | R$ 2.000 | Buffer para ordens de saída (Buy USDt + Buy L-BTC) |
| **Total** | — | **~R$ 7.250** | Capital mínimo para operar os 3 pares |

> Mínimo absoluto: **R$ 7.000**. Abaixo disso, as ordens ficam pequenas demais para aparecer de forma relevante no livro e o custo de tempo é desproporcional ao retorno.

**Capital recomendado para operar com conforto: R$ 15.000–20.000.**

---

### Configuração das ordens por par

#### Par 1 — L-BTC/USDt (prioritário)

Este é o par principal de market making. Liquidez bilateral, ciclo em horas, sem risco DePix.

```
PID: 1  (dedicado a L-BTC/USDt)

Ordem BUY  L-BTC/USDt:
  follow_target: true
  price_min: 0.40%
  capital: ~$200 em USDt por ordem

Ordem SELL L-BTC/USDt:
  follow_target: true
  price_min: 0.40%
  capital: ~$200 em L-BTC por ordem

Reserva: 20% de cada ativo fora de ordens (para reagir a below-market)
```

**Por que follow_target aqui:** L-BTC/USDt tem concorrência. Quem fica na posição 1 captura a maioria das execuções. Com `price_min = 0,40%`, o bot acompanha o melhor concorrente sem cair abaixo da margem mínima.

**Projeção conservadora (capital R$ 5.000 nesse par):**

```
Volume médio por ciclo (buy + sell): R$ 500
Spread capturado: 0,40%
Lucro por ciclo: R$ 2,00
Ciclos/semana estimados: 10–20
Lucro semana: R$ 20–40
Lucro mês: R$ 80–160 (1,6–3,2% sobre R$ 5.000)
```

---

#### Par 2 — USDt/DePix (saída de DePix acumulado)

Este par NÃO é para market making simétrico. É usado **apenas para gastar DePix** que o bot recebeu dos clientes.

```
PID: 2  (dedicado à saída de DePix)

Ordem BUY USDt/DePix  (gasta DePix, recebe USDt):
  follow_target: true
  price_min: 1.5%          ← piso do MM emissor + margem
  amount: ≤ 2.000 DePix por ordem
  timer: cancelar se não executar em 7 dias

Ordem SELL USDt/DePix: NÃO COLOCAR
  (recebia DePix → acúmulo → armadilha)
  Só colocar se DePix < 500 em carteira e você precisa repor para servir clientes.
```

**Lógica:** Você recebe DePix dos clientes (quando eles trocam DePix → USDt). Esse DePix precisa sair. A ordem Buy USDt/DePix faz exatamente isso: gasta os DePix acumulados e recompõe USDt para o próximo cliente.

---

#### Par 3 — L-BTC/DePix (rota alternativa de saída DePix)

Usado quando o livro USDt/DePix está lento ou você quer sair de DePix comprando BTC (modo acumulação de BTC).

```
PID: 2  (mesmo PID do par 2, ordens adicionais)

Ordem BUY L-BTC/DePix  (gasta DePix, recebe L-BTC):
  follow_target: true
  price_min: 1.5%
  amount: ≤ 2.000 DePix equivalente por ordem
  Ativar quando: preço BTC estável ou em alta, DePix > 3.000 em carteira

Ordem SELL L-BTC/DePix: NÃO COLOCAR
  (mesma razão: receber DePix é prejudicial)
```

---

### Spread cobrado dos clientes (lado de entrada)

Quando um **cliente** troca DePix com o bot (fora do livro SideSwap, via interface própria), o spread precisa compensar:
- O tempo de hold do DePix (~3–7 dias)
- O risco de câmbio USDBRL durante esse tempo
- O lucro mínimo do negócio

| Tempo esperado de saída do DePix | Spread mínimo a cobrar do cliente |
|----------------------------------|-----------------------------------|
| < 1 dia (via below-market ou livro rápido) | 0,8–1,0% |
| 1–3 dias | 1,2–1,5% |
| 3–7 dias (padrão DePix) | **1,8–2,2%** |
| Imprevisível (mercado fino) | **2,5%+** ou recusar |

> **Regra prática:** cobrar **1,8–2,0% de spread** como padrão de tela. Isso fica acima do MM emissor (~1,4–1,5%), compensando a espera e o risco FX.

---

### Fluxo operacional semanal

```
SEGUNDA-FEIRA
  1. Verificar saldo DePix em carteira
  2. Se DePix > 5.000: priorizar saída (Buy USDt e Buy L-BTC)
  3. Verificar ordens L-BTC/USDt: ambos os lados ativos com follow_target?
  4. Abrir Oportunidades → Abaixo do mercado: algum desconto ≥ 0,8%?
     → Sim: executar com reserva (capital livre), lucro garantido

DIARIAMENTE (manhã)
  5. Checar Telegram por alertas below_market notificados overnight
  6. Verificar saldo por carteira — DePix > 3.000? Reforçar ordens de saída
  7. L-BTC acima de 60% do capital? Rebalancear via Sell L-BTC/USDt

SEXTA-FEIRA
  8. Calcular lucro da semana via Histórico → dealer_trade
  9. Avaliar: round-trip DePix/USDt concluiu > 30% das ordens?
     → Não: aumentar price_min para se destacar do emissor
  10. Reservar 15% do capital livre para caça below-market da semana seguinte
```

---

### Checklist de saúde da carteira piloto

Execute isso toda semana. Se qualquer item falhar, parar e ajustar antes de continuar.

```
[ ] DePix em carteira ≤ 10.000?
[ ] price_min ≥ 1,5% em todos os pares DePix?
[ ] price_min L-BTC/USDt entre 0,35–0,50%?
[ ] Flash crash ativo e configurado?
[ ] Nenhuma ordem SELL em pares DePix (que receba mais DePix)?
[ ] Capital livre (fora de ordens) ≥ 15%?
[ ] L-BTC não representa > 60% do capital total?
[ ] Ordens com mais de 7 dias sem execução → cancelar e reavaliar?
[ ] Telegram notify_below_market ativo para os 3 pares?
```

---

### O que aumenta os assets ao longo do tempo

O crescimento de assets vem de **três fontes simultâneas**:

```
Fonte 1 — Spread do câmbio cliente (entrada)
  → Você cobra 1,8–2,0% em cada troca DePix → USDt/L-BTC
  → Receita direta proporcional ao volume de clientes

Fonte 2 — Spread de market making L-BTC/USDt (contínuo)
  → ~0,4% por ciclo, ciclos diários
  → Receita independente do volume de clientes

Fonte 3 — Below-market opportunistic (esporádico)
  → Compra com desconto garantido ≥ 0,5%
  → Não requer clientes; só vigiar o alerta Telegram
```

**Crescimento esperado (carteira R$ 15.000):**

| Fonte | Estimativa mensal | Premissa |
|-------|------------------|----------|
| Câmbio cliente (Fonte 1) | R$ 200–600 | 10–30 clientes/mês trocando R$ 1.000 cada |
| MM L-BTC/USDt (Fonte 2) | R$ 150–350 | 5–15 ciclos/semana, $500/ciclo |
| Below-market (Fonte 3) | R$ 50–200 | 2–5 oportunidades/mês com $200 cada |
| **Total estimado** | **R$ 400–1.150/mês** | **2,7–7,7% sobre R$ 15k** |

> Sem alavancagem, sem risco direcional de BTC, sem DePix acumulado. Crescimento lento mas seguro.

---

### Erro mais comum a evitar

```
❌ ERRADO — "Spread alto no card = entrar com Buy + Sell"
   Resultado: acumula DePix dos 11 buyers, fica preso por semanas

✅ CERTO  — "Spread alto no card = verificar assimetria"
   Se 11 buy · 3 sell → liquidez no sentido errado para nós
   → Só colocar SELL USDt se tiver plano para sair do DePix
   → Ou usar o spread para Buy USDt (gastar DePix acumulado)

❌ ERRADO — Cobrar 0,67% de spread dos clientes
   Resultado: abaixo do piso do emissor, perde dinheiro com risco FX

✅ CERTO  — Cobrar 1,8–2,0% dos clientes
   Compensa espera de ~7 dias + risco câmbio + margem operacional
```

---

## Referência no código

| Arquivo | Função |
|---------|--------|
| `useMarketScan.js` | WebSocket SideSwap, assinatura dos pares |
| `MarketOpportunities.js` | Spread, score, sugestão de entrada, `BelowMarketCard` |
| `utils/marketBargain.js` | `findBelowMarketSells`, `bestBelowMarketHit`, `BELOW_MARKET_PAIR_OPTIONS` |
| `utils/orderMargin.js` | Cálculo de margem lucro/perda nas ordens |
| `settings/TelegramSettings.js` | Configuração de `notify_below_market` com pares e threshold |
