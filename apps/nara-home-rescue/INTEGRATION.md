# Case integration handoff

The presenter and Brad's live demo are two different read models. This note is the seam between them. It does not change `actors/`, `scripts/`, or `apps/dispatch-frontend`.

Nothing in this document was verified by running two browsers against the actor on port 3100. Same-browser `localStorage` is not cross-device sync. Agent Relay delivery and durable recovery are not claimed from the presenter.

## Where to plug in

`HomeownerPane` and `DispatchApp` do not import a store. They take props and callbacks. `RescueDemo` is the only presenter file that chooses a port:

```ts
const port = developmentCasePort;
```

Replace that binding with an object that satisfies `CasePort` in `src/data/casePort.ts`. Leave the pane components alone.

`developmentCasePort` (`src/demo/caseStore.ts`) is the stand-in. It keeps one case in memory and in `localStorage` under `nara-home-rescue:development-case`. A second tab in the same browser can hear the `storage` event. A second browser, another device, or a closed port 3100 does not.

Live mode (`/` when `http://127.0.0.1:3100/api/cases` answers) still mounts `LiveRescueDemo` and `src/data/live.ts`. That path polls the actor projection. It does not use `CasePort`.

## Development adapter

`source` is always `"development-adapter"`.

### `DemoSnapshot`

| Field | Type | Meaning |
|---|---|---|
| `appointment` | `AppointmentCase` | The shared booking |
| `step` | `number` | Presenter index, 0 through 12. Does not book or reschedule |
| `version` | `number` | Increments only when `appointment` changes |
| `updatedAt` | `string` | ISO time of the last appointment change, or `""` |
| `source` | `"development-adapter"` | Not an actor snapshot |

### `AppointmentCase`

| Field | Type |
|---|---|
| `caseId` | `"case-1847-maple"` |
| `requestedTechnicianId` | `"alex"` \| `"maria"` \| `null` |
| `requestedSlotId` | `"alex-today"` \| `"maria-today"` \| `null` |
| `providerDecision` | `"pending"` \| `"confirmed"` \| `"counteroffer"` \| `"rejected"` |
| `proposedTechnicianId` | `"alex"` \| `"maria"` \| `null` |
| `proposedSlotId` | `"alex-today"` \| `"maria-today"` \| `null` |
| `proposedReason` | `string` \| `null` |
| `confirmedTechnicianId` | `"alex"` \| `"maria"` \| `null` |
| `confirmedSlotId` | `"alex-today"` \| `"maria-today"` \| `null` |
| `appointmentStatus` | `"idle"` \| `"awaiting_provider"` \| `"counteroffer_pending_homeowner"` \| `"confirmed"` \| `"rejected"` |
| `confirmationTimestamp` | `string` \| `null` |

Slots:

| Id | Technician | Label |
|---|---|---|
| `alex-today` | `alex` | Today · 5:30–7:00 PM |
| `maria-today` | `maria` | Today · 6:00–8:00 PM |

`rejected` is in the union. The reducer does not write it. Decline returns the case to `awaiting_provider` and clears the proposal.

A confirmed case ignores later confirm, counteroffer, and reschedule calls. A second confirm returns the same snapshot and does not increment `version`.

### `CasePort` methods

| Method | Effect |
|---|---|
| `subscribe(onChange)` | Re-render when this tab writes, or when another tab in the same browser writes `localStorage` |
| `getSnapshot()` | Current `DemoSnapshot` |
| `getServerSnapshot()` | Empty case, step 0, version 0 |
| `request(technicianId)` | Sets requested technician and matching slot, status `awaiting_provider`, step 5. No-op if a request already exists |
| `confirmRequested()` | Copies the requested technician and slot into the confirmed fields. Status `confirmed` |
| `counteroffer(technicianId, reason)` | From `awaiting_provider` only. Status `counteroffer_pending_homeowner`. Does not confirm |
| `acceptCounteroffer()` | Confirms the proposed technician and slot |
| `declineCounteroffer()` | Clears the proposal and returns to `awaiting_provider` |
| `setStep(step)` | Clamps the presenter index. Same `appointment` object |
| `reset()` | Replaces the local snapshot with an empty case. Does not call the actor |

## Live API that already exists

Proxied by `apps/nara-home-rescue/next.config.ts` to `http://localhost:3100`. Implemented in `apps/dispatch-frontend`. These routes are unchanged.

| Call | Body | Response |
|---|---|---|
| `POST /api/cases` | `{ issue?: string, symptoms?: string[], preferredSlot?: string }` | `201 { caseId: string }`. Id is generated. Default `preferredSlot` is `"Tue 9:00"` |
| `GET /api/cases` | | `{ caseIds: string[] }` |
| `GET /api/cases/:id` | | Projected case from `projectCase`, or 404 |
| `POST /api/provider/confirm` | `{ caseId: string }` | `{ ok: true }`. Calls `ProviderCalendar.approve(caseId)` only |

`src/data/live.ts` also calls `POST /demo/play` on port 7300. That starts the demo director. It is not a booking API.

There is no HTTP route for requesting Alex, offering Maria, accepting a counteroffer, or declining one.

### `ServiceCase` actor (`actors/src/actors.ts`)

