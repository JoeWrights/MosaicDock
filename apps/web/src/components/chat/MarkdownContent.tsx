import { useMemo } from "react";
import { Marked, type Tokens } from "marked";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import { cn } from "../../lib/utils";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("text", plaintext);
hljs.registerLanguage("plaintext", plaintext);

const marked = createMarkedInstance();

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const html = useMemo(() => marked.parse(escapeRawHtml(content)) as string, [content]);

  return (
    <div
      className={cn("markdown-text", className)}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const button = target.closest<HTMLButtonElement>(".copy-code-button");
        if (!button) return;

        const block = button.closest(".custom-code-block");
        const code = block?.querySelector("code")?.textContent ?? "";
        void navigator.clipboard?.writeText(code);
      }}
    />
  );
}

function createMarkedInstance(): Marked {
  const instance = new Marked();

  instance.use({
    breaks: true,
    gfm: true,
    renderer: {
      table(token: Tokens.Table): string {
        const header = token.header
          .map((cell) => `<th align="${cell.align || "left"}">${this.parser.parseInline(cell.tokens)}</th>`)
          .join("");
        const body = token.rows
          .map((row) => {
            const cells = row
              .map((cell) => `<td align="${cell.align || "left"}">${this.parser.parseInline(cell.tokens)}</td>`)
              .join("");
            return `<tr>${cells}</tr>`;
          })
          .join("");

        return `<div class="custom-table-block"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
      },
      code(token: Tokens.Code): string {
        const language = token.lang || "text";
        const highlighted = hljs.highlight(token.text, {
          language: hljs.getLanguage(language) ? language : "plaintext",
        }).value;

        return `<div class="custom-code-block"><div class="code-header"><span class="code-language">${escapeHtml(language)}</span><button type="button" class="copy-code-button" aria-label="复制代码">复制</button></div><pre class="hljs language-${escapeHtml(language)}"><code>${highlighted}</code></pre></div>`;
      },
      link(token: Tokens.Link): string {
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        const text = this.parser.parseInline(token.tokens);
        return `<a href="${escapeHtml(token.href)}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`;
      },
    },
  });

  return instance;
}

function escapeRawHtml(content: string): string {
  let inFence = false;

  return content
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        inFence = !inFence;
        return line;
      }

      return inFence ? line : escapeHtml(line);
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
