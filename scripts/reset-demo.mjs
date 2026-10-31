// Before each rehearsal/recording: empty the CaseIndex and put the provider calendar back to its seed,
// so /dispatch shows only the new case and the first alternative is Tue 13:00 again. Cases themselves are kept.
import { actors } from "../generated/actors/index.js";

const index = actors.CaseIndex.get("main");
const ids = await index.list();
for (const id of ids) await index.remove(id);
await actors.ProviderCalendar.get("cool-air-mechanical").reset();
console.log(`index cleared (${ids.length} cases), calendar reset`);
