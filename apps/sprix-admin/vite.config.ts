import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dashboardMockMiddleware } from "./mock/server.mjs";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), {
    name: "dashboard-http-mock",
    configureServer(server) {
      server.middlewares.use(dashboardMockMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(dashboardMockMiddleware);
    }
  }],
  server: {
    port: 5173,
    proxy: {
      "/sprix-api": {
        target: "http://42.194.150.73:8084",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sprix-api/, "")
      }
    }
  },
  build: {
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
