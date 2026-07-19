---
title: "O que aprendi construindo um Market Maker automatizado na Liquid Network"
slug: market-maker-liquid-network
pillar: Blockchain, Liquid Network & DeFi
type: experience-article
sourceProject: "Dealer AMM — SideSwap / Liquid Network"
author: Rodolfo Romão
date: 2026-07-19
status: rascunho — revisar antes de publicar
note_editorial: "Rascunho gerado com apoio de IA a partir de fatos verificados sobre a arquitetura real do sistema. Detalhes operacionais de segurança (chaves, tokens, portas, hosts, caminhos de repositório) foram deliberadamente omitidos. Revisar números e tom antes de publicar."
---

# O que aprendi construindo um Market Maker automatizado na Liquid Network

Nos últimos anos, além do trabalho no DNIT e dos produtos SaaS próprios, venho operando um sistema de market making automatizado na Liquid Network — a sidechain confidencial do Bitcoin — que posiciona ordens no DEX SideSwap, reage a movimentos de mercado e se protege sozinho quando o mercado fica instável. Este artigo não é um tutorial. É um relato de decisões de arquitetura, do que deu errado, e do que eu faria diferente.

Não vou expor detalhes operacionais de segurança — chaves, tokens, endereços de produção — mas vou explicar os *modelos* de segurança que usei, porque foram eles que mais me ensinaram nesse projeto.

## O que o sistema faz

Um market maker (dealer) mantém ordens de compra e venda simultâneas em um par de ativos, capturando o spread entre elas. Na prática, isso significa: monitorar o livro de ofertas em tempo real, recalcular preços com um spread configurável a cada movimento relevante, reenviar ordens quando o mercado se move, cancelar quando o risco sobe, e nunca deixar o operador sem visibilidade do que está acontecendo com o dinheiro dele.

Os pares que o sistema opera envolvem L-BTC (Bitcoin representado na Liquid Network), USDt e DePix (uma stablecoin brasileira sobre a mesma rede) — e seus inversos. Cada par tem sua própria lógica de spread e seus próprios limites de exposição.

## Por que Liquid Network, não outra rede

A Liquid Network é uma sidechain do Bitcoin com dois atributos que importam muito para um sistema financeiro automatizado: liquidação mais rápida que a mainnet do Bitcoin, e transações confidenciais (o valor movimentado não fica público no explorador). Para um dealer que precisa reagir em segundos e não quer expor posição/exposição publicamente a cada ordem executada, essas duas propriedades pesaram mais do que, por exemplo, usar a Lightning Network — que resolve velocidade mas não resolve confidencialidade da mesma forma, e tem um modelo operacional (canais, liquidez travada) menos adequado para um book de ordens que muda de tamanho o tempo todo.

## Arquitetura, em linhas gerais

O desenho final ficou em quatro camadas, deliberadamente separadas por responsabilidade:

1. **Interface** — um console web que mostra o estado do sistema (saldos, ordens abertas, histórico, alertas) e permite ao operador configurar spreads e limites. Não guarda segredo nenhum.
2. **Orquestração** — um serviço central que recebe comandos da interface, mantém o estado dos processos, e distribui trabalho.
3. **Execução** — um processo isolado por carteira, responsável por assinar e enviar as ordens de fato para o DEX.
4. **Custódia** — um serviço completamente separado, que existe só para uma coisa: entregar a passphrase da carteira para quem prova que tem autorização de fazer isso, e para mais ninguém.

A separação entre orquestração e custódia foi a decisão de arquitetura mais importante do projeto, e é o assunto da próxima seção.

## A decisão de segurança que mais me ensinou: custódia em duas partes

A pergunta que guiou o desenho foi: *o que acontece se um dos meus próprios sistemas for comprometido?*

Se a interface web (a parte mais exposta, rodando num navegador de terceiros) guardasse a passphrase da carteira, um XSS ou um dispositivo comprometido do operador expõe o fundo inteiro. Se o serviço de orquestração guardasse a passphrase em texto plano no disco, comprometer aquele único processo também expõe tudo.

A solução que implementei é um esquema de segredo dividido (split-key) 2-de-2: nem a interface nem o serviço de orquestração conseguem, sozinhos, reconstruir a passphrase. Ela só existe momentaneamente em memória, no processo de execução, depois de uma negociação entre as duas partes.

Em termos técnicos, o fluxo é assim:

- O serviço de custódia guarda uma chave pública do processo de orquestração.
- Quando a passphrase é registrada, o navegador gera um segredo aleatório e deriva uma chave simétrica dele via **HKDF-SHA256**.
- A passphrase é cifrada com essa chave usando **ChaCha20-Poly1305** (AEAD — cifra autenticada, não só sigilo).
- O segredo aleatório em si é cifrado para a chave pública do serviço de orquestração usando **SealedBox** (criptografia de chave pública baseada em X25519/Curve25519) — só quem tem a chave privada correspondente consegue abri-lo.
- Quando o processo de execução precisa da passphrase, ele prova sua identidade ao serviço de custódia via um desafio-resposta **Ed25519** — sem transmitir nenhum segredo de longo prazo pela rede.

