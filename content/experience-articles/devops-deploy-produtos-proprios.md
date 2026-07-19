---
title: "DevOps na prática: como mantenho infraestrutura para sistemas federais e produtos próprios"
slug: devops-deploy-produtos-proprios
pillar: DevOps & Infraestrutura
type: experience-article
sourceProject: "DNIT, LiquidX.pro, Residencial Oliveiras"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA a partir de fatos verificados no currículo real do autor. Revisar antes de publicar."
---

# DevOps na prática: como mantenho infraestrutura para sistemas federais e produtos próprios

Não sou um DevOps engineer dedicado — sou um desenvolvedor fullstack que também opera a infraestrutura do que constrói, em contextos bem diferentes entre si: sistemas federais no DNIT (onde Docker e Linux são padrão corporativo), um gateway financeiro na LiquidX (Debian + Apache2, onde disponibilidade é crítica), e sites institucionais menores como o da Residencial Oliveiras (VPS simples com Cloudflare e HestiaCP). Esse contraste ensina mais sobre DevOps do que operar um único tipo de infraestrutura repetidamente.

## Três contextos, três níveis de rigor exigido

No DNIT, containerização com Docker existe principalmente para consistência entre ambientes de desenvolvimento e produção, dentro de uma infraestrutura corporativa já estabelecida — o rigor vem de fora, imposto pelo ambiente institucional.

Na LiquidX, a infraestrutura (Debian, Apache2) sustenta um gateway que movimenta pagamentos reais — ali, a disponibilidade não é uma métrica de qualidade, é uma condição para o produto existir. Uma indisponibilidade não é só "downtime", é dinheiro que não chega a quem deveria.

Já a Residencial Oliveiras é um site institucional de hospedagem — VPS com Cloudflare na frente (cache, proteção básica contra picos de tráfego) e HestiaCP como painel de controle. O rigor aqui é proporcional ao risco real: um site institucional fora do ar por alguns minutos não tem o mesmo custo que um gateway de pagamento fora do ar.

A lição prática de operar os três em paralelo: calibrar o nível de rigor operacional ao risco real do sistema, não aplicar o mesmo padrão em tudo. Superdimensionar a robustez de um site institucional desperdiça esforço que poderia ir para o sistema que realmente precisa dele.

## Por que ainda uso VPS simples em vez de orquestração mais sofisticada em alguns casos

Existe uma tentação constante de "modernizar" toda infraestrutura para o padrão mais atual disponível — Kubernetes, infraestrutura como código completa, etc. Na prática, para produtos com uma carga de tráfego previsível e uma equipe pequena (no limite, uma pessoa), a complexidade operacional adicional de orquestração sofisticada frequentemente custa mais em tempo de manutenção do que economiza em eficiência de recursos. Um VPS bem configurado, com HestiaCP cuidando de renovação de certificado e configuração de proxy reverso, resolve o problema real sem exigir que eu vire um especialista em uma ferramenta de orquestração para manter um site institucional no ar.

Isso não é um argumento contra ferramentas modernas — é um argumento por calibrar a complexidade da infraestrutura ao tamanho real do problema.

## O que aprendi sobre Cloudflare como camada de proteção

Colocar Cloudflare na frente de um site institucional resolve dois problemas de uma vez: cache de conteúdo estático (menos carga no servidor de origem) e uma primeira camada de proteção contra tráfego malicioso, sem precisar configurar isso manualmente no servidor. O ponto de atenção real é garantir que o servidor de origem não fique diretamente exposto/acessível fora da Cloudflare — se alguém descobre o IP real do servidor, a proteção da CDN deixa de valer para esse vetor.

## Limitações

Não sou especialista em observabilidade de infraestrutura em escala — os ambientes que opero são pequenos o suficiente para que monitoramento relativamente simples (alertas diretos, sem uma stack completa de métricas/tracing) seja proporcional ao risco. Se algum desses sistemas crescer significativamente em tráfego ou criticidade, essa proporcionalidade deixa de valer, e eu esperaria precisar investir em observabilidade mais robusta do que uso hoje.
