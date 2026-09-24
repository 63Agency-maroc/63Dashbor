/**
 * Dates meetings : API = ISO UTC (…Z). Affichage / saisie = Africa/Casablanca.
 * Évite "Invalid time value" en validant toujours le parse.
 */

export const CASABLANCA_TZ = "Africa/Casablanca";

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function getZonedParts(date: Date, timeZone: string = CASABLANCA_TZ): ZonedParts | null {
  if (Number.isNaN(date.getTime())) return null;
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) return null;
  return { year, month, day, hour, minute, second };
}

/** Affichage lisible en Casablanca. */
export function formatInCasablanca(
  iso: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const d = parseIso(iso);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: CASABLANCA_TZ, ...options }).format(d);
  } catch {
    return "—";
  }
}

/** Valeur Flatpickr "YYYY-MM-DD HH:mm" en mur Casablanca depuis ISO UTC. */
export function isoToCasablancaFlatpickr(iso: string | null | undefined): string {
  const d = parseIso(iso);
  if (!d) return "";
  const p = getZonedParts(d);
  if (!p) return "";
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Interprète "YYYY-MM-DD HH:mm" (ou "YYYY-MM-DDTHH:mm") comme heure murale Casablanca → ISO UTC.
 */
export function casablancaWallToUtcIso(wall: string): string | null {
  const cleaned = wall.trim().replace("T", " ");
  const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? 0);

  const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = wantedAsUtc;

  for (let i = 0; i < 3; i++) {
    const parts = getZonedParts(new Date(guess));
    if (!parts) return null;
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    guess += wantedAsUtc - asUtc;
  }

  const out = new Date(guess);
  if (Number.isNaN(out.getTime())) return null;
  return out.toISOString();
}

/** Ajoute des minutes à un ISO UTC (durée UI FullCalendar). */
export function addMinutesIso(iso: string, minutes: number): string | null {
  const d = parseIso(iso);
  if (!d) return null;
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

/** YYYY-MM-DD en Casablanca pour une Date (ex. dateClick FullCalendar). */
export function toCasablancaYmd(date: Date): string | null {
  const p = getZonedParts(date);
  if (!p) return null;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Jour civil actuel en Casablanca (YYYY-MM-DD). */
export function casablancaTodayYmd(): string {
  return toCasablancaYmd(new Date()) ?? "";
}

/** Ajoute N jours civils à un YYYY-MM-DD (via midi Casa pour éviter les bords). */
export function addCalendarDaysYmd(ymd: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const noon = casablancaWallToUtcIso(`${ymd} 12:00`);
  if (!noon) return null;
  const d = parseIso(noon);
  if (!d) return null;
  return toCasablancaYmd(new Date(d.getTime() + days * 86_400_000));
}

/**
 * Bornes UTC d'un jour civil Casablanca :
 * from = 00:00 Casa, to = 00:00 Casa du lendemain (fin exclusive).
 */
export function casablancaDayRangeUtc(ymd: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const from = casablancaWallToUtcIso(`${ymd} 00:00`);
  const next = addCalendarDaysYmd(ymd, 1);
  if (!from || !next) return null;
  const to = casablancaWallToUtcIso(`${next} 00:00`);
  if (!to) return null;
  return { from, to };
}
