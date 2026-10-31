# 2-Minute Demo Script: Nara Home Rescue

2026-10-31 · Brad and Nagisa (drafted by Claude) · fifth draft: Supabase is real, three model decisions on screen

The submission is a YouTube video; the Devpost rubric has five criteria at 20% each: Real-Time AI and track technology, Originality, Execution and demo, UX and design, Potential and impact. This draft puts the product first and the crash second, and every sentence below is tagged with the criterion it scores. Facts that the previous drafts assumed and plan-1h cut: there is no pull-the-plug button, checkbox, tombstone or twin highlight, and there is no three-column page. What is in: the Home Twin is read from Supabase (`nara-preview`, `home_rescue` schema) when the coordinator boots, and a `service_history` row is written when the case is confirmed. Three model decisions are visible: the streamed diagnosis, the shop agent's technician pick from a four-person roster with a one-sentence reason, and the dispatch agent's slot pick from the two alternatives with a one-sentence reason. Two pages in Nagisa's app on `:3100`: `/home` and `/dispatch`. Brad kills the coordinator in a terminal. Nothing on screen says how long the coordinator was down: the restarted process cannot know when it died, and any number would include the human wait for the CONFIRM click. The proof of the crash is the PID change, in the header and on the recovery card.

## 1. The shape of the demo

The machine finishes diagnosis, the technician pick and the slot negotiation in about six seconds. What gives the video its pacing is a human pause that is also the product's real pause: the provider's booking waits until the shop dispatcher clicks **CONFIRM** on `/dispatch`. That click is the kill moment. Nagisa clicks, and in the same second Brad runs `kill -9` on the coordinator. The provider books and sends its confirmation over Relay while the coordinator is dead; Brad restarts it; it reloads the case from the actor, pulls the confirmation it missed, writes the history entry, and the case goes to `confirmed`. Recorded, not live: the terminal is picture-in-picture, so the judge sees the PID die and a new one appear.

Two pages, recorded on one screen, switch by tab:

- `/home`: Home Twin on the left; on the right the prefilled report form, which becomes the case timeline after submit: streaming diagnosis, agent messages (`from → to · via Agent Relay`), the recovery card (`pid <old> → pid <new> · resumed from <checkpoint>`, stays on screen), the final confirmation and the new history line. The header shows the live coordinator PID. The provider reply that arrived during the outage is tagged "caught up from Relay after restart" in gold.
- `/dispatch`: the shop's dashboard. The live case as the job packet (issue, symptoms, equipment, diagnosis narrative), which is literally the `slot_request` message the dispatch agent sent over Relay; the shop agent's technician pick with its reason; the CONFIRM button.

## 2. Roles

Nagisa speaks and drives both pages. Brad runs the four terminals (actors, relay, coordinator, provider) and does the kill and restart; his coordinator terminal is the picture-in-picture.

## 3. Script

Tags: **AI** real-time AI and track tech · **ORIG** originality · **EXEC** execution and demo · **UX** · **IMPACT**.

| Time | Screen | Action | Words | Scores |
|---|---|---|---|---|
| 0:00–0:15 | `/home`, Home Twin card | — | "Every home has a history: this one has a 2014 Carrier condenser and a capacitor replaced in 2023. Nara keeps that as a Home Twin, in Supabase. Today the AC stops cooling, and instead of the homeowner calling around, two AI agents handle it, and one of them is going to die halfway through." | IMPACT, ORIG |
| 0:15–0:35 | `/home`, form then diagnosis | click Submit, let the diagnosis stream | "I file the problem. Watch the diagnosis write itself: the model is reading the twin as it goes, and it names the capacitor, because it knows this unit already had one replaced." *(let 3–4 seconds of streaming play with no words)* "That's the diagnostic agent, live, not a canned answer." | AI, EXEC |
| 0:35–0:55 | `/dispatch`, job packet and technician pick | switch tab, point at the packet, then the technician line | "This is what the HVAC shop sees. The dispatch agent sent this over Agent Relay as a job packet: symptoms, the equipment, the diagnosis. The shop's own agent read it and picked a technician from its roster, with a reason: *[read the reason off the screen]*. No phone call, nothing retyped. The dispatcher's only job is to say yes." | AI, UX, IMPACT |
| 0:55–1:15 | `/home`, agent message list | switch back, point at each message | "Back on the homeowner's side. The shop said: Tuesday 9 is taken, here are two others. The dispatch agent chose one, and said why: *[read the reason off the screen]*. Two separate processes, and Relay is the only line between them. Now it's waiting on a human." | AI, EXEC |
| 1:15–1:35 | `/dispatch` CONFIRM, terminal PiP, then `/home` recovery card | Nagisa clicks CONFIRM; Brad `kill -9` the coordinator in the same second; Brad restarts it after ~2 s; switch to `/home` | "The dispatcher confirms, and right now the agent that was running this case is dead. *(terminal: PID gone; header PID stops updating)* The shop's confirmation went out anyway, over Relay, to nobody. *(restart)* A new process comes up, new PID in the header, finds the case in its Durable Actor, picks up the message it missed, in gold here, and finishes. Same case, same diagnosis, no second booking." | AI, ORIG, EXEC |
| 1:35–1:50 | `/home`, confirmation and new history line | point | "Confirmed for *[read the slot]*. And the Home Twin in Supabase already has today's repair in its history, so the next agent that touches this home knows." | IMPACT, UX |
| 1:50–2:00 | `/home` | — | "Nara Home Rescue: the home remembers, the agents decide and talk to each other, and the case survives whatever dies in the middle. Durable Actors, Agent Relay and Supabase, each doing real work." | IMPACT, AI |

