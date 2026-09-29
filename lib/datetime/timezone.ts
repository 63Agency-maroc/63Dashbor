/**
 * Fuseaux IANA — affichage meetings au fuseau du viewer.
 * Casablanca : réutilise le fallback tzdata stale déjà en place.
 */

import {
  CASABLANCA_TZ,
  effectiveCasablancaTimeZone,
  getZonedParts,
  isCasablancaTzdataStale,
  parseIso,
} from "@/lib/datetime/casablanca";

export { CASABLANCA_TZ, parseIso };

const MOROCCO_UTC0_SINCE_MS = Date.UTC(2026, 8, 20, 1, 0, 0);

/** Défaut runtime (mis à jour par AuthProvider). */
let _defaultViewerTz = CASABLANCA_TZ;

export function setDefaultViewerTimezone(tz: string | null | undefined) {
  _defaultViewerTz = resolveIanaZone(tz);
}

export function getDefaultViewerTimezone(): string {
  return _defaultViewerTz;
}

export function isValidIanaTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Zone IANA effective (Casa → UTC si tzdata stale). */
export function resolveIanaZone(
  iana: string | null | undefined,
  at: Date | number = Date.now(),
): string {
  const raw = (iana || "").trim();
  const z = raw && isValidIanaTimeZone(raw) ? raw : CASABLANCA_TZ;
  if (z === CASABLANCA_TZ) return effectiveCasablancaTimeZone(at);
  return z;
}

export function detectBrowserTimezone(): string {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (z && isValidIanaTimeZone(z)) return z;
  } catch {
    /* ignore */
  }
  return CASABLANCA_TZ;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Libellé court pour UI (« Vietnam », « Maroc »). */
export function shortTimezoneLabel(iana: string | null | undefined): string {
  const z = (iana || "").trim() || CASABLANCA_TZ;
  const map: Record<string, string> = {
    "Africa/Casablanca": "Maroc",
    UTC: "Maroc",
    "Asia/Ho_Chi_Minh": "Vietnam",
    "Asia/Saigon": "Vietnam",
    "Europe/Paris": "France",
    "Europe/Madrid": "Espagne",
    "Europe/London": "Royaume-Uni",
    "Europe/Berlin": "Allemagne",
    "Europe/Rome": "Italie",
    "Europe/Lisbon": "Portugal",
    "Europe/Brussels": "Belgique",
    "Europe/Zurich": "Suisse",
    "Europe/Istanbul": "Turquie",
    "Africa/Cairo": "Égypte",
    "Asia/Dubai": "Émirats",
    "Asia/Riyadh": "Arabie saoudite",
    "Asia/Kolkata": "Inde",
    "Asia/Shanghai": "Chine",
    "Asia/Tokyo": "Japon",
    "America/Toronto": "Canada",
    "America/New_York": "USA (Est)",
    "America/Los_Angeles": "USA (Ouest)",
    "America/Sao_Paulo": "Brésil",
    "Australia/Sydney": "Australie",
  };
  if (map[z]) return map[z];
  const city = z.split("/").pop()?.replace(/_/g, " ");
  return city || z;
}

export function formatInTimeZone(
  iso: string | null | undefined,
  timeZone?: string | null,
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
  const tz = resolveIanaZone(timeZone ?? _defaultViewerTz, d);
  try {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: tz, ...options }).format(d);
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string | null): string {
  return formatInTimeZone(iso, timeZone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined, timeZone?: string | null): string {
  return formatInTimeZone(iso, timeZone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string | null | undefined, timeZone?: string | null): string {
  return formatInTimeZone(iso, timeZone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function getZonedPartsForTz(date: Date, timeZone?: string | null) {
  return getZonedParts(date, resolveIanaZone(timeZone ?? _defaultViewerTz, date));
}

/** "YYYY-MM-DD HH:mm" murale dans `timeZone` depuis ISO UTC. */
export function isoToWallFlatpickr(
  iso: string | null | undefined,
  timeZone?: string | null,
): string {
  const d = parseIso(iso);
  if (!d) return "";
  const p = getZonedPartsForTz(d, timeZone);
  if (!p) return "";
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function toYmdInZone(date: Date, timeZone?: string | null): string | null {
  const p = getZonedPartsForTz(date, timeZone);
  if (!p) return null;
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * Interprète "YYYY-MM-DD HH:mm" comme heure murale dans `timeZone` → ISO UTC.
 */
export function wallToUtcIso(wall: string, timeZone?: string | null): string | null {
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

  const zone = resolveIanaZone(timeZone ?? _defaultViewerTz, wallAsUtcMs);

  // Casa + tzdata stale post-transition : murale = UTC
  if (
    ((timeZone || "").trim() === CASABLANCA_TZ || zone === "UTC") &&
    isCasablancaTzdataStale() &&
    wallAsUtcMs >= MOROCCO_UTC0_SINCE_MS
  ) {
    return new Date(wallAsUtcMs).toISOString();
  }

  let guess = wallAsUtcMs;
  for (let i = 0; i < 3; i++) {
    const p = getZonedParts(new Date(guess), resolveIanaZone(timeZone ?? _defaultViewerTz, guess));
    if (!p) return null;
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wallAsUtcMs - asUtc;
  }

  const out = new Date(guess);
  if (Number.isNaN(out.getTime())) return null;
  return out.toISOString();
}
