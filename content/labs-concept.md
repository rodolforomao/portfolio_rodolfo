---
title: "Labs — conceito e plano (não implementado)"
slug: labs-concept
type: concept-plan
author: Rodolfo Romão
date: 2026-07-19
status: "plano — requer decisão de arquitetura antes de qualquer implementação"
note_editorial: "Documento de planejamento apenas. Nenhum componente novo, rota ou dependência foi criado. Requer decisão explícita antes de qualquer implementação, pois envolve componentes interativos novos (mudança de arquitetura)."
---

# Labs — conceito e plano

"Labs" é a seção proposta para demonstrações interativas e pequenos experimentos técnicos ligados aos pilares reais de experiência (Blockchain, IA, DevOps) — não é uma seção de código-fonte, é uma seção de **coisas que o visitante pode ver funcionando**, não só ler.

## Já existe um precedente real no site

A rota `/` (SystemOS) já tem um card "Challenge Arena" que compara a dificuldade real de mineração da mainnet do Bitcoin (via proxy read-only para a API pública do mempool.space) com o que o navegador do visitante consegue calcular localmente em alguns segundos. Isso já é, na prática, um "Lab" — só não está nomeado ou organizado como seção própria. Qualquer implementação futura de Labs deveria começar reconhecendo e potencialmente reorganizando esse card existente, em vez de tratá-lo como algo separado.

## Candidatos a novos experimentos (pilar → ideia)

**Blockchain, Liquid Network & DeFi**
- Visualizador de uma transação confidencial na Liquid Network — mostrar, de forma didática, o que fica público e o que fica oculto, comparado a uma transação Bitcoin normal.
- Simulador simplificado de slippage em AMM — visitante ajusta tamanho de ordem e tamanho de pool, vê o preço de execução mudar.
- Demonstração dos 4 níveis de proteção contra flash crash (ver [artigo do Market Maker](/content/experience-articles/market-maker-liquid-network)) com dados de mercado históricos reais, em modo replay — nunca em modo "ao vivo" contra o sistema real.

**Artificial Intelligence & LLMs**
- Demonstração do RAG usado no chat de IA embutido — mostrar lado a lado a pergunta, o trecho do JSON de contexto recuperado, e a resposta gerada, para tornar visível como o grounding funciona.
- Comparador OpenAI API vs. modelo open-source (Llama 2) em uma tarefa simples e pública, com custo e latência exibidos.

**DevOps & Infraestrutura**
- Visualização em tempo real (dados sintéticos, não de produção) dos 4 níveis de resposta a incidentes descritos no artigo de DevOps.

## Restrições que qualquer implementação futura precisa respeitar

- Nenhum experimento pode expor dados reais de produção (saldos, ordens, chaves) — tudo roda sobre dados sintéticos, históricos anonimizados, ou fontes públicas read-only (como já é o caso do Challenge Arena existente).
- Nenhum experimento pode escrever/mutar estado de sistemas reais (o Market Maker, o vault, etc.) — só leitura ou simulação local no navegador.
- Implementação real depende de novos componentes React — está fora do escopo desta fase de conteúdo até decisão explícita de arquitetura.

## Próximo passo

Nada a implementar agora. Este documento existe para que, quando a decisão de arquitetura for tomada, já exista um ponto de partida com ideias avaliadas quanto a risco (o que pode/não pode expor), em vez de começar do zero.
