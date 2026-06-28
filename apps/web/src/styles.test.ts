import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("global styles", () => {
  it("loads the highlight.js theme used by code previews", () => {
    const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toContain('@import "highlight.js/styles/foundation.css";');
  });

  it("keeps workspace source previews backgroundless", () => {
    const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    expect(styles).toContain(".workspace-code-preview .hljs");
    expect(styles).toContain("background: transparent;");
  });
});
