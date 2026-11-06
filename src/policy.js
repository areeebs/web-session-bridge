// Pure, dependency-free core of web-session-bridge: a site allowlist and an
// append-only audit log. Keeping this logic separate from the browser/MCP
// wiring makes the security-critical part easy to test and reason about.

import fs from "node:fs";

/** Normalize a URL to its lowercase hostname, or null if it can't be parsed. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export class SiteAllowlist {
  /** @param {string[]} sites bare hostnames, e.g. ["claude.ai", "chatgpt.com"] */
  constructor(sites = []) {
    this.sites = sites.map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  /** True if the URL's host is an allowed site or a subdomain of one. */
  isAllowed(url) {
    const host = hostOf(url);
    if (!host) return false;
    return this.sites.some((s) => host === s || host.endsWith("." + s));
  }
}

/** The sites the reference config ships with (all require your own login). */
export const DEFAULT_SITES = [
  "chatgpt.com",
  "claude.ai",
  "perplexity.ai",
  "aistudio.google.com",
  "gemini.google.com",
  "grok.com",
];

/** Append one JSON record to an append-only audit log. */
export function auditAppend(path, record) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...record }) + "\n";
  fs.appendFileSync(path, line);
}

/** Read an audit log back into an array of records. */
export function auditRead(path) {
  if (!fs.existsSync(path)) return [];
  return fs
    .readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}
