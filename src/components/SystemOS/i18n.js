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
      heading: "Explore this project",
      subheading: "Two demos running 100% in your browser right now — no network call, no backend.",
      cpfTitle: "CPF Validator",
      cpfHint: "Mod-11 check digit, validated on every keystroke",
      cpfPlaceholder: "Type a CPF",
      cnpjTitle: "CNPJ Validator",
      cnpjHint: "Same algorithm, applied to businesses",
      cnpjPlaceholder: "Type a CNPJ",
      statusIdle: "waiting for input…",
      statusTyping: (n, max) => `${n}/${max} digits`,
      statusValid: "✓ valid",
      statusInvalid: "✗ invalid",
      platformsHeading: "Platforms",
      worksHeading: "Selected Works",
      websiteLabel: "Website",
      githubLabel: "GitHub",
      viewFullMenu: "See the full project menu",
    },
    challenge: {
      title: "Challenge my code",
      intro:
        "The validators below run the official mod-11 check-digit algorithm for CPF and CNPJ — no shortcuts. Try typing something that tricks them into passing as valid without being a real, well-formed document. Spoiler: math doesn't negotiate — but I'm genuinely curious if you find a way.",
      note: "Everything runs in your browser. Nothing is sent to any server — attempts stay only in your localStorage.",
      cpfCardTitle: "Break the CPF validator",
      cpfCardDescription: "Type a CPF that isn't real (or even one that is) and see if the check digit accepts it.",
      cpfPlaceholder: "e.g.: 123.456.789-09",
      cpfHint: "Only digits matter for the calculation — dots and dashes are ignored.",
      cnpjCardTitle: "Break the CNPJ validator",
      cnpjCardDescription: "Same challenge, now with both CNPJ check digits.",
      cnpjPlaceholder: "e.g.: 12.345.678/0001-95",
      cnpjHint: "Free format — the validator extracts only the digits before calculating.",
      formLabel: (docNoun) => `Your challenging ${docNoun}`,
      testBtn: "test",
      clearBtn: "clear",
      passFeedback: "✅ passed! (rare — let me know how!)",
      failFeedback: "❌ invalid, try another",
      attemptsLabel: "attempts recorded on this browser:",
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
      heading: "Explore este projeto",
      subheading: "Duas demos rodando 100% no seu navegador agora — sem chamada de rede, sem backend.",
      cpfTitle: "Validador de CPF",
      cpfHint: "Dígito verificador mod-11, validado a cada tecla",
      cpfPlaceholder: "Digite um CPF",
      cnpjTitle: "Validador de CNPJ",
      cnpjHint: "Mesmo algoritmo, aplicado a pessoa jurídica",
      cnpjPlaceholder: "Digite um CNPJ",
      statusIdle: "aguardando entrada…",
      statusTyping: (n, max) => `${n}/${max} dígitos`,
      statusValid: "✓ válido",
      statusInvalid: "✗ inválido",
      platformsHeading: "Plataformas",
      worksHeading: "Maiores Trabalhos",
      websiteLabel: "Site",
      githubLabel: "GitHub",
      viewFullMenu: "Ver o menu completo de projetos",
    },
    challenge: {
      title: "Desafie meu código",
      intro:
        "Os validadores abaixo rodam o algoritmo oficial de dígito verificador (mod-11) de CPF e CNPJ, sem gambiarra. Tente digitar algo que engane e passe como válido sem ser um documento real e bem-formado. Spoiler: matemática não negocia — mas fico genuinamente curioso se você achar um jeito.",
      note: "Tudo roda no seu navegador. Nada é enviado pra nenhum servidor — as tentativas ficam só no seu localStorage.",
      cpfCardTitle: "Quebre o validador de CPF",
      cpfCardDescription: "Digite um CPF que não seja real (ou até seja) e veja se o dígito verificador aceita.",
      cpfPlaceholder: "ex: 123.456.789-09",
      cpfHint: "Só números importam pro cálculo — pontos e traço não fazem diferença.",
      cnpjCardTitle: "Quebre o validador de CNPJ",
      cnpjCardDescription: "Mesmo desafio, agora com os dois dígitos verificadores do CNPJ.",
      cnpjPlaceholder: "ex: 12.345.678/0001-95",
      cnpjHint: "Formato livre — o validador extrai só os dígitos antes de calcular.",
      formLabel: (docNoun) => `Seu ${docNoun} desafiador`,
      testBtn: "testar",
      clearBtn: "limpar",
      passFeedback: "✅ passou! (raro — me avisa como!)",
      failFeedback: "❌ inválido, tente outro",
      attemptsLabel: "tentativas registradas neste navegador:",
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
      heading: "Explora este proyecto",
      subheading: "Dos demos corriendo 100% en tu navegador ahora — sin llamada de red, sin backend.",
      cpfTitle: "Validador de CPF",
      cpfHint: "Dígito verificador mod-11, validado en cada tecla",
      cpfPlaceholder: "Escribe un CPF",
      cnpjTitle: "Validador de CNPJ",
      cnpjHint: "Mismo algoritmo, aplicado a personas jurídicas",
      cnpjPlaceholder: "Escribe un CNPJ",
      statusIdle: "esperando entrada…",
      statusTyping: (n, max) => `${n}/${max} dígitos`,
      statusValid: "✓ válido",
      statusInvalid: "✗ inválido",
      platformsHeading: "Plataformas",
      worksHeading: "Trabajos Destacados",
      websiteLabel: "Sitio",
      githubLabel: "GitHub",
      viewFullMenu: "Ver el menú completo de proyectos",
    },
    challenge: {
      title: "Desafía mi código",
      intro:
        "Los validadores de abajo ejecutan el algoritmo oficial de dígito verificador (mod-11) de CPF y CNPJ, sin trucos. Intenta escribir algo que los engañe y pase como válido sin ser un documento real y bien formado. Spoiler: las matemáticas no negocian — pero tengo curiosidad genuina si encuentras la forma.",
      note: "Todo corre en tu navegador. Nada se envía a ningún servidor — los intentos quedan solo en tu localStorage.",
      cpfCardTitle: "Rompe el validador de CPF",
      cpfCardDescription: "Escribe un CPF que no sea real (o incluso que lo sea) y mira si el dígito verificador lo acepta.",
      cpfPlaceholder: "ej: 123.456.789-09",
      cpfHint: "Solo los dígitos importan para el cálculo — puntos y guion no afectan.",
      cnpjCardTitle: "Rompe el validador de CNPJ",
      cnpjCardDescription: "Mismo desafío, ahora con los dos dígitos verificadores del CNPJ.",
      cnpjPlaceholder: "ej: 12.345.678/0001-95",
      cnpjHint: "Formato libre — el validador extrae solo los dígitos antes de calcular.",
      formLabel: (docNoun) => `Tu ${docNoun} desafiante`,
      testBtn: "probar",
      clearBtn: "limpiar",
      passFeedback: "✅ ¡pasó! (raro — ¡avísame cómo!)",
      failFeedback: "❌ inválido, prueba otro",
      attemptsLabel: "intentos registrados en este navegador:",
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
      heading: "Explorez ce projet",
      subheading: "Deux démos tournant à 100% dans votre navigateur maintenant — sans appel réseau, sans backend.",
      cpfTitle: "Validateur de CPF",
      cpfHint: "Clé de contrôle mod-11, validée à chaque frappe",
      cpfPlaceholder: "Entrez un CPF",
      cnpjTitle: "Validateur de CNPJ",
      cnpjHint: "Même algorithme, appliqué aux entreprises",
      cnpjPlaceholder: "Entrez un CNPJ",
      statusIdle: "en attente de saisie…",
      statusTyping: (n, max) => `${n}/${max} chiffres`,
      statusValid: "✓ valide",
      statusInvalid: "✗ invalide",
      platformsHeading: "Plateformes",
      worksHeading: "Travaux Marquants",
      websiteLabel: "Site",
      githubLabel: "GitHub",
      viewFullMenu: "Voir le menu complet des projets",
    },
    challenge: {
      title: "Défiez mon code",
      intro:
        "Les validateurs ci-dessous exécutent l'algorithme officiel de clé de contrôle (mod-11) du CPF et du CNPJ, sans triche. Essayez de saisir quelque chose qui les trompe et passe pour valide sans être un document réel et bien formé. Spoiler : les maths ne négocient pas — mais je suis vraiment curieux si vous trouvez un moyen.",
      note: "Tout s'exécute dans votre navigateur. Rien n'est envoyé à un serveur — les tentatives restent uniquement dans votre localStorage.",
      cpfCardTitle: "Cassez le validateur de CPF",
      cpfCardDescription: "Entrez un CPF qui n'est pas réel (ou qui l'est) et voyez si la clé de contrôle l'accepte.",
      cpfPlaceholder: "ex : 123.456.789-09",
      cpfHint: "Seuls les chiffres comptent pour le calcul — points et tirets sont ignorés.",
      cnpjCardTitle: "Cassez le validateur de CNPJ",
      cnpjCardDescription: "Même défi, avec les deux clés de contrôle du CNPJ cette fois.",
      cnpjPlaceholder: "ex : 12.345.678/0001-95",
      cnpjHint: "Format libre — le validateur n'extrait que les chiffres avant de calculer.",
      formLabel: (docNoun) => `Votre ${docNoun} qui défie`,
      testBtn: "tester",
      clearBtn: "effacer",
      passFeedback: "✅ réussi ! (rare — dites-moi comment !)",
      failFeedback: "❌ invalide, essayez un autre",
      attemptsLabel: "tentatives enregistrées sur ce navigateur :",
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
