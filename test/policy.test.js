import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { SiteAllowlist, hostOf, auditAppend, auditRead, DEFAULT_SITES } from "../src/policy.js";
import { makeHandlers } from "../src/mcp-server.js";

test("hostOf extracts hostname, null on garbage", () => {
  assert.equal(hostOf("https://claude.ai/chat"), "claude.ai");
  assert.equal(hostOf("not a url"), null);
});

test("allowlist matches exact host and subdomains, rejects others", () => {
  const al = new SiteAllowlist(["claude.ai", "chatgpt.com"]);
  assert.ok(al.isAllowed("https://claude.ai/x"));
  assert.ok(al.isAllowed("https://www.chatgpt.com/"));
  assert.ok(!al.isAllowed("https://evil.com/claude.ai"));
  assert.ok(!al.isAllowed("https://claude.ai.evil.com/"));
});

test("default sites are non-empty and lowercase", () => {
  assert.ok(DEFAULT_SITES.length > 0);
  assert.deepEqual(DEFAULT_SITES, DEFAULT_SITES.map((s) => s.toLowerCase()));
});

test("audit append and read round-trips", () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wsb-")), "a.jsonl");
  auditAppend(p, { action: "open_tab", url: "https://claude.ai", allowed: true });
  auditAppend(p, { action: "navigate", url: "https://evil.com", allowed: false });
  const rows = auditRead(p);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].action, "open_tab");
  assert.equal(rows[1].allowed, false);
});

function fakeBrowser() {
  return {
    async newPage() {
      return { async goto() {}, async innerText() { return "page text"; } };
    },
  };
}

test("open_tab allows allowlisted host and records audit", async () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wsb-")), "a.jsonl");
  const h = makeHandlers({ allowlist: new SiteAllowlist(["claude.ai"]), auditPath: p }, fakeBrowser());
  const res = await h.open_tab({ key: "k1", url: "https://claude.ai/chat" });
  assert.equal(res.key, "k1");
  assert.equal(auditRead(p)[0].allowed, true);
});

test("open_tab blocks non-allowlisted host and records the denial", async () => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "wsb-")), "a.jsonl");
  const h = makeHandlers({ allowlist: new SiteAllowlist(["claude.ai"]), auditPath: p }, fakeBrowser());
  await assert.rejects(() => h.open_tab({ key: "k1", url: "https://evil.com" }), /blocked by allowlist/);
  assert.equal(auditRead(p)[0].allowed, false);
});

test("read_page errors on unknown key", async () => {
  const h = makeHandlers({ allowlist: new SiteAllowlist(["claude.ai"]), auditPath: path.join(os.tmpdir(), "x.jsonl") }, fakeBrowser());
  await assert.rejects(() => h.read_page({ key: "missing" }), /no tab with key/);
});
