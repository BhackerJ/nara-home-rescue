// One command runs the whole demo on the real backend, for the backup video and for a
// pre-show check. Open http://localhost:3000 first and watch it there.
//
//   node scripts/auto-demo.mjs            run once, then keep provider + coordinator alive (Ctrl-C stops them)
//   node scripts/auto-demo.mjs --once     run once and stop everything
//   node scripts/auto-demo.mjs --pause 5  seconds to hold at the CONFIRM moment before the kill (default 3)
//
// Needs actors (:7100), relay (:8787) and apps/dispatch-frontend (:3100) already running (docs/runbook.md).
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const API = "http://localhost:3100";
const args = process.argv.slice(2);
const once = args.includes("--once");
const pauseArg = args.indexOf("--pause");
const pauseMs = 1000 * (pauseArg >= 0 ? Number(args[pauseArg + 1]) || 3 : 3);

const log = (msg) => console.log(`${new Date().toISOString().slice(11, 23)} [auto-demo] ${msg}`);

function run(script) {
  const child = spawn(process.execPath, [`scripts/${script}`], { stdio: "inherit" });
  child.on("exit", (code, signal) => log(`${script} exited (${signal ?? code})`));
  return child;
}

async function api(path, init) {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status}`);
  return res.json();
}

async function waitFor(caseId, label, test, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const c = await api(`/api/cases/${caseId}`).catch(() => null);
    if (c && test(c)) return c;
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// 0. Preflight and reset.
await api("/api/cases").catch(() => {
  console.error("Backend not reachable on :3100. Start actors, relay and apps/dispatch-frontend first (docs/runbook.md).");
  process.exit(1);
});
await new Promise((resolve) => run("reset-demo.mjs").on("exit", resolve));

// 1. Start the two agents.
const provider = run("provider.mjs");
let coordinator = run("coordinator.mjs");
const children = () => [provider, coordinator];
const stopAll = () => children().forEach((c) => c.exitCode === null && c.kill());
process.on("SIGINT", () => { stopAll(); process.exit(0); });
await sleep(2500);

try {
  // 2. Homeowner reports the problem.
  const { caseId } = await api("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  log(`case ${caseId} created; watch http://localhost:3000`);

  // 3. Diagnosis and Relay negotiation run on their own until the shop must confirm.
  await waitFor(caseId, "slot_accepted", (c) => c.checkpoint === "slot_accepted", 60_000);
  log(`slot accepted; holding ${pauseMs / 1000}s at the CONFIRM moment`);
  await sleep(pauseMs);

  // 4. Pull the plug on the coordinator, then the shop confirms while it is dead.
  const deadPid = coordinator.pid;
  coordinator.kill("SIGKILL");
  log(`kill -9 coordinator pid ${deadPid}`);
  await sleep(1000);
  await api("/api/provider/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
  log("shop CONFIRM sent; provider books while the coordinator is dead");
  await sleep(2500);

  // 5. Resurrect it; it resumes from the checkpoint and catches up from Relay.
  coordinator = run("coordinator.mjs");
  log(`coordinator restarted pid ${coordinator.pid}`);
  const done = await waitFor(caseId, "confirmed", (c) => c.status === "confirmed", 30_000);

  const bookings = done.events.filter((e) => e.type === "booking");
  const caughtUp = done.events.some((e) => e.type === "agent_message" && e.payload.kind === "confirm" && e.payload.backfilled);
  log(`confirmed ${done.confirmedSlot}; bookings ${bookings.length}; confirm caught up from Relay: ${caughtUp}; recovery pid ${done.recovery?.previousPid} -> ${done.recovery?.pid}`);
  if (bookings.length !== 1 || !caughtUp) {
    log("CHECK FAILED: expected exactly one booking and a backfilled confirm");
    process.exitCode = 1;
  }
} catch (error) {
  log(`FAILED: ${error.message}`);
  process.exitCode = 1;
}

if (once || process.exitCode) {
  stopAll();
} else {
  log("done. provider and coordinator stay up: click New case on :3000 to run again by hand; Ctrl-C stops them.");
}
