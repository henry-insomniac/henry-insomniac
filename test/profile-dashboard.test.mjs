import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url);
const reposFixture = new URL("./fixtures/repos.json", import.meta.url);
const userFixture = new URL("./fixtures/user.json", import.meta.url);

test("profile asset generator renders a data-driven SVG dashboard with a signal ring", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "profile-dashboard-"));
  const outPath = join(tempDir, "profile-dashboard.svg");

  execFileSync(
    process.execPath,
    [
      "scripts/generate-profile-assets.mjs",
      "--user",
      userFixture.pathname,
      "--repos",
      reposFixture.pathname,
      "--out",
      outPath
    ],
    { cwd: repoRoot.pathname }
  );

  const svg = readFileSync(outPath, "utf8");

  assert.match(svg, /<svg[^>]+viewBox="0 0 1200 680"/);
  assert.match(svg, /HenryHou/);
  assert.match(svg, /Builder Signal/);
  assert.match(svg, /8 public repos/);
  assert.match(svg, /6 original/);
  assert.match(svg, /Profile Grade/);
  assert.match(svg, /\/100 score/);
  assert.match(svg, /Originality/);
  assert.match(svg, /Momentum/);
  assert.match(svg, /Stack Breadth/);
  assert.match(svg, /Product Shape/);
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /TypeScript/);
  assert.match(svg, /Go/);
  assert.match(svg, /Swift/);
  assert.match(svg, /openclaw-manager-native/);
  assert.doesNotMatch(svg, /Public GitHub Data|GitHub Action|Profile README/);
});
