import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { fileURLToPath } from "node:url";

const backendTarget = process.env.MOSAIC_DOCK_API_TARGET ?? "http://localhost:3000";
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    title: "Mosaic Dock",
  },
  output: {
    distPath: {
      js: "assets/js",
      css: "assets/css",
      font: "assets/font",
      image: "assets/image",
      media: "assets/media",
    },
  },
  resolve: {
    alias: {
      "@mosaic-dock/api-client": `${workspaceRoot}/packages/api-client/src/index.ts`,
      "@mosaic-dock/shared": `${workspaceRoot}/packages/shared/src/index.ts`,
    },
  },
  server: {
    port: 5174,
    historyApiFallback: true,
    proxy: {
      "/api/v1": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/static": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
