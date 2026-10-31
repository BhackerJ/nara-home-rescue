// Coordinator: diagnostic + dispatch agent. Runs every ServiceCase in CaseIndex through the checkpoints
// created -> diagnosed -> slot_requested -> slot_rejected -> slot_accepted -> booked -> home_updated.
// Stateless: ServiceCase is the only truth. Sends follow the outbox order (stageStep -> send -> completeStep),
// so kill -9 anywhere and a restart resumes from the checkpoint without resending or rebooking. docs/plan-1h.md §4.
import fs from "node:fs";
import crypto from "node:crypto";
import { AgentRelay } from "@agent-relay/sdk";
import { decide } from "./llm.mjs";

try { process.loadEnvFile(".env"); } catch {}
const { actors } = await import("../generated/actors/index.js");

const baseUrl = process.env.RELAY_BASE_URL ?? "http://localhost:8787";
const CHANNEL = "home-rescue";
const bootId = crypto.randomUUID().slice(0, 8);
const pid = process.pid;
const home = JSON.parse(fs.readFileSync("data/home.json", "utf8"));
const state = JSON.parse(fs.readFileSync("relay/state.json", "utf8"));
const relay = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const dispatch = await relay.workspace.reconnect({ apiToken: state.tokens.dispatch });
const index = actors.CaseIndex.get("main");
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), `[coordinator ${pid}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Inbox of provider replies, keyed caseId -> kind -> message. Fed by the live listener and by the startup backfill.
// A message is "backfilled" when it already existed at boot: its id is at or below the newest id in the startup history.
// (Relay's mailbox also replays recent messages over the websocket on reconnect, so the delivery path does not tell us.)
const inbox = new Map();
const seen = new Set();
let bootWatermark = 0n;
function intake(m) {
  if (seen.has(m.id)) return;
  let body;
  try { body = JSON.parse(m.text); } catch { return; }
  if (!body || body.to !== "dispatch" || !body.caseId) return;
  seen.add(m.id);
  if (!inbox.has(body.caseId)) inbox.set(body.caseId, new Map());
  inbox.get(body.caseId).set(body.kind, { id: m.id, text: m.text, body, get backfilled() { return BigInt(m.id) <= bootWatermark; } });
}
relay.addListener("message.created", ({ message, envelope }) => {
  if (envelope?.channel?.name !== CHANNEL && message.channel?.name !== CHANNEL) return;
  intake(message);
});

// ---------- step 1: diagnosis (OpenAI streaming, plain text) ----------
const FALLBACK_NARRATIVE =
  "A fan that runs while the outdoor unit stays silent points to the condenser not starting, most often a failed run capacitor or contactor. " +
  "This Carrier 24ABC6 had its run capacitor replaced in July 2023, so a repeat failure or a weak contactor is the first thing to check. " +
  "The spring 2025 maintenance found the charge and coil fine, which makes a refrigerant problem less likely. " +
  "A technician should test the capacitor and contactor on the outdoor unit before anything else.";

async function* streamDiagnosis(data) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    log("OPENAI_API_KEY missing: streaming the fixture narrative instead");
    for (const word of FALLBACK_NARRATIVE.split(" ")) { yield word + " "; await sleep(40); }
    return;
  }
  const prompt = [
    "You are the diagnostic agent for a home HVAC service. Write a plain-text diagnosis for the technician in 3 to 5 sentences, no headings, no lists.",
    "Mention the 2023 capacitor replacement if it is relevant to these symptoms.",
    "", "Home twin:", JSON.stringify(home, null, 2), "",
    `Issue: ${data.issue}`, `Symptoms: ${(data.symptoms ?? []).join("; ")}`, `Preferred slot: ${data.preferredSlot}`,
  ].join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", stream: true, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") return;
      const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

async function diagnose(sc, c) {
  let text = "";
  let flushed = "";
  const timer = setInterval(() => {
    if (text !== flushed) { flushed = text; sc.setDraft(text).catch(() => {}); }
  }, 250);
  try {
    for await (const chunk of streamDiagnosis(c.data)) text += chunk;
  } finally { clearInterval(timer); }
  const narrative = text.trim();
  await sc.setDraft(narrative);
  await sc.completeStep({ step: "diagnosed", status: "dispatching", agent: "diagnostic", events: [{ type: "diagnosed", payload: { narrative } }], result: { narrative } });
  log(`diagnosed ${c.data.id} (${narrative.length} chars)`);
}

// ---------- outbox send: stage -> send (idempotent) -> complete ----------
async function sendStep(sc, c, { step, kind, status, payload, result }) {
  const caseId = c.data.id;
  let staged = c.outbox && c.outbox.step === step ? c.outbox : null;
  if (staged) log(`${caseId}: resending staged ${kind} from outbox`);
  else {
    const text = JSON.stringify({ to: "provider", kind, caseId, ...payload });
    staged = await sc.stageStep({ step, kind, text, idempotencyKey: `${caseId}:${kind}`, result });
  }
  const sent = await dispatch.sendMessage({ to: `#${CHANNEL}`, text: staged.text, idempotencyKey: staged.idempotencyKey });
  await sc.completeStep({
    step, status, agent: "dispatch", relayMessageId: sent.messageId, result: staged.result,
    events: [{ type: "agent_message", payload: { from: "dispatch", to: "provider", kind, body: staged.text, relayMessageId: sent.messageId, backfilled: false } }],
  });
  log(`${caseId}: sent ${kind} (${sent.messageId}) -> ${step}`);
}

