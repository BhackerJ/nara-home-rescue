# Nara HVAC dispatch frontend

Isolated Next.js app for the existing Cool Air Mechanical dispatch dashboard. It is not wired to the actors, Relay, or provider process in the repository root.

## Run

```bash
cd apps/dispatch-frontend
npm install
npm run dev
```

Open http://localhost:3000/dispatch

`/` redirects to `/dispatch`. There is no homeowner app in this package.

Plus Jakarta Sans and Fraunces load from Google Fonts. `next/font` is not used: in this nested package it fails to resolve font files during `next build`.

## What renders

Desktop dashboard titled **Nara Capacity — Cool Air Mechanical**. It publishes technician openings, ranks a mock service request, and lets the shop offer, suggest, or confirm a technician. Those actions update React state and `localStorage` only.

## Mock data

`loadDispatchDashboard()` in `src/data/dispatchGateway.ts` is the only read seam. It returns:

| Fixture | File | Used by the screen |
| --- | --- | --- |
| Cool Air Mechanical | `src/data/companies.ts` | Header and service cities |
| Service request `request-001` | `src/data/serviceRequests.ts` | Incoming request, photos, matching |
| Cool Air roster | `src/data/technicians.ts` (`TECHNICIAN_ROSTER`) | Capacity cards and ranking |
| Sample outcome | `src/data/outcomes.ts` | Not rendered |
| `serviceCase` projection | built in the gateway | Not rendered |

`src/data/technicians.ts` also contains marketplace technicians from the homeowner prototype. The dashboard roster is `TECHNICIAN_ROSTER` only.

Portraits and request photos live in `public/photos/`.

Two lists in `DispatchApp` are still written in the component, not read from the fixture: “What Nara learned” and “Technician requirements”. They match the mock request, but a live case will not change them until those lists read `serviceCase`.

`getDemoInbound()` can replace the request card when `sessionStorage` key `nara-demo-inbound` is set. Nothing in this app sets that key.

Offer, suggest, and confirm call `setAssignment()`, which writes `localStorage` key `nara-assignment`.

## Expected backend shapes

Types are in `src/contracts/serviceCase.ts`. They follow `docs/prd.txt` and add the equipment, diagnostic, job packet, counteroffer, and confirmed appointment objects this screen needs. No client calls them.

The fixture projection sets:

- Service case ID: `request-001`
- Status: `dispatching`
- Checkpoint: `intake_complete`
- Requested appointment: `Today` (from `urgency: same_day`)
- Provider counteroffer: `null`
- Confirmed appointment: `null`
- One diagnostic event with `timestamp: "fixture"`
- Home and equipment IDs prefixed `fixture-`, because the original mock has an address and a Carrier model, not actor IDs

`DispatchTimeline` is included and is not mounted.

## Integration still to do

- Replace `loadDispatchDashboard()` with the ServiceCase actor read.
- Drive the learned-facts and technician-requirement lists from the case.
- Map provider reject / counteroffer / confirm onto the existing offer and confirm flow, or onto new states, without assuming this UI already does that.
- Ignore root `package.json`. This app has its own dependencies and does not change the actor or Relay scripts.
