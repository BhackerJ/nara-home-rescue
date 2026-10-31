// Setup check: call the Smoke actor from Node, SIGKILL the actor server, restart it, and confirm the value survived.
import { spawn, execSync } from "node:child_process";
import { actors } from "../generated/actors/index.js";

const smoke = () => actors.Smoke.get("setup-check");
const before = await smoke().bump();
console.log("bumped to", before);

const pids = execSync("lsof -ti tcp:7100 -sTCP:LISTEN || true").toString().trim().split("\n").filter(Boolean);
console.log("killing actor server pids", pids);
for (const p of pids) process.kill(Number(p), "SIGKILL");
const killedAt = Date.now();

const child = spawn("../node_modules/.bin/durable-actors", ["dev", "--no-watch"], { cwd: "actors", stdio: "ignore", detached: true });
child.unref();

for (;;) {
  try {
    const after = await smoke().read();
    console.log(`read ${after} after restart; kill-to-first-successful-call ${Date.now() - killedAt} ms`);
    console.log(after === before ? "PASS: state survived SIGKILL" : "FAIL: state lost");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 50));
  }
}
