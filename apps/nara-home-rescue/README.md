# Nara Home Rescue UI

Presentation screen for the hackathon story: a homeowner reports one symptom, Nara remembers the home, and Cool Air Mechanical receives a technician-ready case. Three panes on one screen: homeowner, shop, agent activity.

## Run

```bash
cd apps/nara-home-rescue
npm install
npm run dev
```

Open http://localhost:3000

## Data mode

`backend` (default) renders the live case from the ServiceCase actor when `http://127.0.0.1:3100/api/cases` answers. If that API is not running, the page shows the presenter instead of polling a closed port. `src/data/live.ts` polls `/api/cases` only in live mode. The API routes stay in `apps/dispatch-frontend`; this app proxies `/api/*` to `http://localhost:3100` and `/demo/*` to the demo director on `:7300` (`next.config.ts`). Actors, Agent Relay, and those routes are unchanged.

Live mode needs the backend from `docs/runbook.md`: actors (:7100), relay (:8787), `apps/dispatch-frontend` on :3100, `scripts/provider.mjs`, `scripts/coordinator.mjs`. Run `node scripts/reset-demo.mjs` before each run.

The live run: **Report a problem** (homeowner pane) or **New case** (header) → `POST /api/cases`. The page polls the newest case every 300 ms. The assessment streams in; the slot cards follow the Relay negotiation; at `slot_accepted` the shop pane shows **Confirm** → `POST /api/provider/confirm`.

`mock` is the presenter UI: http://localhost:3000/?mode=mock or `NEXT_PUBLIC_NARA_DATA_SOURCE=mock`. On this machine, `/` uses it whenever port 3100 is down. Previous, Next, Reset, and the arrow keys move one screen. They do not confirm, reject, or reschedule. Both panes share one case in the development adapter (`src/demo/caseStore.ts`), saved in this browser only. That store is not the ServiceCase actor. Live mode still reads the actor through `src/data/live.ts`. The homeowner phone and the Nara Capacity dashboard use that same case:

- Home Twin with structured service history
- Preliminary assessment and technician recommendations
- Request Alex at Today · 5:30–7:00 PM, or request Maria
- Shop actions: Confirm Alex, or Offer Maria instead at Today · 6:00–8:00 PM
- The homeowner accepts a counteroffer before it is confirmed
- Illustrated route on “Alex is on the way” (not live GPS)
- Reset clears the simulated case only. It does not delete a backend booking.

`npm test` runs the appointment regression tests.

The swap point for Brad's actor is `CasePort` in `src/data/casePort.ts`. The presenter uses `developmentCasePort`. Homeowner and shop components do not import it. See `INTEGRATION.md`. Cross-browser sync against the actor has not been run.

## Case

Canonical id in the mock: `case-1847-maple`. Live ids come from `POST /api/cases`.

The 2023 capacitor replacement is home history. The assessment does not say the capacitor is the fault.
