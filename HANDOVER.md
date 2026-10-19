# Handover

This branch holds the full history of the public repository
`jirawatp/billing-tracker-agent-plugins`: the plugins, connector settings and
agent skill for the Bill Tracker MCP server at `https://bills.jirawat.dev/mcp`.
It was built and validated locally and has not been pushed to the public
repository yet. See the [README](README.md) for what is in it and how it is
maintained.

## Publish

Once the public repository exists and is still empty, push this branch to its
`main` from a clone of the private source repository that holds this branch:

```bash
git clone --single-branch --branch cursor/agent-plugins-export-4fa1 <private source repository URL> agent-plugins
cd agent-plugins
git push https://github.com/jirawatp/billing-tracker-agent-plugins cursor/agent-plugins-export-4fa1:main
```

That also publishes this file, which holds no secrets. To leave it out, push
`cursor/agent-plugins-export-4fa1~1:main` instead, or delete it afterwards. If
the public repository is no longer empty, rebase this branch onto its `main`
(keep this branch's `README.md`) before pushing.

## Contract

The server address and integration contract match PR #49 in the private source
repository ("MCP server (combined)", open and unmerged on 2026-10-19). Checked
against that PR's tool-schema snapshot and code:
- the server URL;
- all 30 tool names;
- the error codes and kinds;
- the confirm and dry-run rules;
- the 3 resources and the prompt;
- the default scope hint (with `offline_access`) and the separate approval for
  `account:delete`;
- the 500-bill cap on `bills.list`.

Three wording differences to fix before publishing:

- **Protocol negotiation.** In PR #49, `initialize` never fails on version: it
  answers `2025-11-25` and the client decides. `-32022` only comes back for
  other requests with an unsupported `MCP-Protocol-Version` header. The
  README's "Before you start" and its `-32022` troubleshooting entry say a
  first offer of `2026-07-28` gets `-32022`, and that `2025-03-26` clients
  cannot connect. That should become "may not connect".
- **`chat.run` permission.** In PR #49, `chat.run` needs `chat:write` for
  every command, and deleting through it also needs `bills:delete`. The
  README permission table and `references/tools.md` say `chat:write` is only
  for commands that change data.
- **mcp-remote `--protocol auto`.** The server plan recommends it for old
  clients. PR #49 answers `server/discover` listing only `2025-11-25` and
  `2025-06-18`, and mcp-remote 0.15.1 in that mode then refuses to bridge.
  This repository deliberately does not use the flag; the plan text should
  drop it.

## Still placeholder or untested

- **Live server.** Nothing here has been tested against a running server. On
  2026-10-19 the server URL still served the web app, so the server was not
  deployed yet. The plugin was only installed locally with Claude Code, Gemini
  CLI, Codex, Copilot CLI and Antigravity CLI, and each loaded the server and
  the skill. Cursor, VS Code, the Claude apps, ChatGPT, Windsurf, Cline and
  Zed were not exercised.
- **CI badge.** The README's CI badge and Actions link return 404 until the
  first push to the public repository. The first CI run checks them again.
- **Pre-launch note.** Remove the README's "has not launched yet" note once
  the server is live and tested.
- **MCP Registry.** Publish with the manual workflow after launch; it refuses
  to run until the server answers with an OAuth challenge. First decide the
  name: `io.github.jirawatp/billing-tracker`, or `dev.jirawat/billing-tracker`
  with DNS verification.
- **Directory listings.** Nothing has been submitted to the Claude, OpenAI,
  Cursor or Cline directories, and the manifests carry no privacy policy or
  terms URLs.