Persisted fields: `data`, `status`, `checkpoint`, `events`, `draft`, `outbox`, `results`, `worker`, `recovery`, `lastRelayMessageId`.

`CaseData`: `{ id, issue, symptoms, preferredSlot, createdAt }`.

`get()` returns `CaseSnapshot`:

| Field | Type |
|---|---|
| `data` | `CaseData` \| `null` |
| `status` | `string` (starts as `"created"`) |
| `checkpoint` | `string` |
| `events` | `CaseEvent[]` |
| `draft` | `string` |
| `outbox` | `Outbox` \| `null` |
| `results` | `{ [step: string]: StepResult }` |
| `worker` | `{ bootId, pid }` \| `null` |
| `recovery` | recovery record \| `null` |
| `lastRelayMessageId` | `string` \| `null` |

Methods on `ServiceCase`: `create`, `get`, `setDraft`, `stageStep`, `completeStep`, `addEvent`, `setWorker`, `beginRecovery`, `fail`.

`create` input: `{ id, issue, symptoms, preferredSlot }`. A second `create` returns the existing snapshot.

`stageStep` input: `{ step, kind, text, idempotencyKey, result? }`. The same `step` returns the existing outbox.

`completeStep` input: `{ step, status, agent?, relayMessageId?, events?, result? }`. The same checkpoint returns the current snapshot.

`ProviderCalendar` methods: `offer`, `approve`, `isApproved`, `book`, `claim`, `markReplied`, `get`, `reset`.

`offer(caseId, requestedSlot)` returns `{ caseId, requestedSlot, requestedTaken: true, alternatives: string[] }`. The seeded calendar treats the preferred slot as taken and offers other clock labels such as `"Tue 13:00"`. It does not know Alex or Maria.

`book({ slot, key, caseId })` is idempotent on `key`. It stores a slot string, not a technician id.

`CaseIndex`: `add`, `list`, `remove`.

## Differences

| Presenter | Actor and live HTTP |
|---|---|
| Stable id `case-1847-maple` | `POST /api/cases` mints a new id |
| Technician ids `alex`, `maria` | No technician field |
| Slot ids `alex-today`, `maria-today` | `preferredSlot` string, default `"Tue 9:00"` |
| Status `idle`, `awaiting_provider`, `counteroffer_pending_homeowner`, `confirmed` | Status string on the actor. The live UI union is `created`, `diagnosing`, `dispatching`, `awaiting_provider`, `recovering`, `negotiating`, `confirmed`, `failed` |
| Proposal is one technician plus one slot plus a reason | `ProviderCalendar.offer` returns alternative slot strings and always sets `requestedTaken: true` |
| `confirmRequested` writes the requested technician and slot | `POST /api/provider/confirm` only calls `approve(caseId)` |
| `version` on the presenter snapshot | Actor has no `version`. The dispatch projection uses `revision` |
| Home id and equipment id live in the presenter fixtures | `CaseData` has no `homeId` or `equipmentId`. The dispatch `ServiceCase` projection adds them |
| `setStep` is local presentation | Checkpoints are `created`, `diagnosed`, `slot_requested`, and the strings `completeStep` writes |
| Reset clears `localStorage` | `ProviderCalendar.reset` keeps the seeded booking and `handled` map. The presenter does not call it |

The dispatch file `apps/dispatch-frontend/src/contracts/serviceCase.ts` is a wider read model (`equipment`, `jobPacket`, `confirmedAppointment`, `revision`) than `CaseSnapshot`. `GET /api/cases/:id` returns that projection. `src/data/live.ts` uses a smaller `ServiceCase` (`requestedSlot`, `confirmedSlot`, `counteroffer.alternatives`, `events`). Neither type is `AppointmentCase`.

## Cross-session plan

Not run. Do not treat this list as a passing result.

Setup, from `docs/runbook.md`: actors on `:7100`, relay on `:8787`, `apps/dispatch-frontend` on `:3100`, `scripts/provider.mjs`, `scripts/coordinator.mjs`, then `apps/nara-home-rescue` (`npm run dev`). Two browsers, not two tabs of one browser.

1. Browser A opens the homeowner presenter. Browser B opens the shop presenter. Both must read the same case id from `GET /api/cases/:id` after a `CasePort` implementation exists. The development adapter cannot do this step.
2. A requests Alex, `alex-today`. B shows awaiting provider, Alex preferred, slot not confirmed.
3. B confirms that requested technician and slot. A shows Alex Morgan, Today · 5:30–7:00 PM, without a presenter Next click. A refresh of A and of B shows the same confirmed pair. A second confirm does not add a booking.
4. Reset that case on the actor (do not use presenter Reset, which only clears local storage). A requests Alex again. B submits Maria, `maria-today`, with a reason. A shows Maria as a counteroffer, not as confirmed. A accepts. Both show Maria confirmed and Alex not confirmed.
5. Kill and restart the coordinator only if the runbook's recovery step is under test. The presenter must not label a `localStorage` reload as actor recovery.
6. Watch the activity pane. Rows may say development adapter until the port's `source` and events come from `CaseSnapshot.events`. Do not describe those rows as Agent Relay until a Relay message id from the actor is on screen.

Until that run is done, the presenter is one browser, one local case, and the live page is the existing actor demo.
