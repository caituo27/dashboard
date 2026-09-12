import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { dashboardMockMiddleware } from "./mock/server.mjs";
import { loadEnv } from "vite";

function splitVendorChunk(id: string) {
  const moduleId = id.replace(/\\/g, "/");
  if (
    moduleId.includes("/node_modules/antd/") ||
    moduleId.includes("/node_modules/@ant-design/") ||
    moduleId.includes("/node_modules/@rc-component/") ||
    /\/node_modules\/rc-[^/]+\//.test(moduleId)
  ) return "vendor-ui";
  if (moduleId.includes("/node_modules/framer-motion/")) return "vendor-motion";
  if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@tanstack\/react-query)\//.test(moduleId)) return "vendor-react";
}

export default defineConfig(({ mode }) => {
  const apiProxyTarget = loadEnv(mode, ".", "").VITE_API_PROXY_TARGET ?? "http://42.194.150.73:8084";

  return {
    base: "/",
    plugins: [react(), tailwindcss(), {
      name: "dashboard-http-mock",
      configureServer(server) { server.middlewares.use(dashboardMockMiddleware); },
      configurePreviewServer(server) { server.middlewares.use(dashboardMockMiddleware); }
    }],
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
      outDir: "dist",
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: splitVendorChunk
        }
      }
    },
    test: {
      environment: "jsdom",
      globals: true
    }
  };
});
