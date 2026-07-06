import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isValidCPF, isValidCNPJ } from "./validators";
import { detectLocale, t } from "./i18n";
import "./ChallengeArena.css";

// "Desafie meu código" — seção de code-battle para /system.
// Dois cartões: o visitante tenta digitar um CPF/CNPJ que `isValidCPF`/`isValidCNPJ`
// aceite incorretamente como válido sem ser um documento real/bem-formado. Como o
// algoritmo é um mod-11 correto, isso nunca deveria acontecer — é exatamente o ponto:
// demonstrar que o validador é robusto, de forma divertida e sem ser piegas.
//
// 100% client-side: sem chamada de rede, sem dependência de backend, sem log
// server-side. O contador de tentativas fica só no localStorage do navegador do
// visitante. Se localStorage estiver indisponível o componente cai pra estado em
// memória (o próprio state do React) e nunca quebra — toda leitura/escrita é
// protegida por try/catch. Textos vêm do dicionário i18n (pt-br/en/es/fr).

function safeStorageGetCount(key, fallback) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  } catch (err) {
    return fallback;
  }
}

function safeStorageSetCount(key, value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, String(value));
  } catch (err) {
    // localStorage indisponível (privado/bloqueado/cheio) — segue só em memória (state do React).
  }
}

function ChallengeCard({
  title,
  description,
  docNoun,
  validator,
  storageKey,
  placeholder,
  hint,
  locale,
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null); // null (sem tentativa ainda) | true | false
  const [attempts, setAttempts] = useState(() => safeStorageGetCount(storageKey, 0));
  const [round, setRound] = useState(0); // incrementa a cada submit, força a animação de feedback a rodar de novo

  function handleChange(event) {
    const next = event.target.value;
    setValue(next);
    // feedback ao vivo enquanto digita, mas a tentativa só conta ao enviar
    if (next.trim() === "") {
      setResult(null);
    } else {
      setResult(validator(next));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (value.trim() === "") return;

    const passed = validator(value);
    setResult(passed);
    setRound((prev) => prev + 1);
    setAttempts((prev) => {
      const next = prev + 1;
      safeStorageSetCount(storageKey, next);
      return next;
    });
  }

  function handleClear() {
    setValue("");
    setResult(null);
  }

  const feedback =
    result === null ? null : result ? (
      <span className="challenge-feedback challenge-feedback-pass">
        {t(locale, "challenge.passFeedback")}
      </span>
    ) : (
      <span className="challenge-feedback challenge-feedback-fail">
        {t(locale, "challenge.failFeedback")}
      </span>
    );

  return (
    <div className="challenge-card">
      <h3 className="challenge-card-title">{title}</h3>
      <p className="challenge-card-description">{description}</p>

      <form className="challenge-form" onSubmit={handleSubmit}>
        <label className="challenge-form-label" htmlFor={`challenge-input-${storageKey}`}>
          {t(locale, "challenge.formLabel")(docNoun)}
        </label>
        <div className="challenge-form-row">
          <input
            id={`challenge-input-${storageKey}`}
            type="text"
            className="challenge-input"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck="false"
            inputMode="numeric"
          />
          <button type="submit" className="challenge-submit-btn">
            {t(locale, "challenge.testBtn")}
          </button>
        </div>
        {hint && <p className="challenge-hint">{hint}</p>}
      </form>

      <div className="challenge-feedback-row" aria-live="polite">
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={`${round}-${result}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>
        {value.trim() !== "" && (
          <button type="button" className="challenge-clear-btn" onClick={handleClear}>
            {t(locale, "challenge.clearBtn")}
          </button>
        )}
      </div>

      <p className="challenge-attempts">
        {t(locale, "challenge.attemptsLabel")}{" "}
        <span className="challenge-attempts-count">{attempts}</span>
      </p>
    </div>
  );
}

function ChallengeArena() {
  const locale = useMemo(() => detectLocale(), []);

  return (
    <section className="challenge-arena" aria-label="Challenge my code">
      <header className="challenge-arena-header">
        <h2 className="challenge-arena-title">{t(locale, "challenge.title")}</h2>
        <p className="challenge-arena-intro">{t(locale, "challenge.intro")}</p>
        <p className="challenge-arena-note">{t(locale, "challenge.note")}</p>
      </header>

      <div className="challenge-arena-grid">
        <ChallengeCard
          title={t(locale, "challenge.cpfCardTitle")}
          description={t(locale, "challenge.cpfCardDescription")}
          docNoun="CPF"
          validator={isValidCPF}
          storageKey="system_os_cpf_challenge_attempts"
          placeholder={t(locale, "challenge.cpfPlaceholder")}
          hint={t(locale, "challenge.cpfHint")}
          locale={locale}
        />
        <ChallengeCard
          title={t(locale, "challenge.cnpjCardTitle")}
          description={t(locale, "challenge.cnpjCardDescription")}
          docNoun="CNPJ"
          validator={isValidCNPJ}
          storageKey="system_os_cnpj_challenge_attempts"
          placeholder={t(locale, "challenge.cnpjPlaceholder")}
          hint={t(locale, "challenge.cnpjHint")}
          locale={locale}
        />
      </div>
    </section>
  );
}

export default ChallengeArena;
