// i18n compartilhado da seção /system — detecção de idioma do navegador + dicionário de UI.
// Terminal.js é a única exceção: fica sempre em inglês (simulação de terminal real), exceto
// as respostas dos comandos "easter egg" (ls, reboot, sudo, ...), que também usam este dicionário.

export const SUPPORTED_LOCALES = ["pt-br", "en", "es", "fr"];
export const DEFAULT_LOCALE = "en";

export function detectLocale() {
  try {
    const raw =
      (typeof navigator !== "undefined" &&
        (navigator.language || (navigator.languages && navigator.languages[0]))) ||
      "";
    const lower = raw.toLowerCase();
    if (lower.startsWith("pt")) return "pt-br";
    if (lower.startsWith("es")) return "es";
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("en")) return "en";
    return DEFAULT_LOCALE;
  } catch (e) {
    return DEFAULT_LOCALE;
  }
}

// t(locale, path) — lookup simples por caminho "namespace.chave"; cai pro inglês, depois
// pra própria chave, se faltar tradução. Nunca lança.
export function t(locale, path) {
  const dict = UI[locale] || UI[DEFAULT_LOCALE];
  const fallback = UI[DEFAULT_LOCALE];
  const parts = path.split(".");

  function resolve(source) {
    let node = source;
    for (const part of parts) {
      if (node && typeof node === "object" && part in node) {
        node = node[part];
      } else {
        return undefined;
      }
    }
    return node;
  }

  const value = resolve(dict);
  if (value !== undefined) return value;
  const fallbackValue = resolve(fallback);
  if (fallbackValue !== undefined) return fallbackValue;
  return path;
}

