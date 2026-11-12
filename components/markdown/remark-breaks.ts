// Alt alta yazılan satırları alt alta gösterir. Markdown normalde tek satır sonunu
// boşluk sayar ve satırları aynı paragrafta yan yana birleştirir; burada her satır
// sonu gerçek bir satır sonuna (<br>) çevrilir. Kod blokları etkilenmez: onların
// içeriği "text" düğümü değildir.

type Node = {
  type: string;
  value?: string;
  children?: Node[];
};

const LINE_END = /\r\n|\r|\n/;

export function remarkBreaks() {
  function walk(node: Node) {
    if (!node.children) return;
    const next: Node[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value && LINE_END.test(child.value)) {
        child.value.split(LINE_END).forEach((line, i) => {
          if (i > 0) next.push({ type: "break" });
          if (line) next.push({ type: "text", value: line });
        });
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  }

  return (tree: Node) => walk(tree);
}
