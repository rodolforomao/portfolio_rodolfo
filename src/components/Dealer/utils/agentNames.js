// Nomeação de agentes (manager_dealer) só no frontend — sem precisar de
// config (.env) em cada instância. Identifica a fonte pelo IP real que o
// relay observou (X-Forwarded-For/X-Real-IP, não dado enviado pelo agente)
// combinado com o hostname que o próprio agente informa — esse par é o
// "fingerprint" usado como chave. O operador atribui um nome (ex:
// "Produção-Termux", "Dev-PC") na primeira vez que vê uma fonte nova, e o
// mapeamento fica salvo no navegador.

const STORAGE_KEY = 'dealer_agent_names';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage indisponível (modo privado, quota) — nomeação vira
    // só-nesta-sessão, sem quebrar o resto da UI.
  }
}

/** Chave estável a partir do que o relay observa sobre a fonte. */
export function fingerprintOf({ ip, hostname } = {}) {
  return `${ip || '?'}|${hostname || '?'}`;
}

export function getAgentName(fingerprint) {
  if (!fingerprint) return null;
  return readMap()[fingerprint] || null;
}

export function setAgentName(fingerprint, name) {
  if (!fingerprint) return;
  const map = readMap();
  const trimmed = (name || '').trim();
  if (trimmed) {
    map[fingerprint] = trimmed;
  } else {
    delete map[fingerprint];
  }
  writeMap(map);
}

export function getAllAgentNames() {
  return readMap();
}

/** Nome pra exibir: nome dado pelo operador > IP > hostname > '?'. */
export function displayNameFor(meta) {
  if (!meta) return '?';
  const custom = getAgentName(fingerprintOf(meta));
  return custom || meta.ip || meta.hostname || '?';
}
