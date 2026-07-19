---
title: "Problemas reais que encontrei usando Claude Code em um projeto grande"
slug: problemas-claude-code-projetos-grandes
pillar: Artificial Intelligence & LLMs
type: experience-article
sourceProject: "rodolforomao.com.br — auditoria e implementação de LLM SEO"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA, narrando o processo real ocorrido nesta sessão de trabalho (2026-07-18/19) neste mesmo repositório. Revisar antes de publicar."
---

# Problemas reais que encontrei usando Claude Code em um projeto grande

Usei o Claude Code para auditar e começar a corrigir o LLM SEO deste portfólio — um repositório que, além do site React, tem um backend Python de market making, um serviço de custódia de chaves, e uma API isolada para IA. Não é um projeto pequeno, e não foi um uso trivial da ferramenta: envolveu orquestrar múltiplos agentes em paralelo, editar código de produção real, e verificar que nada quebrou antes de considerar o trabalho concluído. Isto é o relato dos atritos reais, não um review genérico da ferramenta.

## Orquestrar agentes em paralelo economiza tempo, mas exige partição cuidadosa

Pedi para a auditoria inicial ser feita por múltiplos agentes rodando em paralelo — um por página, um para extração de entidades, um para a parte técnica de crawlability, um para o plano de conteúdo. Funcionou bem *porque* cada agente tinha um conjunto de arquivos e uma pergunta claramente delimitados, sem sobreposição. Na fase seguinte, de implementação, esse mesmo padrão quase gerou um bug: dois blocos de edição planejados para arquivos diferentes na verdade tocavam o mesmo arquivo (`portfolio_context.json`, editado tanto pela correção de entidades quanto pela divulgação do endpoint de IA). A lição prática: antes de paralelizar edições, particione por *arquivo*, não por *tarefa* — duas tarefas diferentes que tocam o mesmo arquivo em paralelo são uma race condition esperando para acontecer, mesmo com um assistente de IA no controle.

## Um erro silencioso que só o diff pegou

Durante uma edição em lote no JSON de contexto (havia quatro blocos de idioma quase idênticos, com pequenas diferenças de texto), uma das substituições usou o texto errado como âncora e sobrescreveu um campo (`role`, de uma das experiências profissionais) com o valor de outro campo, em outro bloco. Nada quebrou tecnicamente — o JSON continuou válido, o site continuou funcionando, o build passou. Só apareceu porque, antes de considerar a tarefa concluída, reli o diff daquele arquivo especificamente. Se eu tivesse confiado só no build passar e no site "parecer certo" no navegador, esse erro teria ido para produção. A lição: com edições em lote sobre conteúdo repetitivo (múltiplos idiomas, múltiplos itens de uma lista), ler o diff final é obrigatório, não opcional — o tipo de erro que isso produz não aparece em nenhum teste automatizado nem em uma inspeção visual rápida.

## Verificar de verdade exige mais do que rodar o build

Um build limpo (`npm run build` sem erros) prova que o código compila. Não prova que o texto novo aparece onde deveria, que um layout não quebrou em mobile, ou que um JSON-LD gerado é sintaticamente válido. Neste projeto, isso significou subir o servidor de desenvolvimento e efetivamente navegar pelas páginas alteradas com um navegador headless, capturando screenshots reais — inclusive em uma viewport estreita, porque a mudança mais arriscada (adicionar texto embaixo de ícones que antes só tinham SVG) era exatamente o tipo de coisa que quebra em telas pequenas e não em telas largas. Só depois de ver o resultado renderizado — não só o código — dava para dizer com confiança que a mudança funcionava.

Um obstáculo prático nessa etapa: o ambiente não tinha Playwright nem Puppeteer instalados, e o Chromium disponível via snap tinha um sandbox de sistema de arquivos que bloqueava silenciosamente a escrita de screenshots em diretórios temporários "óbvios" — sem mensagem de erro clara na primeira tentativa. Descobrir que só diretórios dentro do `$HOME` eram graváveis custou algumas tentativas perdidas. Ferramentas de verificação "acessórias" (como um navegador headless) merecem o mesmo cuidado de configuração que as ferramentas principais do projeto.

## Escopo explícito evita o problema mais comum: fazer demais

Boa parte deste trabalho envolveu instruções explícitas de *não* fazer certas coisas — não mudar arquitetura, não mudar rotas, não commitar, não inventar fatos sobre experiência profissional que não estivessem confirmados em nenhuma fonte real. Na prática, isso funcionou: quando a auditoria encontrou uma entidade citada como exemplo mas sem evidência no conteúdo real do site (um sistema de governo específico), a resposta correta foi *não* incluí-la, e sinalizar isso explicitamente como pendente de confirmação, em vez de assumir que estava certo. Um assistente de IA sem esse tipo de restrição explícita — ou um uso mais apressado da ferramenta, sem definir o que está fora de escopo — tende a "preencher lacunas" de um jeito que parece produtivo no momento, mas que introduz afirmações não verificadas em conteúdo que depois é publicado como se fosse experiência real.

## O que eu recomendaria para quem for fazer algo parecido

Definir explicitamente, antes de começar, o que a IA não deve fazer (mudar arquitetura, commitar, inventar fatos) rende mais controle do que tentar corrigir depois. Particionar trabalho paralelo por arquivo, não por tarefa. E nunca considerar uma mudança "verificada" só porque o build passou — rodar a aplicação de verdade e olhar o resultado é a única forma de pegar os erros que não aparecem em nenhuma outra camada.

## Limitações deste relato

Isto é um relato de um único projeto e um único tipo de tarefa (auditoria de conteúdo + edições coordenadas em um repositório já existente). Não cobre, por exemplo, o que muda ao usar a ferramenta para escrever uma funcionalidade nova do zero, ou para depurar um bug de produção sob pressão de tempo — situações onde eu esperaria que outros atritos apareçam.
