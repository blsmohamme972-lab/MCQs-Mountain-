// Kafu's small control plane. Publishing work is performed by GitHub Actions.
const MAX_ZIP = 19 * 1024 * 1024;
const NAME = /^([A-Z0-9][A-Z0-9-]*)_v([1-9]\d*)(?:_part([1-9]\d*)of([1-9]\d*))?\.zip$/i;
const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const QID = /^Q\d{9}$/;

export function parsePackageName(filename) {
  const m = NAME.exec(filename || "");
  if (!m) return null;
  const part = Number(m[3] || 1), total = Number(m[4] || 1);
  if (total > 100 || part > total || (total === 1 && m[3])) return null;
  return { book_id: m[1].toUpperCase(), version: Number(m[2]), part, total,
    group_key: `${m[1].toUpperCase()}_v${Number(m[2])}` };
}

function reply(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json",
      "cache-control": "no-store" },
  });
}
async function telegram(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram ${method}: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || "failed"}`);
  return data.result;
}
async function message(env, text, extra = {}) {
  return telegram(env, "sendMessage", { chat_id: env.OWNER_TELEGRAM_ID, text, ...extra });
}
async function dispatch(env) {
  const repo = env.GITHUB_REPOSITORY || "blsmohamme972-lab/MCQs-Mountain-";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid GitHub repository");
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-queue.yml/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28",
      "user-agent": "kafu-publish-queue" }, body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch: ${res.status}`);
}
async function queueDocument(env, doc) {
  if (!doc || !Number.isInteger(doc.file_size) || doc.file_size < 1 || doc.file_size > MAX_ZIP ||
      !doc.file_id || !doc.file_unique_id) return "❌ ZIP required, up to 19 MB.";
  const p = parsePackageName(doc.file_name);
  if (!p) return "❌ Filename must be BOOK-ID_vN.zip or BOOK-ID_vN_partXofY.zip.";
  const existing = await env.DB.prepare("SELECT file_unique_id FROM publish_queue WHERE group_key=? AND part_index=?")
    .bind(p.group_key, p.part).first();
  if (existing) return existing.file_unique_id === doc.file_unique_id ? "📥 already received" :
    "❌ A different ZIP already occupies this part. Use /queue to inspect it.";
  await env.DB.prepare("INSERT OR IGNORE INTO publish_groups(group_key,book_id,version,part_total,status) VALUES(?,?,?,?, 'waiting')")
    .bind(p.group_key, p.book_id, p.version, p.total).run();
  const group = await env.DB.prepare("SELECT part_total,status FROM publish_groups WHERE group_key=?").bind(p.group_key).first();
  if (group.part_total !== p.total || !["waiting", "ready"].includes(group.status))
    return "❌ Conflicting part count or this release has already started.";
  await env.DB.prepare("INSERT INTO publish_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) VALUES(?,?,?,?,?,?,?)")
    .bind(p.group_key, p.part, p.total, doc.file_id, doc.file_unique_id, doc.file_name, doc.file_size).run();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM publish_queue WHERE group_key=?").bind(p.group_key).first();
  if (row.n === p.total) {
    await env.DB.prepare("UPDATE publish_groups SET status='ready' WHERE group_key=? AND status='waiting'")
      .bind(p.group_key).run();
  }
  return `📥 received ${p.group_key} (${row.n}/${p.total})`;
}
async function adminJob(env, kind, bookId, version = null) {
  if (!ID.test(bookId) || (version !== null && (!Number.isInteger(version) || version < 1)))
    return "❌ Invalid book ID or version.";
  await env.DB.prepare("INSERT INTO admin_jobs(kind,book_id,version,status) VALUES(?,?,?,'ready')")
    .bind(kind, bookId, version).run();
  return `📥 ${kind} queued for ${bookId}${version ? ` v${version}` : ""}`;
}
async function bookForQuestion(env, qid) {
  const base = env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev";
  const response = await fetch(`${base}/routes/${qid.slice(0, 7)}.json`, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()).routes?.[qid]?.book_id || null;
}
async function command(env, raw) {
  const [cmd, arg, arg2] = raw.trim().split(/\s+/);
  switch (cmd.toLowerCase().split("@")[0]) {
    case "/help": return "/queue /books /status /flags /hold QID PAGE /republish BOOK-ID_vN /rollback BOOK-ID VERSION /remove BOOK-ID";
    case "/queue": {
      const r = await env.DB.prepare("SELECT group_key,status,part_total,error_summary FROM publish_groups ORDER BY created_at DESC LIMIT 15").all();
      const a = await env.DB.prepare("SELECT kind,book_id,status FROM admin_jobs ORDER BY id DESC LIMIT 5").all();
      return [...(r.results || []).map(x => `${x.group_key}: ${x.status}${x.error_summary ? ` — ${x.error_summary}` : ""}`),
        ...(a.results || []).map(x => `${x.kind} ${x.book_id}: ${x.status}`)].join("\n") || "Queue empty.";
    }
    case "/books": {
      try {
        const response = await fetch((env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev") + "/catalog.json", { cache: "no-store" });
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
    case "/flags": {
      const r = await env.DB.prepare("SELECT qid,source_page FROM flags WHERE status='pending' ORDER BY created_at LIMIT 10").all();
      if (!r.results?.length) return "No pending flags.";
      return (r.results || []).map(x => `${x.qid} — source page ${x.source_page ?? "unknown"}`).join("\n") + "\nUse /flags QID for actions.";
    }
    case "/hold": {
      if (!QID.test(arg || "")) return "Usage: /hold Q000000001 PAGE";
      const bookId = await bookForQuestion(env, arg);
      if (!bookId) return "❌ Question route not found.";
      await env.DB.prepare("INSERT INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending') ON CONFLICT(qid) DO UPDATE SET status='pending',source_page=excluded.source_page")
        .bind(arg, bookId, Number(arg2) || null).run();
      await adminJob(env, "moderate", bookId);
      return `📥 held ${arg}; moderation publish queued. Use /flags ${arg} to review.`;
    }
    case "/republish": {
      const p = parsePackageName(`${arg || ""}.zip`);
      if (!p || p.total !== 1) return "Usage: /republish BOOK-ID_vN";
      const found = await env.DB.prepare("SELECT group_key FROM publish_groups WHERE group_key=? AND status IN ('failed','published')").bind(p.group_key).first();
      if (!found) return "❌ No completed upload found for that release.";
      await env.DB.prepare("UPDATE publish_groups SET status='ready',force_republish=1,error_summary=NULL WHERE group_key=? AND status IN ('failed','published')")
        .bind(p.group_key).run();
      return `📥 republish requested: ${p.group_key}`;
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
  if (m[1] === "source") {
    const row = await env.DB.prepare("SELECT source_page FROM flags WHERE qid=?").bind(qid).first();
    await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `Source page: ${row?.source_page ?? "unknown"}`, show_alert: true });
    return;
  }
  const row = await env.DB.prepare("SELECT book_id FROM flags WHERE qid=?").bind(qid).first();
  if (!row) return;
  await env.DB.prepare("UPDATE flags SET status=? WHERE qid=?").bind(m[1] === "approve" ? "approved" : "rejected", qid).run();
  await adminJob(env, "moderate", row.book_id);
  await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `${qid}: ${m[1]}` });
}
async function webhook(request, env, ctx) {
  if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET)
    return reply("Forbidden", 403);
  const update = await request.json();
  const cb = update.callback_query;
  const m = update.message;
  const actor = cb?.from || m?.from;
  const chat = cb?.message?.chat || m?.chat;
  if (!actor || String(actor.id) !== String(env.OWNER_TELEGRAM_ID) || chat?.type !== "private" ||
      String(chat.id) !== String(env.OWNER_TELEGRAM_ID)) return reply("OK");
  if (cb) {
    await callback(env, cb);
    if (!String(cb.data || "").startsWith("source:"))
      ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${e.message}`)));
    return reply("OK");
  }
  let text;
  if (m.document) text = await queueDocument(env, m.document);
  else if (m.text?.startsWith("/")) {
    const parts = m.text.trim().split(/\s+/);
    if (parts[0].toLowerCase() === "/flags" && QID.test(parts[1] || "")) {
      const x = await env.DB.prepare("SELECT qid,source_page,status FROM flags WHERE qid=?").bind(parts[1]).first();
      if (x) {
        await message(env, `${x.qid}: ${x.status}; source page ${x.source_page ?? "unknown"}`, {
          reply_markup: { inline_keyboard: [[
            { text: "Approve", callback_data: `approve:${x.qid}` },
            { text: "Reject", callback_data: `reject:${x.qid}` },
            { text: "Show source page", callback_data: `source:${x.qid}` },
          ]] },
        });
        return reply("OK");
      }
    }
    text = await command(env, m.text);
  } else return reply("OK");
  await message(env, text);
  if (text.startsWith("📥") && !text.includes("already received")) {
    ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${e.message}`)));
  }
  return reply("OK");
}
function authorized(request, env) {
  return !!env.QUEUE_API_TOKEN && request.headers.get("Authorization") === `Bearer ${env.QUEUE_API_TOKEN}`;
}
async function internal(request, env, path) {
  if (!authorized(request, env)) return reply("Forbidden", 403);
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
  if (path === "/internal/finish") {
    const status = body.ok ? "published" : "failed";
    if (body.kind === "publish") {
      await env.DB.prepare("UPDATE publish_groups SET status=?,finished_at=datetime('now'),error_summary=? WHERE group_key=? AND status='running'")
        .bind(status, body.error || null, body.group_key).run();
      if (body.ok) {
        await env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=?").bind(body.book_id).run();
        await env.DB.prepare("INSERT INTO published_books(book_id,version,questions,chapters,images,skipped,held,active) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(book_id,version) DO UPDATE SET questions=excluded.questions,chapters=excluded.chapters,images=excluded.images,skipped=excluded.skipped,held=excluded.held,active=1")
          .bind(body.book_id, body.version, body.questions || 0, body.chapters || 0, body.images || 0, body.skipped || 0, body.held || 0).run();
      }
    } else if (body.kind === "admin") {
      await env.DB.prepare("UPDATE admin_jobs SET status=?,finished_at=datetime('now'),error_summary=? WHERE id=? AND status='running'")
        .bind(status, body.error || null, body.id).run();
      if (body.ok && body.operation === "remove") await env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=?").bind(body.book_id).run();
      if (body.ok && body.operation === "rollback") await env.DB.prepare("UPDATE published_books SET active=(version=?) WHERE book_id=?").bind(body.version, body.book_id).run();
    } else return reply("Invalid kind", 400);
    return reply({ ok: true });
  }
  if (path === "/internal/notify") {
    await message(env, String(body.text || "").slice(0, 3500));
    return reply({ ok: true });
  }
  if (path === "/internal/decisions") {
    const r = await env.DB.prepare("SELECT qid,status FROM flags WHERE book_id=?").bind(body.book_id).all();
    return reply(Object.fromEntries((r.results || []).map(x => [x.qid, x.status === "approved" ? "approved" : "rejected"])));
  }
  if (path === "/internal/flags") {
    for (const x of body.held_details || []) {
      if (!QID.test(x.qid) || !ID.test(x.book_id)) continue;
      await env.DB.prepare("INSERT OR IGNORE INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending')")
        .bind(x.qid, x.book_id, x.source_page || null).run();
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
