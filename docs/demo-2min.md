# 2-Minute Demo Script: Nara Home Rescue

2026-10-31 · Brad (drafted by Claude) · second draft, after a "can this win first place" review

Theme is "Real-time AI", pitch slot is 2 minutes, tracks are Durable Actors, Agent Relay and Supabase. The story is the one in [plan-onsite.md](./plan-onsite.md) §1. This document fixes what appears on screen in what order, what is said over it, and what the frontend has to show for the words to land.

This draft assumes four things that the on-site plan does not yet contain; §7 lists them with their cost so they can be cut individually.

## 1. What first place needs that the first draft didn't have

Most teams in the room will demo "agent crashes, agent comes back", because that is what Durable Actors is for. A crash-recovery demo of a mock HVAC booking is correct, but correctness is invisible: the judge sees a booking happen and has to take our word that nothing was duplicated, nothing was redone, and the process really died. Three things separate a top-5 finish from first:

1. **The judge kills it, not a checkbox.** A self-inflicted crash from a form field looks staged. A big red button that a judge presses at a moment of their choosing is the memory they take to the scoring sheet. The design already has `armPlug` ("die right after the next committed step"); the on-site plan cut it because Relay replies in 20 ms. It comes back: the button is lit while the diagnosis streams (a 2–4 second window), and the kill fires right after the slot request leaves. That is the designed crash moment, reached by a judge's hand.
2. **Proof on screen, not in the narration.** "Exactly one booking" and "it didn't redo the diagnosis" have to be visible: a provider calendar panel that shows one booked slot, and a diagnosis card that keeps its original timestamp through the crash.
3. **The AI has to look like AI.** Only the diagnosis uses an LLM; the negotiation is templates. We don't have time to change that, so the diagnosis must carry the "real-time AI" theme on its own: it streams, and when it mentions the capacitor, the 2023 history entry in the twin lights up. That is the one moment where the judge sees the agent *use* memory.

Plus a cheap one: it's Haunted Hacks. The dead process gets a tombstone with its PID; the recovered one gets "resurrected". Judges remember the team that leaned into the theme.

Honest verdict: with these four, the demo has a judge-participation moment, visible proof and a theme hook, which is what first place usually looks like. Without them it is a strong Durable Actors track entry. The bigger risk to first place is not the script: it is whether the whole thing runs at 16:00 after a five-hour build from zero. Nothing in this document is worth doing if it costs the rehearsal time.

## 2. The hard part: the machine is faster than the mouth

Report to confirmed booking takes about ten seconds of machine time: diagnosis 2–4 s, slot request, kill, 2–4 s of recovery, then four Relay messages at ~15 ms each. No narration keeps up.

So the demo runs twice. **First pass, let it run**, say only a few words, so the judge sees it is fast and the crash is real. **Second pass, rewind on the timeline** and point at each event. This requires that everything the narration points at stays on screen after recovery: the tombstone, both PIDs, the downtime, the caught-up message.

## 3. Roles

Nagisa speaks, Brad drives and watches the terminal. The backend runs on Brad's Mac, so he is the one who knows fastest whether to cut to the video. (plan-onsite §8 left this open; change it if you've agreed otherwise.)

The judge presses the kill button. If no judge wants to, Nagisa asks Brad to press it; the words don't change.

## 4. Script

| Time | Screen | Action | Words |
|---|---|---|---|
| 0:00–0:10 | Home Twin | — | "Happy Halloween. Every agent demo you'll see today dies if you kill the process halfway. Ours comes back from the dead, and in a minute one of you will kill it." |
| 0:10–0:22 | Home Twin: equipment card, two history entries | point at the 2023 capacitor entry | "This is the home's twin, in Supabase: a 2014 Carrier condenser, and a capacitor replaced in 2023. The agents read from it." |
| 0:22–0:28 | Report form, prefilled | click Submit | "The AC isn't cooling. I'll file it. Watch the diagnosis stream, and when the red button lights up, *you* pull the plug." |
| 0:28–0:40 | Diagnosis streams → 2023 entry lights up → button lit → judge presses → slot request → tombstone → resurrected → negotiation → booked | judge presses the button | Short phrases only, timed to the screen: "It's reading the twin." / "Now." / "Dead. Both processes." / "Back." / "Booked." |
| 0:40–1:30 | Case page, top to bottom | scroll and point | the rewind, below |
| 1:30–1:40 | Home Twin history gains an entry; provider calendar shows one booked slot | point at both | "The twin already has today's repair, and the provider's calendar has exactly one booking." |
| 1:40–2:00 | Stay on the case page | — | "Durable Actors hold every case and survive a hard kill. Agent Relay carries every message between the two agents, even while one of them is dead. Supabase holds what every case shares. That's Nara Home Rescue." |

**The rewind (0:40–1:30)**, one sentence per thing on screen:

1. "Ten seconds, crash included. Let me rewind."
2. (diagnosis) "It named the capacitor because it read the twin. Same timestamp as before the crash: it was never redone."
3. (slot request) "The dispatch agent asked the provider's agent for a slot over Agent Relay. Two processes, and Relay is the only line between them."
4. (tombstone) "Then you killed it. SIGKILL on the dispatcher *and* on the Durable Actors runtime, right after it sent that message and before it could write down that it had. Worst possible moment. Old PID, new PID, down for *[read the seconds off the screen]*."
5. (caught-up message) "While it was dead, the provider replied: slot taken. The new dispatcher reloaded the case from the actor's SQLite, caught that reply up from Relay, and kept negotiating."
6. (booking) "And because every message carries an idempotency key, nothing was sent twice and there is one booking."

