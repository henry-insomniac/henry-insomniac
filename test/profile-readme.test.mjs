import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readmeUrl = new URL("../README.md", import.meta.url);

test("GitHub profile README presents HenryHou as an agent-first builder with a visual dashboard", () => {
  assert.equal(existsSync(readmeUrl), true, "README.md should exist");

  const readme = readFileSync(readmeUrl, "utf8");

  assert.match(readme, /HenryHou/);
  assert.match(readme, /agent-first/i);
  assert.match(readme, /https:\/\/yi-flow\.com/);
  assert.match(readme, /assets\/profile-dashboard\.svg/);
});
