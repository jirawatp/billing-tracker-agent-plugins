# Bill Tracker MCP tools

The `bills` server exposes 30 tools, 3 resources and 1 prompt. Tool names are
exact. The main inputs listed here help you plan calls; the input schema the
server advertises is authoritative, so read it before calling a tool.

Tools only change in backward-compatible ways: new tools and new optional
inputs can appear, and a renamed tool keeps its old name working for a
deprecation window, marked with a deprecation notice that names the
replacement.

Kinds: **read** never changes data, **change** edits data, **destructive**
deletes data or disconnects something and always needs the user's explicit
confirmation. Permission is the OAuth scope (or personal access token scope)
the tool needs.

## Bills: read

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `bills.list` | List the user's bills in a bucket | read | `bills:read` | `bucket`: `all`, `open`, `overdue`, `due_soon`, `unconfirmed`, `top_priority`, `paid` or `this_month`; optional `today` |
| `bills.get` | Fetch one bill by id or short reference | read | `bills:read` | `id` or `ref` |
| `bills.query` | Filter by status, due date range, category, payment method and flags, with paging | read | `bills:read` | `status`, `dueFrom`, `dueTo`, `category`, `paymentMethod`, `recurring`, `isConfirmed`, `topPriority`, `limit` (up to 500), `cursor` |
| `bills.search` | Case-insensitive text match on bill name and note | read | `bills:read` | `query`, `limit` (up to 100) |
| `bills.recentlyChanged` | Bills changed within the last N days | read | `bills:read` | `sinceDays` (1 to 90) |
| `bills.byRef` | Resolve a short reference (as used by the LINE chatbot) to a bill id | read | `bills:read` | `ref` |

## Bills: change

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `bills.create` | Create one bill | change | `bills:write` | `name`, `amount`; optional `dueDate`, `cycle`, `recurring`, `category`, `paymentMethod`, `note`, `nextStatementDate`, `scheduleDate`, `paymentStatus`, `isConfirmed`, `topPriority` |
| `bills.update` | Change some fields of one bill | change | `bills:write` | `id`, `patch` |
| `bills.markPaid` | Mark one bill fully paid (today unless a date is given) | change | `bills:write` | `id`, optional `paidDate` |
| `bills.recordPayment` | Add a partial payment; repeating the call adds another payment | change | `bills:write` | `id`, `amount`, optional `paidDate` |
| `bills.setAmount` | Set the amount and mark the bill confirmed | change | `bills:write` | `id`, `amount` |
| `bills.confirm` | Mark the amount confirmed without changing it | change | `bills:write` | `id` |
| `bills.schedule` | Mark the bill scheduled for payment on a date | change | `bills:write` | `id`, `scheduleDate` |
| `bills.toggleTopPriority` | Flip or set the top-priority flag | change | `bills:write` | `id`, optional `value` |

## Bills: delete

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `bills.delete` | Delete one bill | destructive | `bills:delete` | `id`, `confirm: true` |
| `bills.bulkDelete` | Delete up to 500 bills; a dry run previews without deleting | destructive (a dry run is read-only) | `bills:delete` | `ids`; `dryRun: true` to preview, with no `confirm`; `confirm: true` to delete |

## Summaries and reports

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `summary.kpis` | Overdue count, unpaid total, bills due in the next 7 days, top-priority count | read | `bills:read` | optional `today` |
| `summary.month` | Paid total and count for this month, average unpaid amount | read | `bills:read` | optional `today` |
| `summary.chatbot` | The LINE chatbot's summary, as structured data | read | `bills:read` | optional `today` |
| `reports.spend` | Monthly spending report over 3, 6 or 12 months | read | `reports:read` | optional `today`, `range` |
| `reports.spendDigest` | One-paragraph plain-text spending summary | read | `reports:read` | optional `today`, `range` |
| `reports.paidMonthlyAverage` | Average amount paid per month over the last N months | read | `reports:read` | optional `months` (1 to 24) |

## Account

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `account.export` | Export all of the user's data | read | `account:read` | none |
| `account.delete` | Permanently erase the user's bills, LINE link and account | destructive | `account:delete`, granted only by re-consent (see below) | the confirmation value its schema requires |
| `account.revokeSessions` | Sign the user out of Bill Tracker on every device (AI agent connections are revoked separately in Settings) | destructive | `account:manage` | none |

`account:delete` is never part of a normal sign-in. The server refuses
`account.delete` with `insufficient_scope` until the user approves account
deletion on its dedicated consent screen at
https://bills.jirawat.dev/settings/connected-agents. That approval is
short-lived and is not renewed by a refresh token.

## LINE

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `lineLink.status` | Linked LINE display name and whether daily reminders are on | read | `line:read` | none |
| `lineLink.setNotifyEnabled` | Turn daily LINE reminders on or off | change | `account:manage` | `enabled` |
| `lineLink.unlink` | Disconnect the user's LINE account; bills stay with the account | destructive | `account:manage` | `confirm: true` |

## Chat

| Tool | What it does | Kind | Permission | Main inputs |
| --- | --- | --- | --- | --- |
| `chat.parseCommand` | Parse one line of the Thai or English chatbot syntax without running it | read | `chat:read` | `text` |
| `chat.run` | Run one chatbot command; commands that add, pay, change an amount or delete need `confirm: true` | change, or destructive for delete | `chat:write` for commands that change data | `text`, optional `confirm` |

## Resources

| URI | Contents |
| --- | --- |
| `bill://<id>` | One bill as JSON |
| `summary://today` | Today's summary, the same data as `summary.chatbot` |
| `report://spend/<yyyy-mm>` | The `reports.spend` report for the period ending with that month |

## Prompt

| Name | Arguments | What it does |
| --- | --- | --- |
| `summarize-month` | `month` as `YYYY-MM`, default the current month | Summarizes one month's spending from `reports.spend` |
