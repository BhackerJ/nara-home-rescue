# Demo runbook

2026-10-31 13:30 · what to type, in order. Everything runs from the repo root on Brad's Mac. Full flow verified end to end at 13:26 (kill at the CONFIRM wait, restart, confirmed, one booking, confirm tagged backfilled).

## Which UI (decided 13:50)

The pitch uses Nagisa's app, `apps/nara-home-rescue` on **:3000**, with `/api/*` proxied to :3100. So :3100 must stay up as the API even though nobody looks at it. The `/home` and `/dispatch` pages on :3100 are the verified fallback: if the :3000 wiring has not passed the kill/restart check below by 14:30, demo on :3100.

| 6 | `cd apps/nara-home-rescue && npx next dev -p 3000` | ready on :3000 |

The demo window is `http://localhost:3000` (branch `feature/live-rescue-demo` until merged). `?mode=mock` plays Nagisa's scripted version as the last-resort fallback. Passed the kill/restart check at 13:55 with 0 console errors.

## Terminals (keep all five open)

| # | Command | Must show |
|---|---|---|
| 1 | `npm run actors` | `Ready http://127.0.0.1:7100` |
| 2 | `nvm use && npm run relay` (Node 22) | engine on :8787 |
| 3 | `cd apps/dispatch-frontend && npx next dev -p 3100` | ready on :3100 |
| 4 | `node scripts/provider.mjs` | `listening on #home-rescue as provider` |
| 5 | `node scripts/coordinator.mjs` | `boot <id> pid <n>` |

Terminal 5 is the one on screen during the demo: the kill and the restart happen there.

## Before every run (rehearsal, recording, each judge)

```
node scripts/reset-demo.mjs
```

Then open `http://localhost:3100/home` (homeowner) and `http://localhost:3100/dispatch` (shop) in two windows. If `/home` shows an old case, click "Start a new case".

## The run

1. `/home`: click **Ask Nara to fix it**. Diagnosis streams in (~3 s), then three agent messages appear; status stops at `awaiting_provider`, checkpoint `slot_accepted`. The header shows `coordinator pid N`.
2. `/dispatch`: the live card shows the job packet. Offer → Choose → **Confirm**. Do **not** click yet.
3. Terminal 5: `Ctrl-C` is too gentle; use **`kill -9 <pid>`** (the pid is in the header on `/home` and in the log line). Say so.
4. `/dispatch`: click **Confirm**. Terminal 4 logs `booked Tue 13:00 (new) -> confirm sent`. Nothing happens on `/home`: the coordinator is dead.
5. Terminal 5: `node scripts/coordinator.mjs`. Within a second `/home` shows the recovery card (`pid old → pid new · resumed from slot_accepted`), the confirm message tagged **caught up from Relay after restart**, the confirmed appointment, and the Home Twin gains a history line.

Machine time: ~4 s to `slot_accepted`, then as long as you talk, then ~1 s after the restart.

## If it breaks

- Nothing streams on `/home` within 5 s: terminal 5 shows the error. If it is OpenAI, the coordinator falls back to a fixed narrative only when the key is missing; if the key is bad, fix `.env` and restart terminal 5. The case resumes from `created`.
- `/dispatch` shows an old case: `reset-demo` was not run; run it and submit again.
- Provider does not reply: terminal 4 died; restart it. It re-reads Relay and answers anything unanswered.
- Terminal 4 prints red `Idempotency-Key was reused` lines at boot: it is re-answering old messages; harmless, finishes in a second. Start terminals 4 and 5 before the audience looks at the screen.
- Anything else: cut to the backup video at the same point.

## Known limits (say them if asked, don't hide them)

- The provider's calendar does not check that a slot is still free when two cases run at once; one demo case at a time.
- Relay `messages.list` returns at most 100 messages; after a long day of runs, the backfill could miss a very old reply. `reset-demo` does not clear Relay; if backfill ever misses, the live listener still catches new replies.
- Killing the actor server as well (the design's "pull the plug") is not rehearsed; the demo kills the coordinator only.
