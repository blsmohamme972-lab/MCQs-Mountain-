// Question comment packs. The Worker only records uploads and owner requests; the publisher run
// (tools/drain_queue.py → tools/comments.py) validates, publishes and reports back through finish.
const MAX_ZIP = 2 * 1024 * 1024;
const NAME = /^COMMENTS_([A-Z0-9][A-Z0-9-]{0,127})_r([1-9]\d{0,5})\.zip$/i;
const ID = /^[A-Z0-9][A-Z0-9-]{0,127}$/;
const COUNTS = ["questions", "comments", "book_questions", "book_comments"];

export function looksCommentsFilename(name) { return typeof name === "string" && /^comments[_-]/i.test(name); }
export function parseCommentsName(name) {
  if (typeof name !== "string" || name.length > 255) return null;
  const m = NAME.exec(name);
  if (!m) return null;
  const book_id = m[1].toUpperCase(), revision = Number(m[2]);
  return { book_id, revision, group_key: `COMMENTS_${book_id}_r${revision}` };
}
export const commentJobKey = job => job.action === "clear" ? `comments-off ${job.book_id}`
  : job.action === "restore" ? `comments-restore ${job.book_id} r${job.revision}` : `COMMENTS_${job.book_id}_r${job.revision}`;
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const nextRevision = async (env, bookId) =>
  Number((await statement(env, "SELECT MAX(revision) AS n FROM comment_jobs WHERE action='publish' AND book_id=?", bookId).first())?.n || 0) + 1;

export async function queueCommentsDocument(env, doc) {
  if (!doc || !Number.isInteger(doc.file_size) || doc.file_size < 1 || doc.file_size > MAX_ZIP ||
      typeof doc.file_id !== "string" || !doc.file_id || typeof doc.file_unique_id !== "string" || !doc.file_unique_id)
    return "❌ Comments ZIP required, up to 2 MB.";
  const p = parseCommentsName(doc.file_name);
  if (!p) return "❌ Filename must be COMMENTS_BOOK-ID_rN.zip, for example COMMENTS_ANATOMY-MRCS_r1.zip.";
  const row = await statement(env, "SELECT id,status,telegram_file_unique_id FROM comment_jobs WHERE action='publish' AND book_id=? AND revision=?", p.book_id, p.revision).first();
  if (row) {
    if (row.telegram_file_unique_id === doc.file_unique_id)
      return `📥 already received ${p.group_key} (${row.status})` + (row.status === "failed" ? `. Fix it and send it again, or use /comments-retry ${p.group_key}` : "");
    if (row.status !== "failed")
      return `❌ ${p.group_key} is already ${row.status}. Send the new comments as COMMENTS_${p.book_id}_r${await nextRevision(env, p.book_id)}.zip.`;
    const changed = await statement(env,
      "UPDATE comment_jobs SET telegram_file_id=?,telegram_file_unique_id=?,filename=?,file_size=?,status='ready',error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE id=? AND status='failed' RETURNING id",
      doc.file_id, doc.file_unique_id, doc.file_name, doc.file_size, row.id).first();
    return changed ? `📥 replaced failed ${p.group_key}` : "❌ Queue state changed; use /comments before trying again.";
  }
  try {
    await statement(env, "INSERT INTO comment_jobs(action,book_id,revision,telegram_file_id,telegram_file_unique_id,filename,file_size) VALUES('publish',?,?,?,?,?,?)",
      p.book_id, p.revision, doc.file_id, doc.file_unique_id, doc.file_name, doc.file_size).run();
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) return "❌ Queue state changed; use /comments before trying again.";
    throw error;
  }
  return `📥 received ${p.group_key}`;
}

function describe(job, safeText) {
  const key = commentJobKey(job);
  if (job.status === "failed") return `❌ ${key}: failed — ${safeText(job.error_summary || "unknown error")}`;
  if (job.status !== "published") return `⏳ ${key}: ${job.status}`;
  if (job.action === "clear") return `🧹 ${key}: done — comments are off for ${job.book_id}`;
  if (job.action === "restore") return `↩️ ${key}: done — ${job.book_id} now has ${job.book_comments} comments on ${job.book_questions} questions`;
  return `✅ ${key}: ${job.comments} comments on ${job.questions} questions — ${job.book_id} now has ${job.book_comments} comments on ${job.book_questions} questions`;
}

const publishedUpload = (env, bookId, revision) => statement(env,
  "SELECT * FROM comment_jobs WHERE action='publish' AND status='published' AND book_id=? AND revision=?", bookId, revision).first();
