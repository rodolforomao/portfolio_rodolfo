---
title: "Como estruturar um projeto React pensando em LLM SEO"
slug: estruturar-projeto-react-llm-seo
pillar: Software Engineering & Full Stack Development
type: experience-article
sourceProject: "rodolforomao.com.br (este portfólio)"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA, narrando o processo real de auditoria e implementação executado neste mesmo projeto em 2026-07-18/19. Revisar antes de publicar."
---

# Como estruturar um projeto React pensando em LLM SEO

Este próprio site — um Create React App client-side rendered, sem SSR, com rotas via `react-router-dom` — foi o objeto de uma auditoria de LLM SEO que fiz recentemente. O que segue é o relato de como esse trabalho aconteceu e o que aprendi sobre os limites reais de otimizar um SPA para ser lido por modelos de linguagem, sem reescrever a arquitetura.

## O diagnóstico que muda tudo: HTML vazio é HTML vazio, não importa o quanto o resto esteja bom

A primeira coisa que a auditoria revelou — e que eu já suspeitava, mas nunca tinha confirmado de forma sistemática — é que, como o site não tem server-side rendering, o HTML bruto servido para qualquer uma das rotas públicas é idêntico e vazio: um `<div id="root"></div>` sem nenhum texto. Todo o conteúdo real (bio, projetos, currículo) só existe depois que o JavaScript executa completamente. A maioria dos crawlers de LLM — GPTBot, ClaudeBot, PerplexityBot, entre outros — não espera essa execução, ou espera com orçamento limitado.

Isso significa que qualquer melhoria de conteúdo, por melhor que seja, tem um teto: sem pré-renderização, uma parcela relevante dos consumidores de conteúdo simplesmente nunca vê o texto que eu escrevi. Reconhecer esse teto — em vez de ignorá-lo — foi o que definiu o escopo do trabalho: fazer tudo que é possível fazer *sem* mudar a arquitetura agora, documentar claramente o que só se resolve mudando a arquitetura, e deixar essa decisão para depois.

## O que dá para fazer sem tocar em React

Separar rigorosamente "o que é conteúdo/metadata estático" de "o que é arquitetura" foi a decisão mais importante do processo. Na prática, isso significou:

- **JSON-LD `Person` e `WebSite`** direto no `index.html` — estático, então funciona independente de JavaScript ter rodado ou não.
- **Sitemap e `robots.txt`** com diretivas explícitas para os principais bots de IA — trabalho de arquivo estático, zero risco.
- **Meta description e Open Graph corrigidos** — a versão anterior tinha uma tag duplicada e apontava para um domínio diferente do de produção real. Corrigir isso não muda nenhum componente.
- **Texto/label em ícones que antes eram só SVG mudo** — tecnicamente uma mudança de componente React, mas de conteúdo (um `<p>` com o nome da tecnologia), não de estrutura ou lógica.
- **Consistência de entidades** — unificar grafias diferentes do mesmo conceito (por exemplo, "Liquid Network" vs. "Liquid", "DePix" vs. "Depix") espalhadas pelo código. Isso não muda nada visualmente, mas muda como um sistema de extração de entidades interpreta o texto: duas grafias diferentes parecem duas entidades diferentes.

## O que fica de fora, deliberadamente

Pré-renderização (SSG, ou um passo de build com um navegador headless gerando HTML estático por rota), `react-helmet` para meta tags por rota, e JSON-LD específico por página — todos esses itens dependem de mudar a arquitetura de build/renderização, e ficaram documentados como próxima fase, não implementados agora. A tentação de "já que estou mexendo, resolve tudo de uma vez" é real, mas misturar uma mudança de conteúdo reversível com uma mudança de arquitetura de maior risco é exatamente o tipo de decisão que complica revisão e rollback depois.

## Entidades consistentes importam mais do que eu esperava

Uma das descobertas mais úteis da auditoria foi olhar o site inteiro como um grafo de entidades em vez de como um conjunto de páginas. Isso expôs coisas que uma revisão página-por-página não pega: um projeto (Smart Condo) aparecia duas vezes com descrições e enquadramentos diferentes, sem deixar claro que eram o mesmo produto em duas formas (SaaS hospedado vs. código aberto); um link de projeto apontava para um repositório de outra pessoa sem contexto, criando ambiguidade sobre autoria; e a fonte de dados que alimenta o chat de IA embutido no site (um JSON separado, consumido por um backend) tinha uma lista de projetos diferente da lista mostrada na página pública de projetos — ou seja, alguém perguntando à IA embutida "o que Rodolfo construiu" recebia uma resposta incompleta em relação ao que o site realmente mostra.

Nenhum desses problemas é visível olhando uma página de cada vez. Só aparecem quando você trata o conteúdo do site como dados estruturados que precisam ser consistentes entre si.

## O ativo que eu não sabia que já tinha

O site já tinha, antes desta auditoria, um endpoint de backend que responde perguntas em linguagem natural sobre meu currículo, usando um LLM (Claude ou GPT, dependendo da configuração) com grounding no mesmo JSON de contexto mencionado acima. Isso é, na prática, uma pequena "answer engine" pessoal — a maioria dos portfólios não tem nada parecido. O problema é que ela só existia escondida dentro de um comando de terminal estilizado em uma das páginas, sem nenhum link ou menção apontando para ela em nenhum outro lugar do site. Descobrir esse tipo de ativo subutilizado — algo que já resolve um problema real, mas que ninguém sabe que existe — acabou sendo tão valioso quanto qualquer correção nova.

## O que eu faria diferente da próxima vez

Eu teria começado pela auditoria de entidades (o grafo: o que é forte, o que é fraco, o que está ausente, o que está duplicado) antes de qualquer correção pontual, em vez de fazer as duas coisas em paralelo. A visão de grafo é o que revela os problemas de maior alavancagem — e fazer isso primeiro evitaria retrabalho em correções que a visão de grafo teria priorizado de forma diferente.

## Limitações do que foi feito

Nada disso resolve o problema estrutural (SPA sem SSR) descrito no início. É uma otimização real, mas parcial — o próximo ganho de verdade depende de uma decisão de arquitetura que ainda não foi tomada.
