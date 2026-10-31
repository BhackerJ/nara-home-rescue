// Frontend fixture: drive one case through every step directly on the actors (no coordinator, provider, Relay or OpenAI),
// so /home and /dispatch can be checked before Session B lands. Run: node scripts/simulate-case.mjs [http://localhost:3100]
import { actors } from "../generated/actors/index.js";

const base = process.argv[2] ?? "http://localhost:3100";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const r = await fetch(`${base}/api/cases`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ issue: "My AC isn't cooling.", symptoms: ["Fan runs", "No cold air", "Outdoor unit not running"], preferredSlot: "Tue 9:00" }),
});
const { caseId: id } = await r.json();
console.log("case", id);
const c = actors.ServiceCase.get(id);
const msg = (kind, extra) => JSON.stringify({ to: kind === "reject" || kind === "confirm" ? "dispatch" : "provider", kind, caseId: id, ...extra });
const agentMessage = (from, to, kind, body, relayMessageId, backfilled) => ({ type: "agent_message", payload: { from, to, kind, body, relayMessageId, backfilled } });

await c.setWorker({ bootId: "boot-a", pid: 48213 });
const text =
  "Based on the Carrier 24ABC636A003 installed in 2014 and the run capacitor replaced in July 2023, a fan that runs with no cold air while the outdoor unit stays off points to the run capacitor again, or the contactor. A technician should test the capacitor first and bring a 45/5 µF replacement.";
for (let i = 30; i <= text.length + 30; i += 30) {
  await c.setDraft(text.slice(0, i));
  await sleep(250);
}
await c.completeStep({ step: "diagnosed", status: "dispatching", result: { narrative: text }, events: [{ type: "diagnosed", payload: { narrative: text } }] });
await sleep(800);

const req = msg("slot_request", { requestedSlot: "Tue 9:00" });
await c.stageStep({ step: "slot_requested", kind: "slot_request", text: req, idempotencyKey: `${id}:slot_request` });
await c.completeStep({ step: "slot_requested", status: "awaiting_provider", relayMessageId: "m1", events: [agentMessage("dispatch", "provider", "slot_request", req, "m1", false)] });
await sleep(800);

const rej = msg("reject", { requestedSlot: "Tue 9:00", alternatives: ["Tue 13:00", "Wed 9:00"] });
await c.completeStep({ step: "slot_rejected", status: "negotiating", relayMessageId: "m2", result: { alternatives: ["Tue 13:00", "Wed 9:00"] }, events: [agentMessage("provider", "dispatch", "reject", rej, "m2", false)] });
await sleep(800);

const acc = msg("accept", { slot: "Tue 13:00" });
await c.stageStep({ step: "slot_accepted", kind: "accept", text: acc, idempotencyKey: `${id}:accept`, result: { slot: "Tue 13:00" } });
await c.completeStep({ step: "slot_accepted", status: "awaiting_provider", relayMessageId: "m3", events: [agentMessage("dispatch", "provider", "accept", acc, "m3", false)] });
console.log("waiting for the shop's CONFIRM (POST /api/provider/confirm) … 3 s, then simulating the kill/restart");
await sleep(3000);

await c.beginRecovery({ bootId: "boot-b", pid: 48390 });
await sleep(800);
const conf = msg("confirm", { slot: "Tue 13:00" });
await c.completeStep({ step: "booked", status: "negotiating", relayMessageId: "m4", result: { slot: "Tue 13:00" }, events: [agentMessage("provider", "dispatch", "confirm", conf, "m4", true)] });
await sleep(800);
await c.completeStep({
  step: "home_updated",
  status: "confirmed",
  events: [{ type: "home_updated", payload: { date: "2026-10-31", summary: "AC not cooling: capacitor/contactor check booked with Cool Air Mechanical, Tue 13:00", caseId: id } }],
});

const p = await (await fetch(`${base}/api/cases/${id}`)).json();
console.log("status", p.status, "| confirmed", p.confirmedAppointment?.confirmedSlot, "| recovery", p.recovery?.previousPid, "->", p.recovery?.pid);
console.log("events", p.events.map((e) => e.type).join(","));
