import { json, requireAdmin } from "../../_shared/admin.js";
import { forbidCrossOrigin, readJsonBody } from "../../_shared/security.js";

// Costs used by the dashboard's profit estimate. Values are plain numbers in DZD.
const KEYS = ["cost_oil", "cost_laban", "cost_gift", "return_fee"];
const DEFAULTS = { cost_oil: 0, cost_laban: 0, cost_gift: 0, return_fee: 150 };

async function readSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const settings = { ...DEFAULTS };
  for (const row of results) {
    if (KEYS.includes(row.key) && Number.isFinite(Number(row.value))) settings[row.key] = Number(row.value);
  }
  return settings;
}

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);
  return json({ settings: await readSettings(env) });
}

export async function onRequestPut({ request, env }) {
  const blocked = forbidCrossOrigin(request);
  if (blocked) return blocked;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (!env.DB) return json({ error: "قاعدة الطلبات غير مهيأة." }, 503);

  const parsed = await readJsonBody(request, 2000);
  if (parsed.error) return parsed.error;
  const input = parsed.body?.settings;
  if (!input || typeof input !== "object") return json({ error: "بيانات غير صحيحة." }, 400);

  const statements = [];
  for (const key of KEYS) {
    if (!(key in input)) continue;
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value < 0 || value > 1000000) {
      return json({ error: "القيم يجب أن تكون أرقاما بين 0 و1000000." }, 400);
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).bind(key, String(Math.round(value))),
    );
  }
  if (statements.length) await env.DB.batch(statements);
  return json({ ok: true, settings: await readSettings(env) });
}
