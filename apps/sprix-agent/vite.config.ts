import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

declare const process: { env: Record<string, string | undefined> };

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://42.194.150.73:8084";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/sprix-api": {
        target: apiProxyTarget,
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
