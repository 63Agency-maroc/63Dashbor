import type { ClickUpCustomField, Lead } from "@/lib/api/leads";
import { splitLeadNameAndPhone } from "@/lib/leads/splitLeadNameAndPhone";

/** Min. chiffres pour un numéro utilisable (broadcast / cochable). */
export const MIN_PHONE_DIGITS = 9;

/** Garde uniquement les chiffres (E.164 sans +). */
export function normalizePhoneDigits(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  return String(raw).replace(/\D/g, "");
}

/** Noms exacts des custom fields ClickUp (référence produit). */
export const CLICKUP_FIELD_NAMES = {
  phonePrimary: "Phone Number",
  fullName: "Full Name",
  email: "Email",
} as const;

function getCustomFields(lead: Pick<Lead, "clickupData"> | null | undefined): ClickUpCustomField[] {
  const data = lead?.clickupData;
  if (!data || typeof data !== "object") return [];
  const task = data.task;
  const candidates: unknown[] = [
    task && typeof task === "object" ? (task as { custom_fields?: unknown }).custom_fields : null,
    task && typeof task === "object" ? (task as { customFields?: unknown }).customFields : null,
    (data as { custom_fields?: unknown }).custom_fields,
    (data as { customFields?: unknown }).customFields,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as ClickUpCustomField[];
  }
  return [];
}

/**
 * Aplatit value ClickUp (string | number | { value|email|… } | array | null).
 */
export function extractCustomFieldValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => extractCustomFieldValue(v))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Formats ClickUp fréquents (email type inclus)
    for (const key of [
      "email",
      "email_address",
      "emailAddress",
      "value",
      "phone",
      "name",
      "text",
      "formatted",
      "url",
    ]) {
      if (key in obj) {
        const inner = extractCustomFieldValue(obj[key]);
        if (inner) return inner;
      }
    }
    // Dernier recours : première chaîne contenant @
    for (const v of Object.values(obj)) {
      const inner = extractCustomFieldValue(v);
      if (inner.includes("@")) return inner;
    }
  }
  return "";
}

/** Normalise / extrait une adresse email utilisable ("" si invalide). */
export function normalizeEmail(raw: string | null | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim().replace(/^mailto:/i, "").trim();
  if (!s) return "";
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (m) return m[0].trim();
  if (s.includes("@") && s.length >= 5) return s;
  return "";
}

function fieldNameNorm(name: string | undefined | null): string {
  return (name ?? "").trim().toLowerCase();
}

function findFieldByExactName(fields: ClickUpCustomField[], exact: string): string {
  const target = exact.toLowerCase();
  for (const f of fields) {
    if (fieldNameNorm(f.name) === target) {
      const v = extractCustomFieldValue(f.value);
      if (v) return v;
    }
  }
  return "";
}

function findPhoneFromCustomFields(fields: ClickUpCustomField[]): string {
  if (fields.length === 0) return "";

  // 1) "Phone Number" exact
  const primary = findFieldByExactName(fields, CLICKUP_FIELD_NAMES.phonePrimary);
  if (normalizePhoneDigits(primary).length >= MIN_PHONE_DIGITS) return primary;

  // 2) "Phone Number (…)" variante masquée / secondaire
  const masked: string[] = [];
  const otherPhone: string[] = [];
  for (const f of fields) {
    const n = fieldNameNorm(f.name);
    if (!n || !n.includes("phone")) continue;
    const v = extractCustomFieldValue(f.value);
    if (!v) continue;
    if (n === "phone number") continue; // déjà testé
    if (n.startsWith("phone number")) masked.push(v);
    else otherPhone.push(v);
  }

  for (const v of [...masked, ...otherPhone]) {
    if (normalizePhoneDigits(v).length >= MIN_PHONE_DIGITS) return v;
  }

  // 3) premier champ phone même si < seuil (sera filtré plus bas)
  return primary || masked[0] || otherPhone[0] || "";
}

