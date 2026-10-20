---
name: billing-tracker
description: Read and manage the user's own bills in Bill Tracker through its MCP server (tools named bills.*, summary.*, reports.*, account.*, lineLink.* and chat.*). Use when the user asks what is due or overdue, wants to mark a bill paid or record a partial payment, add, edit, schedule or delete a bill, see spending reports, export their data, or turn LINE reminders on or off in Bill Tracker.
license: MIT
compatibility: Needs the Bill Tracker MCP server at https://bills.jirawat.dev/mcp, connected and signed in. Works in any agent that can call MCP tools.
---

# Bill Tracker

Bill Tracker is a personal bill tracker. Every request runs as the signed-in
user, so you only ever see and change that user's own bills. Amounts are in
Thai Baht (THB) and dates follow the Asia/Bangkok calendar.

## Check the connection first

- The tools come from the MCP server named `bills`. Clients may show it as
  `plugin:billing-tracker:bills`, and may show tool names with a prefix such
  as `mcp__bills__` or with dots replaced by underscores. The names in this
  skill are the server's exact tool names.
- If no Bill Tracker tools are available, say so and point the user to the
  setup guide at https://github.com/jirawatp/billing-tracker-agent-plugins.
  Never invent bill data.
- If a call fails because the user is not signed in or the session expired,
  ask them to sign in again to the `bills` server from their client's MCP
  settings.
- If a call fails for a missing permission (an `insufficient_scope` sign-in
  challenge, or a tool error of kind `insufficient-scope`), name the
  permission the server asked for, such as `reports:read`, and ask the user
  to approve it. Many clients reopen the Bill Tracker consent screen; others
  need the user to sign in to the server again. A personal access token
  needs to be replaced by one that includes that permission, created at
  https://bills.jirawat.dev/settings/connected-agents. The `account:delete`
  permission works differently; see `account.delete` below.
- Other tool failures come back as results you can read and act on; see
  "When a call fails".
- The server can add tools over time; follow each tool's own description and
  input schema. If a tool carries a deprecation notice, use the replacement
  it names.

## Ground rules

1. Ask before you change anything, and always ask before you delete. See
   "Confirmation rules".
2. Never guess a bill id. Find the bill with a read tool and use the `id`
   from the result.
3. Use the server's dates and amounts. Do not do your own time zone or
   currency conversion.
4. Keep bill details private. Do not repeat notes or account details beyond
   what the user needs.

## Dates

- Dates are calendar dates written `YYYY-MM-DD`. Bills have no times.
- On bill writes, exact date inputs with years 2400 to 2699 inclusive are
  interpreted as Buddhist Era. The server subtracts 543 before Gregorian
  calendar validation: `2569-10-20` becomes `2026-10-20`, and `2567-02-29`
  becomes `2024-02-29`. State that interpreted date before saving; an
  impossible converted date is rejected. Other years are unchanged.
- This applies only to `dueDate`, `paidDate`, `scheduleDate` and
  `nextStatementDate` on bill writes. Use Gregorian dates for queries and
  reports. Do not convert timestamps or existing history; a legacy field
  sent exactly as stored is preserved on an unrelated edit.
- "Today" means today in Asia/Bangkok (UTC+7, no daylight saving time). The
  server uses that date when you leave `today` out, so omit `today` unless
  the user asks about another reference date, such as "what was overdue on
  1 March".
- Late in the evening in Europe or the Americas it can already be tomorrow in
  Bangkok. When you need today's date, read it from a tool result
  (`bills.list` returns `today`) instead of your own clock.
- Resolve relative dates ("next Friday", "end of the month") against that
  Bangkok date, and say the exact date back to the user before you save it.
- "This month" is the Bangkok calendar month.

## Money

- Pass plain numbers to tools: `1250.5`, not `"฿1,250.50"` or
  `"1,250.50 THB"`.
- Show amounts to people with the baht sign and two decimals, for example
  ฿1,250.50.
- Do not convert currencies. If the user gives an amount in another currency,
  ask for the amount in baht.
- A bill can hold an estimated amount until the real statement arrives (an
  unconfirmed bill). Say "estimated" when you show those amounts.
- `bills.markPaid` settles a bill in full. `bills.recordPayment` adds one
  partial payment and returns what is still `remaining`; calling it twice
  records two payments.

## Confirmation rules

