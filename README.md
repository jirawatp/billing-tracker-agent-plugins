# Bill Tracker agent plugins

[![CI](https://github.com/jirawatp/billing-tracker-agent-plugins/actions/workflows/ci.yml/badge.svg)](https://github.com/jirawatp/billing-tracker-agent-plugins/actions/workflows/ci.yml)

Connect your AI agent to [Bill Tracker](https://bills.jirawat.dev), a personal
bill tracker with LINE reminders. Once connected, your agent can tell you what
is due or overdue, record payments, add and edit bills, and summarize your
spending, all through your own Bill Tracker account.

This repository holds the plugins, connector settings and agent skill. They all
point at one remote MCP server:

```text
https://bills.jirawat.dev/mcp
```

> [!NOTE]
> The Bill Tracker MCP server has not launched yet. Everything here follows the
> server's published integration contract and each client's documented setup
> format, but none of it has been tested against the live server.

## Contents

- [What is in this repository](#what-is-in-this-repository)
- [Before you start](#before-you-start)
- [Sign-in, permissions and privacy](#sign-in-permissions-and-privacy)
- [Choose your client](#choose-your-client)
- [Install](#install)
- [Headless agents: personal access tokens](#headless-agents-personal-access-tokens)
- [What your agent can do](#what-your-agent-can-do)
- [Troubleshooting](#troubleshooting)
- [Repository layout](#repository-layout)
- [Maintaining this repository](#maintaining-this-repository)
- [License](#license)

## What is in this repository

- **One plugin** that bundles the MCP server and the `billing-tracker` agent
  skill. It installs natively in Claude Code, Codex and the ChatGPT desktop
  app, Cursor, VS Code, GitHub Copilot CLI, Gemini CLI and Antigravity CLI.
- **Plugin marketplaces**, so Claude Code, GitHub Copilot CLI, VS Code and Codex
  can add this repository as a marketplace and keep the plugin updated.
- **A `server.json`** for the official MCP Registry.
- **Copy-paste settings** for clients that connect to MCP servers directly:
  Claude apps, ChatGPT, Windsurf, Cline, Zed and stdio-only clients.
- **A portable [Agent Skill](https://agentskills.io/specification)** that
  teaches agents to use the bill tools well: common tasks, confirming before
  destructive changes, and handling dates and Thai Baht amounts.

Every configuration names the server `bills`.

## Before you start

- **A Bill Tracker account.** Sign in once at
  [Bill Tracker](https://bills.jirawat.dev) with Google or LINE to create one.
- **An MCP client that supports remote servers.** The server uses the
  Streamable HTTP transport with OAuth sign-in. Every client below supports
  that; clients that can only start local (stdio) servers can use the
  [mcp-remote bridge](#other-clients-stdio-only).
- **A current client.** The server implements MCP protocol revision
  `2026-07-28` and also accepts `2025-06-18` for older clients. The legacy
  HTTP+SSE transport is not supported.

## Sign-in, permissions and privacy

- **You sign in with your own account.** The first time your agent connects, a
  browser window opens on the Bill Tracker site. Sign in with the same Google
  or LINE account you use in the app, then review the consent screen, which shows
  the agent's name and the permissions it asks for. You never need a client ID,
  secret or API key: clients discover the sign-in flow on their own through
  standard MCP authorization (OAuth 2.1 with PKCE, client registration through
  Client ID Metadata Documents or Dynamic Client Registration).
- **You only see your own bills.** Every request runs as the account that
  signed in. An agent connected to your account cannot reach anyone else's
  bills.
- **Permissions are granted step by step.** By default the first sign-in asks
  for `bills:read` and `bills:write` (some clients, such as Codex, ask for every
  permission up front). When the agent first uses a tool that needs more, the
  server asks for that permission and your client either reopens the consent
  screen or asks you to sign in to the server again.
- **You can disconnect any agent.** Open
  [Settings > Connected AI agents](https://bills.jirawat.dev/settings/connected-agents)
  in Bill Tracker to see every connected agent and personal access token, and
  revoke any of them. Signing out of Bill Tracker on all devices does not
  disconnect agents; revoke them on that page.
- **Destructive actions need confirmation.** The server refuses to delete
  bills, unlink LINE or delete your account unless the request carries an
  explicit confirmation, and the included skill tells agents to ask you first.
- **This repository holds no data and no secrets.** It contains only
  configuration and instructions. Your MCP client stores your sign-in tokens,
  and your bills stay in Bill Tracker.

| Permission | Lets the agent |
| --- | --- |
| `bills:read` | List, search and read bills and summaries |
| `bills:write` | Add and edit bills, record payments, confirm amounts, schedule payments |
| `bills:delete` | Delete bills |
| `reports:read` | Read spending reports |
| `account:read` | Export all of your data |
| `account:manage` | Sign you out on every device, turn LINE reminders on or off, unlink LINE |
| `account:delete` | Delete your Bill Tracker account |
| `line:read` | See whether LINE is linked and reminders are on |
| `chat:read` | Parse LINE chatbot commands without running them |
| `chat:write` | Run LINE chatbot commands that change data |

## Choose your client

| Client | Recommended setup | Includes the skill |
| --- | --- | --- |
| [Claude Code](#claude-code) | Plugin from this marketplace | Yes |
| [Claude apps](#claude-apps-claudeai-claude-desktop-mobile) (claude.ai, Claude Desktop, mobile) | Custom connector | Upload it separately |
| [ChatGPT](#chatgpt) (Business, Enterprise and Edu, on the web) | Custom MCP server, created as a plugin | No |
| [Codex](#codex-cli-ide-extension-and-chatgpt-desktop-app) (CLI, IDE extension, ChatGPT desktop app) | Plugin from this marketplace | Yes |
| [Cursor](#cursor) | One-click install link, or local plugin | With the plugin |
| [VS Code and GitHub Copilot](#vs-code-and-github-copilot) | One-click install link, or plugin from source | With the plugin |
| [GitHub Copilot CLI](#github-copilot-cli) | Plugin from this marketplace | Yes |
| [Gemini CLI](#gemini-cli) | Extension | Yes |
| [Antigravity CLI](#antigravity-cli) | Plugin | Yes |
| [Windsurf](#windsurf) | `mcp_config.json` entry | No |
| [Cline](#cline) | Remote server | No |
| [Zed](#zed) | `context_servers` entry | No |
| [Stdio-only clients](#other-clients-stdio-only) | `mcp-remote` bridge | No |

Any agent that supports Agent Skills can add the skill on its own; see
[Skill only](#skill-only). Use one setup per client: installing the plugin and
also adding the server by hand gives you every tool twice.

## Install

### Claude Code

Install the plugin, which adds the MCP server and the skill. Inside Claude
Code:

```text
/plugin marketplace add jirawatp/billing-tracker-agent-plugins
/plugin install billing-tracker@billing-tracker
```

Or from a terminal:

```bash
claude plugin marketplace add jirawatp/billing-tracker-agent-plugins
claude plugin install billing-tracker@billing-tracker
```

Then run `/reload-plugins` (or restart Claude Code), open `/mcp`, select
`plugin:billing-tracker:bills` and choose Authenticate.

To add only the server, for every project:

```bash
claude mcp add --transport http --scope user bills https://bills.jirawat.dev/mcp
claude mcp login bills
```

On a machine without a browser, `claude mcp login bills --no-browser` prints
the sign-in URL and asks you to paste the redirect URL back.

If a tool later fails with "needs additional permissions", open `/mcp` and
authenticate the server again to approve the extra permission.

### Claude apps (claude.ai, Claude Desktop, mobile)

Add Bill Tracker as a custom connector. Custom connectors are available on the
Free (one custom connector), Pro, Max, Team and Enterprise plans, and once added
they work in claude.ai, Claude Desktop, Cowork and the mobile apps.

1. Go to **Customize > Connectors**, select **+ Add**, then
   **Add custom connector**.
2. Enter the name `Bill Tracker` and the URL `https://bills.jirawat.dev/mcp`,
   then select **Continue**.
3. Under **Authentication**, choose **Sign in now**. Under **OAuth client**,
   keep **Use Claude's published identity (Recommended)**. Leave
   **Request headers** empty.
4. Select **Add**, then sign in with Google or LINE in the window that opens.
5. In a chat, turn the connector on from the **+** menu under **Connectors**.

On Team and Enterprise plans an Owner adds the connector in the organization
settings, and each member then connects their own Bill Tracker account. Claude
reaches the server from Anthropic's cloud, not from your computer.

To add the skill as well, turn on **Code execution and file creation** in
**Settings > Capabilities**, build a ZIP that contains the `billing-tracker`
folder, and upload it in **Customize > Skills** with **+ > Create skill >
Upload a skill**:

```bash
git clone https://github.com/jirawatp/billing-tracker-agent-plugins
cd billing-tracker-agent-plugins/skills
zip -r billing-tracker.zip billing-tracker
```

### ChatGPT

Custom MCP servers with full tool support are available on ChatGPT Business,
Enterprise and Edu, on the web only. On Business, only workspace admins and
owners can add one; on Enterprise and Edu, admins and the members they
authorize can. Pro accounts can connect custom MCP servers with read and fetch
access only, so Bill Tracker's tools that change data are not available there.

1. Open **Plugins** in ChatGPT, select the **+** button, then
   **Add custom MCP server**.
2. Enter the name `Bill Tracker` and, under **Connection**, the URL
   `https://bills.jirawat.dev/mcp`.
3. Choose OAuth for authentication. ChatGPT discovers the sign-in settings from
   the server, so leave the client ID and secret empty.
4. Review the risk warning, select **I understand and want to continue**, then
   **Create as a plugin**.
5. Review the discovered tools, install the plugin and sign in with Google or
   LINE when asked.
6. In a new chat, type `@` and choose Bill Tracker.

To share it with the workspace, an admin or owner publishes the plugin.
ChatGPT asks you to confirm write actions according to the plugin's
permissions.

### Codex (CLI, IDE extension and ChatGPT desktop app)

The Codex CLI, the Codex IDE extension and the ChatGPT desktop app share
`~/.codex/config.toml`, so you only set this up once. Install the plugin, which
adds the MCP server and the skill:

```bash
codex plugin marketplace add jirawatp/billing-tracker-agent-plugins
codex plugin add billing-tracker@billing-tracker
```

After adding the marketplace you can also install the plugin from the Plugins
directory in the ChatGPT desktop app.

To add only the server:

```bash
codex mcp add bills --url https://bills.jirawat.dev/mcp
```

which writes this to `~/.codex/config.toml`:

```toml
[mcp_servers.bills]
url = "https://bills.jirawat.dev/mcp"
```

Sign in with `codex mcp login bills` (add `--no-browser` on a remote machine),
or select Authenticate next to the server in the MCP servers settings of the
desktop app or IDE extension. Codex requests every permission the server
offers; to grant only the basics, run
`codex mcp login bills --scopes bills:read,bills:write`.

### Cursor

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=bills&config=eyJ1cmwiOiJodHRwczovL2JpbGxzLmppcmF3YXQuZGV2L21jcCJ9)

The button opens Cursor and asks you to confirm. The same install link as a
Cursor deeplink:

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=bills&config=eyJ1cmwiOiJodHRwczovL2JpbGxzLmppcmF3YXQuZGV2L21jcCJ9
```

Or add the server to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json`
(one project):

```json
{
  "mcpServers": {
    "bills": {
      "url": "https://bills.jirawat.dev/mcp"
    }
  }
}
```

Cursor runs the sign-in flow when the server first connects. Manage the server,
or sign in again, from **Customize**.

For the plugin with the skill: Cursor installs plugins from the Cursor
Marketplace and team marketplaces. Until Bill Tracker is listed there, load it
as a local plugin, then restart Cursor or run **Developer: Reload Window**:

```bash
git clone https://github.com/jirawatp/billing-tracker-agent-plugins ~/.cursor/plugins/local/billing-tracker
```

On Teams and Enterprise plans an admin has to allow local plugin imports.

### VS Code and GitHub Copilot

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square)](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522bills%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fbills.jirawat.dev%252Fmcp%2522%257D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Server-24bfa5?style=flat-square)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522bills%2522%252C%2522type%2522%253A%2522http%2522%252C%2522url%2522%253A%2522https%253A%252F%252Fbills.jirawat.dev%252Fmcp%2522%257D)

Or from a terminal:

```bash
code --add-mcp '{"name":"bills","type":"http","url":"https://bills.jirawat.dev/mcp"}'
```

Or add it to `.vscode/mcp.json` in a workspace, or to your user `mcp.json`
(run **MCP: Open User Configuration**):

```json
{
  "servers": {
    "bills": {
      "type": "http",
      "url": "https://bills.jirawat.dev/mcp"
    }
  }
}
```

VS Code asks you to sign in the first time the server starts. Use
**MCP: List Servers** to start, stop or sign in to the server again.

For the plugin with the skill, make sure the `chat.plugins.enabled` setting is
on, run **Chat: Install Plugin From Source** and enter
`https://github.com/jirawatp/billing-tracker-agent-plugins`. To receive updates
through a marketplace instead, add this repository to the
`chat.plugins.marketplaces` setting and install Bill Tracker from the
Extensions view (search for `@agentPlugins`):

```json
{
  "chat.plugins.marketplaces": [
    "jirawatp/billing-tracker-agent-plugins"
  ]
}
```

### GitHub Copilot CLI

Install the plugin, which adds the MCP server and the skill:

```bash
copilot plugin marketplace add jirawatp/billing-tracker-agent-plugins
copilot plugin install billing-tracker@billing-tracker
```

To add only the server:

```bash
copilot mcp add --transport http bills https://bills.jirawat.dev/mcp
```

When the server shows `needs-auth`, run `/mcp auth bills` in Copilot CLI and
sign in. VS Code also picks up plugins and servers that you add with Copilot
CLI.

### Gemini CLI

Gemini CLI now serves Gemini Code Assist and API key users; individual Google
accounts moved to [Antigravity CLI](#antigravity-cli) in June 2026. Install the
extension, which adds the MCP server and the skill:

```bash
gemini extensions install https://github.com/jirawatp/billing-tracker-agent-plugins
```

Restart Gemini CLI, then run `/mcp auth bills` to sign in. Update later with
`gemini extensions update billing-tracker`.

To add only the server:

```bash
gemini mcp add --scope user --transport http bills https://bills.jirawat.dev/mcp
```

### Antigravity CLI

Install the plugin, which adds the MCP server and the skill:

```bash
agy plugin install https://github.com/jirawatp/billing-tracker-agent-plugins
```

To sign in, run `/mcp`, select `bills`, choose **Authenticate**, finish signing
in in your browser, then paste the code it shows back into the terminal.

To add only the server, which writes `serverUrl` to
`~/.gemini/config/mcp_config.json`:

```bash
agy mcp add bills https://bills.jirawat.dev/mcp
```

If you already installed the Gemini CLI extension, `agy plugin import gemini`
converts it.

### Windsurf

In Cascade's MCP menu choose **Open MCP config file** (on current versions this
is `~/.config/devin/mcp_config.json`, or `%AppData%\devin\mcp_config.json` on
Windows; older versions use `~/.codeium/windsurf/mcp_config.json`) and add:

```json
{
  "mcpServers": {
    "bills": {
      "serverUrl": "https://bills.jirawat.dev/mcp"
    }
  }
}
```

Press the refresh button in the MCP panel. Cascade asks you to sign in the
first time it uses the server.

### Cline

In the Cline panel open **MCP Servers**, then the **Remote Servers** tab. Enter
the name `bills` and the URL `https://bills.jirawat.dev/mcp`, choose
**Streamable HTTP**, and select **Add Server**. When Cline reports that the
server needs authentication, select **Authenticate** and sign in in your
browser.

To edit the settings file instead (**Configure MCP Servers** in the extension,
or `~/.cline/data/settings/cline_mcp_settings.json` for the Cline CLI):

```json
{
  "mcpServers": {
    "bills": {
      "type": "streamableHttp",
      "url": "https://bills.jirawat.dev/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Keep `"type": "streamableHttp"`. Without it Cline uses the legacy SSE
transport, which this server does not support.

### Zed

Open **Settings > AI > MCP Servers**, select **Add Server**, then
**Add Remote Server**. Or add this to your settings file
(`zed: open settings file`):

```json
{
  "context_servers": {
    "bills": {
      "url": "https://bills.jirawat.dev/mcp"
    }
  }
}
```

With no `Authorization` header configured, Zed runs the standard MCP sign-in
flow. External agents that Zed runs over ACP do not share that sign-in;
configure the server in those agents directly.

### Other clients (stdio only)

For clients that can only start local MCP servers, run
[mcp-remote](https://github.com/punkpeye/mcp-remote) as a bridge. It needs
Node.js, opens the browser for sign-in and keeps tokens in `~/.mcp-auth`.

```json
{
  "mcpServers": {
    "bills": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://bills.jirawat.dev/mcp",
        "--transport",
        "http-only"
      ]
    }
  }
}
```

This is the `mcpServers` format most clients use, including the local
`claude_desktop_config.json` of Claude Desktop (where a custom connector is
the better choice).

### Skill only

The `billing-tracker` skill follows the
[Agent Skills specification](https://agentskills.io/specification), so any
agent that supports skills can use it next to one of the server setups above.
With the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add jirawatp/billing-tracker-agent-plugins
```

It asks which agents to install to; add `-g` to install for your user instead
of the current project. You can also copy `skills/billing-tracker` into your
agent's skills folder.

## Headless agents: personal access tokens

Scripts, CI jobs and agents that cannot open a browser can use a personal
access token instead of OAuth.

1. Open
   [Settings > Connected AI agents](https://bills.jirawat.dev/settings/connected-agents)
   in Bill Tracker and select **Create personal access token**. Name it, pick
   its permissions and expiry, and copy the token. It is shown only once.
2. Store it as a secret, for example in an environment variable named
   `BILL_TRACKER_TOKEN`.
3. Send it on every request as a bearer token:

```text
Authorization: Bearer <token>
```

The server treats a personal access token exactly like a signed-in session with
the permissions you picked. It expires on the date you chose; revoke or replace
it on the same settings page.

**Claude Code.** Single quotes keep `${BILL_TRACKER_TOKEN}` as a reference that
Claude Code reads when it connects:

```bash
claude mcp add --transport http --scope user bills https://bills.jirawat.dev/mcp \
  --header 'Authorization: Bearer ${BILL_TRACKER_TOKEN}'
```

For `claude -p` in CI, pass a file like this with `--mcp-config`:

```json
{
  "mcpServers": {
    "bills": {
      "type": "http",
      "url": "https://bills.jirawat.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${BILL_TRACKER_TOKEN}"
      }
    }
  }
}
```

**Codex**, in `~/.codex/config.toml` (or
`codex mcp add bills --url https://bills.jirawat.dev/mcp --bearer-token-env-var BILL_TRACKER_TOKEN`):

```toml
[mcp_servers.bills]
url = "https://bills.jirawat.dev/mcp"
bearer_token_env_var = "BILL_TRACKER_TOKEN"
```

**Cursor**, in `mcp.json`:

```json
{
  "mcpServers": {
    "bills": {
      "url": "https://bills.jirawat.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${env:BILL_TRACKER_TOKEN}"
      }
    }
  }
}
```

**VS Code**, in `.vscode/mcp.json`. VS Code asks for the token once and stores
it securely:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "bill-tracker-token",
      "description": "Bill Tracker personal access token",
      "password": true
    }
  ],
  "servers": {
    "bills": {
      "type": "http",
      "url": "https://bills.jirawat.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${input:bill-tracker-token}"
      }
    }
  }
}
```

**GitHub Copilot CLI** (single quotes keep the variable reference):

```bash
copilot mcp add --transport http --header 'Authorization: Bearer ${BILL_TRACKER_TOKEN}' bills https://bills.jirawat.dev/mcp
```

**Gemini CLI** and **Antigravity CLI** store the token itself in their
settings:

```bash
gemini mcp add --scope user --transport http --header "Authorization: Bearer $BILL_TRACKER_TOKEN" bills https://bills.jirawat.dev/mcp
agy mcp add --header "Authorization: Bearer $BILL_TRACKER_TOKEN" bills https://bills.jirawat.dev/mcp
```

**Windsurf** and **Cline** expand `${env:...}` in headers:

```json
{
  "mcpServers": {
    "bills": {
      "serverUrl": "https://bills.jirawat.dev/mcp",
      "headers": {
        "Authorization": "Bearer ${env:BILL_TRACKER_TOKEN}"
      }
    }
  }
}
```

For Cline, use the `"type": "streamableHttp"` and `"url"` keys from the
[Cline section](#cline) with the same `headers` block.

**Zed** does not expand variables in headers, so the token goes in the settings
file itself: add `"headers": { "Authorization": "Bearer <token>" }` to the
`bills` entry.

**mcp-remote.** To keep the token out of the process list, put the header in a
file (one `Name: value` line, for example `Authorization: Bearer <token>`) and
pass it with `--header-file`:

```json
{
  "mcpServers": {
    "bills": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://bills.jirawat.dev/mcp",
        "--transport",
        "http-only",
        "--header-file",
        "/path/to/bill-tracker-headers.txt"
      ]
    }
  }
}
```

## What your agent can do

The server offers 30 tools, 3 resources and 1 prompt. Each tool needs one of
the permissions listed above. Deleting bills, unlinking LINE and deleting your
account only run with an explicit confirmation in the request, and the skill
also asks you before it signs you out everywhere.

### Bills

| Tool | What it does | Permission |
| --- | --- | --- |
| `bills.list` | List your bills in a bucket: all, open, overdue, due soon, unconfirmed, top priority, paid or this month | `bills:read` |
| `bills.get` | Fetch one bill by id or short reference | `bills:read` |
| `bills.query` | Filter bills by status, due dates, category, payment method and flags | `bills:read` |
| `bills.search` | Search bill names and notes | `bills:read` |
| `bills.recentlyChanged` | Bills changed in the last N days | `bills:read` |
| `bills.byRef` | Turn a short reference from the LINE chatbot into a bill | `bills:read` |
| `bills.create` | Add a bill | `bills:write` |
| `bills.update` | Change a bill | `bills:write` |
| `bills.markPaid` | Mark a bill fully paid | `bills:write` |
| `bills.recordPayment` | Record a partial payment | `bills:write` |
| `bills.setAmount` | Set the amount and mark it confirmed | `bills:write` |
| `bills.confirm` | Confirm an estimated amount | `bills:write` |
| `bills.schedule` | Mark a bill scheduled for payment on a date | `bills:write` |
| `bills.toggleTopPriority` | Pin or unpin a bill as top priority | `bills:write` |
| `bills.delete` | Delete a bill (destructive) | `bills:delete` |
| `bills.bulkDelete` | Delete up to 500 bills; can preview with a dry run (destructive) | `bills:delete` |

### Summaries and reports

| Tool | What it does | Permission |
| --- | --- | --- |
| `summary.kpis` | Overdue count, unpaid total, bills due in the next 7 days, top-priority count | `bills:read` |
| `summary.month` | What you paid this month and the average unpaid amount | `bills:read` |
| `summary.chatbot` | The LINE chatbot's summary as data | `bills:read` |
| `reports.spend` | Monthly spending report over 3, 6 or 12 months | `reports:read` |
| `reports.spendDigest` | A one-paragraph spending summary | `reports:read` |
| `reports.paidMonthlyAverage` | Average paid per month over the last N months | `reports:read` |

### Account, LINE and chat

| Tool | What it does | Permission |
| --- | --- | --- |
| `account.export` | Export all of your data | `account:read` |
| `account.delete` | Delete your account and all of its data (destructive) | `account:delete` |
| `account.revokeSessions` | Sign you out of Bill Tracker on every device (destructive) | `account:manage` |
| `lineLink.status` | Whether LINE is linked and daily reminders are on | `line:read` |
| `lineLink.setNotifyEnabled` | Turn daily LINE reminders on or off | `account:manage` |
| `lineLink.unlink` | Unlink your LINE account; bills stay (destructive) | `account:manage` |
| `chat.parseCommand` | Parse a Thai or English LINE chatbot command without running it | `chat:read` |
| `chat.run` | Run a LINE chatbot command; commands that change data need confirmation | `chat:write` |

### Resources and prompt

| Name | What it is |
| --- | --- |
| `bill://<id>` | One bill as JSON |
| `summary://today` | Today's summary |
| `report://spend/<yyyy-mm>` | The spending report for the period ending with that month |
| `summarize-month` prompt | Summarizes one month's spending; takes `month` as `YYYY-MM` |

## Troubleshooting

**The sign-in window does not open.** Copy the sign-in URL from your client
into a browser. On a remote machine use `claude mcp login bills --no-browser`
or `codex mcp login bills --no-browser` and paste the redirect URL back. Gemini
CLI needs a local browser for sign-in; use a
[personal access token](#headless-agents-personal-access-tokens) there instead.

**The server shows "needs authentication" or 401 Unauthorized.** Sign in again:
`/mcp` in Claude Code, `codex mcp login bills`, `/mcp auth bills` in Gemini CLI
or Copilot CLI, or **Authenticate** in Cline and Antigravity. Your session may
have expired or been revoked under Connected AI agents. With a personal access
token, check that the header is exactly `Authorization: Bearer <token>` with no
quotes or trailing spaces, that the token has not expired, and that the
environment variable is set where the client starts.

**A tool fails with `insufficient_scope` or "needs additional permissions".**
The agent needs a permission you have not granted yet. Approve it when your
client asks, or sign in to the server again; in Claude Code, open `/mcp` and
authenticate the server again. For a personal access token, create a new token
that includes the permission.

**Claude Code reports a server with a "url" but no "type".** Add
`"type": "http"` to the server entry.

**Cline fails to connect or falls back to SSE.** Set
`"type": "streamableHttp"` on the server entry.

**Opening the server URL in a browser shows 405 Method Not Allowed.** That is
expected. The endpoint accepts only MCP requests sent with POST.

**The client reports an unsupported protocol version or cannot initialize.**
The server supports MCP `2026-07-28` and `2025-06-18`. Update your client. When
you use mcp-remote, adding `--protocol auto` to its arguments lets it talk to
the server in the current protocol revision on behalf of an older client.

**Tools are missing or out of date.** The server does not push tool-list
changes, so restart the client or refresh the server: **MCP: Reset Cached
Tools** in VS Code or the refresh button in Windsurf. ChatGPT keeps a snapshot
of the tools from when the plugin was created; a workspace admin refreshes it
from the plugin's settings.

**Every tool appears twice.** You installed the plugin and also added the
server by hand. Remove one of them.

**Zed sends `${MY_TOKEN}` literally.** Zed does not expand environment
variables in headers. Paste the token itself, or remove the header and use
OAuth.

**Sign-in fails with a client registration or redirect error.** Remove any
OAuth client ID or secret you entered, for example in a connector's advanced
settings, so the client registers itself, then try again.

**Antigravity signs in but tool calls still return 401.** Update `agy`; early
versions did not send the OAuth token on MCP requests. As a workaround, add the
server with a personal access token.

**Start over.** Remove the server or plugin, clear its stored sign-in (in
Claude Code open `/mcp` and choose Clear authentication; run
`codex mcp logout bills`; for mcp-remote delete `~/.mcp-auth`), revoke the old
connection under Connected AI agents, then set it up again.

**Check the server yourself.** Without a token the server should answer
`401 Unauthorized` with a `WWW-Authenticate: Bearer resource_metadata="..."`
header that starts the sign-in discovery:

```bash
curl -i -X POST https://bills.jirawat.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

With a personal access token it should list the tools:

```bash
curl -sS https://bills.jirawat.dev/mcp \
  -H "Authorization: Bearer $BILL_TRACKER_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/list' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}}'
```

For an interactive check, run `npx @modelcontextprotocol/inspector`, choose
the Streamable HTTP transport and connect to `https://bills.jirawat.dev/mcp`.

## Repository layout

```text
.
├── .agents/plugins/marketplace.json  Codex and ChatGPT desktop marketplace
├── .claude-plugin/
│   ├── marketplace.json              Claude Code marketplace (also read by Copilot CLI and VS Code)
│   └── plugin.json                   Claude Code plugin manifest
├── .github/workflows/
│   ├── ci.yml                        Validation and link checks
│   └── publish-mcp-registry.yml      Manual publish to the MCP Registry
├── .mcp.json                         MCP server for the Claude Code plugin
├── config.json                       Server URL, app URL, repository and version
├── gemini-extension.json             Gemini CLI extension manifest
├── lychee.toml                       Link checker settings
├── mcp.json                          MCP server for the Agent Plugins format
├── mcp_config.json                   MCP server for Antigravity CLI
├── plugin.json                       Agent Plugins manifest (Codex, Cursor, VS Code, Copilot CLI, Antigravity CLI)
├── scripts/
│   ├── sync.mjs                      Copies config.json values into every file
│   └── validate.mjs                  Offline checks, run locally and in CI
├── server.json                       Official MCP Registry entry
└── skills/billing-tracker/
    ├── SKILL.md                      The agent skill
    └── references/tools.md           All 30 tools with permissions and inputs
```

## Maintaining this repository

### Change the server URL, repository or version

Values that repeat across files (the server URL, the app URL that hosts
Connected AI agents, the repository and the version) live only in
`config.json`. Change them there, then run:

```bash
node scripts/sync.mjs
node scripts/validate.mjs
```

`sync.mjs` rewrites every manifest and document that repeats a value, including
the one-click install links. You can also pass new values directly, for example
`node scripts/sync.mjs --server-url https://example.com/mcp`. The scripts need
Node.js 18 or newer and no packages; the TOML checks also need Python 3.11 or
newer.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request, and weekly for
links. It checks that every file matches `config.json`, runs
`scripts/validate.mjs` (JSON formatting, TOML, code blocks in the docs, skill
and tool-name rules, writing style), validates the manifests against their
published JSON Schemas, runs `claude plugin validate --strict`,
`gemini extensions validate` and the Agent Skills reference validator, and
checks every link with lychee.

### Publish to the MCP Registry

`server.json` describes the server for the
[official MCP Registry](https://registry.modelcontextprotocol.io) as
`io.github.jirawatp/billing-tracker`; publishing proves ownership of that
namespace through GitHub. Once the server is live, run the
**Publish to MCP Registry** workflow from the Actions tab, or publish from a
terminal with [mcp-publisher](https://github.com/modelcontextprotocol/registry):

```bash
mcp-publisher login github
mcp-publisher publish
```

The registry rejects a version it already has, so bump the version first.

### Release a new version

1. Set the new `version` in `config.json` and run `node scripts/sync.mjs`.
2. Commit, then tag the commit `vX.Y.Z` and push the tag.

Clients that cache plugins by version, such as Claude Code, Codex and VS Code,
pick up changes when the version changes.

### Keep the skill in step with the server

The tool names, resources and prompt in `skills/billing-tracker` follow the
server's integration contract, which is also listed in `scripts/validate.mjs`.
If the server adds, renames or removes a tool, update that list,
`references/tools.md`, `SKILL.md` and the tool tables in this README. The
validator checks that the reference table and this README cover every contract
tool, and that no document names a tool, resource or prompt outside the
contract.

## License

[MIT](LICENSE)