export const UI = {
  en: {
    hero: {
      hint: "type below in the terminal",
    },
    lab: {
      heading: "Lab",
      subtitle: "Architecture, code, and live demos — all running in this browser right now.",
    },
    arch: {
      heading: "One pattern, many systems",
      caption:
        "An architecture pattern I've applied to automation systems, blockchain, and financial APIs — deliberately generic: the backbone repeats, the details change on top of it per domain.",
      nodes: {
        client: { label: "Client", detail: "User request (web, mobile, CLI)" },
        api: { label: "API", detail: "Entry point, auth, and validation" },
        cache: { label: "Cache", detail: "Hot responses, less load on the database" },
        queue: { label: "Queue", detail: "Decouples producers from consumers" },
        workers: { label: "Workers", detail: "Scalable, asynchronous processing" },
        db: { label: "Database", detail: "Persistence and consistency" },
        monitoring: { label: "Monitoring", detail: "Metrics, logs, and alerts" },
      },
    },
    projectsLive: {
      platformsHeading: "Platforms",
      worksHeading: "Selected Works",
      websiteLabel: "Website",
      githubLabel: "GitHub",
      viewFullMenu: "See the full project menu",
    },
    challenge: {
      title: "Challenge my code",
      intro:
        "Three small algorithmic challenges: out-predict an adaptive bot at rock-paper-scissors, find a real collision in a deliberately naive hash function, or race the real Bitcoin mainnet's proof-of-work.",
      note: "Score and attempts stay only in your localStorage. The first two cards run 100% in your browser, no network call; the Bitcoin one makes a single read-only request for the current tip block (see its own note below).",
      rpsCardTitle: "Beat the bot at rock-paper-scissors",
      rpsCardDescription:
        "It's not random — the bot studies your pattern round after round and tries to counter your next move.",
      rpsHint:
        "The bot watches your last move and predicts what you'll play next (a simple Markov chain), then throws the counter. Stay unpredictable.",
      rockLabel: "Rock",
      paperLabel: "Paper",
      scissorsLabel: "Scissors",
      rpsWin: "🎉 you beat the bot!",
      rpsLose: "🤖 the bot got you.",
      rpsDraw: "🤝 draw.",
      rpsScoreLabel: "score (wins / losses / draws):",
      rpsResetBtn: "reset score",
      hashCardTitle: "Find a hash collision",
      hashCardDescription:
        "Type two different strings below. If they land on the same hash, you win — that's a real collision.",
      hashHint:
        "Naive hash on purpose: sum of character codes, mod 997. Real hash functions mix bits (the avalanche effect) exactly to prevent shortcuts like this one. Tip: anagrams are a good place to start.",
      hashInputALabel: "String A",
      hashInputBLabel: "String B",
      hashPlaceholderA: "e.g.: listen",
      hashPlaceholderB: "e.g.: silent",
      hashOf: (n) => `hash: ${n}`,
      hashCollisionFound: "🎉 collision found!",
      hashNoCollisionYet: "no collision yet — try again",
      hashSameInput: "type two different strings",
      hashCollisionsLabel: "collisions found on this browser:",
      clearBtn: "clear",
      bitcoinCardTitle: "Race the real Bitcoin mainnet",
      bitcoinCardDescription:
        "Your browser vs. the real network: mine for a few seconds and compare your best hash against the current tip block's real proof-of-work.",
      bitcoinHint:
        "Runs real SHA-256d (double SHA-256) via the Web Crypto API, searching for hashes with more leading zero bits — exactly what Bitcoin mining does, just at a laughably smaller scale.",
      bitcoinNote:
        "The only card here that makes a network call: a read-only, no-key request to a public block explorer for the current tip hash. No wallet, no transaction, nothing written on-chain.",
      bitcoinTipLabel: (n) => `current tip: block #${Number(n).toLocaleString()}`,
      bitcoinTipUnavailable: "mainnet data unavailable right now",
      bitcoinMineBtn: "mine for 3s",
      bitcoinMiningLabel: "mining…",
      bitcoinYourBest: (bits) => `your best: ${bits} leading zero bits`,
      bitcoinRealBits: (bits) => `real block: ${bits} leading zero bits`,
      bitcoinHashrate: (n) => `${n} hashes/s in your browser`,
      bitcoinTimesHarder: (s) => `the real network is ${s} times harder`,
      bitcoinYearsEstimate: (s) => `at this rate, you'd need ~${s} years to find one block alone`,
      bitcoinUnsupported: "Your browser doesn't support the Web Crypto API needed for this demo.",
    },
    stats: {
      years_coding: "Years coding",
      systems_delivered: "Systems delivered",
      languages: "Languages",
      github_public_repos: "Public repositories",
      github_followers: "GitHub followers",
      uptime_seconds: "Uptime (s)",
      error: "Could not load stats right now.",
    },
    timeline: {
      loading: "Loading timeline…",
      error: "Could not load the timeline right now.",
      empty: "Timeline under construction 🚧",
    },
    devmode: {
      loadingServer: "loading server metrics…",
      serverError: "could not load server metrics right now.",
      closeHint: "Ctrl+Shift+D or Esc to close",
    },
    easter: {
      ls: "resume.pdf  dreams.txt  coffee.exe  bugs_i_wont_fix.md",
      pwd: "/home/visitor/pretending-to-know-linux",
      whoami: "you. obviously. (checked twice, just in case)",
      sudo: "nice try — this terminal has no root, only vibes.",
      reboot: "rebooting... jk, I'm a React component, not a kernel.",
      rm: "permission denied. I like this filesystem, thanks.",
      cat: "cat: file not found (there was never a cat, only ASCII art)",
      matrix: "there is no spoon. there is, however, a résumé.",
      sl: "🚂 choo choo — you meant 'ls', right?",
      exit: "you can't exit a simulation. try 'clear' instead.",
      vi: ":wq (jk, there's nothing to save here)",
      man: "no manual entry for life. try 'help' instead.",
    },
  },

  "pt-br": {
    hero: {
      hint: "role no terminal abaixo",
    },
    lab: {
      heading: "Laboratório",
      subtitle: "Arquitetura, código e demos ao vivo — tudo rodando neste navegador agora.",
    },
    arch: {
      heading: "Um padrão, muitos sistemas",
      caption:
        "Um padrão de arquitetura que já apliquei em sistemas de automação, blockchain e APIs financeiras — deliberadamente genérico: a espinha dorsal se repete, os detalhes de cada domínio mudam por cima dela.",
      nodes: {
        client: { label: "Cliente", detail: "Requisição do usuário (web, mobile, CLI)" },
        api: { label: "API", detail: "Entrada, autenticação e validação" },
        cache: { label: "Cache", detail: "Respostas quentes, menos carga no banco" },
        queue: { label: "Fila", detail: "Desacopla produtores de consumidores" },
        workers: { label: "Workers", detail: "Processamento assíncrono e escalável" },
        db: { label: "Banco de Dados", detail: "Persistência e consistência" },
        monitoring: { label: "Monitoramento", detail: "Métricas, logs e alertas" },
      },
    },
    projectsLive: {
      platformsHeading: "Plataformas",
      worksHeading: "Maiores Trabalhos",
      websiteLabel: "Site",
      githubLabel: "GitHub",
      viewFullMenu: "Ver o menu completo de projetos",
    },
    challenge: {
      title: "Desafie meu código",
      intro:
        "Três desafios algorítmicos: tente enganar um bot adaptativo no pedra-papel-tesoura, encontre uma colisão de verdade numa função hash propositalmente ingênua, ou minere contra a prova de trabalho real da mainnet do Bitcoin.",
      note: "Placar e tentativas ficam só no seu localStorage. Os dois primeiros cards rodam 100% no seu navegador, sem chamada de rede; o do Bitcoin faz uma única requisição read-only pro bloco mais recente (veja a nota própria dele abaixo).",
      rpsCardTitle: "Vença o bot no pedra-papel-tesoura",
      rpsCardDescription:
        "Ele não joga aleatório — o bot estuda seu padrão a cada rodada e tenta antecipar seu próximo lance.",
      rpsHint:
        "O bot observa seu último lance e tenta prever o próximo (uma cadeia de Markov simples), depois joga o que vence essa previsão. Tente ser imprevisível.",
      rockLabel: "Pedra",
      paperLabel: "Papel",
      scissorsLabel: "Tesoura",
      rpsWin: "🎉 você venceu o bot!",
      rpsLose: "🤖 o bot te pegou.",
      rpsDraw: "🤝 empate.",
      rpsScoreLabel: "placar (vitórias / derrotas / empates):",
      rpsResetBtn: "reiniciar placar",
      hashCardTitle: "Ache uma colisão de hash",
      hashCardDescription:
        "Digite duas strings diferentes abaixo. Se caírem no mesmo hash, você venceu — isso é uma colisão de verdade.",
      hashHint:
        "Hash ingênuo de propósito: soma dos códigos ASCII, módulo 997. Funções hash de verdade misturam bits (o efeito avalanche) exatamente pra evitar atalhos como esse. Dica: anagramas são um bom começo.",
      hashInputALabel: "String A",
      hashInputBLabel: "String B",
      hashPlaceholderA: "ex: roma",
      hashPlaceholderB: "ex: amor",
      hashOf: (n) => `hash: ${n}`,
      hashCollisionFound: "🎉 colisão encontrada!",
      hashNoCollisionYet: "sem colisão ainda — tente de novo",
      hashSameInput: "digite duas strings diferentes",
      hashCollisionsLabel: "colisões encontradas neste navegador:",
      clearBtn: "limpar",
      bitcoinCardTitle: "Minere contra a mainnet real",
      bitcoinCardDescription:
        "Seu navegador contra a rede de verdade: minere por alguns segundos e compare seu melhor hash com a prova de trabalho real do bloco mais recente.",
      bitcoinHint:
        "Roda SHA-256d de verdade (SHA-256 duplo) via Web Crypto API, buscando hashes com mais bits de zero à esquerda — exatamente o que a mineração de Bitcoin faz, só que numa escala ridiculamente menor.",
      bitcoinNote:
        "O único card aqui que faz uma chamada de rede: uma requisição read-only, sem chave, pra um explorador de blocos público, só pra pegar o hash do bloco mais recente. Sem carteira, sem transação, nada é escrito on-chain.",
      bitcoinTipLabel: (n) => `bloco atual: #${Number(n).toLocaleString()}`,
      bitcoinTipUnavailable: "dados da mainnet indisponíveis agora",
      bitcoinMineBtn: "minerar por 3s",
      bitcoinMiningLabel: "minerando…",
      bitcoinYourBest: (bits) => `seu melhor: ${bits} bits de zero à esquerda`,
      bitcoinRealBits: (bits) => `bloco real: ${bits} bits de zero à esquerda`,
      bitcoinHashrate: (n) => `${n} hashes/s no seu navegador`,
      bitcoinTimesHarder: (s) => `a rede real é ${s} vezes mais difícil`,
      bitcoinYearsEstimate: (s) => `nesse ritmo, você levaria ~${s} anos pra achar 1 bloco sozinho`,
      bitcoinUnsupported: "Seu navegador não suporta a Web Crypto API necessária pra essa demo.",
    },
    stats: {
      years_coding: "Anos programando",
      systems_delivered: "Sistemas entregues",
      languages: "Linguagens",
      github_public_repos: "Repositórios públicos",
      github_followers: "Seguidores no GitHub",
      uptime_seconds: "Uptime (s)",
      error: "Não foi possível carregar as estatísticas agora.",
    },
    timeline: {
      loading: "Carregando timeline…",
      error: "Não foi possível carregar a timeline agora.",
      empty: "Timeline em construção 🚧",
    },
    devmode: {
      loadingServer: "carregando métricas do servidor…",
      serverError: "não foi possível carregar métricas do servidor agora.",
      closeHint: "Ctrl+Shift+D ou Esc para fechar",
    },
    easter: {
      ls: "resume.pdf  sonhos.txt  cafe.exe  bugs_que_nao_vou_arrumar.md",
      pwd: "/home/visitante/fingindo-que-manja-de-linux",
      whoami: "você. obviamente. (conferi duas vezes, por garantia)",
      sudo: "boa tentativa — esse terminal não tem root, só vibe.",
      reboot: "reiniciando... brincadeira, eu sou um componente React, não um kernel.",
      rm: "permissão negada. eu gosto desse filesystem, valeu.",
      cat: "cat: arquivo não encontrado (nunca teve gato aqui, só arte ASCII)",
      matrix: "não existe colher. existe, porém, um currículo.",
      sl: "🚂 tchutchu — você quis dizer 'ls', né?",
      exit: "você não sai de uma simulação. tenta 'clear'.",
      vi: ":wq (brincadeira, não tem nada pra salvar aqui)",
      man: "sem manual pra vida. tenta 'help'.",
    },
  },

  es: {
    hero: {
      hint: "escribe abajo en la terminal",
    },
    lab: {
      heading: "Laboratorio",
      subtitle: "Arquitectura, código y demos en vivo — todo corriendo en este navegador ahora.",
    },
    arch: {
      heading: "Un patrón, muchos sistemas",
      caption:
        "Un patrón de arquitectura que ya apliqué en sistemas de automatización, blockchain y APIs financieras — deliberadamente genérico: la columna vertebral se repite, los detalles cambian encima según el dominio.",
      nodes: {
        client: { label: "Cliente", detail: "Solicitud del usuario (web, móvil, CLI)" },
        api: { label: "API", detail: "Entrada, autenticación y validación" },
        cache: { label: "Caché", detail: "Respuestas frecuentes, menos carga en la base de datos" },
        queue: { label: "Cola", detail: "Desacopla productores de consumidores" },
        workers: { label: "Workers", detail: "Procesamiento asíncrono y escalable" },
        db: { label: "Base de Datos", detail: "Persistencia y consistencia" },
        monitoring: { label: "Monitoreo", detail: "Métricas, logs y alertas" },
      },
    },
    projectsLive: {
      platformsHeading: "Plataformas",
      worksHeading: "Trabajos Destacados",
      websiteLabel: "Sitio",
      githubLabel: "GitHub",
      viewFullMenu: "Ver el menú completo de proyectos",
    },
    challenge: {
      title: "Desafía mi código",
      intro:
        "Tres desafíos algorítmicos: intenta superar a un bot adaptativo en piedra-papel-tijera, encuentra una colisión real en una función hash deliberadamente ingenua, o compite contra la prueba de trabajo real de la mainnet de Bitcoin.",
      note: "El marcador y los intentos quedan solo en tu localStorage. Las primeras dos tarjetas corren 100% en tu navegador, sin llamada de red; la de Bitcoin hace una única solicitud de solo lectura para el bloque más reciente (ver su propia nota abajo).",
      rpsCardTitle: "Vence al bot en piedra-papel-tijera",
      rpsCardDescription:
        "No juega al azar — el bot estudia tu patrón ronda tras ronda e intenta anticipar tu próxima jugada.",
      rpsHint:
        "El bot observa tu última jugada y predice la siguiente (una cadena de Markov simple), luego lanza lo que le gana a esa predicción. Intenta ser impredecible.",
      rockLabel: "Piedra",
      paperLabel: "Papel",
      scissorsLabel: "Tijera",
      rpsWin: "🎉 ¡venciste al bot!",
      rpsLose: "🤖 el bot te ganó.",
      rpsDraw: "🤝 empate.",
      rpsScoreLabel: "marcador (victorias / derrotas / empates):",
      rpsResetBtn: "reiniciar marcador",
      hashCardTitle: "Encuentra una colisión de hash",
      hashCardDescription:
        "Escribe dos cadenas diferentes abajo. Si caen en el mismo hash, ganaste — eso es una colisión real.",
      hashHint:
        "Hash ingenuo a propósito: suma de los códigos ASCII, módulo 997. Las funciones hash reales mezclan bits (el efecto avalancha) justamente para evitar atajos como este. Pista: los anagramas son un buen comienzo.",
      hashInputALabel: "Cadena A",
      hashInputBLabel: "Cadena B",
      hashPlaceholderA: "ej: roma",
      hashPlaceholderB: "ej: amor",
      hashOf: (n) => `hash: ${n}`,
      hashCollisionFound: "🎉 ¡colisión encontrada!",
      hashNoCollisionYet: "sin colisión todavía — intenta de nuevo",
      hashSameInput: "escribe dos cadenas diferentes",
      hashCollisionsLabel: "colisiones encontradas en este navegador:",
      clearBtn: "limpiar",
      bitcoinCardTitle: "Compite contra la mainnet real",
      bitcoinCardDescription:
        "Tu navegador contra la red real: mina por unos segundos y compara tu mejor hash con la prueba de trabajo real del bloque más reciente.",
      bitcoinHint:
        "Ejecuta SHA-256d real (doble SHA-256) vía Web Crypto API, buscando hashes con más bits de cero a la izquierda — justo lo que hace la minería de Bitcoin, solo que a una escala ridículamente menor.",
      bitcoinNote:
        "La única tarjeta aquí que hace una llamada de red: una solicitud de solo lectura, sin clave, a un explorador de bloques público, solo para obtener el hash del bloque más reciente. Sin billetera, sin transacción, nada se escribe on-chain.",
      bitcoinTipLabel: (n) => `bloque actual: #${Number(n).toLocaleString()}`,
      bitcoinTipUnavailable: "datos de la mainnet no disponibles ahora",
      bitcoinMineBtn: "minar por 3s",
      bitcoinMiningLabel: "minando…",
      bitcoinYourBest: (bits) => `tu mejor: ${bits} bits de cero a la izquierda`,
      bitcoinRealBits: (bits) => `bloque real: ${bits} bits de cero a la izquierda`,
      bitcoinHashrate: (n) => `${n} hashes/s en tu navegador`,
      bitcoinTimesHarder: (s) => `la red real es ${s} veces más difícil`,
      bitcoinYearsEstimate: (s) => `a este ritmo, necesitarías ~${s} años para encontrar 1 bloque solo`,
      bitcoinUnsupported: "Tu navegador no soporta la Web Crypto API necesaria para esta demo.",
    },
    stats: {
      years_coding: "Años programando",
      systems_delivered: "Sistemas entregados",
      languages: "Lenguajes",
      github_public_repos: "Repositorios públicos",
      github_followers: "Seguidores en GitHub",
      uptime_seconds: "Uptime (s)",
      error: "No se pudieron cargar las estadísticas ahora.",
    },
    timeline: {
      loading: "Cargando timeline…",
      error: "No se pudo cargar la timeline ahora.",
      empty: "Timeline en construcción 🚧",
    },
    devmode: {
      loadingServer: "cargando métricas del servidor…",
      serverError: "no se pudieron cargar las métricas del servidor ahora.",
      closeHint: "Ctrl+Shift+D o Esc para cerrar",
    },
    easter: {
      ls: "resume.pdf  sueños.txt  cafe.exe  bugs_que_no_arreglare.md",
      pwd: "/home/visitante/fingiendo-saber-linux",
      whoami: "tú. obviamente. (lo verifiqué dos veces, por si acaso)",
      sudo: "buen intento — esta terminal no tiene root, solo vibra.",
      reboot: "reiniciando... es broma, soy un componente de React, no un kernel.",
      rm: "permiso denegado. me gusta este filesystem, gracias.",
      cat: "cat: archivo no encontrado (nunca hubo un gato aquí, solo arte ASCII)",
      matrix: "no hay cuchara. sí hay, en cambio, un currículum.",
      sl: "🚂 chuchú — ¿quisiste decir 'ls'?",
      exit: "no puedes salir de una simulación. prueba 'clear'.",
      vi: ":wq (es broma, no hay nada que guardar aquí)",
      man: "no hay manual para la vida. prueba 'help'.",
    },
  },

  fr: {
    hero: {
      hint: "tape ci-dessous dans le terminal",
    },
    lab: {
      heading: "Laboratoire",
      subtitle: "Architecture, code et démos en direct — tout tourne dans ce navigateur en ce moment.",
    },
    arch: {
      heading: "Un schéma, plusieurs systèmes",
      caption:
        "Un schéma d'architecture que j'ai déjà appliqué à des systèmes d'automatisation, à la blockchain et à des API financières — volontairement générique : l'ossature se répète, les détails changent par-dessus selon le domaine.",
      nodes: {
        client: { label: "Client", detail: "Requête de l'utilisateur (web, mobile, CLI)" },
        api: { label: "API", detail: "Entrée, authentification et validation" },
        cache: { label: "Cache", detail: "Réponses fréquentes, moins de charge sur la base" },
        queue: { label: "File d'attente", detail: "Découple producteurs et consommateurs" },
        workers: { label: "Workers", detail: "Traitement asynchrone et scalable" },
        db: { label: "Base de Données", detail: "Persistance et cohérence" },
        monitoring: { label: "Supervision", detail: "Métriques, logs et alertes" },
      },
    },
    projectsLive: {
      platformsHeading: "Plateformes",
      worksHeading: "Travaux Marquants",
      websiteLabel: "Site",
      githubLabel: "GitHub",
      viewFullMenu: "Voir le menu complet des projets",
    },
    challenge: {
      title: "Défiez mon code",
      intro:
        "Trois défis algorithmiques : essayez de déjouer un bot adaptatif au pierre-papier-ciseaux, trouvez une vraie collision dans une fonction de hash volontairement naïve, ou affrontez la preuve de travail réelle de la mainnet Bitcoin.",
      note: "Le score et les tentatives restent uniquement dans votre localStorage. Les deux premières cartes tournent à 100% dans votre navigateur, sans appel réseau ; celle du Bitcoin fait une seule requête en lecture seule pour le dernier bloc (voir sa propre note ci-dessous).",
      rpsCardTitle: "Battez le bot au pierre-papier-ciseaux",
      rpsCardDescription:
        "Il ne joue pas au hasard — le bot étudie votre schéma manche après manche et essaie d'anticiper votre prochain coup.",
      rpsHint:
        "Le bot observe votre dernier coup et prédit le prochain (une simple chaîne de Markov), puis joue le coup qui bat cette prédiction. Restez imprévisible.",
      rockLabel: "Pierre",
      paperLabel: "Papier",
      scissorsLabel: "Ciseaux",
      rpsWin: "🎉 vous avez battu le bot !",
      rpsLose: "🤖 le bot vous a eu.",
      rpsDraw: "🤝 égalité.",
      rpsScoreLabel: "score (victoires / défaites / égalités) :",
      rpsResetBtn: "réinitialiser le score",
      hashCardTitle: "Trouvez une collision de hash",
      hashCardDescription:
        "Saisissez deux chaînes différentes ci-dessous. Si elles tombent sur le même hash, vous gagnez — c'est une vraie collision.",
      hashHint:
        "Hash naïf volontairement : somme des codes de caractères, modulo 997. Les vraies fonctions de hash mélangent les bits (l'effet avalanche) justement pour éviter ce genre de raccourci. Astuce : les anagrammes sont un bon point de départ.",
      hashInputALabel: "Chaîne A",
      hashInputBLabel: "Chaîne B",
      hashPlaceholderA: "ex : roma",
      hashPlaceholderB: "ex : amor",
      hashOf: (n) => `hash : ${n}`,
      hashCollisionFound: "🎉 collision trouvée !",
      hashNoCollisionYet: "pas encore de collision — réessayez",
      hashSameInput: "saisissez deux chaînes différentes",
      hashCollisionsLabel: "collisions trouvées sur ce navigateur :",
      clearBtn: "effacer",
      bitcoinCardTitle: "Affrontez la vraie mainnet Bitcoin",
      bitcoinCardDescription:
        "Votre navigateur contre le vrai réseau : minez pendant quelques secondes et comparez votre meilleur hash à la preuve de travail réelle du dernier bloc.",
      bitcoinHint:
        "Exécute un vrai SHA-256d (double SHA-256) via l'API Web Crypto, à la recherche de hachages avec plus de bits de zéro en tête — exactement ce que fait le minage Bitcoin, mais à une échelle ridiculement plus petite.",
      bitcoinNote:
        "La seule carte ici qui fait un appel réseau : une requête en lecture seule, sans clé, vers un explorateur de blocs public, juste pour obtenir le hash du dernier bloc. Pas de portefeuille, pas de transaction, rien n'est écrit on-chain.",
      bitcoinTipLabel: (n) => `bloc actuel : #${Number(n).toLocaleString()}`,
      bitcoinTipUnavailable: "données de la mainnet indisponibles pour le moment",
      bitcoinMineBtn: "miner pendant 3s",
      bitcoinMiningLabel: "minage…",
      bitcoinYourBest: (bits) => `votre meilleur : ${bits} bits de zéro en tête`,
      bitcoinRealBits: (bits) => `bloc réel : ${bits} bits de zéro en tête`,
      bitcoinHashrate: (n) => `${n} hachages/s dans votre navigateur`,
      bitcoinTimesHarder: (s) => `le vrai réseau est ${s} fois plus difficile`,
      bitcoinYearsEstimate: (s) => `à ce rythme, il vous faudrait ~${s} ans pour trouver 1 bloc seul`,
      bitcoinUnsupported: "Votre navigateur ne prend pas en charge l'API Web Crypto nécessaire pour cette démo.",
    },
    stats: {
      years_coding: "Années de code",
      systems_delivered: "Systèmes livrés",
      languages: "Langages",
      github_public_repos: "Dépôts publics",
      github_followers: "Abonnés GitHub",
      uptime_seconds: "Uptime (s)",
      error: "Impossible de charger les statistiques pour le moment.",
    },
    timeline: {
      loading: "Chargement de la timeline…",
      error: "Impossible de charger la timeline pour le moment.",
      empty: "Timeline en construction 🚧",
    },
    devmode: {
      loadingServer: "chargement des métriques du serveur…",
      serverError: "impossible de charger les métriques du serveur pour le moment.",
      closeHint: "Ctrl+Shift+D ou Échap pour fermer",
    },
    easter: {
      ls: "resume.pdf  reves.txt  cafe.exe  bugs_que_je_ne_corrigerai_pas.md",
      pwd: "/home/visiteur/faisant-semblant-de-connaitre-linux",
      whoami: "toi. évidemment. (vérifié deux fois, au cas où)",
      sudo: "bien tenté — ce terminal n'a pas de root, juste de l'ambiance.",
      reboot: "redémarrage... je plaisante, je suis un composant React, pas un kernel.",
      rm: "permission refusée. j'aime bien ce filesystem, merci.",
      cat: "cat : fichier introuvable (il n'y a jamais eu de chat ici, juste de l'art ASCII)",
      matrix: "il n'y a pas de cuillère. il y a, en revanche, un CV.",
      sl: "🚂 tchou-tchou — tu voulais dire 'ls', non ?",
      exit: "on ne quitte pas une simulation. essaie 'clear'.",
      vi: ":wq (je plaisante, il n'y a rien à sauvegarder ici)",
      man: "pas de manuel pour la vie. essaie 'help'.",
    },
  },
};
