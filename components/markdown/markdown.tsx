import { isValidElement, type ReactElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { CodeBlock } from "./code-block";
import { rehypeMentions } from "./rehype-mentions";

// Markdown içindeki ham HTML render edilmez (react-markdown varsayılanı),
// javascript: gibi tehlikeli link adresleri de otomatik temizlenir.
const components: Components = {
  pre({ children }) {
    // ```ts gibi bloklarda dil, iç <code> elemanının sınıfından okunur
    const code = isValidElement(children)
      ? (children as ReactElement<{ className?: string }>)
      : null;
    const language =
      code?.props.className?.match(/language-([\w+#-]+)/)?.[1] ?? null;
    return <CodeBlock language={language}>{children}</CodeBlock>;
  },
  a({ href, children }) {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    // Dış görselleri gömmek yerine link olarak göster (izleme/takip riskine karşı)
    if (typeof src !== "string") return null;
    return (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {alt || src}
      </a>
    );
  },
};

// mentions: verilirse "@Ad Soyad" bahsetmeleri renkli rozet olarak gösterilir
export function Markdown({ children, mentions }: { children: string; mentions?: string[] }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={
          mentions?.length
            ? [[rehypeHighlight, { detect: false }], [rehypeMentions, { names: mentions }]]
            : [[rehypeHighlight, { detect: false }]]
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