Read-only tools never need confirmation: `bills.list`, `bills.get`,
`bills.query`, `bills.search`, `bills.recentlyChanged`, `bills.byRef`,
`summary.kpis`, `summary.month`, `summary.chatbot`, `reports.spend`,
`reports.spendDigest`, `reports.paidMonthlyAverage`, `account.export`,
`lineLink.status` and `chat.parseCommand`. A `bills.bulkDelete` call with
`dryRun: true` is also read-only: it only reports what would be deleted.

Tools that change data: say what you are about to do (which bill, which
fields, which values) and wait for a yes, unless the user's message already
asked for exactly that change and exactly one bill matches. These are
`bills.create`, `bills.update`, `bills.markPaid`, `bills.recordPayment`,
`bills.setAmount`, `bills.confirm`, `bills.schedule`,
`bills.toggleTopPriority` and `lineLink.setNotifyEnabled`.

Destructive tools: always confirm immediately before the call, even when the
user asked directly, and list exactly what will be affected.

- `bills.delete` deletes one bill.
- `bills.bulkDelete` deletes up to 500 bills. Preview first with
  `dryRun: true`, which deletes nothing and needs no `confirm`. Show the user
  exactly which bills would be deleted, and only after their explicit yes call
  it again with the same `ids` and `confirm: true`.
- `lineLink.unlink` disconnects the user's LINE account. Bills stay, but LINE
  reminders and the LINE chatbot stop working for this account until the user
  links LINE again in the app.
- `account.revokeSessions` signs the user out of Bill Tracker on every
  device. It does not disconnect AI agents; those are managed under Connected
  AI agents in the app's settings.
- `account.delete` permanently erases the user's bills, LINE link and
  account. Use it only when the user explicitly asks to delete their whole
  Bill Tracker account. Explain that it cannot be undone, offer
  `account.export` first, and ask them to confirm in their own words. Then
  pass the confirmation value that the tool's input schema requires. The
  `account:delete` permission is never part of a normal sign-in, so unless the
  user has just approved it, the call fails for a missing permission. Tell
  the user to open https://bills.jirawat.dev/settings/connected-agents and
  approve account deletion on its dedicated consent screen, then call again
  once they say it is done. The permission expires at that original sign-in
  time plus five minutes; consent and code exchange do not extend it, and
  no refresh token is issued. If it expires, ask for a fresh sign-in and
  dedicated approval. Never try to obtain
  `account:delete` through a normal sign-in, and never use this tool to clean
  up data.

Set `confirm` only after the user agreed to that specific action in this
conversation. If the server answers that confirmation is required, ask the
user; do not retry with `confirm` added on your own.

`chat.run` executes one line of the Bill Tracker LINE chatbot syntax (Thai or
English). Prefer the `bills.*` tools for changes. Use `chat.parseCommand` to
show what a chatbot command would do without running it. A `chat.run` command
that adds a bill, records a payment, changes an amount or deletes needs
`confirm: true`, and such a call always needs the user's explicit yes first,
even when they typed the command themselves.

The read commands `help`, `list`, `due`, `overdue`, `unconfirmed` and `summary`
accept `bills:read` or `chat:write`. Existing `chat:write` tokens need no
additional read scope. Commands that change data require `chat:write`, and
deletion also requires `bills:delete`. The `chat:read` permission only permits
`chat.parseCommand`; it never grants access to the user's bills.

## Finding the right bill

- Search by name or note with `bills.search`, or list a bucket with
  `bills.list`. Use `bills.query` for filters such as status, due date range,
  category or payment method; it pages results with `nextCursor`.
- `bills.list` returns at most 500 bills. When `truncated` is true, `count`
  is the full size of the bucket: say how many bills there are, and use a
  narrower bucket or `bills.query` (following `nextCursor`) to reach the rest.
  Never present a truncated list as complete.
- A short reference from the LINE chatbot resolves with `bills.byRef`, or
  pass it to `bills.get` as `ref`.
- If several bills match, show the candidates (name, due date, amount,
  status) and ask which one. Do not pick one silently.
- After a change, report the result from the tool response, such as the new
  status or the remaining amount.

## Common tasks

