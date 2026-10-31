# One-hour build: 13:00–14:00

2026-10-31 12:58 · drafted by Claude for Brad and Nagisa · supersedes plan-onsite.md for today's remaining time

What exists at 12:58: `actors/src/actors.ts` has a smoke actor only; `npm run relay` and `npm run actors` work; `generated/actors` client exists; `apps/dispatch-frontend` is Nagisa's shop dashboard on mock data, with offer/confirm buttons that write `localStorage`. No ServiceCase, ProviderCalendar, coordinator, provider, API routes, homeowner page, Supabase schema. Deadline 16:00; this hour builds the demo, 14:00–15:00 is integration and rehearsal, 15:00 video and Devpost.

## 1. The demo we are building (matches the Nagisa/Brad script)

```
/home (Nagisa's page, prefilled form)      /dispatch (Nagisa's dashboard, live)
  submit ──▶ POST /api/cases                 shows the live case as the job packet
  polls GET /api/cases/:id                   dispatcher clicks CONFIRM ──▶ POST /api/provider/confirm
  diagnosis streams in                            │
  agent messages appear                           ▼
  recovery card appears                    ProviderCalendar.approve(caseId)

coordinator.mjs                            provider.mjs
  1 diagnose: OpenAI streaming → setDraft    on slot_request → reject + 2 alternatives
  2 send slot_request ──Relay──▶             on accept → wait for approve flag → book(key) → confirm
  3 on reject → pick first alternative       (never killed)
  4 send accept ──Relay──▶   ◀── KILL HERE: `kill -9` coordinator (and actors if 14:00 says so)
  5 on confirm → write history → confirmed   restart: read checkpoint, messages.list, resume
```

The human pause is the shop dispatcher's CONFIRM click on `/dispatch`. That is when Brad kills the coordinator. Nagisa clicks, the provider's confirmation goes to Relay while the coordinator is dead, Brad restarts it, it catches up and finishes. The timing problem in the script (machine done in 5 s, restart at 1:15) is solved by that click, not by delays.

## 2. Cut list (decided, don't reopen before 14:00)

| Kept | Cut |
|---|---|
| ServiceCase + ProviderCalendar + CaseIndex actors | supervisor / `npm run demo` (four terminals, Brad runs them) |
| coordinator + provider as two Node processes on local Relay | `armPlug`, pull-plug button, checkbox (Brad kills in a terminal) |
| streaming diagnosis, plain text, OpenAI | JSON-schema structured output |
| resume from checkpoint + Relay backfill on restart | LLM slot pick (template picks first alternative; add only if everything else is green) |
| `/home` page + live `/dispatch` dashboard in Nagisa's app | separate mobile app, three-column page, tombstone styling, twin highlight |
| Home Twin as a fixture JSON read by the coordinator; Supabase only if §4 timebox passes | `case_summary`, `home_rescue_app` role, RLS work |
| manual smoke list | automated tests, preflight page |

## 3. Contracts (so three sessions can work in parallel)

`GET /api/cases/:id` returns Nagisa's `ServiceCase` from `apps/dispatch-frontend/src/contracts/serviceCase.ts`, plus:

```ts
draftDiagnosis?: string;                       // streams while status === "diagnosing"
worker?: { bootId: string; pid: number };      // current coordinator
recovery?: { previousPid: number; pid: number; fromCheckpoint: string; at: string };
```

`CaseEvent.type` values: `diagnosis_draft`? no — drafts are not events. Events: `diagnosed`, `agent_message` (payload `{ from, to, kind, body, relayMessageId, backfilled }`), `step_completed` (`{ step }`), `recovery_started`, `booking` (`{ slot, idempotencyKey, reused }`), `home_updated`, `error`.

Checkpoints in order: `created` → `diagnosed` → `slot_requested` → `slot_rejected` → `slot_accepted` → `booked` → `home_updated`. Status per design-hackathon §4.

Routes (Next route handlers in `apps/dispatch-frontend/src/app/api/`, importing the generated client from the repo root):

