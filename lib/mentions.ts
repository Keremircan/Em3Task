// @bahsetme: metinde "@Ad Soyad" geçen ekip üyelerini bulur (sunucu ve tarayıcı).
// Adlar en uzundan kısaya denenir ("@Ali Can" yazınca "Ali" değil "Ali Can" eşleşir).

export type Mentionable = { id: string; name: string };

const lower = (s: string) => s.toLocaleLowerCase("tr");
// Adın hemen ardından harf/rakam gelmemeli ("@Alice" yazınca "Ali" eşleşmesin)
const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function findMentions(text: string, members: Mentionable[]): string[] {
  const hay = lower(text);
  const sorted = [...members].filter((m) => m.name.trim()).sort((a, b) => b.name.length - a.name.length);
  const found = new Set<string>();
  const taken: [number, number][] = [];
  for (const m of sorted) {
    const needle = `@${lower(m.name.trim())}`;
    let from = 0;
    while (true) {
      const at = hay.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      const before = at === 0 ? "" : hay[at - 1];
      const after = hay[end] ?? "";
      const overlaps = taken.some(([s, e]) => at < e && end > s);
      if (!overlaps && !WORD_CHAR.test(after) && !WORD_CHAR.test(before)) {
        found.add(m.id);
        taken.push([at, end]);
      }
      from = end;
    }
  }
  return [...found];
}
