import type { Lead } from "@/lib/api/leads";
import {
  getLeadName,
  getLeadPhone,
  MIN_PHONE_DIGITS,
  normalizePhoneDigits,
} from "@/lib/leads/clickup-fields";
import { splitLeadNameAndPhone } from "@/lib/leads/splitLeadNameAndPhone";

export { MIN_PHONE_DIGITS, normalizePhoneDigits } from "@/lib/leads/clickup-fields";

/** Téléphone utilisable (≥ MIN_PHONE_DIGITS après normalisation). */
export function hasUsablePhone(raw: string | null | undefined): boolean {
  return normalizePhoneDigits(raw).length >= MIN_PHONE_DIGITS;
}

/**
 * Prénom pour {{1}} : premier mot si le name ressemble à "Prénom Nom",
 * sinon le name complet. Fallback "Client" si vide.
 */
export function variable1FromName(name: string | null | undefined): string {
  const full = (name ?? "").trim().replace(/\s+/g, " ");
  if (!full) return "Client";
  const parts = full.split(" ");
  if (parts.length >= 2 && parts[0].length >= 2 && !/^\d+$/.test(parts[0])) {
    return parts[0];
  }
  return full;
}

export type ResolvedLeadPhone = {
  /** Digits only, ex. 212668101007 */
  phoneDigits: string;
  /** Nom sans le numéro collé / Full Name CF */
  cleanedName: string;
  /** Source brute avant normalisation */
  phoneRaw: string;
};

/**
 * Résolution téléphone + nom pour broadcast (custom fields ClickUp en priorité).
 */
export function resolveLeadPhone(lead: Lead): ResolvedLeadPhone {
  const phoneDigits = getLeadPhone(lead);
  const cleanedName = getLeadName(lead) || "Client";
  const { phoneFromName } = splitLeadNameAndPhone(lead.name ?? "");
  const phoneRaw =
    (lead.phone ?? "").trim() ||
    phoneFromName ||
    (phoneDigits ? `+${phoneDigits}` : "");

  return { phoneDigits, cleanedName, phoneRaw };
}

/** @deprecated Utiliser getLeadPhone / resolveLeadPhone */
export function getLeadPhoneRaw(lead: Lead): string {
  const r = resolveLeadPhone(lead);
  return r.phoneRaw || r.phoneDigits;
}
