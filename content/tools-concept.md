---
title: "Ferramentas — conceito e plano (não implementado)"
slug: tools-concept
type: concept-plan
author: Rodolfo Romão
date: 2026-07-19
status: "plano — requer decisão de arquitetura antes de qualquer implementação"
note_editorial: "Documento de planejamento apenas. Nenhum componente novo, rota ou dependência foi criado. Requer decisão explícita antes de qualquer implementação."
---

# Ferramentas — conceito e plano

Diferença em relação a "Labs": Labs demonstra conceitos (é para entender como algo funciona); Ferramentas resolve um problema prático pontual do visitante (é para usar). Ambos são interativos, mas com propósitos diferentes.

## Candidatos (pilar → ferramenta → utilidade real)

**Blockchain, Liquid Network & DeFi**
- **Conversor PIX ↔ DePix com taxa ilustrativa** — útil para quem está avaliando integrar um gateway parecido com o descrito em [Como construí um gateway de pagamentos entre PIX e Liquid Network](/content/experience-articles/liquid-network-depix-payment-gateway); deixa explícito que é ilustrativo, não uma cotação real de produção.
- **Validador de formato de endereço da Liquid Network** — ferramenta simples client-side (sem enviar o endereço a nenhum servidor) que confirma se uma string tem o formato esperado de um endereço confidencial da Liquid Network.

**Software Engineering**
- **Gerador de checklist de segurança para wallets automatizadas** — a partir dos princípios descritos no artigo do Market Maker, uma ferramenta que gera uma checklist customizável (o que verificar antes de colocar um sistema de custódia em produção).
- **Analisador de consistência de entidades** — versão web do [snippet de checagem de consistência](/content/snippets#checagem-de-consistência-de-entidades-em-conteúdo-nodejs): visitante cola um texto, a ferramenta aponta grafias inconsistentes de termos técnicos conhecidos.

**Government Systems / GovTech**
- **Glossário de siglas de sistemas públicos brasileiros** — versão pesquisável do [glossário](/content/glossary), filtrando só os termos do Pilar 3 (DNIT, CGU, TCU, SEI, etc.) — útil para quem está entrando no setor público pela primeira vez.

## Restrições que qualquer implementação futura precisa respeitar

- Ferramentas que processam dados do visitante (o validador de endereço, o analisador de consistência) devem rodar inteiramente no navegador (client-side), sem enviar o input a nenhum servidor — evita criar uma nova superfície de coleta de dados sem necessidade.
- Nenhuma ferramenta pode se conectar a sistemas reais de produção (o Market Maker, o vault, o gateway da LiquidX) — tudo roda com dados ilustrativos ou lógica local.
- Implementação real depende de novos componentes React — está fora do escopo desta fase de conteúdo até decisão explícita de arquitetura.

## Próximo passo

Nada a implementar agora. Assim como em Labs, este documento serve para que a decisão de arquitetura, quando tomada, já parta de ideias avaliadas — não de uma lista em branco.