// Step 4: the dispatch agent picks one of the provider's alternatives and says why. Runs before stageStep,
// so a crash during the call just re-runs it; a crash after stageStep resends the staged message.
async function chooseSlot(c, alternatives, technician) {
  const fallback = { slot: alternatives[0], reason: "" };
  if (alternatives.length === 1) return fallback;
  const picked = await decide({
    name: "choose_slot",
    log,
    system: "You are the dispatch agent for a homeowner. Choose one appointment slot from the provider's alternatives. Reply with the slot exactly as written and one short sentence (max 25 words) explaining the choice to the homeowner.",
    user: [
      `Homeowner preferred: ${c.data.preferredSlot} (taken).`,
      `Alternatives offered: ${alternatives.join(" | ")}`,
      `Issue: ${c.data.issue}. Symptoms: ${(c.data.symptoms ?? []).join("; ")}.`,
      technician ? `Technician the shop proposes: ${technician.name}, ${technician.title}.` : "",
      "Prefer the earliest slot unless there is a clear reason not to.",
    ].join("\n"),
    schema: {
      type: "object", additionalProperties: false, required: ["slot", "reason"],
      properties: { slot: { type: "string", enum: alternatives }, reason: { type: "string" } },
    },
  });
  if (!picked || !alternatives.includes(picked.slot)) return fallback;
  return { slot: picked.slot, reason: String(picked.reason ?? "").slice(0, 200) };
}

function agentMessageEvent(msg) {
  return { type: "agent_message", payload: { from: "provider", to: "dispatch", kind: msg.body.kind, body: msg.text, relayMessageId: msg.id, backfilled: msg.backfilled } };
}

