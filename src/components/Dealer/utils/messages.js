export function formatMessageDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const TIME_PREFIX = /^\[(\d{2}:\d{2}:\d{2})\]\s*(.*)$/s;
const ISO_PREFIX = /^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]\s*(.*)$/s;

function timeToday(h, m, s, extraMs = 0) {
  const now = new Date();
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    s,
    extraMs,
  );
  return d.getTime();
}

export function parseMessageEntry(raw, options = {}) {
  const { order = 0 } = options;
  const str = typeof raw === 'string' ? raw : JSON.stringify(raw);

  if (typeof raw === 'object' && raw !== null && raw.ts) {
    const ts = typeof raw.ts === 'number' ? raw.ts : new Date(raw.ts).getTime();
    return {
      id: `ws-${ts}-${order}`,
      text: raw.text || str,
      sortTs: ts + order,
      displayTime: formatMessageDateTime(new Date(ts)),
    };
  }

  const isoMatch = str.match(ISO_PREFIX);
  if (isoMatch) {
    const [, iso, text] = isoMatch;
    const ts = new Date(iso).getTime();
    return {
      id: `iso-${ts}-${order}`,
      text: text || str,
      sortTs: Number.isNaN(ts) ? Date.now() + order : ts + order,
      displayTime: formatMessageDateTime(new Date(iso)),
    };
  }

  const timeMatch = str.match(TIME_PREFIX);
  if (timeMatch) {
    const [, time, text] = timeMatch;
    const [h, m, s] = time.split(':').map(Number);
    const sortTs = timeToday(h, m, s, order);
    const displayDate = new Date(sortTs);
    return {
      id: `t-${sortTs}-${order}`,
      text: text || str,
      sortTs,
      displayTime: formatMessageDateTime(displayDate),
    };
  }

  const now = Date.now();
  return {
    id: `raw-${now}-${order}`,
    text: str,
    sortTs: now + order,
    displayTime: formatMessageDateTime(now),
  };
}

/** Mescla mensagens do backend e do WS; mais recente primeiro. */
export function buildMessageFeed(stateMessages = [], wsMessages = [], limit = 80) {
  const entries = [];

  stateMessages.forEach((m, i) => {
    entries.push(parseMessageEntry(m, { order: i }));
  });

  wsMessages.forEach((m, i) => {
    entries.push(parseMessageEntry(m, { order: i + 10000 }));
  });

  return entries
    .sort((a, b) => b.sortTs - a.sortTs)
    .slice(0, limit);
}
