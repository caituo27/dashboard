import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev: Vite serves the UI on 5173 and proxies /api to the Express backend on 3100.
// Prod: `vite build` emits dist/, which Express serves directly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3100",
    },
  },
  build: {
    outDir: "dist",
  },
});
