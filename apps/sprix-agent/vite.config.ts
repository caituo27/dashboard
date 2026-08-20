// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

declare const process: { env: Record<string, string | undefined> };

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://42.194.150.73:8084";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif"]);
const videoExtensions = new Set([".mp4", ".webm", ".mov", ".m4v"]);

function listPublicAssets(directory, relativeDirectory = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const sourcePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return listPublicAssets(sourcePath, relativePath);

    const extension = path.extname(entry.name).toLowerCase();
    if (imageExtensions.has(extension)) return [{ relativePath, kind: "image" }];
    if (videoExtensions.has(extension)) return [{ relativePath, kind: "video" }];
    return [];
  });
}

function packagePublicAssets() {
  const publicDirectory = path.resolve(process.cwd(), "public");
  const assets = listPublicAssets(publicDirectory);
  const replacements = new Map(
    [...assets]
      .sort((left, right) => right.relativePath.length - left.relativePath.length)
      .map(({ relativePath, kind }) => [`/${relativePath}`, `/${kind === "image" ? "images" : "videos"}/${relativePath}`])
  );

  return {
    name: "sprix-package-public-assets",
    apply: "build",
    transformIndexHtml(html) {
      return [...replacements].reduce((result, [sourcePath, packagedPath]) => result.replaceAll(sourcePath, packagedPath), html);
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") {
          for (const [sourcePath, packagedPath] of replacements) output.code = output.code.replaceAll(sourcePath, packagedPath);
        } else if (typeof output.source === "string") {
          for (const [sourcePath, packagedPath] of replacements) output.source = output.source.replaceAll(sourcePath, packagedPath);
        }
      }
    },
    closeBundle() {
      const distDirectory = path.resolve(process.cwd(), "dist");
      for (const { relativePath, kind } of assets) {
        const sourcePath = path.join(distDirectory, relativePath);
        if (!fs.existsSync(sourcePath)) continue;
        const destinationPath = path.join(distDirectory, kind === "image" ? "images" : "videos", relativePath);
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.renameSync(sourcePath, destinationPath);
      }
    }
  };
}

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss(), packagePublicAssets()],
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