// One pass over a case. Returns "done", "wait" (reply not here yet) or "next".
async function step(sc, c) {
  const caseId = c.data.id;
  const reply = (kind) => inbox.get(caseId)?.get(kind);
  switch (c.checkpoint) {
    case "created":
      await diagnose(sc, c);
      return "next";
    case "diagnosed": {
      // The job packet the shop receives: slot plus what the diagnostic agent learned.
      const eq = home.equipment[0];
      const payload = {
        requestedSlot: c.data.preferredSlot,
        summary: (c.results.diagnosed?.narrative ?? "").slice(0, 600),
        symptoms: c.data.symptoms ?? [],
        equipment: `${eq.brand} ${eq.model} (${eq.installedYear})`,
      };
      await sendStep(sc, c, { step: "slot_requested", kind: "slot_request", status: "awaiting_provider", payload, result: { requestedSlot: c.data.preferredSlot } });
      return "next";
    }
    case "slot_requested": {
      const msg = reply("reject");
      if (!msg) return "wait";
      const { alternatives, technician = null, reason = "" } = msg.body;
      await sc.completeStep({ step: "slot_rejected", status: "negotiating", agent: "dispatch", relayMessageId: msg.id, events: [agentMessageEvent(msg)], result: { alternatives, technician, reason } });
      log(`${caseId}: provider rejected ${c.data.preferredSlot}; alternatives ${alternatives.join(" / ")}; technician ${technician?.name ?? "n/a"}${msg.backfilled ? " (backfilled)" : ""}`);
      return "next";
    }
    case "slot_rejected": {
      const alternatives = c.results.slot_rejected?.alternatives ?? [];
      if (!alternatives.length) throw new Error("no alternative slot recorded");
      const technician = c.results.slot_rejected?.technician ?? null;
      const pick = await chooseSlot(c, alternatives, technician);
      await sendStep(sc, c, {
        step: "slot_accepted", kind: "accept", status: "awaiting_provider",
        payload: { slot: pick.slot, reason: pick.reason, technicianId: technician?.id ?? null }, result: { slot: pick.slot, reason: pick.reason },
      });
      log(`${caseId}: accepted ${pick.slot}${pick.reason ? ` — ${pick.reason}` : ""}`);
      return "next";
    }
    case "slot_accepted": {
      const msg = reply("confirm");
      if (!msg) return "wait";
      const { slot, key, reused, technician = null } = msg.body;
      await sc.completeStep({
        step: "booked", status: "negotiating", agent: "dispatch", relayMessageId: msg.id,
        events: [agentMessageEvent(msg), { type: "booking", payload: { slot, idempotencyKey: key, reused: Boolean(reused), technician: technician?.name ?? "" } }], result: { slot, technician },
      });
      log(`${caseId}: booked ${slot}${reused ? " (reused booking)" : ""}${msg.backfilled ? " (backfilled)" : ""}`);
      return "next";
    }
    case "booked": {
      const slot = c.results.booked?.slot;
      const historyEntry = { date: new Date().toISOString().slice(0, 10), summary: `Service visit booked for ${slot}: ${c.data.issue}`, caseId };
      await sc.completeStep({ step: "home_updated", status: "confirmed", events: [{ type: "home_updated", payload: { historyEntry, homeId: home.id } }], result: { historyEntry } });
      log(`${caseId}: home twin updated -> confirmed`);
      return "next";
    }
    default:
      return "done";
  }
}

// Per-case loop: read -> step -> repeat. Any error: wait 200 ms, re-read, retry; 30 s of errors -> fail().
const running = new Set();
const finished = new Set();
async function runCase(caseId) {
  running.add(caseId);
  const sc = actors.ServiceCase.get(caseId);
  let firstError = null;
  try {
    for (;;) {
      let outcome;
      try {
        const c = await sc.get();
        if (!c.data) { log(`${caseId}: no data, skipping`); break; }
        if (c.status === "failed" || c.checkpoint === "home_updated") break;
        if (c.worker?.bootId !== bootId) {
          if (c.worker) { await sc.beginRecovery({ bootId, pid }); log(`${caseId}: recovering from ${c.checkpoint} (previous pid ${c.worker.pid})`); }
          else await sc.setWorker({ bootId, pid });
          continue;
        }
        outcome = await step(sc, c);
        firstError = null;
      } catch (e) {
        firstError ??= Date.now();
        log(`${caseId}: error: ${e.message}`);
        if (Date.now() - firstError > 30_000) { await sc.fail(e.message).catch(() => {}); log(`${caseId}: FAILED after 30 s of errors`); break; }
        await sleep(200);
        continue;
      }
      if (outcome === "done") break;
      if (outcome === "wait") await sleep(300);
    }
  } finally {
    running.delete(caseId);
    finished.add(caseId);
  }
}

// ---------- startup: backfill Relay history, then pick up every unfinished case ----------
await sleep(300); // websocket subscribed before we list, so nothing falls between
const history = await dispatch.messages.list(CHANNEL, { limit: 200 });
for (const m of history) bootWatermark = BigInt(m.id) > bootWatermark ? BigInt(m.id) : bootWatermark;
for (const m of [...history].reverse()) intake(m);
log(`boot ${bootId} pid ${pid}; backfilled ${history.length} relay messages`);

async function scan() {
  const ids = await index.list().catch((e) => { log("CaseIndex.list error:", e.message); return []; });
  for (const id of ids) {
    if (running.has(id) || finished.has(id)) continue;
    runCase(id).catch((e) => log(`${id}: loop crashed: ${e.message}`));
  }
}
await scan();
setInterval(scan, 1000);
