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

The default screen is the presenter UI below, with the live agent log and the LLM text from the real case beside it (**Play demo** in the header runs the backend through the director; Next/Previous turn the screens). `?mode=live` opens the plain three-pane live view. `backend` renders the live case from the ServiceCase actor. `src/data/live.ts` polls `/api/cases`. The API routes stay in `apps/dispatch-frontend`; this app proxies `/api/*` to `http://localhost:3100` and `/demo/*` to the demo director on `:7300` (`next.config.ts`). Actors, Agent Relay, and those routes are unchanged.

Live mode needs the backend from `docs/runbook.md`: actors (:7100), relay (:8787), `apps/dispatch-frontend` on :3100, `scripts/provider.mjs`, `scripts/coordinator.mjs`. Run `node scripts/reset-demo.mjs` before each run.

The live run: **Report a problem** (homeowner pane) or **New case** (header) → `POST /api/cases`. The page polls the newest case every 300 ms. The assessment streams in; the slot cards follow the Relay negotiation; at `slot_accepted` the shop pane shows **Confirm** → `POST /api/provider/confirm`.

`mock` is the latest presenter UI: http://localhost:3000/?mode=mock or `NEXT_PUBLIC_NARA_DATA_SOURCE=mock`. Previous, Next, Reset, and the arrow keys move one screen. They do not confirm, reject, or reschedule. The homeowner phone and the Nara Capacity dashboard share one simulated appointment (`src/demo/appointment.ts`):

- Home Twin with structured service history
- Preliminary assessment and technician recommendations
- Request Alex at Today · 5:30–7:00 PM, or request Maria
- Shop actions: Confirm Alex, or Offer Maria instead at Today · 6:00–8:00 PM
- The homeowner accepts a counteroffer before it is confirmed
- Illustrated route on “Alex is on the way” (not live GPS)
- Reset clears the simulated case only. It does not delete a backend booking.

`npm test` runs the appointment regression tests.

## Case

Canonical id in the mock: `case-1847-maple`. Live ids come from `POST /api/cases`.

The 2023 capacitor replacement is home history. The assessment does not say the capacitor is the fault.
