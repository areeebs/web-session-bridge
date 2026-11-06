# web-session-bridge

A **local MCP server** that lets an MCP-capable agent (Claude Code, Codex,
OpenCode) drive *your own* logged-in browser sessions — open keyed tabs, read
pages, navigate — while keeping two guardrails front and center: a **site
allowlist** and an **append-only audit log** of every navigation.

Inspired by [agentify-sh/desktop](https://github.com/agentify-sh/desktop), which
pioneered using your existing AI web subscriptions from an agent. This is a
clean-room take with a different emphasis: instead of maximizing reach, it makes
**what the agent is allowed to touch, and what it actually did, explicit and
reviewable** — a natural fit beside the AI-agent-security tools in
[`agent-fence`](https://github.com/areeebs/agent-fence) and
[`skill-sec-bench`](https://github.com/areeebs/skill-sec-bench).

## Install & run

```bash
npm install                      # pulls the MCP SDK + Playwright
npx playwright install chromium  # one-time browser download
npx web-session-bridge mcp       # start the MCP server over stdio
```

Register it with an MCP client, e.g. Claude Code:

```bash
claude mcp add --transport stdio web-session-bridge -- npx -y web-session-bridge mcp
```

List the allowlisted sites without starting the server:

```bash
npx web-session-bridge sites
```

## Tools exposed

| tool         | what it does                                            |
|--------------|---------------------------------------------------------|
| `list_sites` | return the allowlisted hosts                            |
| `open_tab`   | open `{url}` under a stable `{key}` (allowlisted only)  |
| `navigate`   | point an existing keyed tab at a new URL (allowlisted)  |
| `read_page`  | return the visible text of a keyed tab                  |

`open_tab` and `navigate` call the allowlist first; a blocked host throws and is
still recorded as a denial.

## The two guardrails

- **Site allowlist** — only the configured hosts (and their subdomains) can be
  opened. Default list: ChatGPT, Claude, Perplexity, Gemini, AI Studio, Grok.
  Override with `WSB_SITES="claude.ai,chatgpt.com"`.
- **Audit log** — every `open_tab`/`navigate` appends one JSON line (timestamp,
  action, URL, host, allowed?) to `WSB_AUDIT` (default
  `web-session-bridge.audit.jsonl`). Append-only, so the trail of what the agent
  did to your signed-in sessions can't be quietly edited.

## Architecture

`src/policy.js` is the dependency-free, fully-tested core (allowlist + audit).
`src/mcp-server.js` wires those guards to Playwright and the MCP SDK (imported
lazily, so the core and its tests need nothing installed). That split keeps the
security-critical logic small and verifiable — `npm test` runs it with zero
external dependencies.

## Safety & scope

It automates **your own** browser with **your own** logins; it never handles
credentials itself. It won't touch any site outside the allowlist, and it keeps
a record of everything. Treat page content the agent reads as untrusted input.

## Roadmap

- Local control-center GUI (tab list, live audit view, per-site toggles).
- File upload / artifact download tools.
- Per-tool allow/confirm policy (reuse `agent-fence`'s policy model).

## License

[MIT](LICENSE).
