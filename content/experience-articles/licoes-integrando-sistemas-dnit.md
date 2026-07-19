---
title: "Lições aprendidas liderando desenvolvimento de sistemas no DNIT"
slug: licoes-integrando-sistemas-dnit
pillar: Government Systems / GovTech
type: experience-article
sourceProject: "DNIT — Departamento Nacional de Infraestrutura de Transportes"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA a partir de fatos verificados no currículo real do autor. Revisar antes de publicar."
---

# Lições aprendidas liderando desenvolvimento de sistemas no DNIT

Desde julho de 2018 lidero uma equipe de desenvolvimento no DNIT — o Departamento Nacional de Infraestrutura de Transportes, autarquia federal brasileira. Construímos e mantivemos o SUPRA (Sistema de Supervisão Avançada, para monitoramento de obras em tempo real), o SIMA, e o Portal Cidadão DNIT, entre outros sistemas. O SUPRA e o Portal Cidadão foram reconhecidos por órgãos de controle federal (CGU e TCU) pela transparência que trouxeram ao acompanhamento de obras públicas.

Este artigo é sobre o que muda, na prática de engenharia, quando o cliente é o governo — não sobre os sistemas em si.

## Transparência não é um requisito de produto, é um requisito de arquitetura

Quando um sistema como o SUPRA existe justamente para dar visibilidade real de obras públicas para órgãos de controle e para o cidadão, "transparência" deixa de ser um valor abstrato e vira uma restrição técnica concreta: os dados precisam ser auditáveis, o histórico não pode ser silenciosamente alterável, e a informação que chega ao público precisa ser rastreável até a fonte. Isso influencia decisões que, em outro contexto, seriam só detalhe de implementação — por exemplo, como versionar mudanças de status de uma obra, não apenas mostrar o status atual.

## Por que sistemas legados de governo demoram tanto para migrar

O SUPRA e o Portal Cidadão nasceram em CodeIgniter, um framework PHP mais antigo, mesmo com Laravel disponível e mais moderno. A pergunta natural é "por que não migrar". A resposta, depois de anos vendo isso de dentro, é que sistemas públicos carregam uma obrigação de continuidade que sistemas privados não têm da mesma forma: uma indisponibilidade prolongada durante uma migração não é só "um cliente insatisfeito" — pode significar cidadãos sem acesso a um serviço público, ou um órgão de controle sem os dados que precisa numa auditoria em andamento. Isso não significa que sistemas legados devem ficar parados para sempre; significa que a migração precisa ser incremental e reversível a cada passo, o que é mais lento — e mais caro em esforço de engenharia — do que uma reescrita de uma vez só.

## APIs REST e SOAP convivendo no mesmo backend

Parte da integração do DNIT envolve tanto APIs REST modernas quanto SOAP — um protocolo mais antigo, baseado em XML, que ainda é exigido por sistemas terceiros com os quais precisamos nos integrar. A lição prática aqui foi resistir à tentação de "modernizar" a interface externa: o contrato SOAP existe porque outro sistema, que não está sob meu controle, depende dele. A modernização acontece por trás da interface, não substituindo o contrato que terceiros já consomem.

## Stack e por que ela é heterogênea

A stack de desenvolvimento no DNIT inclui PHP/CodeIgniter, Java, Python, React, Node.js, Flutter (para o app móvel Atlas, que permite baixar dados de obras rodoviárias por estado em PDF), Docker e SQL Server rodando sobre Linux. Essa heterogeneidade não é acidental — cada sistema herdou a tecnologia mais adequada ao momento em que foi criado, e parte do trabalho de liderança técnica é decidir quando vale a pena unificar e quando é mais responsável deixar como está e investir esforço em outro lugar.

## Liderar equipe dentro de uma autarquia federal

Um ponto que poucos artigos técnicos cobrem: liderar desenvolvimento dentro de uma estrutura pública tem um componente de gestão de expectativas que não existe da mesma forma numa empresa privada. Prioridades podem mudar por motivos alheios à engenharia (uma demanda de fiscalização, uma solicitação de órgão de controle), e parte do meu papel é traduzir isso em trabalho técnico executável sem que a equipe perca previsibilidade sobre o que está fazendo e por quê.

## O que eu diria para quem está começando a trabalhar com o setor público

Se você é desenvolvedor e está prestes a trabalhar com um órgão público pela primeira vez: espere que "correto" e "disponível" pesem mais do que "rápido de entregar". Espere integrações com sistemas que você não controla e não pode simplesmente substituir. E entenda que "transparência", quando é requisito real e não discurso, muda decisões de arquitetura antes mesmo de você escrever a primeira linha de código — não é uma feature que se adiciona depois.

## Limitações

Não vou fingir que este modelo é ideal em todos os aspectos: a velocidade de entrega é, de fato, mais lenta do que em produtos privados equivalentes, e parte da stack legada ainda espera uma modernização mais profunda do que o ritmo atual permite. O que descrevo acima não é a ausência desses problemas — é como eu aprendi a trabalhar dentro deles sem comprometer a confiabilidade que o sistema precisa ter.
