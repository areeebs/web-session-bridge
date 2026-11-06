#!/usr/bin/env node
// Entry point / CLI for web-session-bridge.
//   web-session-bridge mcp [--show-tabs]   start the MCP server over stdio
//   web-session-bridge sites               print the allowlisted sites
//   web-session-bridge gui                 (placeholder; see roadmap)

import { loadConfig } from "./mcp-server.js";

const cmd = process.argv[2];

async function main() {
  if (cmd === "mcp") {
    const { start } = await import("./mcp-server.js");
    await start();
    return;
  }
  if (cmd === "sites") {
    console.log(loadConfig().allowlist.sites.join("\n"));
    return;
  }
  if (cmd === "gui") {
    console.log("The local control-center GUI is on the roadmap. Use `mcp` for now.");
    return;
  }
  console.log(`web-session-bridge <command>

  mcp [--show-tabs]   start the MCP server (stdio) for an MCP client
  sites               list the allowlisted sites
  gui                 local control center (roadmap)

Config via env: WSB_SITES (comma-separated hosts), WSB_AUDIT (log path).`);
  process.exitCode = cmd ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
