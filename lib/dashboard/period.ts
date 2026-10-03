import { addCalendarDaysYmd, casablancaTodayYmd } from "@/lib/datetime/casablanca";

export type DashboardPeriodKey = "7d" | "30d" | "month" | "custom";

export const DASHBOARD_PERIOD_OPTIONS: { value: DashboardPeriodKey; label: string }[] = [
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Personnalisé" },
];

/** Résout from/to (YYYY-MM-DD, heure Maroc). maxDays défaut 180 (by-day) ; by-member accepte 366. */
export function resolveDashboardPeriod(
  key: DashboardPeriodKey,
  customFrom?: string,
  customTo?: string,
  opts?: { maxDays?: number },
): { from: string; to: string } {
  const today = casablancaTodayYmd();
  let from = today;
  let to = today;

  if (key === "7d") {
    from = addCalendarDaysYmd(today, -6) || today;
  } else if (key === "30d") {
    from = addCalendarDaysYmd(today, -29) || today;
  } else if (key === "month") {
    const [y, m] = today.split("-");
    from = y && m ? `${y}-${m}-01` : today;
  } else {
    const cf = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : null;
    const ct = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : null;
    from = cf || addCalendarDaysYmd(today, -29) || today;
    to = ct || today;
  }

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  const maxDays = Math.max(1, opts?.maxDays ?? 180);
  const minFrom = addCalendarDaysYmd(to, -(maxDays - 1));
  if (minFrom && from < minFrom) from = minFrom;

  return { from, to };
}
