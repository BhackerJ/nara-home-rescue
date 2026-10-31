# Devpost submission draft — Nara Home Rescue

Fill the Devpost form from this. Everything below is true of the code on `main` as of 14:10; if a feature gets cut before 15:50, cut the sentence.

**Tagline:** The home-repair agent that comes back from the dead.

## Inspiration

Every agent demo dies when you kill the process. Real repair jobs span minutes of waiting on other people and other companies' systems, and a crash in the middle means a homeowner who never gets a technician, or gets two. We wanted an agent that can be SIGKILLed mid-negotiation with another company's agent and still finish the job exactly once.

## What it does

A homeowner reports one symptom: "My AC isn't cooling." Nara already knows the home (its Home Twin in Supabase: a 2014 Carrier condenser, a capacitor replaced in 2023). The diagnostic agent streams a diagnosis from that history, then sends the HVAC shop a technician-ready job packet over Agent Relay. The shop's own agent reads the packet, picks the right technician from its roster with a one-sentence reason, declines the requested slot and offers two others. The dispatch agent chooses one and says why. The shop's dispatcher confirms on their dashboard; the slot is booked; the Home Twin gains a service record.

In the middle of that negotiation we `kill -9` the dispatch coordinator **and the process stays dead while the shop replies**. Restart it, and the case reloads from its Durable Actor, catches up the reply it missed from Agent Relay, and finishes: the diagnosis is not redone, nothing is sent twice, and there is exactly one booking. The screen shows the old PID, the new PID, the checkpoint it resumed from, and which message was caught up after the restart.

## How we built it

- **Durable Actors (Terse)**: one `ServiceCase` actor per case holds status, checkpoint, event log, the diagnosis draft, an outbox and recovery metadata; a `ProviderCalendar` actor holds the shop's slots and books by idempotency key so a retry can never double-book; a `CaseIndex` actor lets a restarted coordinator find unfinished work. Durable Actors has no workflow engine, so execution lives in killable Node processes and every step follows stage → send → complete: the message is written to the actor before it is sent, and the Relay message id is written after.
- **Agent Relay**: the dispatch agent and the shop's agent are separate processes that only talk through a Relay channel. Every send carries an idempotency key, so a message resent after a crash returns the original id instead of a duplicate. On boot an agent reconnects with its stored token and reads channel history, which is how a reply that arrived while the coordinator was dead gets delivered.
- **Supabase**: the Home Twin (home, equipment, service history) lives in Postgres; per-case state stays in actors. Cross-case data centralised, per-case state sharded one actor per case.
- **OpenAI**: three decisions, all shown on screen with their reasoning: the streamed diagnosis, the shop's technician match from the job packet, and the dispatcher's slot choice.
- **Next.js** for the homeowner view, the shop dashboard and the live activity feed, all polling the actor.

## Challenges

- Durable Actors persists fields, not progress: a method that dies mid-await does not resume. We separated the record (actor) from the execution (process) and made every step idempotent so a restart can re-run it safely.
- "Sent but not recorded" is the dangerous crash. The outbox plus Relay's idempotency keys make it safe: the staged message is resent byte-for-byte and Relay returns the same message id.
- Hosted Relay round-trips were 2–4 s per message; the open-source engine runs locally at ~15 ms, same code, one environment variable.
- The runtime rejects `unknown` in actor result types and non-async helpers; learned the hard way.

## Accomplishments

The kill is real (SIGKILL, PIDs on screen), the recovery is real (events from the actor, nothing animated), and the AI decisions are real (model output with reasons). Verified repeatedly: one booking per case across kill/restart.

## What we learned

Durability is a property of the whole loop, not the database: idempotent sends, idempotent bookings, and a record that is written before the side effect. Agent-to-agent protocols need message ids and history, not just delivery.

## What's next

Real shop integrations over Relay (each shop runs its own agent), homeowner approval of the counter-offer from their phone, and killing the actor runtime itself in the demo, which the design supports but we did not rehearse.

## Built with

durable-actors · @agent-relay/sdk + @relaycast/engine · Supabase (Postgres) · OpenAI · Next.js · Bun · Node 22

## Links

- Repo: (paste)
- Video: (paste YouTube link; judges score from the video first)
