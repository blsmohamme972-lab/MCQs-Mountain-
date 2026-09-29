// Kafu control plane. Heavy publishing work stays in GitHub Actions.
import { parsePackageName, queueDocument, retryGroup, clearGroup } from "./queue-state.mjs";
export { parsePackageName, retryGroup, clearGroup };
const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const QID = /^Q\d{9}$/;

function reply(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json", "cache-control": "no-store" },
  });
}
function safeText(env, value) {
  let text = String(value || "");
  for (const key of ["BOT_TOKEN", "QUEUE_API_TOKEN", "WEBHOOK_SECRET", "DISPATCH_TOKEN", "CLOUDFLARE_API_TOKEN"]) {
    const secret = String(env[key] || "");
    if (secret.length >= 4) text = text.split(secret).join("<redacted>");
  }
  return text.replace(/(\/(?:file\/)?bot)[^/\s]+\//g, "$1<redacted>/")
    .replace(/(Bearer|Basic)\s+[^\s"'<>]+/gi, "$1 <redacted>")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']+/g, "$1");
}
async function telegram(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": "kafu-bot/1.0" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram ${method}: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${safeText(env, data.description || "failed")}`);
  return data.result;
}
async function message(env, text, extra = {}) {
  return telegram(env, "sendMessage", { chat_id: env.OWNER_TELEGRAM_ID, text: safeText(env, text).slice(0, 4000), ...extra });
}
async function dispatch(env) {
  const repo = env.GITHUB_REPOSITORY || "blsmohamme972-lab/MCQs-Mountain-";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid GitHub repository");
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-queue.yml/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${env.DISPATCH_TOKEN}`, accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28", "user-agent": "kafu-publish-queue" }, body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch: ${res.status}`);
}
async function adminJob(env, kind, bookId, version = null) {
  if (!ID.test(bookId || "") || (version !== null && (!Number.isSafeInteger(version) || version < 1)))
    return "❌ Invalid book ID or version.";
  await env.DB.prepare("INSERT INTO admin_jobs(kind,book_id,version,status) VALUES(?,?,?,'ready')").bind(kind, bookId, version).run();
  return `📥 ${kind} queued for ${bookId}${version ? ` v${version}` : ""}`;
}
async function bookForQuestion(env, qid) {
  const base = env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev";
  const response = await fetch(`${base}/routes/${qid.slice(0, 7)}.json`, { cache: "no-store", headers: {"user-agent":"kafu-bot/1.0"} });
  if (!response.ok) return null;
  return (await response.json()).routes?.[qid]?.book_id || null;
}
async function command(env, raw) {
  const [cmd, arg, arg2, arg3] = raw.trim().split(/\s+/);
  switch (cmd.toLowerCase().split("@")[0]) {
    case "/help": return "/queue /books /status /warnings BOOK-ID /flags [/flags approve-all BOOK-ID CONFIRM] /hold QID PAGE /retry BOOK-ID_vN /clear BOOK-ID_vN /republish BOOK-ID_vN /rollback BOOK-ID VERSION /remove BOOK-ID";
    case "/queue": {
      const r = await env.DB.prepare("SELECT group_key,status,part_total,error_summary FROM publish_groups ORDER BY created_at DESC LIMIT 15").all();
      const a = await env.DB.prepare("SELECT kind,book_id,status,error_summary FROM admin_jobs ORDER BY id DESC LIMIT 5").all();
      return [...(r.results || []).map(x => `${x.group_key}: ${x.status}${x.error_summary ? ` — ${safeText(env, x.error_summary)}` : ""}`),
        ...(a.results || []).map(x => `${x.kind} ${x.book_id}: ${x.status}${x.error_summary ? ` — ${safeText(env, x.error_summary)}` : ""}`)].join("\n") || "Queue empty.";
    }
    case "/books": {
      try {
        const response = await fetch((env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev") + "/catalog.json", { cache: "no-store", headers: {"user-agent":"kafu-bot/1.0"} });
        if (response.ok) {
          const c = await response.json();
          return (c.books || []).map(x => `${x.id} v${x.version} — ${x.questions} questions, ${x.chapters?.length || 0} chapters`).join("\n") || "No active books.";
        }
      } catch (e) {}
      const r = await env.DB.prepare("SELECT book_id,version,questions,chapters FROM published_books WHERE active=1 ORDER BY book_id LIMIT 50").all();
      return (r.results || []).map(x => `${x.book_id} v${x.version} — ${x.questions} questions, ${x.chapters} chapters`).join("\n") || "No published books recorded yet.";
    }
    case "/status": {
      const r = await env.DB.prepare("SELECT status,COUNT(*) AS n FROM publish_groups GROUP BY status").all();
      return `Kafu queue: ${(r.results || []).map(x => `${x.status} ${x.n}`).join(", ") || "empty"}.`;
    }
    case "/warnings": {
      const bookId = String(arg || "").toUpperCase();
      if (!ID.test(bookId)) return "Usage: /warnings BOOK-ID";
      const r = await env.DB.prepare(
        "SELECT qid,version,local_id,source_page,reason FROM publish_warnings WHERE book_id=? ORDER BY version DESC,local_id LIMIT 100"
      ).bind(bookId).all();
      if (!r.results?.length) return `No recorded publish warnings for ${bookId}.`;
      return r.results.map(x =>
        `${x.qid} — v${x.version}, local ${x.local_id}, page ${x.source_page ?? "unknown"} — ${x.reason}`
      ).join("\n");
    }
    case "/flags": {
      if ((arg || "").toLowerCase() === "approve-all") {
        const bookId = String(arg2 || "").toUpperCase();
        if (!ID.test(bookId)) return "Usage: /flags approve-all BOOK-ID CONFIRM";
        const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM flags WHERE book_id=? AND status='pending'").bind(bookId).first();
        const count = Number(pending?.n || 0);
        if (!count) return `No pending audit warnings for ${bookId}.`;
        if (arg3 !== "CONFIRM") {
          return `⚠️ Approve all ${count} pending audit warnings for ${bookId}? Re-run exactly: /flags approve-all ${bookId} CONFIRM`;
        }
        const changed = await env.DB.prepare("UPDATE flags SET status='approved' WHERE book_id=? AND status='pending'").bind(bookId).run();
        const approved = Number(changed?.meta?.changes || 0);
        if (!approved) return `No pending audit warnings for ${bookId}.`;
        await env.DB.prepare("INSERT INTO admin_jobs(kind,book_id,version,status) VALUES('moderate',?,NULL,'ready')").bind(bookId).run();
        return `📥 approved ${approved} audit warnings for ${bookId}; moderation publish queued.`;
      }
      const r = await env.DB.prepare("SELECT qid,source_page FROM flags WHERE status='pending' ORDER BY created_at LIMIT 10").all();
      if (!r.results?.length) return "No pending flags.";
      return r.results.map(x => `${x.qid} — source page ${x.source_page ?? "unknown"}`).join("\n") + "\nUse /flags QID for actions, or /flags approve-all BOOK-ID to review a bulk approval.";
    }
    case "/hold": {
      const page = Number(arg2);
      if (!QID.test(arg || "") || !Number.isSafeInteger(page) || page < 1) return "Usage: /hold Q000000001 PAGE";
      const bookId = await bookForQuestion(env, arg);
      if (!bookId) return "❌ Question route not found.";
      await env.DB.prepare("INSERT INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending') ON CONFLICT(qid) DO UPDATE SET status='pending',source_page=excluded.source_page")
        .bind(arg, bookId, page).run();
      await adminJob(env, "moderate", bookId);
      return `📥 held ${arg}; moderation publish queued. Use /flags ${arg} to review.`;
    }
    case "/retry": return (await retryGroup(env, arg)).text;
    case "/clear": return (await clearGroup(env, arg)).text;
    case "/republish": {
      const p = parsePackageName(`${arg || ""}.zip`);
      if (!p || p.total !== 1) return "Usage: /republish BOOK-ID_vN";
      const changed = await env.DB.prepare("UPDATE publish_groups SET status='ready',force_republish=1,error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE group_key=? AND status IN ('failed','published') RETURNING group_key").bind(p.group_key).first();
      return changed ? `📥 republish requested: ${p.group_key}` : "❌ No completed upload found for that release.";
    }
    case "/rollback": return arg && arg2 ? adminJob(env, "rollback", arg.toUpperCase(), Number(arg2)) : "Usage: /rollback BOOK-ID VERSION";
    case "/remove": return arg ? adminJob(env, "remove", arg.toUpperCase()) : "Usage: /remove BOOK-ID";
    default: return "Use /help for admin commands.";
  }
}
async function callback(env, cb) {
  const m = /^(approve|reject|source):Q\d{9}$/.exec(cb.data || "");
  if (!m) return;
  const qid = cb.data.slice(cb.data.indexOf(":") + 1);
  const row = await env.DB.prepare("SELECT book_id,source_page FROM flags WHERE qid=?").bind(qid).first();
  if (!row) return;
  if (m[1] === "source") {
    await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `Source page: ${row.source_page ?? "unknown"}`, show_alert: true });
    return;
  }
  await env.DB.prepare("UPDATE flags SET status=? WHERE qid=?").bind(m[1] === "approve" ? "approved" : "rejected", qid).run();
  await adminJob(env, "moderate", row.book_id);
  await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `${qid}: ${m[1]}` });
}
async function webhook(request, env, ctx) {
  if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return reply("Forbidden", 403);
  const update = await request.json();
  const cb = update.callback_query, m = update.message;
  const actor = cb?.from || m?.from, chat = cb?.message?.chat || m?.chat;
  if (!actor || String(actor.id) !== String(env.OWNER_TELEGRAM_ID) || chat?.type !== "private" || String(chat.id) !== String(env.OWNER_TELEGRAM_ID)) return reply("OK");
  if (cb) {
    await callback(env, cb);
    if (/^(approve|reject):Q\d{9}$/.test(cb.data || "")) ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${safeText(env, e.message)}`)));
    return reply("OK");
  }
  let text;
  if (m.document) text = await queueDocument(env, m.document);
  else if (m.text?.startsWith("/")) {
    const parts = m.text.trim().split(/\s+/);
    if (parts[0].toLowerCase().split("@")[0] === "/flags" && QID.test(parts[1] || "")) {
      const x = await env.DB.prepare("SELECT qid,source_page,status FROM flags WHERE qid=?").bind(parts[1]).first();
      if (x) {
        await message(env, `${x.qid}: ${x.status}; source page ${x.source_page ?? "unknown"}`, { reply_markup: { inline_keyboard: [[
          { text: "Approve", callback_data: `approve:${x.qid}` }, { text: "Reject", callback_data: `reject:${x.qid}` }, { text: "Show source page", callback_data: `source:${x.qid}` },
        ]] } });
        return reply("OK");
      }
    }
    text = await command(env, m.text);
  } else return reply("OK");
  await message(env, text);
  if (text.startsWith("📥") && !text.includes("already received")) ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${safeText(env, e.message)}`)));
  return reply("OK");
}
async function tokenFingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 8);
}
async function queueAuthorization(request, env) {
  const expected = String(env.QUEUE_API_TOKEN || "").trim(), header = request.headers.get("Authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const [expectedHash, presentedHash] = await Promise.all([tokenFingerprint(expected), tokenFingerprint(presented)]);
  console.log(`[queue-auth] expected_len=${expected.length} expected_sha256_8=${expectedHash} presented_len=${presented.length} presented_sha256_8=${presentedHash} header='Authorization' scheme='Bearer'`);
  return expected.length > 0 && header.startsWith("Bearer ") && presented === expected;
}
async function internal(request, env, path) {
  if (!(await queueAuthorization(request, env))) return reply({ error: "bad_queue_token" }, 403);
  if (request.method !== "POST") return reply("Method not allowed", 405);
  if (path === "/internal/claim") {
    const group = await env.DB.prepare("UPDATE publish_groups SET status='running',claimed_at=datetime('now'),attempts=attempts+1 WHERE group_key=(SELECT g.group_key FROM publish_groups g JOIN publish_queue q ON q.group_key=g.group_key WHERE g.status='ready' GROUP BY g.group_key ORDER BY MIN(q.job_id) LIMIT 1) AND status='ready' RETURNING *").first();
    if (group) {
      const parts = await env.DB.prepare("SELECT * FROM publish_queue WHERE group_key=? ORDER BY part_index").bind(group.group_key).all();
      return reply({ kind: "publish", group, parts: parts.results || [] });
    }
    const job = await env.DB.prepare("UPDATE admin_jobs SET status='running',claimed_at=datetime('now') WHERE id=(SELECT id FROM admin_jobs WHERE status='ready' ORDER BY created_at,id LIMIT 1) AND status='ready' RETURNING *").first();
    return reply(job ? { kind: "admin", job } : { kind: "empty" });
  }
  const body = await request.json();
  if (path === "/internal/recover") {
    if (!["retry", "clear"].includes(body.action)) return reply({ error: "invalid_recovery_action" }, 400);
    const result = body.action === "clear" ? await clearGroup(env, String(body.group_key || "")) : await retryGroup(env, String(body.group_key || ""));
    if (result.ok && body.clear_failed_admin_book === true) await env.DB.prepare("DELETE FROM admin_jobs WHERE book_id=? AND status='failed'").bind(result.book_id).run();
    if (result.ok && body.dispatch !== false && body.action === "retry") await dispatch(env);
    return reply(result, result.ok ? 200 : 409);
  }
  if (path === "/internal/finish") {
    const status = body.ok ? "published" : "failed", error = body.ok ? null : safeText(env, body.error).slice(0, 400);
    if (body.kind === "publish") {
      const group = await env.DB.prepare("SELECT book_id,version,status FROM publish_groups WHERE group_key=?").bind(body.group_key).first();
      if (!group || group.status !== "running") return reply({ error: "job_not_running" }, 409);
      if (body.ok && (body.book_id !== group.book_id || body.version !== group.version)) return reply({ error: "job_identity_mismatch" }, 400);
      const writes = [];
      if (body.ok) {
        const counts = [body.questions, body.chapters, body.images, body.skipped, body.held].map(x => x || 0);
        if (!counts.every(x => Number.isSafeInteger(x) && x >= 0)) return reply({ error: "invalid_counts" }, 400);
        writes.push(env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=? AND EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='running')").bind(group.book_id, body.group_key));
        writes.push(env.DB.prepare("INSERT INTO published_books(book_id,version,questions,chapters,images,skipped,held,active) SELECT ?,?,?,?,?,?,?,1 WHERE EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='running') ON CONFLICT(book_id,version) DO UPDATE SET questions=excluded.questions,chapters=excluded.chapters,images=excluded.images,skipped=excluded.skipped,held=excluded.held,active=1").bind(group.book_id, group.version, ...counts, body.group_key));
      }
      writes.push(env.DB.prepare("UPDATE publish_groups SET status=?,finished_at=datetime('now'),error_summary=? WHERE group_key=? AND status='running'").bind(status, error, body.group_key));
      const results = await env.DB.batch(writes);
      if (!results.at(-1)?.meta?.changes) return reply({ error: "job_not_running" }, 409);
    } else if (body.kind === "admin") {
      const job = await env.DB.prepare("SELECT * FROM admin_jobs WHERE id=?").bind(body.id).first();
      if (!job || job.status !== "running") return reply({ error: "job_not_running" }, 409);
      if (body.ok && (body.book_id !== job.book_id || body.operation !== job.kind || (job.kind === "rollback" && body.version !== job.version))) return reply({ error: "job_identity_mismatch" }, 400);
      const writes = [];
      if (body.ok && job.kind === "remove") writes.push(env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=? AND EXISTS(SELECT 1 FROM admin_jobs WHERE id=? AND status='running')").bind(job.book_id, job.id));
      if (body.ok && job.kind === "rollback") writes.push(env.DB.prepare("UPDATE published_books SET active=(version=?) WHERE book_id=? AND EXISTS(SELECT 1 FROM admin_jobs WHERE id=? AND status='running')").bind(job.version, job.book_id, job.id));
      writes.push(env.DB.prepare("UPDATE admin_jobs SET status=?,finished_at=datetime('now'),error_summary=? WHERE id=? AND status='running'").bind(status, error, job.id));
      const results = await env.DB.batch(writes);
      if (!results.at(-1)?.meta?.changes) return reply({ error: "job_not_running" }, 409);
    } else return reply("Invalid kind", 400);
    return reply({ ok: true });
  }
  if (path === "/internal/notify") { await message(env, String(body.text || "").slice(0, 3500)); return reply({ ok: true }); }
  if (path === "/internal/decisions") {
    const r = await env.DB.prepare("SELECT qid,status FROM flags WHERE book_id=?").bind(body.book_id).all();
    return reply(Object.fromEntries((r.results || []).map(x => [x.qid, x.status === "approved" ? "approved" : "rejected"])));
  }
  if (path === "/internal/flags") {
    for (const x of body.held_details || []) {
      if (!QID.test(x.qid) || !ID.test(x.book_id)) continue;
      await env.DB.prepare("INSERT OR IGNORE INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending')").bind(x.qid, x.book_id, x.source_page || null).run();
    }
    return reply({ ok: true });
  }
  if (path === "/internal/warnings") {
    const bookId = String(body.book_id || "").toUpperCase();
    const version = Number(body.version);
    if (!ID.test(bookId) || !Number.isSafeInteger(version) || version < 1) return reply({ error: "invalid_warning_identity" }, 400);
    await env.DB.prepare("DELETE FROM publish_warnings WHERE book_id=? AND version=?").bind(bookId, version).run();
    for (const x of body.warnings || []) {
      if (!QID.test(x.qid) || !Number.isSafeInteger(Number(x.local_id))) continue;
      const reasons = Array.isArray(x.reasons) ? x.reasons : [];
      for (const reason of reasons) {
        const text = String(reason || "").slice(0, 500);
        if (!text) continue;
        await env.DB.prepare(
          "INSERT OR IGNORE INTO publish_warnings(book_id,version,qid,local_id,source_page,reason) VALUES(?,?,?,?,?,?)"
        ).bind(bookId, version, x.qid, Number(x.local_id), x.source_page || null, text).run();
      }
    }
    return reply({ ok: true });
  }
  return reply("Not found", 404);
}
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/bot" && request.method === "POST") return webhook(request, env, ctx);
    if (path.startsWith("/internal/")) return internal(request, env, path);
    return env.ASSETS.fetch(request);
  },
};
