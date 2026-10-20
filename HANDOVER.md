# Maintainer handover

This repository contains the plugins, connector settings and agent skill for
the Bill Tracker MCP server at `https://bills.jirawat.dev/mcp`. The plugin name
is `billing-tracker`, its MCP server key is `bills`, and its first release is
version `0.1.0`. See the [README](README.md) for installation and maintenance.

## Deployment checkpoint

The application was deployed from commit `384a4bd` on 20 October 2026 at
07:15 Asia/Bangkok (00:15 UTC). The deployment smoke check passed:

- public protected-resource metadata identified the MCP resource;
- an unauthenticated MCP request returned HTTP 401 with an OAuth sign-in
  challenge.

Google sign-in and a subsequent live OAuth authorization passed with the
official MCP JavaScript SDK on 20 October 2026. All 21 checks passed: discovery,
PKCE code exchange, tool/resource/prompt discovery, a bounded bill read,
synthetic zero-baht bill create/read/update, deletion confirmation, refresh
rotation and reconnect, revocation, and rejection of the revoked token. The
synthetic bill was deleted and the grant revoked. LINE sign-in and individual
product clients still need separate live checks.

The configurations and documentation cover the server's 30 tools, 3 resources
and 1 prompt, its error codes, confirmation and dry-run rules, default scopes
including `offline_access`, separate approval for `account:delete`, and the
500-bill cap on `bills.list`.

The documentation now reflects these details of the deployed contract:

- `initialize` offers of an unsupported revision receive `2025-11-25`, and
  the client decides whether it can continue. An unsupported protocol header
  still gets `-32022`.
- Every `chat.run` command needs `chat:write`; deletion additionally needs
  `bills:delete`.
- The mcp-remote examples omit `--protocol auto`. The server advertises
  `2025-11-25` and `2025-06-18` through `server/discover`; use its ordinary
  handshake bridge with the documented configuration.

## Publish this repository

Before the first push, confirm that `origin` is the intended public repository,
review the full tree and history for private data, and run:

```bash
node scripts/sync.mjs --check
node scripts/validate.mjs --ci
git diff --check
```

Publish the reviewed `main` branch with:

```bash
git push -u origin main
```

If the public repository already has commits, reconcile its history first.
Keep the existing `billing-tracker` plugin and marketplace identities. Do not
create a second plugin or force-push over another history.

The first public CI run also checks the published schema formats, client
validators and links. The README CI badge and repository links need that first
push before they can resolve.

## Remaining release checks

- **Live clients.** Before deployment, local installs in Claude Code, Gemini
  CLI, Codex, Copilot CLI and Antigravity CLI loaded the server and skill.
  This was configuration validation, not authenticated live compatibility.
  Cursor, VS Code, Claude apps, ChatGPT, Windsurf, Cline and Zed were not
  exercised. Record each live client result separately.
- **MCP Registry.** Version `0.1.0` of the existing
  `io.github.jirawatp/billing-tracker` identity was published successfully on
  20 October 2026 after public CI passed. Retain that identity. For a later
  release, run **Publish to MCP Registry** from `main` in Actions. The workflow
  checks for the OAuth challenge, signs in using GitHub OIDC and publishes
  `server.json`. A registry version cannot
  be published twice: bump `config.json` and run `node scripts/sync.mjs`
  before publishing a later release.
- **Directory listings.** Claude, OpenAI, Cursor and Cline directory
  submissions remain separate work. The manifests do not include privacy
  policy or terms URLs; complete any directory's required fields before
  submitting there.
