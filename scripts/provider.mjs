// Provider agent: Cool Air Mechanical (simulated). Listens on Relay channel home-rescue as agent "provider".
// slot_request -> offer (preferred slot is always taken) -> reject with 2 alternatives.
// accept -> wait for the shop's CONFIRM (ProviderCalendar.approve via POST /api/provider/confirm) -> book(key) -> confirm.
// Never killed in the demo. Dedupe: ProviderCalendar.claim(messageId); replies use idempotencyKey <caseId>:provider:<kind>.
import fs from "node:fs";
import { AgentRelay } from "@agent-relay/sdk";

try { process.loadEnvFile(".env"); } catch {}
const { actors } = await import("../generated/actors/index.js");

const baseUrl = process.env.RELAY_BASE_URL ?? "http://localhost:8787";
const CHANNEL = "home-rescue";
const PROVIDER_ID = "cool-air-mechanical";
const state = JSON.parse(fs.readFileSync("relay/state.json", "utf8"));
const relay = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const me = await relay.workspace.reconnect({ apiToken: state.tokens.provider });
const calendar = actors.ProviderCalendar.get(PROVIDER_ID);
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), "[provider]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parse(m) {
  try {
    const body = JSON.parse(m.text);
    return body && body.to === "provider" && body.caseId ? body : null;
  } catch { return null; }
}

async function send(caseId, kind, payload) {
  const text = JSON.stringify({ to: "dispatch", kind, caseId, ...payload });
  const sent = await me.sendMessage({ to: `#${CHANNEL}`, text, idempotencyKey: `${caseId}:provider:${kind}` });
  return sent.messageId;
}

async function handle(m, source) {
  const body = parse(m);
  if (!body || (body.kind !== "slot_request" && body.kind !== "accept")) return;
  if (!(await calendar.claim(m.id))) return;
  log(`${source} ${body.kind} for ${body.caseId} (${m.id})`);
  const caseId = body.caseId;
  if (body.kind === "slot_request") {
    const offer = await calendar.offer(caseId, body.requestedSlot);
    const replyId = await send(caseId, "reject", { requestedSlot: body.requestedSlot, alternatives: offer.alternatives, inReplyTo: m.id });
    await calendar.markReplied(m.id, replyId);
    log(`rejected ${body.requestedSlot}; offered ${offer.alternatives.join(" / ")}`);
    return;
  }
  // accept: the shop dispatcher must click CONFIRM first (this wait is the demo's kill window).
  log(`waiting for CONFIRM on ${caseId}...`);
  while (!(await calendar.isApproved(caseId))) await sleep(300);
  const booking = await calendar.book({ slot: body.slot, key: `${caseId}:book`, caseId });
  const replyId = await send(caseId, "confirm", { slot: booking.slot, key: booking.key, reused: booking.reused, inReplyTo: m.id });
  await calendar.markReplied(m.id, replyId);
  log(`booked ${booking.slot} (${booking.reused ? "reused" : "new"}) -> confirm sent`);
}

function safeHandle(m, source) {
  handle(m, source).catch((e) => log(`error handling ${m.id}:`, e.message));
}

relay.addListener("message.created", ({ message, envelope }) => {
  if (envelope?.channel?.name !== CHANNEL && message.channel?.name !== CHANNEL) return;
  safeHandle(message, "live");
});
await sleep(300); // let the websocket subscribe before backfilling

const history = await me.messages.list(CHANNEL, { limit: 200 });
for (const m of [...history].reverse()) safeHandle(m, "backfill");
log(`listening on #${CHANNEL} as provider; scanned ${history.length} past messages`);
