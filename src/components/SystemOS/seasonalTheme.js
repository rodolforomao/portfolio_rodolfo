// Tema sazonal opcional para a seção /system — só datas comemorativas neutras e não
// controversas (copa do mundo, natal, ano novo, são joão). Nunca inclui temas políticos,
// partidários ou de pautas sociais controversas — é um perfil de trabalho neutro.
// Aplica só um acento de cor + um selinho discreto no Hero; não reestiliza o site inteiro.

const EXACT_RANGES = [
  {
    id: "worldcup",
    start: "2026-06-11",
    end: "2026-07-19",
    accent: "#22c55e",
    accent2: "#facc15",
    badge: {
      "pt-br": "🇧🇷 Copa do Mundo 2026",
      en: "🇧🇷 World Cup 2026",
      es: "🇧🇷 Copa del Mundo 2026",
      fr: "🇧🇷 Coupe du Monde 2026",
    },
  },
];

// [mês, dia] — recorrentes todo ano. `wraps` = true quando o intervalo cruza o fim do ano.
const RECURRING_RANGES = [
  {
    id: "saojoao",
    startMonthDay: [6, 12],
    endMonthDay: [6, 24],
    accent: "#f97316",
    accent2: "#facc15",
    badge: {
      "pt-br": "🔥 Festa de São João",
      en: "🔥 São João Festival",
      es: "🔥 Fiesta de San Juan",
      fr: "🔥 Fête de la Saint-Jean",
    },
  },
  {
    id: "christmas",
    startMonthDay: [12, 15],
    endMonthDay: [12, 26],
    accent: "#ef4444",
    accent2: "#22c55e",
    badge: {
      "pt-br": "🎄 Feliz Natal",
      en: "🎄 Merry Christmas",
      es: "🎄 Feliz Navidad",
      fr: "🎄 Joyeux Noël",
    },
  },
  {
    id: "newyear",
    startMonthDay: [12, 28],
    endMonthDay: [1, 3],
    wraps: true,
    accent: "#facc15",
    accent2: "#38bdf8",
    badge: {
      "pt-br": "🎆 Feliz Ano Novo",
      en: "🎆 Happy New Year",
      es: "🎆 Feliz Año Nuevo",
      fr: "🎆 Bonne Année",
    },
  },
];

function inMonthDayRange(month, day, [startM, startD], [endM, endD], wraps) {
  const value = month * 100 + day;
  const start = startM * 100 + startD;
  const end = endM * 100 + endD;
  if (!wraps) {
    return value >= start && value <= end;
  }
  // intervalo cruza dezembro -> janeiro (ex: 28 dez a 3 jan)
  return value >= start || value <= end;
}

export function getActiveTheme(date = new Date()) {
  try {
    const iso = date.toISOString().slice(0, 10);
    const exact = EXACT_RANGES.find((range) => iso >= range.start && iso <= range.end);
    if (exact) return exact;

    const month = date.getMonth() + 1;
    const day = date.getDate();
    const recurring = RECURRING_RANGES.find((range) =>
      inMonthDayRange(month, day, range.startMonthDay, range.endMonthDay, range.wraps)
    );
    return recurring || null;
  } catch (e) {
    return null;
  }
}
