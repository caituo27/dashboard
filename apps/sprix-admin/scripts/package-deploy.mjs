import { access, copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const output = join(appRoot, "deploy");
const mockSource = join(appRoot, "mock");
const sharedSource = join(appRoot, "shared");

async function copyRuntimeModules(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.endsWith(".test.mjs")) {
      await copyFile(join(source, entry.name), join(target, entry.name));
    }
  }
}

// Only replace generated artifacts. Persistent state must live outside deploy/.
await access(join(appRoot, "dist/index.html"));
await rm(output, { recursive: true, force: true });
await cp(join(appRoot, "dist"), join(output, "web"), { recursive: true });
// Runtime modules are self-contained; never ship local state, declarations, or test fixtures.
await copyRuntimeModules(mockSource, join(output, "mock"));
await copyRuntimeModules(sharedSource, join(output, "shared"));
await copyFile(join(appRoot, "DEPLOY.md"), join(output, "README.md"));
console.log("Deployment bundle ready: deploy/ (web/, mock/, shared/, README.md)");
