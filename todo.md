# MVP: Minha Rotina

- `1. how over the affected subsystem.` Skip: repository contains no app or subsystem to map; no subagents are permitted by session instructions.
- `2. architect for parallel design exploration.` Skip: single-owner constraint in AGENTS.md and session instructions; use the minimum shape grounded in the brief.
- `3. Write the throughput checkpoint as four todo items.`
  - **Blocking first steps.** Read AGENTS.md, README, Git status, Supabase target, tables, and migrations; check if the routine source spreadsheet is present.
  - **Independent workstreams.** n/a: feature and migration are coupled through the shared RoutineItem/Completion data shape and single screen.
  - **Shared mutable state.** One owner; no parallel writers under session instructions.
  - **Smallest safe decomposition.** One owner because this is a new, empty app with a single screen and one data model.
- `4. Delegate code-writing to a subagent using your configured feature model with a specific scope...` Skip: session instructions prohibit delegation unless explicitly requested; AGENTS.md names this agent as sole implementer.
- `5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.`
- `6. Rebase into small, ordered commits. Stack follow-ups.` Skip: no commits requested; verify units without creating commits.
- `7. If the design is contested, interrogate before shipping.` Skip: no competing design or existing constraints to reconcile.
- `8. Run Opening a PR.` Skip: no PR requested.

## Implementation checklist

- [x] Create the React, TypeScript, Vite, Tailwind, and PWA scaffold.
- [x] Add Supabase schema/RLS migration and typed auth-backed data operations; keep empty data until schedule validation.
- [x] Build the responsive weekly view, checklist, completion totals, and simple recurring item editor.
- [x] Read the v0.6 workbook and seed only fixed routine blocks and confirmed study/gym sessions.
- [x] Make the initial schedule load idempotent in local demo storage and Supabase.
- [x] Add tests for date handling, weekly progress, idempotent completion and routine initialization; validate typecheck/build.
- [x] Replace password login with GitHub OAuth and document the Supabase/GitHub callback setup.

skip: no lint script exists. Automated browser interaction was unavailable; the local Vite HTML response and data behavior tests were verified instead.
pending: add a GitHub OAuth App Client ID/Secret in Supabase and run an end-to-end OAuth login; provider credentials are not exposed by the available Supabase MCP tools.
