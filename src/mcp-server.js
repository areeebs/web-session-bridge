// MCP server wiring: exposes browser-session tools to an MCP client, with every
// navigation checked against the SiteAllowlist and recorded in the audit log.
//
// Playwright and the MCP SDK are imported lazily so the pure policy core (and
// its tests) don't need them installed. Install with `npm install` before
// running `web-session-bridge mcp`.

import { SiteAllowlist, DEFAULT_SITES, auditAppend, hostOf } from "./policy.js";

export function loadConfig(env = process.env) {
  const sites = env.WSB_SITES ? env.WSB_SITES.split(",") : DEFAULT_SITES;
  return {
    allowlist: new SiteAllowlist(sites),
    auditPath: env.WSB_AUDIT || "web-session-bridge.audit.jsonl",
    showTabs: process.argv.includes("--show-tabs"),
  };
}

/**
 * Build the tool handlers. `browser` is any object with the small surface we
 * use (injected in tests); in production it's a Playwright BrowserContext
 * wrapper created in start().
 */
export function makeHandlers(config, browser) {
  const tabs = new Map();

  function guard(action, url) {
    const allowed = config.allowlist.isAllowed(url);
    auditAppend(config.auditPath, { action, url, host: hostOf(url), allowed });
    if (!allowed) {
      throw new Error(`blocked by allowlist: ${hostOf(url) || url}`);
    }
  }

  return {
    async list_sites() {
      return { sites: config.allowlist.sites };
    },
    async open_tab({ key, url }) {
      guard("open_tab", url);
      const tab = await browser.newPage();
      await tab.goto(url);
      tabs.set(key, tab);
      return { key, url };
    },
    async navigate({ key, url }) {
      guard("navigate", url);
      const tab = tabs.get(key);
      if (!tab) throw new Error(`no tab with key '${key}'`);
      await tab.goto(url);
      return { key, url };
    },
    async read_page({ key }) {
      const tab = tabs.get(key);
      if (!tab) throw new Error(`no tab with key '${key}'`);
      return { key, text: await tab.innerText("body") };
    },
  };
}

// Tool schemas advertised to the MCP client.
export const TOOLS = [
  { name: "list_sites", description: "List the allowlisted sites.", inputSchema: { type: "object", properties: {} } },
  { name: "open_tab", description: "Open a URL in a keyed browser tab (allowlisted hosts only).",
    inputSchema: { type: "object", properties: { key: { type: "string" }, url: { type: "string" } }, required: ["key", "url"] } },
  { name: "navigate", description: "Navigate an existing keyed tab to a new URL.",
    inputSchema: { type: "object", properties: { key: { type: "string" }, url: { type: "string" } }, required: ["key", "url"] } },
  { name: "read_page", description: "Return the visible text of a keyed tab.",
    inputSchema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] } },
];

export async function start() {
  const config = loadConfig();
  const { chromium } = await import("playwright");
  const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { CallToolRequestSchema, ListToolsRequestSchema } =
    await import("@modelcontextprotocol/sdk/types.js");

  const context = await chromium.launchPersistentContext("./.wsb-profile", {
    headless: !config.showTabs,
  });
  const handlers = makeHandlers(config, context);

  const server = new Server({ name: "web-session-bridge", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const fn = handlers[req.params.name];
    if (!fn) throw new Error(`unknown tool: ${req.params.name}`);
    const result = await fn(req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  });

  await server.connect(new StdioServerTransport());
}