| Method | Path | Does |
|---|---|---|
| POST | `/api/cases` | `{ issue, symptoms, preferredSlot }` → `ServiceCase.create` + `CaseIndex.add` → `{ caseId }` |
| GET | `/api/cases/:id` | reads the actor, returns the shape above |
| GET | `/api/cases` | `CaseIndex.list()` → latest case id (dashboard uses it to find the live case) |
| POST | `/api/provider/confirm` | `{ caseId }` → `ProviderCalendar.approve(caseId)` |

Relay: one channel `home-rescue`, agents `dispatch` and `provider`, message body is JSON `{ caseId, kind, ...}`; `idempotencyKey = "<caseId>:<kind>"` for dispatch, `"<caseId>:provider:<kind>"` for provider. Tokens in `relay/state.json` (already there from the smoke test; reuse its pattern).

Fixture `data/home.json`: Demo Home · Palo Alto, Carrier 24ABC6 (2014), history: capacitor replaced 2023-07, maintenance 2025-04. Preferred slot "Tue 9:00" is always taken; alternatives come from 12 seeded open slots.

## 4. Who does what (three Claude sessions, two people)

**Session A — actors + API routes (Brad)** · 25 min
1. `actors/src/actors.ts`: `ServiceCase` (persisted `data`, `status`, `checkpoint`, `events[]`, `draft`, `outbox`, `worker`, `recovery`; methods `create`, `get`, `setDraft`, `stageStep`, `completeStep`, `beginRecovery`, `fail`), `ProviderCalendar` (persisted `slots`, `bookings`, `approved`, `handled`; methods `offer(caseId, requested)`, `approve`, `isApproved`, `book(slot, key)`, `claim`, `markReplied`), `CaseIndex` (`add`, `list`, `remove`). Whole-array reassignment on every write (design §2). Run `npm run actors:generate`.
2. The four routes in §3. Verify with curl: create → get shows `status: created`.
→ Done when: `curl POST /api/cases` then `GET /api/cases/:id` round-trips through the actor.

**Session B — coordinator + provider (Brad)** · 35 min
1. `scripts/provider.mjs`: reconnect with stored token, listen on channel, handle `slot_request` → `ProviderCalendar.offer` → send `reject` with alternatives; handle `accept` → poll `isApproved(caseId)` every 300 ms → `book(slot, "<caseId>:book")` → send `confirm`. On start, `messages.list` and handle anything unanswered.
2. `scripts/coordinator.mjs`: every second `CaseIndex.list()`; per case run the loop from design §4 (read case → skip done steps → outbox → send → completeStep). Step 1 streams OpenAI (`gpt-4.1-mini` or whatever is fastest, plain text, prompt includes `data/home.json`), `setDraft` every 250 ms. Step 5 writes the history entry to the case (`home_updated`) and, if §4 Supabase timebox passed, to Postgres. On start: `beginRecovery(bootId, pid)` for any unfinished case, `messages.list` since last recorded relayMessageId, mark those `backfilled: true`.
3. Any actor/Relay error: wait 200 ms, re-read, retry; 30 s → `fail`.
→ Done when: in terminals, create a case via curl, watch it reach `confirmed` after clicking confirm (or `curl POST /api/provider/confirm`); then kill -9 the coordinator after `slot_accepted`, confirm, restart, and see it finish without a second booking.

**Session C — frontend (Nagisa)** · 40 min
1. `/home` page: prefilled form ("My AC isn't cooling", fan runs / no cold air / outdoor unit not running, preferred Tue 9:00) → `POST /api/cases` → poll `GET /api/cases/:id` every 300 ms → render: Home Twin card (from the same fixture copied into the app), streaming diagnosis, agent message list (`from → to · via Agent Relay`, `backfilled` tag), recovery card (old pid → new pid, from checkpoint; stays on screen), final confirmation + new history line.
2. `/dispatch`: `loadDispatchDashboard()` → fetch `GET /api/cases` then `/api/cases/:id` on a 300 ms poll; request card shows the live issue, symptoms, equipment, diagnosis narrative. CONFIRM button also calls `POST /api/provider/confirm`. Until the backend is up, keep the fixture when the fetch fails.
3. Big type; nothing else.
→ Done when: both pages render against the fixture with the fetch failing, and against the live API when it is up.

