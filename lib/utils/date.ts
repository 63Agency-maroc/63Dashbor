/**
 * Helpers d’affichage date/heure — heure légale Maroc (Africa/Casablanca).
 * Réexporte l’API centrale de lib/datetime/casablanca.ts.
 */
export {
  CASABLANCA_TZ,
  parseIso,
  formatInCasablanca,
  formatDateTime,
  formatDate,
  formatTime,
  effectiveCasablancaTimeZone,
  isCasablancaTzdataStale,
} from "@/lib/datetime/casablanca";