/**
 * Téléphone lead — digits only (ex. 212661703431).
 * Priorité : custom "Phone Number" → variante Phone* → lead.phone → extraction name.
 */
export function getLeadPhone(lead: Lead | null | undefined): string {
  if (!lead) return "";
  const fields = getCustomFields(lead);
  const fromCf = findPhoneFromCustomFields(fields);
  const fromCfDigits = normalizePhoneDigits(fromCf);
  if (fromCfDigits.length >= MIN_PHONE_DIGITS) return fromCfDigits;

  const fromPhone = normalizePhoneDigits(lead.phone);
  if (fromPhone.length >= MIN_PHONE_DIGITS) return fromPhone;

  const { phoneFromName } = splitLeadNameAndPhone(lead.name ?? "");
  const fromName = normalizePhoneDigits(phoneFromName);
  if (fromName.length >= MIN_PHONE_DIGITS) return fromName;

  // meilleur effort (peut être vide)
  return fromCfDigits || fromPhone || fromName || "";
}

/** Affichage brut (avec + si présent) avant normalisation digits. */
export function getLeadPhoneDisplay(lead: Lead | null | undefined): string {
  if (!lead) return "";
  const fields = getCustomFields(lead);
  const fromCf = findPhoneFromCustomFields(fields);
  if (fromCf) return fromCf;
  if ((lead.phone ?? "").trim()) return lead.phone.trim();
  const { phoneFromName } = splitLeadNameAndPhone(lead.name ?? "");
  return phoneFromName ?? "";
}

/**
 * Nom pour UI / {{1}} — priorité custom "Full Name", sinon name nettoyé du numéro.
 */
export function getLeadName(lead: Lead | null | undefined): string {
  if (!lead) return "";
  const fields = getCustomFields(lead);
  const full =
    findFieldByExactName(fields, CLICKUP_FIELD_NAMES.fullName) ||
    (() => {
      for (const f of fields) {
        const n = fieldNameNorm(f.name);
        if (n === "full name" || n === "fullname" || n.includes("full name")) {
          return extractCustomFieldValue(f.value);
        }
      }
      return "";
    })();
  if (full) return full.replace(/\s+/g, " ").trim();

  const { cleanedName } = splitLeadNameAndPhone(lead.name ?? "");
  return (cleanedName || lead.name || "").replace(/\s+/g, " ").trim();
}

/**
 * Email lead — priorité custom field "Email" (name ou type), sinon lead.email.
 * Retourne "" si rien de valide (contient @).
 */
export function getLeadEmail(lead: Lead | null | undefined): string {
  if (!lead) return "";
  const fields = getCustomFields(lead);

  const tryValue = (raw: string): string => normalizeEmail(raw);

  // 1) Exact "Email"
  const exact = tryValue(findFieldByExactName(fields, CLICKUP_FIELD_NAMES.email));
  if (exact) return exact;

  // 2) name contient "email" / "e-mail", ou type === "email"
  for (const f of fields) {
    const n = fieldNameNorm(f.name);
    const t = fieldNameNorm(f.type);
    const isEmailField =
      n === "email" ||
      n.includes("email") ||
      n.includes("e-mail") ||
      t === "email";
    if (!isEmailField) continue;
    const v = tryValue(extractCustomFieldValue(f.value));
    if (v) return v;
  }

  // 3) Fallback lead.email
  return tryValue(lead.email ?? "");
}

export function leadHasUsablePhone(lead: Lead | null | undefined): boolean {
  return getLeadPhone(lead).length >= MIN_PHONE_DIGITS;
}

export function leadHasUsableEmail(lead: Lead | null | undefined): boolean {
  return Boolean(getLeadEmail(lead));
}

/** Au moins un canal de contact (téléphone ou email). */
export function leadHasContact(lead: Lead | null | undefined): boolean {
  return leadHasUsablePhone(lead) || leadHasUsableEmail(lead);
}
