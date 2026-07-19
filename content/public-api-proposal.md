---
title: "API pública — proposta técnica (NÃO implementada)"
slug: public-api-proposal
type: technical-proposal
author: Rodolfo Romão
date: 2026-07-19
status: "proposta — decisão explícita de infraestrutura/segurança necessária antes de qualquer implementação"
note_editorial: "Este é um documento de PROPOSTA. Nenhum endpoint, rota ou infraestrutura nova foi criado ou exposto. Expor uma API pública nova é uma decisão de infraestrutura e segurança que afeta sistemas compartilhados — não deve ser implementada sem revisão explícita, dado que este repositório também hospeda o vault_server.py e serviços do sistema Dealer/AMM."
---

# API pública — proposta técnica (não implementada)

## Por que isto é diferente de tudo que foi feito até aqui

Todo o resto deste roadmap (Fases 1–7) é conteúdo estático ou componentes de leitura. Uma API pública é infraestrutura nova, com superfície de ataque nova, hospedada no mesmo domínio que já serve `vault_server.py` (custódia de chaves) e os serviços do sistema Dealer/AMM. Por isso este documento é uma proposta para avaliação, não uma especificação para implementar diretamente.

## O que já existe (e não é isto)

O site já expõe `POST /api/portfolio/ai-chat` via `portfolio_api_server.py` — um processo isolado, sem acesso a `vault_data.db` nem a qualquer credencial do sistema Dealer, com rate limit por IP e sem tool-calling. Esse endpoint já é, na prática, uma forma limitada de API pública. A proposta abaixo é sobre formalizar e expandir isso deliberadamente — não sobre criar algo do zero desconectado do que já existe.

## O que uma "API pública" formal ofereceria

Dados públicos, somente leitura, já presentes no site em outro formato:

- `GET /api/v1/profile` — dados equivalentes ao que já está em `portfolio_context.json` (nome, roles, skills, experiência) — versão pública, versionada e documentada do que já existe.
- `GET /api/v1/projects` — lista de projetos equivalente à página `/project`, em JSON.
- `GET /api/v1/glossary` — os termos deste [glossário](/content/glossary), estruturados.
- `POST /api/v1/ai-chat` — versão pública/documentada do endpoint que já existe, possivelmente com autenticação por API key para uso além do rate limit atual por IP.

Nenhum endpoint de escrita. Nenhum dado que não esteja já público no site em formato HTML/JSON hoje.

## Por que isto exige decisão explícita, não é "só mais conteúdo"

1. **Superfície de ataque nova.** Qualquer endpoint novo, mesmo somente leitura, é algo a mais para monitorar, atualizar e proteger contra abuso (scraping em massa, DoS por volume de requisições).
2. **Convivência com sistemas sensíveis no mesmo domínio/infraestrutura.** `rodolforomao.com.br` também serve o `vault_server.py` e o relay do Dealer/AMM. Qualquer nova superfície pública precisa de isolamento de processo e rede claro em relação a esses serviços — o padrão já usado pelo `portfolio_api_server.py` (processo separado, sem import de código do vault/dealer) deveria se manter, mas isso precisa ser verificado explicitamente antes de qualquer expansão, não assumido.
3. **Autenticação e limites de uso.** Uma API "pública de verdade" (não só um endpoint isolado de chat) provavelmente precisa de API keys, quotas por chave, e possivelmente termos de uso — decisões de produto, não só técnicas.
4. **Precedente de compromisso de longo prazo.** Uma vez publicada e documentada, uma API pública cria expectativa de estabilidade (breaking changes afetam quem a consome). Isso muda o cálculo de quanto esforço de manutenção este projeto está assumindo.

## Recomendação

Não implementar agora. Se a decisão for seguir em frente:
- Confirmar isolamento de processo/rede em relação ao vault e ao Dealer/AMM antes de qualquer coisa.
- Começar só com os endpoints de leitura listados acima, versionados desde o primeiro dia (`/api/v1/...`).
- Definir rate limiting e, se necessário, autenticação por API key antes de anunciar publicamente — não depois.
- Tratar como mudança de infraestrutura formal (revisão de segurança, não só revisão de código), dado o contexto dos outros serviços hospedados no mesmo ambiente.
