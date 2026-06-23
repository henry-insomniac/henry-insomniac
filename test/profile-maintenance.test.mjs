import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const packageUrl = new URL("../package.json", import.meta.url);
const workflowUrl = new URL("../.github/workflows/update-profile.yml", import.meta.url);

test("profile assets can be regenerated locally and by GitHub Actions", () => {
  const manifest = JSON.parse(readFileSync(packageUrl, "utf8"));

  assert.equal(manifest.scripts.generate, "node scripts/generate-profile-assets.mjs");
  assert.equal(existsSync(workflowUrl), true, "update workflow should exist");

  const workflow = readFileSync(workflowUrl, "utf8");

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run generate/);
  assert.match(workflow, /contents: write/);
});
