---
title: "Como construí um gateway de pagamentos entre PIX e Liquid Network"
slug: liquid-network-depix-payment-gateway
pillar: Blockchain, Liquid Network & DeFi
type: experience-article
sourceProject: "LiquidX.pro / ispflash.space"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA a partir de fatos verificados no currículo real do autor. Revisar antes de publicar."
---

# Como construí um gateway de pagamentos entre PIX e Liquid Network

Desde novembro de 2023 eu desenvolvo, como desenvolvedor fullstack sênior na LiquidX.pro/ispflash.space, um gateway que recebe pagamentos via PIX (o sistema de pagamento instantâneo do Banco Central do Brasil) e os converte em DePix — uma stablecoin brasileira que roda sobre a Liquid Network, a sidechain confidencial do Bitcoin. Este artigo é sobre as decisões técnicas por trás disso, não sobre o produto em si.

## O problema que o gateway resolve

PIX é rápido, mas é um trilho fechado: só circula dentro do sistema bancário brasileiro. DePix é um token que representa reais na Liquid Network, e pode circular como qualquer outro ativo da rede — inclusive ser trocado, via DEX, por L-BTC ou outros ativos. O gateway é a ponte entre esses dois mundos: uma empresa recebe um PIX de um cliente e, do outro lado, tem saldo em DePix disponível para movimentar on-chain.

Isso parece simples até você considerar que os dois lados têm modelos de confirmação completamente diferentes — PIX confirma quase instantaneamente dentro do sistema bancário, enquanto uma transação on-chain tem seu próprio tempo de confirmação e sua própria noção de "final". Sincronizar esses dois relógios sem criar uma janela onde o sistema acha que já recebeu algo que ainda pode reverter (ou vice-versa) foi o maior desafio de engenharia do projeto.

## Arquitetura: gateway, agregador e bridge

Além do gateway PIX↔DePix, o mesmo time constrói o **ispbanking**, um agregador de DEX com bridge entre Liquid Network, Polygon e Solana — ou seja, liquidez e rotas de troca que atravessam mais de uma blockchain. A stack por trás disso é heterogênea por necessidade: PHP e Python para a maior parte da lógica de negócio e integração, Rust nos pontos onde desempenho e segurança de memória importavam mais (processamento próximo da camada de carteira), Laravel e Flask como frameworks web, WebSocket para eventos em tempo real, rodando em Debian com Apache2.

A gestão de carteiras é automatizada usando Elements (o software por trás da Liquid Network) e integração direta com o SideSwap para operações de troca. Uma sincronização com ERP corporativo garante que pagamentos em token cheguem refletidos no sistema financeiro da empresa que usa o gateway — sem isso, o produto seria só "mais uma carteira", não uma peça de infraestrutura financeira que uma empresa consegue conciliar.

## O que aprendi sobre WebSocket em sistemas financeiros

Boa parte da comunicação em tempo real do gateway (confirmações de pagamento, atualização de saldo, eventos de troca) acontece por WebSocket. A lição mais cara que aprendi aqui foi que WebSocket "funciona" em desenvolvimento e falha de formas sutis em produção: conexões que caem sem que nenhum dos dois lados perceba imediatamente, mensagens que chegam fora de ordem depois de uma reconexão, e — o pior caso — um evento importante (como confirmação de recebimento) que é emitido enquanto o cliente está momentaneamente desconectado e nunca é reprocessado.

Isso me levou a tratar WebSocket como um canal de *notificação*, não como fonte de verdade. A fonte de verdade fica sempre em um estado consultável (é possível perguntar "qual é o status desta operação agora?" a qualquer momento, independente de ter recebido o evento ou não). O WebSocket só existe para reduzir a latência de descobrir que algo mudou — nunca é a única forma de descobrir.

## Bridge entre blockchains: onde a complexidade realmente mora

Conectar Liquid Network, Polygon e Solana num único agregador de liquidez soa, de longe, como "só mais uma integração de API" por rede. Na prática, cada rede tem seu próprio modelo de finalidade de transação, sua própria forma de representar ativos, e seus próprios modos de falha. O trabalho real não foi escrever três integrações — foi desenhar uma camada comum que trata "essa transação está confirmada o suficiente para eu agir sobre ela" de forma consistente, mesmo quando as três redes discordam sobre o que isso significa.

## Limitações e o que ainda não resolvi bem

Sendo honesto sobre o estado atual: a maior fragilidade do sistema ainda é a dependência de disponibilidade de terceiros — o PIX depende do sistema bancário, o DEX depende da liquidez disponível no momento da troca, e a bridge entre redes depende de todas elas estarem operacionais simultaneamente. Não existe (ainda) uma estratégia de fallback elegante para "uma das três redes está degradada mas as outras duas não" — hoje, na prática, o sistema fica mais conservador globalmente quando qualquer parte está instável, o que é seguro mas não é eficiente.

Se eu fosse recomeçar hoje, teria desenhado o modelo de estado consultável (mencionado acima) antes de escrever qualquer integração, em vez de adicioná-lo depois que os problemas de WebSocket apareceram. Teria economizado pelo menos um ciclo de retrabalho.
