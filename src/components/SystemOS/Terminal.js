import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useTerminalAI from "./useTerminalAI";
import { detectLocale, t } from "./i18n";
import "./Terminal.css";

// Terminal interativo da seção /system (Web OS).
// Sempre em inglês (chrome/mensagens do sistema/comandos reais) — é a simulação de um
// terminal real. Conteúdo (about/skills/projects/experience/timeline/contact) vem de
// public/portfolio_context.json, campo `.en` (arquivo é multilíngue; o terminal só lê `.en`).
// Whitelist fixa de comandos — nenhuma execução arbitrária de comando/SQL/código.
// `ask <question>` é o único comando que fala com a rede, via useTerminalAI.
//
// Exceção de idioma: os comandos "easter egg" (ls, pwd, whoami, sudo, reboot, rm, cat,
// matrix, sl, exit, vi/vim, man) são piadas que respondem no idioma detectado do navegador
// (pt-br/en/es/fr via i18n.js) — não aparecem em `help` (são segredos, como num terminal real).

const EASTER_EGG_COMMANDS = {
  ls: "ls",
  pwd: "pwd",
  whoami: "whoami",
  sudo: "sudo",
  reboot: "reboot",
  rm: "rm",
  cat: "cat",
  matrix: "matrix",
  sl: "sl",
  exit: "exit",
  vi: "vi",
  vim: "vi",
  man: "man",
};

const DEFAULT_CONTEXT = {
  name: "Rodolfo Romão",
  title: "Software Engineer",
  roles: [],
  skills: [],
  projects: [],
  experience: [],
  timeline: [],
  contact: { github: "", linkedin: "", email: "" },
};