About 320 words, roughly 2:00 at a normal pace including the streaming pause. Time it in rehearsal. If it runs long, cut in this order: "No phone call, nothing retyped." at 0:35, "Two separate processes…" at 0:55, the last sentence of 1:50. Do not cut the two read-off-the-screen reasons; they are two of the three moments that score the real-time AI line.

## 4. What has to be on screen for the words to land

Everything the narration points at must exist in the UI; if it is only said, the judge is only listening.

1. **Streaming diagnosis is visibly streaming** at 0:15, text growing word by word for at least 3 seconds. If the model is too fast to see, add nothing: let the words from 0:15 cover it and point at the capacitor line once it is there.
1b. **Technician pick with reason** on `/dispatch`: the technician's name and the one-sentence reason, readable at projector size; Nagisa reads it aloud at 0:35.
1c. **Slot pick with reason** on `/home`: the chosen slot and the one-sentence reason on the accept message; Nagisa reads it aloud at 0:55. Both reasons are the model's text, not a template, so they will differ between takes; read what is there.
2. **Agent messages** show `from → to · via Agent Relay`, and the provider's confirmation that arrived during the outage carries the gold "caught up from Relay after restart" tag.
3. **Recovery card** on `/home`: `pid <old> → pid <new> · resumed from slot_accepted`, and it stays on screen after the case finishes. No downtime figure anywhere; point at the two PIDs.
4. **Diagnosis keeps its timestamp** through the restart: same card, not a new one.
5. **Confirmation and history line** appear on `/home` without a reload (300 ms poll).
6. **Terminal picture-in-picture** on Brad's coordinator process, big font, so the kill and the new PID are readable in the video.
7. **Big type** on both pages: body ≥ 18 px, PIDs and slot times one size up.

## 5. Recording

Record at 15:00 by this script, two full takes minimum; the better one is the submission. Screen recording of the browser with the terminal as a floating window over it; Nagisa's voice over the recording, not live sync, so a stumble costs one re-record of audio, not a re-run. Note where 0:15, 1:15 and 1:35 fall in the take. Leave 15:30 onward for the YouTube upload (processing takes a few minutes) and Devpost.

## 6. When it goes wrong

- Restart does not resume (14:00 checkpoint, plan-1h §5): no kill in the video. 1:15 becomes "The dispatcher confirms, and the case survives in a Durable Actor: here is its state, every step checkpointed", with Brad showing the actor's state in the terminal. Drop "one of them is going to die" from 0:00.
- Only the coordinator can be killed, not the actors runtime: that is already the plan; the words do not mention the actors process.
- Frontend not live at 14:00: demo from the terminal for the case flow and `/dispatch` on the fixture for 0:35; the words at 0:15 and 0:55 point at terminal output instead. Big terminal font.
- Streaming diagnosis fell back to a single call: 0:15 becomes "Diagnosing…", then point at the capacitor line when it arrives. The real-time AI line gets weaker; nothing else changes.
- Supabase unreachable at record time (hotspot down, project paused): the coordinator cannot boot the twin. Fix the network before recording; there is no fixture fallback in the pitch any more.
- A reason comes back empty or odd: read the slot or technician name only and skip the reason; do not improvise a reason.
- Brad kills too early (before `slot_accepted`): the coordinator resumes from an earlier checkpoint and the demo still works; the recovery card just names a different checkpoint. Read what the card says. If the kill lands before the provider replied, the gold tag will be on a different message or absent; skip "in gold here".
- Anything stalls more than 5 seconds during a take: stop, fix, re-record; never narrate over a stall.

## 7. Likely questions, one sentence each

- **"Isn't this just a database and a retry?"** Durable Actors has no workflow engine, so after a crash nothing resumes by itself; the record lives in the actor, the execution in a process that can die at any time, and the outbox plus Relay's idempotency keys make "died after sending, before recording" safe.
- **"Why is Relay local?"** Hosted was 2–4 s per message in our tests, local is 10–20 ms; same code, one environment variable.
- **"How does this scale?"** Each case's state lives in its own actor; what cases share lives in Postgres. A million homes is a lot of actors, not a bigger actor.
- **"Is the provider a real agent?"** It's a separate process with its own calendar actor that acts only when a Relay message arrives; today its scheduling rules are hard-coded and the booking waits for a human dispatcher's confirm.
- **"What happens if you kill the provider?"** Same pattern: it claims each message in its calendar actor before replying, so on restart it re-reads Relay and skips what it already answered. We didn't demo it for time.
- **"Which decisions are the model's?"** Three: the diagnosis, the shop agent's technician pick from its roster, and the dispatch agent's slot choice; each one's reason is on screen, and each result goes into the case's outbox before it is sent, so a crash during the call just reruns it and a crash after it resends the same message.
