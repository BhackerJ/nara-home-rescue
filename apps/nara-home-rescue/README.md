# Nara Home Rescue UI

Presentation demo for the hackathon story: a homeowner reports one symptom, Nara remembers the home, and Cool Air Mechanical receives a technician-ready case.

This app does not modify `apps/dispatch-frontend` or the actor runtime.

## Run

```bash
cd apps/nara-home-rescue
npm install
npm run dev
```

Open http://localhost:3000

The story plays on its own. **Reset demo** returns to the Home Twin.

## Data mode

Default is a simulated script. Every activity row is labeled simulated. Demo clocks read `Demo 0:00`, not wall time.

Set `NEXT_PUBLIC_NARA_DATA_SOURCE=backend` to stop the script. That mode does not call the network. The only implemented actor is `Smoke` (`read`, `bump`). These routes appear in design notes and are not in the codebase:

- `GET /api/home/:id`
- `POST /api/cases`
- `GET /api/cases/:id`
- `GET /api/provider`
- `POST /api/demo/pull-plug`

The recovery beat says the checkpoint was kept and the assessment was not rewritten. It does not kill a process.

## Case

Canonical id in the mock: `case-1847-maple`.

The 2023 capacitor replacement is home history. The assessment does not say the capacitor is the fault.
