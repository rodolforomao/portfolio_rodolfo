import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { detectLocale, t } from "./i18n";
import "./ChallengeArena.css";

// "Desafie meu código" — seção de code-battle para /system.
// Dois joguinhos algorítmicos, 100% client-side (sem chamada de rede, sem backend):
//
// 1) Pedra-papel-tesoura contra um bot adaptativo: o bot mantém uma cadeia de Markov de
//    ordem 1 (o que o visitante costuma jogar depois de cada lance) e joga o counter da
//    previsão. Não é aleatório — o visitante precisa ser genuinamente imprevisível pra vencer.
// 2) Caça-colisão de hash: função hash propositalmente ingênua (soma dos códigos ASCII,
//    módulo 997) — o visitante tenta achar duas strings diferentes com o mesmo hash. É
//    fácil de propósito: o ponto é mostrar, na prática, por que hash de verdade precisa
//    misturar bits (efeito avalanche) em vez de só somar.
//
// Placar/tentativas ficam só no localStorage do navegador do visitante; leitura/escrita
// protegidas por try/catch — se localStorage estiver indisponível, cai pro state do React
// em memória e nunca quebra. Textos vêm do dicionário i18n (pt-br/en/es/fr).

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

function safeStorageGetJSON(key, fallback) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback;
  } catch (err) {
    return fallback;
  }
}

function safeStorageSetJSON(key, value) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // idem — cai pro state em memória.
  }
}

// ---------------------------------------------------------------------------------
// Pedra, papel, tesoura vs. bot adaptativo
// ---------------------------------------------------------------------------------

const MOVES = ["rock", "paper", "scissors"];
const MOVE_EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" }; // chave vence valor
const COUNTER = { rock: "paper", paper: "scissors", scissors: "rock" }; // joga isso pra vencer a chave

const RPS_SCORE_KEY = "system_os_rps_challenge_score";
const RPS_SCORE_DEFAULT = { wins: 0, losses: 0, draws: 0 };

function randomMove() {
  return MOVES[Math.floor(Math.random() * MOVES.length)];
}

function judge(userMove, botMove) {
  if (userMove === botMove) return "draw";
  return BEATS[userMove] === botMove ? "user" : "bot";
}

