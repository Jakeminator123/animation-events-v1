import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("generated webcanvas is current", () => {
  execFileSync(process.execPath, ["build-static.mjs", "--check"], { cwd: root });
});

test("seven unique page targets and unique section IDs exist", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
  for (let n = 0; n < 7; n++) assert(ids.includes("page-s0" + n));
  assert.equal([...html.matchAll(/<article class="page/g)].length, 7);
});

test("webcanvas exposes team links, provenance and the actual runtime boundary", () => {
  assert.match(html, /data-content-version="[a-f0-9]{12}"/);
  assert.match(html, /href="https:\/\/gitlab.com\/scout-gg\/croupier\/-\/wikis\/agent-inbox"/);
  assert.match(html, /href="https:\/\/github.com\/Jakeminator123\/animation-events-v1"/);
  assert.match(html, /archive\/v2\//);
  assert.match(html, /\/api\/table/);
  assert.match(html, /presentation\[\]/);
});

test("webcanvas has no raw Markdown navigation or remote executable dependencies", () => {
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert(!links.some(link => /^(?:docs\/|\.\/).*\.md(?:#|$)/.test(link)));
  assert(!links.some(link => /^javascript:/i.test(link)));
  assert(!/<script[^>]+src=/i.test(html));
  assert(!/<iframe/i.test(html));
});

test("V2 archive remains the original HTML apart from line endings", () => {
  // Fixed snapshot identity does not depend on old Git objects being fetched in CI.
  const old = readFileSync(new URL("../archive/v2/index.html", import.meta.url), "utf8");
  assert.equal(createHash("sha256").update(old.replaceAll("\r\n", "\n")).digest("hex"),
    "53a7160273a2615fe3f4e9fdbbb7316ef5091939d110e084cf631e5cda34bd5c");
});
