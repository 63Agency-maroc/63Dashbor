/** Indices uniques {{1}}, {{2}}… dans le body (ordre croissant). */
export function detectTemplateVarIndices(body: string | null | undefined): number[] {
  if (!body) return [];
  const found = new Set<number>();
  const re = /\{\{(\d+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

export function applyTemplatePreview(body: string, values: Record<number, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => {
    const v = values[Number(n)];
    return v != null && v !== "" ? v : `{{${n}}}`;
  });
}
