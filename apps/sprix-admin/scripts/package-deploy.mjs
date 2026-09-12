import { access, copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const output = join(appRoot, "deploy");
const mockSource = join(appRoot, "mock");

// Only replace generated artifacts. Persistent state must live outside deploy/.
await access(join(appRoot, "dist/index.html"));
await rm(output, { recursive: true, force: true });
await mkdir(join(output, "mock"), { recursive: true });
await cp(join(appRoot, "dist"), join(output, "web"), { recursive: true });

// Runtime modules are self-contained; never ship local state or test fixtures.
for (const entry of await readdir(mockSource, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.endsWith(".test.mjs")) {
    await copyFile(join(mockSource, entry.name), join(output, "mock", entry.name));
  }
}
await copyFile(join(appRoot, "DEPLOY.md"), join(output, "README.md"));
console.log("Deployment bundle ready: deploy/ (web/, mock/, README.md)");
