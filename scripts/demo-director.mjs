// Demo director: keeps provider + coordinator running and plays the whole story on
// request, so the :3000 page can run the demo with one button and no terminal work.
//
//   node scripts/demo-director.mjs             listens on :7300 (design §3 reserved this port for the supervisor)
//   node scripts/demo-director.mjs --hold 12   seconds to hold at the CONFIRM moment before the kill (default 8)
//
// GET  /status  -> { running, step, hold, runners: { provider, coordinator } }
// POST /play    -> starts a run (409 if one is already playing)
//
// Replaces terminals 4 and 5 of docs/runbook.md. Needs actors (:7100), relay (:8787) and
// apps/dispatch-frontend (:3100). The pauses are display pacing in the director; the agents
// themselves add no delay (design-hackathon §7).
import { spawn } from "node:child_process";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

const API = "http://localhost:3100";
const PORT = 7300;
const args = process.argv.slice(2);
const holdArg = args.indexOf("--hold");
const HOLD_MS = 1000 * (holdArg >= 0 ? Number(args[holdArg + 1]) || 8 : 8);

const log = (msg) => console.log(`${new Date().toISOString().slice(11, 23)} [director] ${msg}`);

// --- runners -----------------------------------------------------------------------
const runners = { provider: null, coordinator: null };
let expectedDeath = null; // runner name we killed on purpose; no auto-restart for it

function start(name) {
  const child = spawn(process.execPath, [`scripts/${name}.mjs`], { stdio: "inherit" });
  runners[name] = child;
  log(`${name} started pid ${child.pid}`);
  child.on("exit", async (code, signal) => {
    log(`${name} exited (${signal ?? code})`);
    if (runners[name] !== child) return;
    runners[name] = null;
    if (expectedDeath === name || shuttingDown) return;
    await sleep(1000);
    if (!runners[name] && !shuttingDown) start(name);
  });
  return child;
}

let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  for (const child of Object.values(runners)) child?.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// --- the story ---------------------------------------------------------------------
const state = { running: false, step: "idle", caseId: null, startedAt: null, error: null };
const setStep = (step) => {
  state.step = step;
  log(step);
};

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

async function play() {
  state.running = true;
  state.error = null;
  state.startedAt = Date.now();
  try {
    setStep("resetting");
    await new Promise((resolve) => spawn(process.execPath, ["scripts/reset-demo.mjs"], { stdio: "inherit" }).on("exit", resolve));
    if (!runners.provider) start("provider");
    if (!runners.coordinator) start("coordinator");
    await sleep(2000);

    const { caseId } = await api("/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    state.caseId = caseId;
    setStep("homeowner reported the problem");

    await waitFor(caseId, "diagnosed", (c) => c.checkpoint !== "created", 60_000);
    setStep("diagnosis ready; agents negotiating over Agent Relay");
    await waitFor(caseId, "slot_accepted", (c) => c.checkpoint === "slot_accepted", 60_000);
    setStep(`shop must confirm; holding ${HOLD_MS / 1000}s`);
    await sleep(HOLD_MS);

    const dead = runners.coordinator;
    expectedDeath = "coordinator";
    dead.kill("SIGKILL");
    setStep(`coordinator killed (pid ${dead.pid})`);
    await sleep(4000);

    await api("/api/provider/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }) });
    setStep("shop confirmed while the coordinator is dead");
    await sleep(4000);

    expectedDeath = null;
    const revived = start("coordinator");
    setStep(`coordinator restarted (pid ${revived.pid}); recovering`);
    const done = await waitFor(caseId, "confirmed", (c) => c.status === "confirmed", 30_000);

    const bookings = done.events.filter((e) => e.type === "booking").length;
    const caughtUp = done.events.some((e) => e.type === "agent_message" && e.payload.kind === "confirm" && e.payload.backfilled);
    if (bookings !== 1 || !caughtUp) throw new Error(`check failed: bookings ${bookings}, confirm caught up ${caughtUp}`);
    setStep(`done: confirmed ${done.confirmedSlot}, one booking, confirm caught up from Relay, pid ${done.recovery?.previousPid} -> ${done.recovery?.pid}`);
  } catch (error) {
    state.error = error.message;
    setStep(`failed: ${error.message}`);
    expectedDeath = null;
    if (!runners.coordinator) start("coordinator");
  } finally {
    state.running = false;
  }
}

// --- http --------------------------------------------------------------------------
http
  .createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/status") {
      return send(200, {
        running: state.running,
        step: state.step,
        caseId: state.caseId,
        error: state.error,
        hold: HOLD_MS / 1000,
        runners: { provider: runners.provider?.pid ?? null, coordinator: runners.coordinator?.pid ?? null },
      });
    }
    if (req.method === "POST" && req.url === "/play") {
      if (state.running) return send(409, { error: "already playing", step: state.step });
      play();
      return send(202, { ok: true });
    }
    send(404, { error: "not found" });
  })
  .listen(PORT, async () => {
    log(`listening on :${PORT}`);
    try {
      await api("/api/cases");
    } catch {
      log("WARNING: backend on :3100 not reachable; start actors, relay and apps/dispatch-frontend (docs/runbook.md)");
    }
    start("provider");
    start("coordinator");
  });
