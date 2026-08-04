import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const apiProxyTarget = loadEnv(mode, ".", "").VITE_API_PROXY_TARGET ?? "http://43.138.142.128:18084";

  return {
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
  };
});
