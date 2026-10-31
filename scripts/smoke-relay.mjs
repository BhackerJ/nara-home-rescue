// Setup check for Agent Relay against the local engine on :8787.
// First run creates the workspace and both agents and saves their tokens to relay/state.json (gitignored).
// Every run: provider listens, coordinator sends with an idempotencyKey, then we check latency, dedupe, reconnect, and catch-up via messages.list.
import fs from "node:fs";
import { AgentRelay } from "@agent-relay/sdk";

const baseUrl = process.env.RELAY_BASE_URL ?? "http://localhost:8787";
const statePath = "relay/state.json";
const CHANNEL = "home-rescue";

let state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : null;
if (!state) {
  const ws = await AgentRelay.createWorkspace({ name: "nara-home-rescue", baseUrl });
  const [coordinator, provider] = await ws.workspace.register([
    { name: "dispatch", type: "agent" },
    { name: "provider", type: "agent" },
  ]);
  await coordinator.channels.create({ name: CHANNEL, topic: "Nara Home Rescue cases" }).catch((e) => console.log("create channel:", e.code ?? e.message));
  await coordinator.channels.join(CHANNEL).catch(() => {});
  await provider.channels.join(CHANNEL).catch(() => {});
  state = { workspaceKey: ws.workspaceKey, tokens: { dispatch: coordinator.token ?? coordinator.apiToken, provider: provider.token ?? provider.apiToken } };
  if (!state.tokens.dispatch) console.log("agent client keys:", Object.keys(coordinator));
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log("created workspace and agents; saved", statePath);
}

// Two separate relay clients, like two separate processes.
const coordRelay = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const provRelay = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const dispatch = await coordRelay.workspace.reconnect({ apiToken: state.tokens.dispatch });
const provider = await provRelay.workspace.reconnect({ apiToken: state.tokens.provider });
console.log("reconnected both agents from saved tokens");

const runId = Date.now().toString(36);
const got = new Promise((resolve) => {
  provRelay.addListener("message.created", ({ message, envelope }) => {
    if (envelope.channel?.name !== CHANNEL && message.channel?.name !== CHANNEL) return;
    if (!message.text.includes(runId)) return;
    resolve({ at: Date.now(), message });
  });
});
await new Promise((r) => setTimeout(r, 300)); // let the websocket subscribe

const text = JSON.stringify({ to: "provider", kind: "slot_request", caseId: `smoke-${runId}` });
const t0 = Date.now();
const sent = await dispatch.sendMessage({ to: `#${CHANNEL}`, text, idempotencyKey: `smoke-${runId}:slot_requested` });
const tSent = Date.now();
const recv = await Promise.race([got, new Promise((r) => setTimeout(() => r(null), 5000))]);
console.log(`send ${tSent - t0} ms; listener ${recv ? recv.at - t0 + " ms" : "TIMEOUT"}`);

const again = await dispatch.sendMessage({ to: `#${CHANNEL}`, text, idempotencyKey: `smoke-${runId}:slot_requested` });
console.log(again.messageId === sent.messageId ? "PASS: same idempotencyKey returned the same message" : "FAIL: duplicate message created");

try {
  await dispatch.sendMessage({ to: `#${CHANNEL}`, text: text + " changed", idempotencyKey: `smoke-${runId}:slot_requested` });
  console.log("FAIL: reused key with different text was accepted");
} catch (e) { console.log("PASS: reused key with different text rejected:", e.code ?? e.status ?? e.message); }

const t1 = Date.now();
const fresh = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const dispatch2 = await fresh.workspace.reconnect({ apiToken: state.tokens.dispatch });
const history = await dispatch2.messages.list(CHANNEL, { limit: 20 });
const found = history.some((m) => m.id === sent.messageId);
console.log(`fresh client reconnect + messages.list ${Date.now() - t1} ms; ${found ? "PASS: message found in history" : "FAIL: not in history"}`);
process.exit(0);
