const encoder = new TextEncoder();
const QID = /^Q\d{9}$/;
const BOOK = /^[A-Z0-9][A-Z0-9-]*$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REASONS = new Set(["Wrong answer", "Wrong explanation", "Typo", "Missing image", "Duplicate", "Outdated information"]);
const MAX_AGE = 86400;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
async function hmac(key, value) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(value)));
}
function sameBytes(a, b) {
  let different = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) different |= (a[i] || 0) ^ (b[i] || 0);
  return different === 0;
}
export async function verifiedTelegramUser(initData, botToken, now = Date.now()) {
  if (typeof initData !== "string" || initData.length > 4096 || !botToken) return null;
  const params = new URLSearchParams(initData), hash = params.get("hash"), date = Number(params.get("auth_date"));
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || params.getAll("hash").length !== 1 || !Number.isSafeInteger(date) ||
      date > Math.floor(now / 1000) + 60 || date < Math.floor(now / 1000) - MAX_AGE) return null;
  const fields = [...params.entries()].filter(([key]) => key !== "hash");
  if (new Set(fields.map(([key]) => key)).size !== fields.length) return null;
  const check = values => values.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const digest = await hmac(secret, check([...fields]));
  const presented = Uint8Array.from(hash.match(/../g), hex => Number.parseInt(hex, 16));
  // Telegram's third-party signature has its own check string. Accept either HMAC
  // variant so clients that include/exclude that optional field remain compatible.
  const withoutSignature = fields.some(([key]) => key === "signature") &&
    await hmac(secret, check(fields.filter(([key]) => key !== "signature")));
  if (!sameBytes(digest, presented) && (!withoutSignature || !sameBytes(withoutSignature, presented))) return null;
  try {
    const user = JSON.parse(params.get("user") || "null");
    return Number.isSafeInteger(user?.id) && user.id > 0 ? String(user.id) : null;
  } catch (_) { return null; }
}
function cleanReport(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, q, book, version, reason, note = "" } = value;
  if (typeof id !== "string" || !UUID.test(id) || typeof q !== "string" || !QID.test(q) ||
      typeof book !== "string" || !BOOK.test(book) || book.length > 80 ||
      !Number.isSafeInteger(version) || version < 1 || version > 1000000 ||
      typeof reason !== "string" || !REASONS.has(reason) || typeof note !== "string" || note.length > 300 ||
      /[\u0000-\u001f\u007f]/.test(note)) return null;
  return { id, q, book, version, reason, note };
}
export async function submitReport(request, env, now = Date.now()) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Number(request.headers.get("content-length") || 0) > 8192) return json({ error: "too_large" }, 413);
  let body;
  try { body = await request.text(); if (body.length > 8192) return json({ error: "too_large" }, 413); body = JSON.parse(body); }
  catch (_) { return json({ error: "invalid_json" }, 400); }
  const userId = await verifiedTelegramUser(body.initData, env.BOT_TOKEN, now);
  if (!userId) return json({ error: "unauthorized" }, 401);
  const report = cleanReport(body.report);
  if (!report) return json({ error: "invalid_report" }, 400);
  const prior = await env.DB.prepare("SELECT id FROM question_reports WHERE id=?").bind(report.id).first();
  if (prior) return json({ accepted: true }); // Lost response: retry must not consume a rate-limit slot.
  const seconds = Math.floor(now / 1000);
  const userKey = [...await hmac(encoder.encode(env.BOT_TOKEN), userId)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  await env.DB.prepare("DELETE FROM report_rate_limits WHERE expires_at<?").bind(seconds).run();
  const row = await env.DB.prepare(`INSERT INTO report_rate_limits(user_key,window_start,attempts,expires_at) VALUES(?,?,1,?)
    ON CONFLICT(user_key) DO UPDATE SET window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END,
      attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END, expires_at=excluded.expires_at
    RETURNING attempts`).bind(userKey, seconds, seconds + MAX_AGE, seconds - MAX_AGE, seconds - MAX_AGE).first();
  if (row.attempts > 5) return json({ error: "rate_limited" }, 429);
  await env.DB.prepare("INSERT OR IGNORE INTO question_reports(id,qid,book_id,book_version,reason,note,created_at) VALUES(?,?,?,?,?,?,?)")
    .bind(report.id, report.q, report.book, report.version, report.reason, report.note, seconds).run();
  return json({ accepted: true });
}
export async function reportCommand(env, arg, id) {
  if (arg === "resolve") {
    if (!UUID.test(id || "")) return "Usage: /reports resolve REPORT-ID";
    const result = await env.DB.prepare("DELETE FROM question_reports WHERE id=?").bind(id).run();
    return result.meta?.changes ? `Resolved and deleted ${id}.` : "Report not found.";
  }
  if (arg) return "Usage: /reports [resolve REPORT-ID]";
  const result = await env.DB.prepare("SELECT id,qid,book_id,book_version,reason,note FROM question_reports ORDER BY created_at,id LIMIT 10").all();
  return (result.results || []).map(r => `${r.id} ${r.qid} ${r.book_id} v${r.book_version}: ${r.reason}${r.note ? " — " + r.note : ""}`).join("\n") || "No pending question reports.";
}
