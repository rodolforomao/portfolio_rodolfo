---
title: "Snippets"
slug: snippets
type: snippets
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Padrões genéricos/pedagógicos extraídos conceitualmente do trabalho real descrito nos Experience Articles — reescritos de forma independente, sem nenhum trecho de código proprietário, credencial, host ou caminho de arquivo real. Revisar antes de publicar."
---

# Snippets

Pequenos padrões de código reutilizáveis, extraídos conceitualmente de problemas reais que resolvi. Não são cópias de código de produção — são reescritas genéricas, sem nenhum dado proprietário, pensadas para serem lidas e adaptadas.

## Validação de preço contra múltiplas fontes (Python)

Contexto: um sistema de market making não deve confiar em uma única fonte de preço para decidir automaticamente pausar ou cancelar ordens. Este padrão só considera um movimento de preço "confirmado" se a maioria das fontes concordar dentro de uma tolerância.

```python
from dataclasses import dataclass
from statistics import median

@dataclass
class PriceQuote:
    source: str
    price: float

def validate_price(quotes: list[PriceQuote], tolerance_pct: float = 1.5) -> float | None:
    """Retorna a mediana dos preços se houver consenso suficiente, senão None (anomalia)."""
    if len(quotes) < 3:
        return None  # fontes insuficientes para validar com confiança

    prices = [q.price for q in quotes]
    reference = median(prices)

    agreeing = [p for p in prices if abs(p - reference) / reference * 100 <= tolerance_pct]

    # exige que a maioria das fontes concorde com a mediana
    if len(agreeing) < (len(prices) // 2 + 1):
        return None  # divergência anômala entre fontes — não confiar neste preço

    return reference
```

O ponto central: o sistema prefere retornar "não confio neste preço" a agir sobre um dado potencialmente ruim. Uma única fonte fora do ar ou divergente não derruba o sistema — várias divergindo ao mesmo tempo, sim, e isso é o comportamento correto.

## Detecção escalonada de queda brusca de preço (Python)

Contexto: reagir de forma proporcional a quedas de preço, em vez de uma resposta binária "está tudo bem" / "para tudo".

```python
from enum import Enum
from dataclasses import dataclass
from time import time

class RiskLevel(Enum):
    NORMAL = "normal"
    WARNING = "warning"
    PAUSE = "pause"
    CANCEL = "cancel"
    LOCKDOWN = "lockdown"

@dataclass
class PriceDrop:
    percent: float
    window_seconds: float

def classify_risk(drop: PriceDrop) -> RiskLevel:
    # janelas curtas pesam mais que a mesma queda em janelas longas
    fast = drop.window_seconds <= 15
    moderate_window = drop.window_seconds <= 30

    if drop.percent >= 15:
        return RiskLevel.LOCKDOWN
    if drop.percent >= 10 and moderate_window:
        return RiskLevel.CANCEL
    if drop.percent >= 5 and moderate_window:
        return RiskLevel.PAUSE
    if drop.percent >= 3 and fast:
        return RiskLevel.WARNING
    return RiskLevel.NORMAL
```

A lição por trás disso (detalhada em [O que aprendi construindo um Market Maker](/content/experience-articles/market-maker-liquid-network)): a janela de tempo importa tanto quanto o percentual — a mesma queda distribuída ao longo de uma hora é normal; concentrada em segundos, é outra categoria de risco.

## Processamento idempotente de webhook de pagamento (PHP/Laravel)

Contexto: um webhook de confirmação de pagamento (PIX, por exemplo) pode ser reenviado mais de uma vez pelo provedor — reprocessar a mesma notificação não pode duplicar o efeito (creditar saldo duas vezes, por exemplo).

```php
public function handlePaymentWebhook(Request $request)
{
    $payload = $request->validate([
        'transaction_id' => 'required|string',
        'amount' => 'required|numeric',
        'status' => 'required|string',
    ]);

    // idempotência: se já processamos este transaction_id, não repetir o efeito
    $alreadyProcessed = PaymentEvent::where('transaction_id', $payload['transaction_id'])
        ->where('status', $payload['status'])
        ->exists();

    if ($alreadyProcessed) {
        return response()->json(['status' => 'already_processed'], 200);
    }

    DB::transaction(function () use ($payload) {
        PaymentEvent::create($payload);

        if ($payload['status'] === 'confirmed') {
            $this->creditBalance($payload['transaction_id'], $payload['amount']);
        }
    });

    return response()->json(['status' => 'processed'], 200);
}
```

O detalhe que mais importa aqui não é o código em si — é reconhecer que "recebi um webhook" e "devo aplicar o efeito dele" são duas coisas diferentes, e a segunda só deve acontecer uma vez por evento único, não uma vez por requisição HTTP recebida.

## Checagem de consistência de entidades em conteúdo (Node.js)

Contexto: nasceu diretamente da auditoria de LLM SEO deste site — um script simples que varre arquivos de conteúdo procurando grafias inconsistentes do mesmo termo (por exemplo, "Liquid Network" vs. "Liquid", "DePix" vs. "Depix"), para pegar esse tipo de problema antes de publicar, em vez de depender de revisão manual.

```javascript
const fs = require("fs");
const path = require("path");

// cada grupo = grafias diferentes que devem convergir para a primeira (canônica)
const CANONICAL_GROUPS = [
  ["Liquid Network", "Liquid"],
  ["DePix", "Depix"],
];

function scanFile(filePath, content) {
  const issues = [];
  for (const [canonical, ...variants] of CANONICAL_GROUPS) {
    for (const variant of variants) {
      const regex = new RegExp(`\\b${variant}\\b`, "g");
      const matches = content.match(regex);
      if (matches) {
        issues.push({
          file: filePath,
          variant,
          canonical,
          occurrences: matches.length,
        });
      }
    }
  }
  return issues;
}

function scanDir(dir) {
  const allIssues = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      allIssues.push(...scanDir(fullPath));
    } else if (/\.(js|md|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      allIssues.push(...scanFile(fullPath, content));
    }
  }
  return allIssues;
}

const issues = scanDir("./src");
issues.forEach((i) =>
  console.log(`${i.file}: "${i.variant}" deveria ser "${i.canonical}" (${i.occurrences}x)`)
);
```

Este é literalmente o tipo de checagem que, se tivesse existido antes, teria pego a divergência "Liquid/Depix" no card do BitBooking antes de qualquer auditoria manual encontrá-la.