About 260 words, roughly 1:45 at a normal pace, 15 seconds for pauses. Time it in rehearsal; if it runs long, drop the second half of sentence 3.

## 5. What the frontend has to show

Every sentence above points at something. If it isn't on screen, the judge is only listening.

1. **One page, three columns**: Home Twin (equipment, history) · case (form, then timeline) · provider calendar (slots, booked one filled). No page switches, and the history entry and the booking appear in front of the judge. The twin column refetches `GET /api/home/:id` on a `home_updated` event; the calendar column polls `GET /api/provider` with the case.
2. **Prefilled form**: issue, symptoms, preferred slot. One click on stage. The "pull the plug" checkbox stays as the fallback (§6) but is unchecked by default.
3. **The kill button**: large, red, in the case column. Disabled until the case exists, lit while the case is `diagnosing` or `dispatching`, calls `POST /api/demo/pull-plug`. Label: "PULL THE PLUG". After pressing: "armed — dies after its next message".
4. **Twin highlight**: while the draft diagnosis streams, if the text contains "capacitor", the 2023 history entry gets a highlight that stays.
5. **Tombstone, not a banner**: on `plug_pulled`, the case column shows a tombstone card: "RIP coordinator PID 48213 · actors PID 48201", with a running timer. On `recovery_started` the card stays and gains "Resurrected · PID 48390 · actors down 2.3 s · resumed from `slot_requested`". It never disappears.
6. **Caught-up message tag**: the provider reply that arrived during the outage is tagged "caught up from Relay after restart". Backend adds `backfilled: boolean` to the `agent_message` payload: messages the coordinator pulls with `messages.list` at startup are `true`.
7. **Diagnosis keeps its timestamp**: the diagnosis card shows the time it was committed; after recovery it must be the same card, not a new one.
8. **Every agent message** shows `from → to` and "via Agent Relay".
9. **Big type**: projector. Body ≥ 18 px; PIDs, the downtime and the slot times one size up.

## 6. When it goes wrong

- Anything stalls more than 5 seconds: no debugging on stage. Brad cuts to the backup video at the same point, Nagisa keeps talking. Record the video at 15:15 by this script and note where 0:28, 0:40 and 1:30 fall in it.
- Judge presses the button too late (case already past `dispatching`): the button is disabled by then, nothing happens. Say "too late, it already finished; let me run it again with the checkbox" and run the checkbox flow. Rehearse this once.
- 14:00 checkpoint fell back to "kill coordinator only" (plan-onsite §4): sentence 4 becomes "SIGKILL on the dispatcher", drop the actors runtime and the downtime.
- 13:00 checkpoint fell back to a single diagnosis call: 0:28 becomes "Diagnosing…", the twin highlight fires when the result arrives instead of while streaming.
- Kill button not built: use the checkbox, 0:22 becomes "and I've told it to crash itself mid-negotiation", 0:00 drops "one of you will kill it".

## 7. What this adds to the on-site plan, and what it costs

| Change | Who | Est. | Falls back to |
|---|---|---|---|
| `armPlug` + `POST /api/demo/pull-plug` + the button | Brad 15 min, Nagisa 15 min | 30 min | checkbox |
| `GET /api/provider` reading `ProviderCalendar` + calendar column | Brad 10 min, Nagisa 20 min | 30 min | say "one booking" without showing it |
| Tombstone card instead of banner | Nagisa | 10 min | plain banner |
| Twin highlight on "capacitor" | Nagisa | 10 min | point at it by hand |
| `backfilled` flag | Brad | 5 min | tag by timestamp on the frontend |
| Streaming diagnosis (plain text, no JSON) | Brad 15 min, Nagisa 10 min | 25 min | single call |

About 110 minutes in a day that has no slack. Take it from 14:00–14:45 (integration and polish) and from building the three columns as one page from the start rather than three pages then merging. Order if time runs short: button → calendar column → tombstone → highlight; everything else has a fallback that only changes one sentence.

Also needed because judging runs 16:00–17:00 and we may demo several times: seed 10+ open slots with the preferred one permanently taken, so every run gets its rejection; power cable, sleep off, hotspot on.

## 8. Likely questions, one sentence each

- **"Isn't this just a database and a retry?"** Durable Actors has no workflow engine, so after a crash nothing resumes by itself; we put the record in the actor and the execution in a process that can die at any time, and the outbox plus Relay's idempotency keys make "died after sending, before recording" safe.
- **"Why is Relay local?"** Hosted was 2–4 s per message in our tests, local is 10–20 ms; same code, one environment variable, happy to flip it.
- **"How does this scale?"** Each case's state lives in its own actor; what cases share lives in Postgres. A million users is a lot of actors, not a bigger actor.
- **"Is the provider a real agent?"** It's a separate process with its own calendar actor that acts only when a Relay message arrives; today its scheduling rules are hard-coded.
- **"What happens if you kill the provider?"** Same pattern: it claims each message in its calendar actor before replying, so on restart it re-reads Relay and skips what it already answered. We didn't demo it for time.