const openJob = (env, bookId, action, revision = null) => statement(env,
  "SELECT id FROM comment_jobs WHERE action=? AND book_id=? AND revision IS ? AND status IN ('ready','running')", action, bookId, revision).first();

async function queueRestore(env, bookId, revision) {
  if (!await publishedUpload(env, bookId, revision)) return `❌ ${bookId} has no published comments r${revision}. Use /comments ${bookId} to see them.`;
  if (await openJob(env, bookId, "restore", revision)) return `📥 already received comments-restore ${bookId} r${revision}`;
  await statement(env, "INSERT INTO comment_jobs(action,book_id,revision) VALUES('restore',?,?)", bookId, revision).run();
  return `📥 comments-restore ${bookId} r${revision} queued`;
}
async function queueClear(env, bookId) {
  if (await openJob(env, bookId, "clear")) return `📥 already received comments-off ${bookId}`;
  await statement(env, "INSERT INTO comment_jobs(action,book_id) VALUES('clear',?)", bookId).run();
  return `📥 comments-off ${bookId} queued`;
}

// What students see now, from the newest finished job: { revision, on } or null when nothing was ever published.
async function currentState(env, bookId) {
  const last = await statement(env, "SELECT * FROM comment_jobs WHERE book_id=? AND status='published' ORDER BY finished_at DESC,id DESC LIMIT 1", bookId).first();
  if (!last) return null;
  return { job: last, revision: last.action === "clear" ? null : last.revision, on: last.action !== "clear" && last.book_comments > 0 };
}

// `/comments BOOK-ID`: the book's state plus Restore / Remove buttons, like MotionCards management.
export async function commentsBookView(env, raw) {
  const bookId = String(raw || "").toUpperCase();
  if (!ID.test(bookId)) return { text: "Usage: /comments BOOK-ID", reply_markup: null };
  const now = await currentState(env, bookId);
  const open = await statement(env, "SELECT COUNT(*) AS n FROM comment_jobs WHERE book_id=? AND status IN ('ready','running')", bookId).first();
  const lines = [`💬 ${bookId}`];
  if (!now) lines.push("No published comments yet.");
  else if (!now.on) lines.push("Comments are off for students.");
  else lines.push(`${now.job.book_comments} comments on ${now.job.book_questions} questions — students see r${now.revision}` +
    (now.job.action === "restore" ? " (restored)" : "") + ".");
  if (Number(open?.n || 0)) lines.push(`⏳ ${open.n} waiting in the queue.`);
  lines.push(`Next upload: COMMENTS_${bookId}_r${await nextRevision(env, bookId)}.zip`);
  const uploads = (await statement(env, "SELECT id,revision,book_comments,book_questions FROM comment_jobs WHERE action='publish' AND status='published' AND book_id=? ORDER BY revision DESC LIMIT 6", bookId).all()).results || [];
  const buttons = uploads.filter(u => !now?.on || u.revision !== now.revision).map(u => ({ text: `↩️ Restore r${u.revision}`, callback_data: `cmrestore:${u.id}` }));
  if (now?.on) buttons.push({ text: "🚫 Remove from students", callback_data: `cmoff:${now.job.id}` });
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return { text: lines.join("\n"), reply_markup: rows.length ? { inline_keyboard: rows } : null };
}

// Inline buttons: the first tap asks, "Confirm" queues the job (the owner-only private chat is checked by the bot).
export async function commentsCallback(env, data) {
  const m = /^cm(restore|off)(-ok)?:(\d+)$/.exec(String(data || ""));
  if (!m) return null;
  const job = await statement(env, "SELECT * FROM comment_jobs WHERE id=?", Number(m[3])).first();
  if (!job) return { answer: "Not found", text: "❌ That comment pack is no longer in the queue history.", reply_markup: null };
  if (m[1] === "restore") {
    const upload = job.action === "publish" && job.status === "published" ? job : null;
    if (!upload) return { answer: "Not available", text: "❌ Only a published comment pack can be restored.", reply_markup: null };
    if (m[2]) { const text = await queueRestore(env, upload.book_id, upload.revision); return { answer: "Restore queued", text, reply_markup: null, dispatch: text.startsWith("📥") && !text.includes("already received") }; }
    return { answer: "Confirm restore", reply_markup: { inline_keyboard: [[{ text: "Confirm restore", callback_data: `cmrestore-ok:${upload.id}` }]] },
      text: `Restore the comments of ${upload.book_id} to r${upload.revision}? Students will see them exactly as right after r${upload.revision} (${upload.book_comments} comments on ${upload.book_questions} questions); later changes are replaced. You can restore another revision afterwards.` };
  }
  if (m[2]) { const text = await queueClear(env, job.book_id); return { answer: "Removal queued", text, reply_markup: null, dispatch: text.startsWith("📥") && !text.includes("already received") }; }
  return { answer: "Confirm removal", reply_markup: { inline_keyboard: [[{ text: "Confirm remove", callback_data: `cmoff-ok:${job.id}` }]] },
    text: `Take every comment of ${job.book_id} away from students? Phones delete their saved copy when they are next online. You can restore a revision later.` };
}

