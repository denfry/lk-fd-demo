export function parsePastedIds(raw: string, cap = 500): string[] {
  const tokens = raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) { seen.add(t); out.push(t); }
    if (out.length >= cap) break;
  }
  return out;
}
