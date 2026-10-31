// One non-streaming structured OpenAI call. Returns the parsed object, or null on any failure so callers can fall back.
export async function decide({ system, user, schema, name, log = () => {} }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) { log(`${name}: OPENAI_API_KEY missing, using fallback`); return null; }
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    log(`${name}: ${Date.now() - t0} ms`);
    return parsed;
  } catch (e) {
    log(`${name}: failed (${e.message}), using fallback`);
    return null;
  }
}
