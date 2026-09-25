import { DateTime } from "luxon";
import type { EventInput } from "@fullcalendar/core";
import type { AvailabilityDay, AvailabilitySlot } from "@/lib/api/availabilities";
import {
  CASABLANCA_TZ,
  effectiveCasablancaTimeZone,
  isCasablancaTzdataStale,
} from "@/lib/datetime/casablanca";
import { labelForTimezone } from "@/lib/calendar/countryTimezones";

export { CASABLANCA_TZ };

/** Zone Luxon : Casa correcte même si tzdata navigateur encore en +01. */
function luxonZone(iana: string): string {
  if (iana === CASABLANCA_TZ && isCasablancaTzdataStale()) return "UTC";
  return iana || effectiveCasablancaTimeZone();
}

export type DisplaySlot = {
  /** Jour civil d’affichage YYYY-MM-DD (dans le timezone d’affichage) */
  displayDate: string;
  /** Date API source YYYY-MM-DD (pour PUT/DELETE) */
  sourceDate: string;
  startHm: string;
  endHm: string;
  /** ISO UTC à passer à FullCalendar (timeZone calendrier = Casablanca) */
  startIso: string;
  endIso: string;
  userId: string;
  sourceTimezone: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHm(dt: DateTime): string {
  return `${pad2(dt.hour)}:${pad2(dt.minute)}`;
}

/** Timezone d’affichage pour un spectateur donné. */
export function displayZoneForViewer(
  availabilityUserId: string,
  viewerUserId: string | null | undefined,
  sourceTimezone: string,
): string {
  if (viewerUserId && viewerUserId === availabilityUserId) {
    return sourceTimezone || CASABLANCA_TZ;
  }
  return CASABLANCA_TZ;
}

/**
 * Convertit un créneau (date + HH:mm dans sourceTimezone) vers des instants
 * compréhensibles par FullCalendar (timeZone=Africa/Casablanca).
 *
 * - Spectateur = propriétaire → les HH:mm affichés = heure locale source
 *   (on encode ces murals comme si Casablanca pour le rendu FC).
 * - Autre spectateur → conversion réelle → murals Casablanca → ISO.
 */
export function slotToDisplay(
  dateYmd: string,
  slot: AvailabilitySlot,
  sourceTimezone: string,
  availabilityUserId: string,
  viewerUserId: string | null | undefined,
): DisplaySlot | null {
  const zone = luxonZone(sourceTimezone || CASABLANCA_TZ);
  const startLocal = DateTime.fromISO(`${dateYmd}T${slot.start}`, { zone });
  const endLocal = DateTime.fromISO(`${dateYmd}T${slot.end}`, { zone });
  if (!startLocal.isValid || !endLocal.isValid || endLocal <= startLocal) return null;

  const displayZone = luxonZone(displayZoneForViewer(availabilityUserId, viewerUserId, sourceTimezone || CASABLANCA_TZ));
  const startInDisplay = startLocal.setZone(displayZone);
  const endInDisplay = endLocal.setZone(displayZone);

  // FullCalendar est en Casablanca : encoder les murals d’affichage en murals Casa
  const fcZone = luxonZone(CASABLANCA_TZ);
  const startForFc = DateTime.fromObject(
    {
      year: startInDisplay.year,
      month: startInDisplay.month,
      day: startInDisplay.day,
      hour: startInDisplay.hour,
      minute: startInDisplay.minute,
      second: 0,
    },
    { zone: fcZone },
  );
  const endForFc = DateTime.fromObject(
    {
      year: endInDisplay.year,
      month: endInDisplay.month,
      day: endInDisplay.day,
      hour: endInDisplay.hour,
      minute: endInDisplay.minute,
      second: 0,
    },
    { zone: fcZone },
  );

  if (!startForFc.isValid || !endForFc.isValid) return null;

  return {
    displayDate: startInDisplay.toFormat("yyyy-MM-dd"),
    sourceDate: dateYmd,
    startHm: formatHm(startInDisplay),
    endHm: formatHm(endInDisplay),
    startIso: startForFc.toUTC().toISO()!,
    endIso: endForFc.toUTC().toISO()!,
    userId: availabilityUserId,
    sourceTimezone: sourceTimezone || CASABLANCA_TZ,
  };
}

export function buildAvailabilityDisplaySlots(
  days: AvailabilityDay[],
  viewerUserId: string | null | undefined,
): DisplaySlot[] {
  const out: DisplaySlot[] = [];
  for (const day of days) {
    for (const slot of day.slots ?? []) {
      const mapped = slotToDisplay(day.date, slot, day.timezone, day.userId, viewerUserId);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

/** Background events FullCalendar (week/day) — verts pâles. */
export function availabilityToBackgroundEvents(slots: DisplaySlot[]): EventInput[] {
  return slots.map((s, i) => ({
    id: `avail-${s.userId}-${s.displayDate}-${s.startHm}-${i}`,
    start: s.startIso,
    end: s.endIso,
    display: "background",
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    classNames: ["fc-avail-slot"],
    editable: false,
    extendedProps: {
      kind: "availability" as const,
      label: `${s.startHm}–${s.endHm}`,
      displayDate: s.displayDate,
    },
  }));
}

/** Map YYYY-MM-DD → libellés créneaux pour tooltip mois. */
export function availabilityTooltipsByDate(slots: DisplaySlot[]): Map<string, string> {
  const map = new Map<string, string[]>();
  for (const s of slots) {
    const list = map.get(s.displayDate) ?? [];
    list.push(`${s.startHm}–${s.endHm}`);
    map.set(s.displayDate, list);
  }
  const out = new Map<string, string>();
  for (const [ymd, parts] of map) {
    out.set(ymd, `Dispo : ${parts.join(", ")}`);
  }
  return out;
}

function formatHmReadable(hm: string): string {
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hm;
  return `${Number(m[1])}:${m[2]}`;
}

export type MonthAvailBadge = {
  date: string;
  /** Texte compact dans le chip */
  text: string;
  /** Tooltip complet */
  title: string;
};

/**
 * Badges vue mois : un chip par jour (créneaux regroupés).
 * Ex. "🟢 Dispo · Saad · 9:00–12:00, 14:00–18:00"
 */
export function buildMonthAvailabilityBadges(
  slots: DisplaySlot[],
  nameByUserId: Map<string, string>,
): Map<string, MonthAvailBadge> {
  type Agg = { userId: string; ranges: string[] };
  const byDate = new Map<string, Agg>();

  for (const s of slots) {
    const range = `${formatHmReadable(s.startHm)}–${formatHmReadable(s.endHm)}`;
    const cur = byDate.get(s.displayDate);
    if (!cur) {
      byDate.set(s.displayDate, { userId: s.userId, ranges: [range] });
    } else {
      if (!cur.ranges.includes(range)) cur.ranges.push(range);
    }
  }

  const out = new Map<string, MonthAvailBadge>();
  for (const [ymd, agg] of byDate) {
    const name = (nameByUserId.get(agg.userId) || "Admin").trim() || "Admin";
    const ranges = agg.ranges.join(", ");
    const text =
      agg.ranges.length === 1
        ? `🟢 Dispo · ${name} · ${ranges}`
        : `🟢 Dispo · ${name} · ${ranges}`;
    out.set(ymd, {
      date: ymd,
      text,
      title: `Disponible (${name}) : ${ranges}`,
    });
  }
  return out;
}

export function availabilityDisplayLegend(
  days: AvailabilityDay[],
  viewerUserId: string | null | undefined,
): string | null {
  if (!days.length) return null;
  const owns = Boolean(viewerUserId && days.some((d) => d.userId === viewerUserId));
  if (owns) {
    const own = days.find((d) => d.userId === viewerUserId);
    const tz = own?.timezone || CASABLANCA_TZ;
    const country = labelForTimezone(tz).split(" (")[0];
    return `Dispos affichées en heure locale (${country})`;
  }
  return "Dispos affichées en heure du Maroc";
}

function formatYmdFr(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export type BannerAvailRow = {
  /** Date source API (pour PUT/DELETE) */
  date: string;
  userId: string;
  text: string;
  title: string;
};

/**
 * Lignes du bandeau du jour : "🟢 Saad · Aujourd'hui · 9:00–12:00, 14:00–18:00"
 * Heures déjà converties via buildAvailabilityDisplaySlots.
 * @param todayYmd — si fourni, n’inclut que ce jour et affiche "Aujourd'hui"
 */
export function buildAvailabilityBannerRows(
  slots: DisplaySlot[],
  nameByUserId: Map<string, string>,
  todayYmd?: string | null,
): BannerAvailRow[] {
  type Agg = { userId: string; sourceDate: string; displayDate: string; ranges: string[] };
  const byKey = new Map<string, Agg>();

  for (const s of slots) {
    if (todayYmd && s.sourceDate !== todayYmd) continue;
    const key = `${s.userId}:${s.sourceDate}`;
    const range = `${formatHmReadable(s.startHm)}–${formatHmReadable(s.endHm)}`;
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, {
        userId: s.userId,
        sourceDate: s.sourceDate,
        displayDate: s.displayDate,
        ranges: [range],
      });
    } else if (!cur.ranges.includes(range)) {
      cur.ranges.push(range);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.sourceDate.localeCompare(b.sourceDate) || a.displayDate.localeCompare(b.displayDate))
    .map((agg) => {
      const name = (nameByUserId.get(agg.userId) || "Admin").trim() || "Admin";
      const ranges = agg.ranges.join(", ");
      const dateLabel =
        todayYmd && agg.sourceDate === todayYmd ? "Aujourd'hui" : formatYmdFr(agg.displayDate);
      return {
        date: agg.sourceDate,
        userId: agg.userId,
        text: `🟢 ${name} · ${dateLabel} · ${ranges}`,
        title: `Disponible (${name}) — ${dateLabel} : ${ranges}`,
      };
    });
}
