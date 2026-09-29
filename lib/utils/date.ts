/**
 * Helpers d’affichage date/heure.
 * - Par défaut : fuseau du viewer (AuthProvider → setDefaultViewerTimezone).
 * - Passer `timeZone` pour forcer une zone (ex. Africa/Casablanca pour stats Maroc).
 * - Helpers Casa purs restent dans lib/datetime/casablanca.ts.
 */
export {
  CASABLANCA_TZ,
  parseIso,
  formatInCasablanca,
  effectiveCasablancaTimeZone,
  isCasablancaTzdataStale,
} from "@/lib/datetime/casablanca";

export {
  formatDateTime,
  formatDate,
  formatTime,
  formatInTimeZone,
  resolveIanaZone,
  detectBrowserTimezone,
  shortTimezoneLabel,
  setDefaultViewerTimezone,
  getDefaultViewerTimezone,
  isValidIanaTimeZone,
  wallToUtcIso,
  isoToWallFlatpickr,
  toYmdInZone,
  getZonedPartsForTz,
} from "@/lib/datetime/timezone";