function RockPaperScissorsCard({ locale }) {
  const [score, setScore] = useState(() => safeStorageGetJSON(RPS_SCORE_KEY, RPS_SCORE_DEFAULT));
  const [round, setRound] = useState(null); // { user, bot, outcome } | null
  const [roundKey, setRoundKey] = useState(0);
  const lastUserMoveRef = useRef(null);
  const transitionsRef = useRef({}); // { [prevMove]: { rock, paper, scissors } }

  function play(userMove) {
    const lastMove = lastUserMoveRef.current;
    let botMove;
    if (lastMove && transitionsRef.current[lastMove]) {
      const counts = transitionsRef.current[lastMove];
      const predicted = MOVES.reduce(
        (best, m) => (counts[m] > counts[best] ? m : best),
        MOVES[0]
      );
      botMove = counts[predicted] > 0 ? COUNTER[predicted] : randomMove();
    } else {
      botMove = randomMove();
    }

    const outcome = judge(userMove, botMove);

    if (lastMove) {
      const bucket = transitionsRef.current[lastMove] || { rock: 0, paper: 0, scissors: 0 };
      bucket[userMove] += 1;
      transitionsRef.current[lastMove] = bucket;
    }
    lastUserMoveRef.current = userMove;

    setRound({ user: userMove, bot: botMove, outcome });
    setRoundKey((prev) => prev + 1);
    setScore((prev) => {
      const next = {
        wins: prev.wins + (outcome === "user" ? 1 : 0),
        losses: prev.losses + (outcome === "bot" ? 1 : 0),
        draws: prev.draws + (outcome === "draw" ? 1 : 0),
      };
      safeStorageSetJSON(RPS_SCORE_KEY, next);
      return next;
    });
  }

  function handleReset() {
    transitionsRef.current = {};
    lastUserMoveRef.current = null;
    setRound(null);
    setScore(RPS_SCORE_DEFAULT);
    safeStorageSetJSON(RPS_SCORE_KEY, RPS_SCORE_DEFAULT);
  }

  const outcomeKey =
    round &&
    (round.outcome === "user"
      ? "challenge.rpsWin"
      : round.outcome === "bot"
      ? "challenge.rpsLose"
      : "challenge.rpsDraw");

  const outcomeClass =
    round &&
    (round.outcome === "user"
      ? "challenge-feedback-pass"
      : round.outcome === "bot"
      ? "challenge-feedback-fail"
      : "challenge-feedback-neutral");

  return (
    <div className="challenge-card">
      <h3 className="challenge-card-title">{t(locale, "challenge.rpsCardTitle")}</h3>
      <p className="challenge-card-description">{t(locale, "challenge.rpsCardDescription")}</p>

      <div className="challenge-rps-buttons">
        {MOVES.map((move) => (
          <button
            key={move}
            type="button"
            className="challenge-rps-btn"
            onClick={() => play(move)}
          >
            <span aria-hidden="true">{MOVE_EMOJI[move]}</span>
            <span className="challenge-rps-btn-label">{t(locale, `challenge.${move}Label`)}</span>
          </button>
        ))}
      </div>

      <p className="challenge-hint">{t(locale, "challenge.rpsHint")}</p>

      <div className="challenge-feedback-row" aria-live="polite">
        <AnimatePresence mode="wait">
          {round && (
            <motion.div
              key={roundKey}
              className="challenge-rps-round"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <span className="challenge-rps-round-moves">
                {MOVE_EMOJI[round.user]} <span className="challenge-rps-vs">×</span>{" "}
                {MOVE_EMOJI[round.bot]}
              </span>
              <span className={`challenge-feedback ${outcomeClass}`}>{t(locale, outcomeKey)}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="challenge-attempts challenge-score-row">
        <span>
          {t(locale, "challenge.rpsScoreLabel")}{" "}
          <span className="challenge-attempts-count">
            {score.wins} / {score.losses} / {score.draws}
          </span>
        </span>
        <button type="button" className="challenge-clear-btn" onClick={handleReset}>
          {t(locale, "challenge.rpsResetBtn")}
        </button>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Caça-colisão de hash
// ---------------------------------------------------------------------------------

const HASH_MOD = 997;
const HASH_COLLISIONS_KEY = "system_os_hash_challenge_collisions";

function naiveHash(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i += 1) {
    sum += str.charCodeAt(i);
  }
  return sum % HASH_MOD;
}

function HashCollisionCard({ locale }) {
  const [valueA, setValueA] = useState("");
  const [valueB, setValueB] = useState("");
  const [collisions, setCollisions] = useState(() =>
    safeStorageGetCount(HASH_COLLISIONS_KEY, 0)
  );
  const wasCollisionRef = useRef(false);

  const trimmedA = valueA.trim();
  const trimmedB = valueB.trim();
  const hashA = trimmedA ? naiveHash(trimmedA) : null;
  const hashB = trimmedB ? naiveHash(trimmedB) : null;
  const sameInput = Boolean(trimmedA) && trimmedA === trimmedB;
  const isCollision = hashA !== null && hashB !== null && hashA === hashB && !sameInput;

  useEffect(() => {
    if (isCollision && !wasCollisionRef.current) {
      wasCollisionRef.current = true;
      setCollisions((prev) => {
        const next = prev + 1;
        safeStorageSetCount(HASH_COLLISIONS_KEY, next);
        return next;
      });
    } else if (!isCollision) {
      wasCollisionRef.current = false;
    }
  }, [isCollision]);

  function handleClear() {
    setValueA("");
    setValueB("");
  }

  let feedbackKey = null;
  let feedbackClass = "challenge-feedback-fail";
  if (trimmedA && trimmedB) {
    if (sameInput) {
      feedbackKey = "challenge.hashSameInput";
      feedbackClass = "challenge-feedback-neutral";
    } else if (isCollision) {
      feedbackKey = "challenge.hashCollisionFound";
      feedbackClass = "challenge-feedback-pass";
    } else {
      feedbackKey = "challenge.hashNoCollisionYet";
      feedbackClass = "challenge-feedback-fail";
    }
  }

  return (
    <div className="challenge-card">
      <h3 className="challenge-card-title">{t(locale, "challenge.hashCardTitle")}</h3>
      <p className="challenge-card-description">{t(locale, "challenge.hashCardDescription")}</p>

      <div className="challenge-hash-inputs">
        <div className="challenge-hash-field">
          <label className="challenge-form-label" htmlFor="challenge-hash-a">
            {t(locale, "challenge.hashInputALabel")}
          </label>
          <input
            id="challenge-hash-a"
            type="text"
            className="challenge-input"
            value={valueA}
            onChange={(event) => setValueA(event.target.value)}
            placeholder={t(locale, "challenge.hashPlaceholderA")}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="challenge-hash-value">
            {hashA === null ? "—" : t(locale, "challenge.hashOf")(hashA)}
          </span>
        </div>
        <div className="challenge-hash-field">
          <label className="challenge-form-label" htmlFor="challenge-hash-b">
            {t(locale, "challenge.hashInputBLabel")}
          </label>
          <input
            id="challenge-hash-b"
            type="text"
            className="challenge-input"
            value={valueB}
            onChange={(event) => setValueB(event.target.value)}
            placeholder={t(locale, "challenge.hashPlaceholderB")}
            autoComplete="off"
            spellCheck="false"
          />
          <span className="challenge-hash-value">
            {hashB === null ? "—" : t(locale, "challenge.hashOf")(hashB)}
          </span>
        </div>
      </div>

      <p className="challenge-hint">{t(locale, "challenge.hashHint")}</p>

      <div className="challenge-feedback-row" aria-live="polite">
        <AnimatePresence mode="wait">
          {feedbackKey && (
            <motion.div
              key={feedbackKey}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <span className={`challenge-feedback ${feedbackClass}`}>
                {t(locale, feedbackKey)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {(valueA || valueB) && (
          <button type="button" className="challenge-clear-btn" onClick={handleClear}>
            {t(locale, "challenge.clearBtn")}
          </button>
        )}
      </div>

      <p className="challenge-attempts">
        {t(locale, "challenge.hashCollisionsLabel")}{" "}
        <span className="challenge-attempts-count">{collisions}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------
// Minere contra a mainnet real do Bitcoin
// ---------------------------------------------------------------------------------
//
// Único card da seção que faz uma chamada de rede: GET /api/portfolio/btc-tip (nosso backend
// isolado, que faz proxy read-only pra mempool.space, cacheado por 10min — ver
// portfolio_api_server.py). Nenhuma chave, carteira ou transação envolvida, só o hash/altura
// públicos do bloco mais recente. A mineração em si roda 100% local via Web Crypto API
// (SHA-256d de verdade — dois SHA-256 em sequência, igual ao Bitcoin), só que numa escala
// risivelmente menor que a rede real.

const MINING_BUDGET_MS = 3000;
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

function leadingZeroBitsBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let bits = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte === 0) {
      bits += 8;
      continue;
    }
    for (let shift = 7; shift >= 0; shift -= 1) {
      if ((byte >> shift) & 1) return bits;
      bits += 1;
    }
    return bits;
  }
  return bits;
}

// Formata 2^bits como "m×10^e" sem estourar Number.MAX_VALUE pra expoentes grandes.
function formatPow2(bits) {
  if (!Number.isFinite(bits) || bits <= 0) return "1";
  const exponent = bits * Math.log10(2);
  const exp10 = Math.floor(exponent);
  const mantissa = Math.pow(10, exponent - exp10);
  return `${mantissa.toFixed(1)}×10^${exp10}`;
}

async function minePow(budgetMs) {
  const encoder = new TextEncoder();
  const salt = `system-os-${Date.now()}-${Math.random()}`;
  const start = performance.now();
  let nonce = 0;
  let bestBits = 0;
  while (performance.now() - start < budgetMs) {
    const data = encoder.encode(`${salt}:${nonce}`);
    const firstHash = await window.crypto.subtle.digest("SHA-256", data);
    const secondHash = await window.crypto.subtle.digest("SHA-256", firstHash);
    const bits = leadingZeroBitsBuffer(secondHash);
    if (bits > bestBits) bestBits = bits;
    nonce += 1;
  }
  const elapsedMs = performance.now() - start;
  return { bestBits, attempts: nonce, elapsedMs };
}

function BitcoinMiningCard({ locale }) {
  const [tip, setTip] = useState(undefined); // undefined = carregando, null = indisponível, objeto = dados
  const [mining, setMining] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portfolio/btc-tip")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setTip(data && data.tip_hash ? data : null);
      })
      .catch(() => {
        if (!cancelled) setTip(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMine() {
    if (mining) return;
    if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
      setResult({ unsupported: true });
      return;
    }
    setMining(true);
    setResult(null);
    try {
      const mined = await minePow(MINING_BUDGET_MS);
      const hashrate = Math.round(mined.attempts / (mined.elapsedMs / 1000));
      setResult({ ...mined, hashrate });
    } catch (err) {
      setResult({ unsupported: true });
    } finally {
      setMining(false);
    }
  }

  const realBits =
    tip && typeof tip.leading_zero_bits === "number" ? tip.leading_zero_bits : null;

  let comparisonNode = null;
  if (result && result.unsupported) {
    comparisonNode = (
      <span className="challenge-feedback challenge-feedback-fail">
        {t(locale, "challenge.bitcoinUnsupported")}
      </span>
    );
  } else if (result) {
    comparisonNode = (
      <div className="challenge-btc-stats">
        <p>{t(locale, "challenge.bitcoinYourBest")(result.bestBits)}</p>
        <p>{t(locale, "challenge.bitcoinHashrate")(result.hashrate.toLocaleString())}</p>
        {realBits !== null && (
          <>
            <p>{t(locale, "challenge.bitcoinRealBits")(realBits)}</p>
            <p className="challenge-btc-highlight">
              {t(locale, "challenge.bitcoinTimesHarder")(formatPow2(realBits - result.bestBits))}
            </p>
            <p className="challenge-btc-highlight">
              {t(locale, "challenge.bitcoinYearsEstimate")(
                formatPow2(realBits - Math.log2(result.hashrate * SECONDS_PER_YEAR))
              )}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="challenge-card">
      <h3 className="challenge-card-title">{t(locale, "challenge.bitcoinCardTitle")}</h3>
      <p className="challenge-card-description">{t(locale, "challenge.bitcoinCardDescription")}</p>

      <p className="challenge-btc-tip">
        {tip === undefined
          ? "…"
          : tip === null
          ? t(locale, "challenge.bitcoinTipUnavailable")
          : t(locale, "challenge.bitcoinTipLabel")(tip.tip_height)}
      </p>

      <button
        type="button"
        className="challenge-submit-btn challenge-btc-mine-btn"
        onClick={handleMine}
        disabled={mining}
      >
        {mining ? t(locale, "challenge.bitcoinMiningLabel") : t(locale, "challenge.bitcoinMineBtn")}
      </button>

      <p className="challenge-hint">{t(locale, "challenge.bitcoinHint")}</p>

      <div className="challenge-feedback-row" aria-live="polite">
        <AnimatePresence mode="wait">
          {comparisonNode && (
            <motion.div
              key={result && result.unsupported ? "unsupported" : "btc-result"}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {comparisonNode}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="challenge-hint">{t(locale, "challenge.bitcoinNote")}</p>
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
        <RockPaperScissorsCard locale={locale} />
        <HashCollisionCard locale={locale} />
        <BitcoinMiningCard locale={locale} />
      </div>
    </section>
  );
}

export default ChallengeArena;
