import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@mosaic-dock/api-client": `${root}/packages/api-client/src/index.ts`,
      "@mosaic-dock/shared": `${root}/packages/shared/src/index.ts`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
