# Maintainer handover

This repository contains the plugins, connector settings and agent skill for
the Bill Tracker MCP server at `https://bills.jirawat.dev/mcp`. The plugin name
is `billing-tracker`, its MCP server key is `bills`, and its first release is
version `0.1.0`. See the [README](README.md) for installation and maintenance.

## Deployment checkpoint

The application was first deployed from commit `384a4bd` on 20 October 2026
at 07:15 Asia/Bangkok (00:15 UTC), then updated to `275a267` at 08:06
Asia/Bangkok (01:06 UTC). The policy/offline-cache release `78f7f46` followed
at 08:16 Asia/Bangkok (01:16 UTC). All deployment smoke checks passed:

- public protected-resource metadata identified the MCP resource;
- an unauthenticated MCP request returned HTTP 401 with an OAuth sign-in
  challenge.

Google sign-in and a subsequent live OAuth authorization passed with the
official MCP JavaScript SDK on 20 October 2026. All 21 checks passed: discovery,
PKCE code exchange, tool/resource/prompt discovery, a bounded bill read,
synthetic zero-baht bill create/read/update, deletion confirmation, refresh
rotation and reconnect, revocation, and rejection of the revoked token. The
synthetic bill was deleted and the grant revoked. The user also verified
browser LINE QR sign-in and reached the bill ledger on 20 October 2026.
Individual product clients and their own LINE OAuth flows still need separate
live compatibility checks.

The bilingual [Privacy Policy](https://bills.jirawat.dev/privacy) and
[Terms of Service](https://bills.jirawat.dev/terms) are complete, effective
20 October 2026, with the owner's supplied public contact details. The service
is currently free; any future paid plan requires separate agreement before
charging. Both production pages and service worker v8 were verified against
the committed sources, with no draft placeholders or `noindex` remaining.

The configurations and documentation cover the server's 30 tools, 3 resources
and 1 prompt, its error codes, confirmation and dry-run rules, default scopes
including `offline_access`, separate approval for `account:delete`, and the
500-bill cap on `bills.list`.

The protocol documentation reflects the deployed negotiation behavior:

- `initialize` offers of an unsupported revision receive `2025-11-25`, and
  the client decides whether it can continue. An unsupported protocol header
  still gets `-32022`.
- The mcp-remote examples omit `--protocol auto`. The server advertises
  `2025-11-25` and `2025-06-18` through `server/discover`; use its ordinary
  handshake bridge with the documented configuration.

## Current server contract

The following changes are confirmed live after the application update:

- `chat.run` read commands (`help`, `list`, `due`, `overdue`, `unconfirmed`,
  `summary`) accept `bills:read` or `chat:write`. Mutations need `chat:write`,
  and deletion additionally needs `bills:delete`. Existing writer-only tokens
  retain their behavior; `chat:read` remains parser-only.
- Account-deletion permission expires at the original sign-in time plus five
  minutes. Consent and code exchange cannot extend it, and no refresh token
  is issued.
- Bill date write inputs in years 2400 to 2699 inclusive convert from
  Buddhist Era by subtracting 543 before Gregorian calendar validation.
  Query/report dates and timestamps are unchanged, as are unchanged legacy
  bill values. The date policy applies to the app, LINE/chat, CSV and MCP.

## Publish documentation updates

The public repository and version `0.1.0` registry entry already exist. Keep
the current plugin, marketplace and registry identities and version for this
documentation update; do not run the registry publishing workflow again.
Before pushing, confirm that the corresponding server contract is live,
review the diff for private data, and run:

```bash
node scripts/sync.mjs --check
node scripts/validate.mjs --ci
git diff --check
```

After committing the reviewed documentation on `main`, publish it with:

```bash
git push -u origin main
```

Keep the existing `billing-tracker` plugin and marketplace identities. Do not
create a second plugin or force-push over another history. Public CI checks
the published schema formats, client validators and links on each push.

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
  submissions remain separate work. Supply the public
  [Privacy Policy](https://bills.jirawat.dev/privacy) and
  [Terms of Service](https://bills.jirawat.dev/terms) wherever a directory
  requests them, and complete its remaining required fields before submitting.
