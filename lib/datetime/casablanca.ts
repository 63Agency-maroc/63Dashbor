/**
 * Dates API = ISO UTC (…Z). Affichage / saisie = heure légale Maroc.
 *
 * Zone IANA : Africa/Casablanca (plus d’offset +1 hardcodé).
 * Depuis le 20/09/2026 02:00 (heure locale), le Maroc est en UTC+0 permanent
 * (tzdata IANA 2026c+). Si le navigateur / Node a un tzdata obsolète qui
 * laisse encore Casablanca en +01, on bascule l’affichage/conversion sur UTC
 * (équivalent légal post-transition) — sans ajouter d’heure manuellement.
 */

export const CASABLANCA_TZ = "Africa/Casablanca";

/** Instant UTC du retour Maroc → UTC+0 (02:00 local UTC+1 = 01:00Z). */
const MOROCCO_UTC0_SINCE_MS = Date.UTC(2026, 8, 20, 1, 0, 0);

let _casablancaTzdataStale: boolean | null = null;

/**
 * true si le runtime croit encore que Casablanca est UTC+1 après le 20/09/2026.
 * (tzdata < 2026c)
 */
export function isCasablancaTzdataStale(): boolean {
  if (_casablancaTzdataStale != null) return _casablancaTzdataStale;
  // 1er oct. 2026 12:00Z → doit afficher 12:00 en Casa (UTC+0). 13:00 = tzdata stale.
  const probe = new Date(Date.UTC(2026, 9, 1, 12, 0, 0));
  const p = getZonedPartsRaw(probe, CASABLANCA_TZ);
  _casablancaTzdataStale = Boolean(p && p.hour === 13);
  return _casablancaTzdataStale;
}

/** Zone effective pour un instant : Africa/Casablanca, ou UTC si tzdata stale post-transition. */
export function effectiveCasablancaTimeZone(at: Date | number = Date.now()): string {
  const ms = typeof at === "number" ? at : at.getTime();
  if (ms >= MOROCCO_UTC0_SINCE_MS && isCasablancaTzdataStale()) return "UTC";
  return CASABLANCA_TZ;
}

export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const trimmed = iso.trim();
  // ISO sans fuseau (souvent UTC côté API) → forcer Z pour éviter l’interprétation « local »
  const normalized =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(trimmed) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
      ? `${trimmed}Z`
      : trimmed;
  const d = new Date(normalized);
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

function getZonedPartsRaw(date: Date, timeZone: string): ZonedParts | null {
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

export function getZonedParts(date: Date, timeZone?: string): ZonedParts | null {
  return getZonedPartsRaw(date, timeZone ?? effectiveCasablancaTimeZone(date));
}

/** Affichage lisible en heure Maroc (Africa/Casablanca / UTC si tzdata stale). */
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
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: effectiveCasablancaTimeZone(d),
      ...options,
    }).format(d);
  } catch {
    return "—";
  }
}

/** Date + heure (ex. 25 sept. 2026, 15:16). */
export function formatDateTime(iso: string | null | undefined): string {
  return formatInCasablanca(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date seule. */
export function formatDate(iso: string | null | undefined): string {
  return formatInCasablanca(iso, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Heure seule (HH:mm). */
export function formatTime(iso: string | null | undefined): string {
  return formatInCasablanca(iso, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
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
 * Interprète "YYYY-MM-DD HH:mm" (ou "YYYY-MM-DDTHH:mm") comme heure murale Maroc → ISO UTC.
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

  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  // Post-transition + tzdata stale : murale Maroc = UTC (pas de +1 fantôme)
  if (isCasablancaTzdataStale() && wallAsUtcMs >= MOROCCO_UTC0_SINCE_MS) {
    return new Date(wallAsUtcMs).toISOString();
  }

  let guess = wallAsUtcMs;
  for (let i = 0; i < 3; i++) {
    const parts = getZonedPartsRaw(new Date(guess), CASABLANCA_TZ);
    if (!parts) return null;
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess += wallAsUtcMs - asUtc;
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