**Supabase timebox (Brad, 10 min, only after Session A is done):** `home_rescue.home` + `service_history` in `nara-preview`, `pg` via pooler with the `.env` URL; coordinator reads the twin from there and appends history. Miss the timebox → fixture JSON stays, say "Supabase" nowhere in the pitch.

## 5. 14:00 checkpoint

Full chain in the terminal: create → confirmed with one booking, and a kill/restart after `slot_accepted` finishes the case. If restart does not resume: demo without the kill (script 1:15 becomes "the case survives in Durable Actors; here is the actor's state"). If the frontend is not live: demo from the terminal plus the dashboard on fixture.

Then 14:00–15:00 integrate, rehearse three times by the script, 15:00 record, 15:30 Devpost, 15:50 submit.

## 6. Notes for Session B (coordinator + provider), 13:40

Session A is done: `actors/src/actors.ts` is final, `:7100` runs it, `generated/actors` matches, the four routes round-trip on `:3100`. **Do not restart `:7100`**; ask Session A (nara-home-rescue-ac) for actor changes.

Facts the actor runtime enforces (learned the hard way): method result types must be concrete (no `unknown`), and every class method, including private helpers, must be `async`.

Actor API as built — read the exported types at the top of `actors.ts`:
- `actors.ServiceCase.get(caseId)`: `create(input)`, `get() → CaseSnapshot`, `setDraft(text)`, `stageStep({ step, kind, text, idempotencyKey, result? }) → Outbox` (returns the existing outbox if that step is already staged), `completeStep({ step, status, agent?, relayMessageId?, events?, result? })` (no-op if `checkpoint === step`), `addEvent({ type, payload, agent? })`, `setWorker({ bootId, pid })`, `beginRecovery({ bootId, pid })`, `fail(message)`.
- Event payloads are flat: values are `string | number | boolean | null | string[]`. For `agent_message`, `body` is the message text (a JSON string), not a nested object.
- `actors.ProviderCalendar.get("cool-air-mechanical")`: `offer(caseId, requestedSlot) → { alternatives: [2 slots] }`, `isApproved(caseId)`, `approve(caseId)`, `book({ slot, key, caseId }) → { slot, reused }`, `claim(messageId) → true` first time only, `markReplied(messageId, replyId)`, `get()`, `reset()`.
- `actors.CaseIndex.get("main")`: `add(id)`, `list()`, `remove(id)`. The index is empty now; test cases were removed.
- Relay pattern: copy `scripts/smoke-relay.mjs` (tokens in `relay/state.json`, channel `home-rescue`, agents `dispatch` and `provider`). `OPENAI_API_KEY` is not in `.env` yet; ask the user for it, do not invent one.
- Frontend facts (from nara-home-rescue-24): `/dispatch` shows `caseIds.at(-1)`; while status is `created`/`diagnosing` it renders `draftDiagnosis` (the actor's `draft`), so `setDraft` every ~250 ms appears live; afterwards it renders `results.diagnosed.narrative`. Its CONFIRM button POSTs `/api/provider/confirm { caseId }` once per click: that is the approve flag the provider polls after `accept`. `/home` (Session A built it) renders `agent_message` events (`body` = the JSON message text; it reads `slot`, `requestedSlot`, `alternatives` from it), the `recovery` object, `confirmedAppointment`, and `home_updated` events with a flat payload `{ date, summary, caseId }`.
- `scripts/simulate-case.mjs` drives one case through every step directly on the actors; it is the reference for exactly which `stageStep`/`completeStep` calls the coordinator must make, in order.