export async function commentsCommand(env, cmd, arg, arg2, arg3, safeText = String) {
  if (cmd === "/comments") {
    if (arg) return (await commentsBookView(env, arg)).text;
    const r = await statement(env, "SELECT * FROM comment_jobs ORDER BY id DESC LIMIT ?", 10).all();
    const rows = (r.results || []).map(x => describe(x, safeText));
    return rows.length ? "💬 Comment packs (newest first)\n" + rows.join("\n") : "💬 No comment packs yet. Send COMMENTS_BOOK-ID_r1.zip here.";
  }
  if (cmd === "/comments-retry") {
    const p = parseCommentsName(String(arg || "").replace(/\.zip$/i, "") + ".zip");
    if (!p) return "Usage: /comments-retry COMMENTS_BOOK-ID_rN";
    const changed = await statement(env, "UPDATE comment_jobs SET status='ready',error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE action='publish' AND book_id=? AND revision=? AND status='failed' RETURNING id", p.book_id, p.revision).first();
    return changed ? `📥 retry queued: ${p.group_key}` : `❌ No failed upload found for ${p.group_key}.`;
  }
  if (cmd === "/comments-restore") {
    const bookId = String(arg || "").toUpperCase(), m = /^r?([1-9]\d{0,5})$/i.exec(String(arg2 || ""));
    if (!ID.test(bookId) || !m) return "Usage: /comments-restore BOOK-ID rN";
    const revision = Number(m[1]), upload = await publishedUpload(env, bookId, revision);
    if (!upload) return `❌ ${bookId} has no published comments r${revision}. Use /comments ${bookId} to see them.`;
    if (arg3 === "CONFIRM") return queueRestore(env, bookId, revision);
    return `⚠️ Restore the comments of ${bookId} to r${revision} (${upload.book_comments} comments on ${upload.book_questions} questions, as right after r${revision})? Re-run exactly: /comments-restore ${bookId} r${revision} CONFIRM`;
  }
  if (cmd === "/comments-off") {
    const bookId = String(arg || "").toUpperCase();
    if (!ID.test(bookId)) return "Usage: /comments-off BOOK-ID";
    if (arg2 !== "CONFIRM") return `⚠️ Take every comment of ${bookId} away from students? Re-run exactly: /comments-off ${bookId} CONFIRM`;
    return queueClear(env, bookId);
  }
  return null;
}

export async function claimComments(env) {
  return statement(env, "UPDATE comment_jobs SET status='running',claimed_at=datetime('now'),attempts=attempts+1 WHERE id=(SELECT id FROM comment_jobs WHERE status='ready' ORDER BY id LIMIT 1) AND status='ready' RETURNING *").first();
}

export async function finishComments(env, body, error) {
  const job = await statement(env, "SELECT * FROM comment_jobs WHERE id=?", body.id).first();
  if (!job || job.status !== "running") return { ok: false, status: 409, error: "job_not_running" };
  if (!body.ok) {
    const done = await statement(env, "UPDATE comment_jobs SET status='failed',finished_at=datetime('now'),error_summary=? WHERE id=? AND status='running'", error, job.id).run();
    return done?.meta?.changes ? { ok: true } : { ok: false, status: 409, error: "job_not_running" };
  }
  if (body.book_id !== job.book_id || body.action !== job.action || (job.action !== "clear" && body.revision !== job.revision))
    return { ok: false, status: 400, error: "job_identity_mismatch" };
  const counts = COUNTS.map(k => body[k] ?? 0);
  if (!counts.every(x => Number.isSafeInteger(x) && x >= 0)) return { ok: false, status: 400, error: "invalid_counts" };
  const done = await statement(env, "UPDATE comment_jobs SET status='published',finished_at=datetime('now'),error_summary=NULL,questions=?,comments=?,book_questions=?,book_comments=? WHERE id=? AND status='running'", ...counts, job.id).run();
  return done?.meta?.changes ? { ok: true } : { ok: false, status: 409, error: "job_not_running" };
}
