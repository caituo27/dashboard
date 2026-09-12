import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({mode}) => ({
  base: "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/mock-api": { target: loadEnv(mode, ".", "SPRIX_").SPRIX_MOCK_PROXY_TARGET ?? "http://127.0.0.1:5174", changeOrigin: true },
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
}));
