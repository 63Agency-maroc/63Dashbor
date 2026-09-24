/** Pays courants → timezone IANA (affichage pays, envoi IANA). */
export type CountryTimezoneOption = {
  country: string;
  timezone: string;
};

export const COUNTRY_TIMEZONES: CountryTimezoneOption[] = [
  { country: "Maroc", timezone: "Africa/Casablanca" },
  { country: "France", timezone: "Europe/Paris" },
  { country: "Espagne", timezone: "Europe/Madrid" },
  { country: "Royaume-Uni", timezone: "Europe/London" },
  { country: "Allemagne", timezone: "Europe/Berlin" },
  { country: "Italie", timezone: "Europe/Rome" },
  { country: "Portugal", timezone: "Europe/Lisbon" },
  { country: "Belgique", timezone: "Europe/Brussels" },
  { country: "Suisse", timezone: "Europe/Zurich" },
  { country: "Turquie", timezone: "Europe/Istanbul" },
  { country: "Égypte", timezone: "Africa/Cairo" },
  { country: "Émirats arabes unis", timezone: "Asia/Dubai" },
  { country: "Arabie saoudite", timezone: "Asia/Riyadh" },
  { country: "Inde", timezone: "Asia/Kolkata" },
  { country: "Chine", timezone: "Asia/Shanghai" },
  { country: "Vietnam", timezone: "Asia/Ho_Chi_Minh" },
  { country: "Japon", timezone: "Asia/Tokyo" },
  { country: "Canada (Toronto)", timezone: "America/Toronto" },
  { country: "USA (Est)", timezone: "America/New_York" },
  { country: "USA (Ouest)", timezone: "America/Los_Angeles" },
  { country: "Brésil (São Paulo)", timezone: "America/Sao_Paulo" },
  { country: "Australie (Sydney)", timezone: "Australia/Sydney" },
];

export const DEFAULT_AVAILABILITY_TIMEZONE = "Africa/Casablanca";

export function labelForTimezone(timezone: string): string {
  const hit = COUNTRY_TIMEZONES.find((c) => c.timezone === timezone);
  return hit ? `${hit.country} (${hit.timezone})` : timezone;
}
