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
- If a call fails for a missing permission (`insufficient_scope`), name the
  permission the server asked for, such as `reports:read`, and ask the user
  to approve it. Many clients reopen the Bill Tracker consent screen; others
  need the user to sign in to the server again. A personal access token
  needs to be replaced by one that includes that permission, created at
  https://bills.jirawat.dev/settings/connected-agents.

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
`lineLink.status` and `chat.parseCommand`.

Tools that change data: say what you are about to do (which bill, which
fields, which values) and wait for a yes, unless the user's message already
asked for exactly that change and exactly one bill matches. These are
`bills.create`, `bills.update`, `bills.markPaid`, `bills.recordPayment`,
`bills.setAmount`, `bills.confirm`, `bills.schedule`,
`bills.toggleTopPriority` and `lineLink.setNotifyEnabled`.

Destructive tools: always confirm immediately before the call, even when the
user asked directly, and list exactly what will be affected.

- `bills.delete` deletes one bill.
- `bills.bulkDelete` deletes up to 500 bills, and its schema requires
  `confirm: true` on every call, including a dry run. Once the user agrees to
  look at deleting a set of bills, call it with `dryRun: true` and
  `confirm: true` to preview, show exactly what would be deleted, and delete
  (the same call without `dryRun`) only after a second, explicit yes.
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
  pass the confirmation value that the tool's input schema requires. Never use
  it to clean up data.

Set `confirm` only after the user agreed to that specific action in this
conversation. If the server answers that confirmation is required, ask the
user; do not retry with `confirm` added on your own.

`chat.run` executes one line of the Bill Tracker LINE chatbot syntax (Thai or
English). Prefer the `bills.*` tools for changes. Use `chat.parseCommand` to
show what a chatbot command would do without running it. A `chat.run` command
that adds a bill, records a payment, changes an amount or deletes needs
`confirm: true`, and such a call always needs the user's explicit yes first,
even when they typed the command themselves.

## Finding the right bill

- Search by name or note with `bills.search`, or list a bucket with
  `bills.list`. Use `bills.query` for filters such as status, due date range,
  category or payment method; it pages results with `nextCursor`.
- A short reference from the LINE chatbot resolves with `bills.byRef`, or
  pass it to `bills.get` as `ref`.
- If several bills match, show the candidates (name, due date, amount,
  status) and ask which one. Do not pick one silently.
- After a change, report the result from the tool response, such as the new
  status or the remaining amount.

## Common tasks

| The user asks | Do this |
| --- | --- |
| What is due or overdue? | `bills.list` with `bucket` set to `overdue`, `due_soon`, `open` or `this_month`; `summary.kpis` for counts and totals |
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

| Failure | What to do |
| --- | --- |
| Not found | The bill does not exist or belongs to someone else. Search again; do not retry the same id. |
| Invalid bill | The server rejected a value. Tell the user which field and why, and ask for a corrected value. |
| Confirmation required | You called a destructive tool without `confirm`. Ask the user before calling again. |
| Rate limited | Wait a minute, then try again. Avoid loops of repeated calls. |
| Insufficient scope | The user has not granted that permission. Name it and ask them to approve it. |
| Not signed in | Ask the user to sign in to the `bills` server again. |

## Tool reference

All 30 tools, their permissions and main inputs are listed in
[references/tools.md](references/tools.md).