const COMMANDS_HELP = [
  { cmd: "help", desc: "list all available commands" },
  { cmd: "about", desc: "about me" },
  { cmd: "skills", desc: "technical skills" },
  { cmd: "projects", desc: "featured projects" },
  { cmd: "experience", desc: "professional experience" },
  { cmd: "timeline", desc: "career timeline" },
  { cmd: "contact", desc: "contact info" },
  { cmd: "github", desc: "github link" },
  { cmd: "ask <question>", desc: "ask the terminal AI" },
  { cmd: "clear", desc: "clear terminal history" },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeTerminalContext(data) {
  const en = data && typeof data.en === "object" && data.en !== null ? data.en : {};
  const contactSource =
    data && typeof data.contact === "object" && data.contact !== null ? data.contact : {};

  return {
    name:
      data && typeof data.name === "string" && data.name.trim()
        ? data.name
        : DEFAULT_CONTEXT.name,
    title:
      typeof en.title === "string" && en.title.trim() ? en.title : DEFAULT_CONTEXT.title,
    roles: safeArray(en.roles).filter((role) => typeof role === "string"),
    skills: safeArray(en.skills).filter((skill) => typeof skill === "string"),
    projects: safeArray(en.projects).filter((p) => p && typeof p === "object"),
    experience: safeArray(en.experience).filter((e) => e && typeof e === "object"),
    timeline: safeArray(en.timeline).filter((t) => t && typeof t === "object"),
    contact: {
      github: typeof contactSource.github === "string" ? contactSource.github : "",
      linkedin: typeof contactSource.linkedin === "string" ? contactSource.linkedin : "",
      email: typeof contactSource.email === "string" ? contactSource.email : "",
    },
  };
}

function formatHelp() {
  const widest = COMMANDS_HELP.reduce((max, item) => Math.max(max, item.cmd.length), 0);
  return COMMANDS_HELP.map(({ cmd, desc }) => `${cmd.padEnd(widest + 2)}${desc}`);
}

function formatAbout(context) {
  const roles = context.roles.length ? context.roles.join(", ") : "no roles listed yet";
  return [`${context.name} — ${context.title}`, `Focus: ${roles}`];
}

function formatSkills(context) {
  if (!context.skills.length) {
    return ["No skills listed yet."];
  }
  return context.skills.map((skill) => `- ${skill}`);
}

function formatProjects(context) {
  if (!context.projects.length) {
    return ["No projects listed yet."];
  }
  const lines = [];
  context.projects.forEach((project, index) => {
    const name = project.name || "(unnamed)";
    const description = project.description || "";
    lines.push(`${index + 1}. ${name}${description ? ` — ${description}` : ""}`);
    if (Array.isArray(project.tech) && project.tech.length) {
      lines.push(`   tech: ${project.tech.join(", ")}`);
    }
    if (project.link) {
      lines.push(`   link: ${project.link}`);
    }
  });
  return lines;
}

function formatExperience(context) {
  if (!context.experience.length) {
    return ["No experience listed yet."];
  }
  const lines = [];
  context.experience.forEach((exp) => {
    const role = exp.role || "(role n/a)";
    const company = exp.company || "(company n/a)";
    const period = exp.period ? ` (${exp.period})` : "";
    lines.push(`${role} — ${company}${period}`);
    if (exp.description) {
      lines.push(`   ${exp.description}`);
    }
  });
  return lines;
}

function formatTimeline(context) {
  if (!context.timeline.length) {
    return ["No timeline events yet."];
  }
  const lines = [];
  context.timeline.forEach((event) => {
    const year = event.year || "----";
    const title = event.title || "(untitled)";
    lines.push(`${year} — ${title}`);
    if (event.description) {
      lines.push(`   ${event.description}`);
    }
    if (Array.isArray(event.tags) && event.tags.length) {
      lines.push(`   tags: ${event.tags.join(", ")}`);
    }
  });
  return lines;
}

function formatContact(context) {
  const { contact } = context;
  return [
    `github: ${contact.github || "n/a"}`,
    `linkedin: ${contact.linkedin || "n/a"}`,
    `email: ${contact.email || "n/a"}`,
  ];
}

function runCommand(command, context) {
  switch (command) {
    case "help":
      return formatHelp();
    case "about":
      return formatAbout(context);
    case "skills":
      return formatSkills(context);
    case "projects":
      return formatProjects(context);
    case "experience":
      return formatExperience(context);
    case "timeline":
      return formatTimeline(context);
    case "contact":
      return formatContact(context);
    case "github":
      return [context.contact.github || "n/a"];
    default:
      return ["command not found, type help"];
  }
}

let historyIdSeq = 0;
function nextHistoryId() {
  historyIdSeq += 1;
  return historyIdSeq;
}

function Terminal() {
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [history, setHistory] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const { ask, loading } = useTerminalAI();
  const locale = useMemo(() => detectLocale(), []);

  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/portfolio_context.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`unexpected status ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setContext(mergeTerminalContext(data));
        }
      })
      .catch(() => {
        // Fetch falhou ou JSON inválido: mantém defaults, terminal segue funcional.
        if (!cancelled) {
          setContext(DEFAULT_CONTEXT);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [history]);

  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const pushEntry = useCallback((entry) => {
    setHistory((prev) => [...prev, { id: nextHistoryId(), ...entry }]);
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (loading) {
        return;
      }

      const raw = inputValue;
      const trimmed = raw.trim();
      setInputValue("");

      if (!trimmed) {
        return;
      }

      const firstWord = trimmed.split(/\s+/)[0];
      const command = firstWord.toLowerCase();

      if (command === "clear") {
        setHistory([]);
        return;
      }

      pushEntry({ type: "input", lines: [trimmed] });

      const easterKey = EASTER_EGG_COMMANDS[command];
      if (easterKey) {
        pushEntry({ type: "output", lines: [t(locale, `easter.${easterKey}`)] });
        return;
      }

      if (command === "ask") {
        const question = trimmed.slice(firstWord.length).trim();

        if (!question) {
          pushEntry({ type: "output", lines: ["usage: ask <your question>"] });
          return;
        }

        pushEntry({ type: "system", lines: ["querying AI..."] });

        try {
          const result = await ask(question);
          pushEntry({
            type: result.ok ? "ai" : "error",
            lines: [result.reply],
          });
        } catch (error) {
          // Segurança extra: mesmo que useTerminalAI já trate erros internamente,
          // o terminal nunca pode quebrar por causa do comando `ask`.
          pushEntry({
            type: "error",
            lines: ["AI unavailable right now, please try again later."],
          });
        }
        return;
      }

      const outputLines = runCommand(command, context);
      pushEntry({ type: "output", lines: outputLines });
    },
    [ask, context, inputValue, loading, locale, pushEntry]
  );

  return (
    <div className="terminal-window" onClick={focusInput}>
      <div className="terminal-header">
        <span className="terminal-dot terminal-dot-red" aria-hidden="true" />
        <span className="terminal-dot terminal-dot-yellow" aria-hidden="true" />
        <span className="terminal-dot terminal-dot-green" aria-hidden="true" />
        <span className="terminal-header-title">visitor@rodolfo-system-os: ~</span>
      </div>

      <div className="terminal-body" ref={bodyRef}>
        <div className="terminal-line terminal-line-system">
          Welcome. Type <span className="terminal-highlight">help</span> to see the available
          commands.
        </div>

        {history.map((entry) => (
          <div key={entry.id} className={`terminal-block terminal-block-${entry.type}`}>
            {entry.type === "input" ? (
              <div className="terminal-line terminal-line-input">
                <span className="terminal-prompt">visitor@rodolfo:~$</span>
                {entry.lines[0]}
              </div>
            ) : (
              entry.lines.map((line, idx) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className="terminal-line terminal-line-output"
                >
                  {line}
                </div>
              ))
            )}
          </div>
        ))}

        <form className="terminal-input-row" onSubmit={handleSubmit}>
          <span className="terminal-prompt">visitor@rodolfo:~$</span>
          <input
            ref={inputRef}
            className="terminal-input"
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-label="terminal-input"
          />
          <span className="terminal-cursor" aria-hidden="true" />
        </form>
      </div>
    </div>
  );
}

export default Terminal;
