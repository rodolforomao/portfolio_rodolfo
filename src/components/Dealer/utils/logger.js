const PREFIX = '[DealerAMM]';

function ts() {
  return new Date().toISOString();
}

// Função registrada pelo DealerConsole para enviar erros ao buffer do manager.
// Deve retornar a Promise do sendCommand (ou null) para rastrear in-flight.
let _pushLog = null;
let _pushingLog = false;  // bloqueia recursão síncrona
let _inFlightPushes = 0; // bloqueia recursão assíncrona (push anterior ainda não resolveu)

export function registerPushLog(fn) {
  _pushLog = fn;
}

function maybePush(level, message, detail = null) {
  if (!_pushLog || _pushingLog || _inFlightPushes > 0) return;
  if (level !== 'error' && level !== 'critical') return;
  _pushingLog = true;
  try {
    const p = _pushLog({ level, source: 'frontend', message: String(message), detail });
    if (p && typeof p.finally === 'function') {
      _inFlightPushes++;
      p.finally(() => { _inFlightPushes--; });
    }
  } catch {
    // silencioso
  } finally {
    _pushingLog = false;
  }
}

export const log = {
  info: (...args) => console.info(PREFIX, ts(), ...args),
  warn: (...args) => console.warn(PREFIX, ts(), ...args),

  error: (...args) => {
    console.error(PREFIX, ts(), ...args);
    const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    const detail = args.find((a) => a instanceof Error)?.stack || null;
    maybePush('error', msg, detail);
  },

  debug: (...args) => console.debug(PREFIX, ts(), ...args),

  group: (label, fn) => {
    console.groupCollapsed(`${PREFIX} ${label}`);
    try { fn(); } finally { console.groupEnd(); }
  },
};
