// Stress the local relay engine so garbage collection runs many times; used to check the engine does not crash.
import fs from "node:fs";
import { AgentRelay } from "@agent-relay/sdk";
const baseUrl = process.env.RELAY_BASE_URL ?? "http://localhost:8787";
const state = JSON.parse(fs.readFileSync("relay/state.json", "utf8"));
const relay = new AgentRelay({ workspaceKey: state.workspaceKey, baseUrl });
const dispatch = await relay.workspace.reconnect({ apiToken: state.tokens.dispatch });
const N = Number(process.argv[2] ?? 1500);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await dispatch.sendMessage({ to: "#home-rescue", text: `stress ${i} ${"x".repeat(200)}`, idempotencyKey: `stress-${t0}-${i}` });
  if (i % 10 === 0) await dispatch.messages.list("home-rescue", { limit: 50 });
}
console.log(`sent ${N} messages in ${Date.now() - t0} ms`);
process.exit(0);
