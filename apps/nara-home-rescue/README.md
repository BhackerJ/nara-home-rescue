# Nara Home Rescue UI

Presentation screen for the hackathon story: a homeowner reports one symptom, Nara remembers the home, and Cool Air Mechanical receives a technician-ready case. Three panes on one screen: homeowner, shop, agent activity.

It renders the live case from the ServiceCase actor. The API routes stay in `apps/dispatch-frontend`; this app proxies `/api/*` to `http://localhost:3100` (`next.config.ts`).

## Run

```bash
cd apps/nara-home-rescue
npm install
npm run dev
```

Open http://localhost:3000

Live mode needs the backend from `docs/runbook.md`: actors (:7100), relay (:8787), `apps/dispatch-frontend` on :3100, `scripts/provider.mjs`, `scripts/coordinator.mjs`. Run `node scripts/reset-demo.mjs` before each run.

The run: **Report a problem** (homeowner pane) or **New case** (header) → `POST /api/cases`. The page polls the newest case every 300 ms. The assessment streams in; the slot cards follow the Relay negotiation; at `slot_accepted` the shop pane shows **Confirm** → `POST /api/provider/confirm`. Kill the coordinator before clicking Confirm, restart it after, and the recovery card, the caught-up message and the confirmed slot appear.

## Data mode

`backend` (default) shows the live case. `mock` plays the scripted story: every activity row is labeled simulated, clocks read `Demo 0:00`, and **Reset demo** returns to the Home Twin. Switch with `NEXT_PUBLIC_NARA_DATA_SOURCE=mock` or `?mode=mock` on the URL (the on-stage fallback if the backend is down).

## Case

Canonical id in the mock: `case-1847-maple`. Live ids come from `POST /api/cases`.

The 2023 capacitor replacement is home history. The assessment does not say the capacitor is the fault.
