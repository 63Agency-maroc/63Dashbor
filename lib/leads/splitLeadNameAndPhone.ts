/**
 * Extrait un numéro collé dans le name ClickUp et renvoie un nom nettoyé.
 * Prudent : ne retire que des motifs téléphone reconnus (+212, 06/07, emoji 📞…).
 * Partagé : meeting form + WhatsApp broadcast.
 */
export function splitLeadNameAndPhone(
  rawName: string,
): { cleanedName: string; phoneFromName: string | null } {
  let working = (rawName ?? "").trim();
  if (!working) return { cleanedName: "", phoneFromName: null };

  // Retirer icônes téléphone avant matching
  working = working.replace(/[📞☎️📱]/gu, " ");

  // Motifs : +212… / 00… / 06xx xx xx xx / 07… / 05…
  // + suites internationales génériques (9–15 chiffres après +/00)
  const phoneRe =
    /(?:\+|00)(?:212|33|1)[\s.\-]*\d(?:[\s.\-]?\d){7,12}|(?:\+|00)\d{1,3}[\s.\-]*\d(?:[\s.\-]?\d){7,12}|\b0[5-7](?:[\s.\-]?\d{2}){4}\b|\b\d(?:[\s.\-]?\d){8,14}\b/g;

  const matches = [...working.matchAll(phoneRe)];
  let phoneFromName: string | null = null;
  if (matches.length > 0) {
    const last = matches[matches.length - 1][0];
    phoneFromName = last.replace(/[\s.\-]/g, "").replace(/^00/, "+");
  }

  let cleaned = working;
  for (const m of matches) {
    cleaned = cleaned.replace(m[0], " ");
  }

  cleaned = cleaned
    .replace(/\s*[-–—·|/]+\s*$/g, "")
    .replace(/^\s*[-–—·|/]+\s*/g, "")
    .replace(/\s*[-–—·|/]+\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[-–—·|/]+$/g, "")
    .trim();

  return {
    cleanedName: cleaned || rawName.trim(),
    phoneFromName,
  };
}
