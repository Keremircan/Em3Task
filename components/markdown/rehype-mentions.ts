// Markdown çıktısında "@Ad Soyad" bahsetmelerini <span class="mention"> ile işaretler.
// Sadece verilen ekip üyesi adları eşleşir; kod blokları ve linkler atlanır.

type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

const SKIP = new Set(["code", "pre", "a"]);
const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function rehypeMentions(options: { names?: string[] } = {}) {
  const names = (options.names ?? []).filter((n) => n.trim()).sort((a, b) => b.length - a.length);
  if (!names.length) return () => {};
  const lowers = names.map((n) => `@${n.toLocaleLowerCase("tr")}`);

  function split(text: string): Node[] | null {
    const lower = text.toLocaleLowerCase("tr");
    if (lower.length !== text.length || !lower.includes("@")) return null;
    const out: Node[] = [];
    let i = 0;
    let changed = false;
    while (i < text.length) {
      const at = lower.indexOf("@", i);
      if (at === -1) break;
      const idx = lowers.findIndex((n) => lower.startsWith(n, at));
      const end = idx === -1 ? -1 : at + lowers[idx].length;
      const before = at === 0 ? "" : text[at - 1];
      if (idx === -1 || WORD_CHAR.test(text[end] ?? "") || WORD_CHAR.test(before)) {
        out.push({ type: "text", value: text.slice(i, at + 1) });
        i = at + 1;
        continue;
      }
      if (at > i) out.push({ type: "text", value: text.slice(i, at) });
      out.push({
        type: "element",
        tagName: "span",
        properties: { className: ["mention"] },
        children: [{ type: "text", value: text.slice(at, end) }],
      });
      i = end;
      changed = true;
    }
    if (!changed) return null;
    if (i < text.length) out.push({ type: "text", value: text.slice(i) });
    return out;
  }

  function walk(node: Node) {
    if (!node.children) return;
    if (node.type === "element" && node.tagName && SKIP.has(node.tagName)) return;
    const next: Node[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value) {
        const parts = split(child.value);
        if (parts) next.push(...parts);
        else next.push(child);
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  }

  return (tree: Node) => walk(tree);
}
