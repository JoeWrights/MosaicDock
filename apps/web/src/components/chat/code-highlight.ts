import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import typescript from "highlight.js/lib/languages/typescript";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("text", plaintext);
hljs.registerLanguage("plaintext", plaintext);

const extensionLanguageMap: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".sh": "bash",
  ".bash": "bash",
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "plaintext",
  ".log": "plaintext",
};

export function getLanguageFromFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  return extensionLanguageMap[extension] ?? "plaintext";
}

export function highlightCode(code: string, language: string): string {
  const resolvedLanguage = hljs.getLanguage(language) ? language : "plaintext";
  const highlighted = hljs.highlight(code, { language: resolvedLanguage }).value;
  return `<pre class="hljs language-${escapeHtml(resolvedLanguage)}"><code>${highlighted}</code></pre>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getFileExtension(fileName: string): string {
  const normalizedName = fileName.toLowerCase();
  const dotIndex = normalizedName.lastIndexOf(".");
  return dotIndex >= 0 ? normalizedName.slice(dotIndex) : "";
}
