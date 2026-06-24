import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function readText(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

test("workspace has separate agent and admin Vite apps", () => {
  assert.equal(readJson("apps/sprix-agent/package.json").name, "@sprix-ai/agent");
  assert.equal(readJson("apps/sprix-admin/package.json").name, "@sprix-ai/admin");

  const rootPackage = readJson("package.json");
  assert.equal(rootPackage.scripts["dev:agent"], "pnpm --filter @sprix-ai/agent dev");
  assert.equal(rootPackage.scripts["dev:admin"], "pnpm --filter @sprix-ai/admin dev");
});

test("agent app does not mount admin routes", () => {
  const agentApp = readText("apps/sprix-agent/src/App.tsx");
  assert.ok(!agentApp.includes("/admin"));
  assert.ok(!agentApp.includes("AdminRoutes"));
  assert.ok(!agentApp.includes("./admin/AdminPages"));
});

test("admin app does not mount agent routes", () => {
  const adminApp = readText("apps/sprix-admin/src/App.tsx");
  assert.ok(!adminApp.includes("/agent"));
  assert.ok(!adminApp.includes("UserRoutes"));
  assert.ok(!adminApp.includes("./user/UserPages"));
});
