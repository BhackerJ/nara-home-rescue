// Home Twin in Supabase (schema home_rescue: home, equipment, service_history), with data/home.json as the fallback.
// Reads happen once at coordinator boot; the history write is idempotent on case_id and never blocks the case.
import fs from "node:fs";
import pg from "pg";

const FILE = "data/home.json";

function client() {
  const url = process.env.HOME_RESCUE_DATABASE_URL;
  if (!url) return null;
  return new pg.Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === "insecure" ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
}

export async function loadTwin(log = () => {}) {
  const file = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const c = client();
  if (!c) { log("twin: HOME_RESCUE_DATABASE_URL missing, using data/home.json"); return { ...file, source: "file" }; }
  try {
    await c.connect();
    // The seed row may still carry the original id; take the file's id first, else the only home there is.
    const home = (await c.query("select id, label from home_rescue.home order by (id = $1) desc, id limit 1", [file.id])).rows[0];
    if (!home) throw new Error("no home row in Supabase");
    const equipment = (await c.query("select id, type, brand, model, installed_year from home_rescue.equipment where home_id = $1 order by id", [home.id])).rows;
    const history = (await c.query("select to_char(date, 'YYYY-MM-DD') as date, summary, case_id from home_rescue.service_history where home_id = $1 order by date desc", [home.id])).rows;
    log(`twin: loaded from Supabase (home ${home.id}, ${equipment.length} equipment, ${history.length} history rows)`);
    return {
      ...file,
      id: home.id,
      label: home.label,
      equipment: equipment.map((e) => ({ id: e.id, type: e.type, brand: e.brand, model: e.model, installedYear: e.installed_year })),
      history: history.map((h) => ({ date: h.date, summary: h.summary, caseId: h.case_id ?? undefined })),
      source: "supabase",
    };
  } catch (e) {
    log(`twin: Supabase unavailable (${e.message}), using data/home.json`);
    return { ...file, source: "file" };
  } finally {
    await c.end().catch(() => {});
  }
}

export async function appendHistory(homeId, entry, log = () => {}) {
  const c = client();
  if (!c) return false;
  try {
    await c.connect();
    const r = await c.query(
      "insert into home_rescue.service_history (home_id, date, summary, case_id) select $1, $2::date, $3, $4 where not exists (select 1 from home_rescue.service_history where case_id = $4)",
      [homeId, entry.date, entry.summary, entry.caseId],
    );
    log(`twin: service_history ${r.rowCount ? "row written" : "row already there"} for ${entry.caseId}`);
    return true;
  } catch (e) {
    log(`twin: service_history write failed (${e.message}); the case still completes`);
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}