O ganho real não é "usar criptografia forte" — é que comprometer qualquer *um* dos componentes isoladamente não é suficiente para roubar a carteira. É preciso comprometer dois sistemas diferentes, com superfícies de ataque diferentes, ao mesmo tempo. Essa é a lição que eu levo para qualquer sistema financeiro que eu construir depois deste: modele a segurança em torno de "o que precisa ser verdade para um comprometimento único não virar perda total", não em torno de "qual algoritmo é mais forte".

## Proteção contra queda brusca de preço

Um market maker automatizado que não se defende de movimentos bruscos de mercado é, na prática, uma forma de dar dinheiro de graça para quem estiver do outro lado da negociação num flash crash. O sistema tem quatro níveis de resposta, escalando com a severidade da queda observada em uma janela curta de tempo:

- **Alerta** — queda pequena (poucos por cento) em segundos: só notifica o operador, não muda comportamento.
- **Pausa** — queda moderada: para de reajustar preços automaticamente, mas mantém as ordens já colocadas.
- **Cancelamento** — queda maior: cancela as ordens em aberto proativamente, para não ser "atropelado" por um movimento que o book ainda não refletiu.
- **Bloqueio total** — queda muito grande, ou quando os oráculos de preço (ver próxima seção) discordam de forma anômala entre si: o sistema para completamente até intervenção manual.

O detalhe que mais importou na prática não foi o percentual de cada nível — foi a **janela de tempo**. Uma queda de 5% ao longo de uma hora é normal; a mesma queda em 15 segundos é outra categoria de evento. Calibrar essa janela levou mais iteração do que calibrar os percentuais em si.

## Por que um único provedor de preço nunca é suficiente

Cedo no projeto, aprendi (da forma difícil) que confiar em uma única fonte de preço para decidir quando pausar ou cancelar é um ponto único de falha perigoso: se aquela fonte específica tiver um bug, ficar fora do ar, ou simplesmente publicar um preço errado por um instante, o sistema toma decisões automatizadas com base em dado ruim.

A solução foi validar cada movimento de preço contra múltiplas exchanges públicas independentes (cinco, no caso) antes de agir. Se as fontes divergem entre si mais do que o esperado, isso por si só já é tratado como sinal de anomalia — o sistema não espera nem confia que "a maioria está certa"; ele prefere errar para o lado da cautela.

## Problemas reais que apareceram em produção

Alguns dos problemas que só apareceram depois que o sistema estava rodando de verdade, não em teste:

- **Ordens que "somem" do livro sem eu ter cancelado.** O DEX pode remover uma ordem por motivos que não chegam como erro explícito para quem enviou. A solução foi um *watchdog* dedicado que compara periodicamente o estado esperado (o que eu mandei manter) com o estado real do livro, e reenvia o que estiver faltando — com alerta separado se isso acontecer com frequência anormal, porque pode ser sintoma de outra coisa.
- **Processos de execução que travam ou caem silenciosamente.** Um processo por carteira ajuda no isolamento, mas também significa que preciso saber quando um deles morre. Isso virou outro watchdog, com alerta imediato — porque "carteira sem processo ativo" é um estado que não pode ficar sem supervisão nem por alguns minutos.
- **Desconexão entre a orquestração e o serviço de retransmissão em tempo real.** Rede não é confiável; reconexão automática com backoff é obrigatória, e eu subestimei quanto tempo levaria para cobrir os casos de borda (reconectar no meio de uma ordem em andamento, por exemplo) de forma que não duplicasse nem perdesse eventos.

## O que eu faria diferente

Duas coisas, com a clareza que só vem depois:

1. Eu teria investido em observabilidade (histórico estruturado de eventos, não só logs) desde o primeiro dia, não depois que precisei investigar o primeiro incidente. Reconstruir "o que o sistema estava pensando" a partir de logs de texto é muito mais lento do que consultar um histórico já estruturado.
2. Eu teria calibrado as janelas de tempo da proteção contra flash crash com dados históricos reais antes de ligar em produção, em vez de ajustar empiricamente depois. Funcionou, mas custou mais ciclos de ajuste do que precisava.

## Limitações, hoje

Este não é um sistema perfeito, e não pretendo apresentá-lo como tal:

- Ele depende da disponibilidade do DEX e das exchanges usadas como oráculo — se todas ficarem indisponíveis ao mesmo tempo, o sistema para (por design), mas isso significa tempo sem operar.
- A proteção contra flash crash reduz risco, não elimina — ela reage a um evento que já começou, não previne.
- É um sistema para operação supervisionada, não para "ligar e esquecer" — o operador ainda precisa acompanhar alertas.

Se você está pensando em construir algo parecido, a lição que eu mais repetiria é: comece pelo modelo de ameaça (o que precisa ser verdade para um comprometimento único não virar perda total), não pela escolha de blockchain ou de exchange. A arquitetura de custódia que descrevi acima nasceu inteiramente dessa pergunta.