| The user asks | Do this |
| --- | --- |
| What is due or overdue? | `bills.list` with `bucket` set to `overdue`, `due_soon`, `open` or `this_month` (check `truncated`); `summary.kpis` for counts and totals |
| Mark a bill as paid | Find it, then `bills.markPaid`; pass `paidDate` if they paid on another day |
| I paid part of it | `bills.recordPayment` with the amount, plus `paidDate` if not today; report `remaining` |
| Add a bill | Collect the name and amount, plus the due date, whether it repeats (`cycle` monthly or yearly), category and payment method if known; then `bills.create` |
| Change a bill | `bills.update` with only the fields that change |
| The real amount arrived | `bills.setAmount`, which also marks the bill confirmed; `bills.confirm` if the estimate was right |
| I scheduled the payment | `bills.schedule` with `scheduleDate`; Bill Tracker marks the bill paid after that date |
| Pin or unpin a bill | `bills.toggleTopPriority` |
| What changed recently? | `bills.recentlyChanged` with `sinceDays` |
| How much do I spend? | `reports.spend` with `range` 3, 6 or 12 months, `reports.spendDigest` for a short text summary, `reports.paidMonthlyAverage`, or `summary.month` for this month |
| Turn LINE reminders on or off | `lineLink.status`, then `lineLink.setNotifyEnabled` |
| Export my data | `account.export`; summarize the result instead of pasting all of it |

## Reading spending reports

- Spending counts money actually paid. Unpaid, overdue and scheduled bills do
  not count until they are paid.
- A bill's paid amount counts in the month of its paid date. When a part-paid
  bill is settled later, its whole paid amount moves to the month of the final
  payment, so a past month can change.
- Averages use complete calendar months only; the current month is reported
  separately as month to date.
- If the report includes data-quality flags (such as dates estimated from the
  due date), mention them instead of hiding them.

## Presenting results

- Lead with what needs attention: overdue first, then due soon.
- Use a short table: bill, due date, amount, status. Add totals in baht.
- Mark estimated (unconfirmed) amounts.
- Do not show raw JSON or internal ids unless the user asks.

## Resources and prompt

- `bill://<id>`: one bill as JSON.
- `summary://today`: today's summary (the same data as `summary.chatbot`).
- `report://spend/<yyyy-mm>`: the spending report for the period ending with
  that month.
- Prompt `summarize-month` (argument `month` as `YYYY-MM`, default the current
  month) writes a short summary of one month's spending from `reports.spend`.

## When a call fails

A tool that fails still returns a result, marked `isError: true`. Its
`structuredContent.error` object tells you what went wrong: a numeric `code`,
a `kind`, a `message` and sometimes `data` with details. Read that object
instead of guessing from the text, fix the cause, and retry at most once.

1. Check `kind` (or `code`) against the table below.
2. Use `message` and `data` to find the exact field or value at fault.
3. Correct the call yourself only when the fix does not change what the user
   asked for, such as a misspelled argument, a value in the wrong format or a
   bucket name that does not exist. If the fix needs a decision or a value
   only the user has, ask them.
4. Never retry a call that changes or deletes data without the user's go-ahead,
   and never add `confirm` on your own.

| `kind` (`code`) | What it means | What to do |
| --- | --- | --- |
| `invalid-params` (`-32602`) | The arguments do not match the tool's input schema, for example a missing `id` or an unknown `bucket` | Re-read the input schema, fix the arguments and retry once |
| `not-found` (`1001`) | No such bill, or it belongs to another account | Do not retry the same id. Search again with `bills.search` or `bills.list` and check with the user |
| `invalid-bill` (`1002`) | A bill value was rejected, for example `Scheduled` status without a `scheduleDate` | Tell the user which field is wrong and why, get a valid value, then retry |
| `forbidden` (`1003`) | The data belongs to another account | Stop and tell the user; do not retry |
| `confirm-required` (`1004`) | A destructive call was sent without `confirm` | Ask the user; retry with `confirm` only after an explicit yes |
| `rate-limited` (`1005`) | Too many requests in a short time | Wait about a minute before trying again; do not loop |
| `upstream-firestore` (`1006`) | Bill Tracker's database had a temporary problem | Wait a moment and retry once; if it fails again, tell the user |
| `insufficient-scope` (`1007`) | The user has not granted a permission this tool needs | Name the permission and ask the user to approve it; for `account:delete`, on the Connected AI agents page |

Some failures are not tool results:

- A JSON-RPC error `-32602` about the tool itself means the server has no tool
  by that name. Check the tool list for a misspelling or a renamed tool.
- A JSON-RPC error `-32603` is an internal server error. Tell the user, quote
  the short reference in its message, and do not retry in a loop.
- A JSON-RPC error `-32022` (unsupported protocol version), or an HTTP 401 or
  403 from sign-in, is a connection problem that retrying will not fix. Ask
  the user to update their client or sign in to the `bills` server again.

## Tool reference

All 30 tools, their permissions and main inputs are listed in
[references/tools.md](references/tools.md).
