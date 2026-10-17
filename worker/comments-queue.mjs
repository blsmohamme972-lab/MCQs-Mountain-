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
export const commentJobKey = job => job.action === "clear" ? `comments-off ${job.book_id}` : `COMMENTS_${job.book_id}_r${job.revision}`;
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
  return `✅ ${key}: ${job.comments} comments on ${job.questions} questions — ${job.book_id} now has ${job.book_comments} comments on ${job.book_questions} questions`;
}

export async function commentsCommand(env, cmd, arg, arg2, safeText = String) {
  if (cmd === "/comments") {
    if (!arg) {
      const r = await statement(env, "SELECT * FROM comment_jobs ORDER BY id DESC LIMIT ?", 10).all();
      const rows = (r.results || []).map(x => describe(x, safeText));
      return rows.length ? "💬 Comment packs (newest first)\n" + rows.join("\n") : "💬 No comment packs yet. Send COMMENTS_BOOK-ID_r1.zip here.";
    }
    const bookId = String(arg).toUpperCase();
    if (!ID.test(bookId)) return "Usage: /comments BOOK-ID";
    const last = await statement(env, "SELECT * FROM comment_jobs WHERE book_id=? AND status='published' ORDER BY finished_at DESC,id DESC LIMIT 1", bookId).first();
    const open = await statement(env, "SELECT COUNT(*) AS n FROM comment_jobs WHERE book_id=? AND status IN ('ready','running')", bookId).first();
    const next = `Next upload: COMMENTS_${bookId}_r${await nextRevision(env, bookId)}.zip`;
    const waiting = Number(open?.n || 0) ? `\n⏳ ${open.n} waiting in the queue.` : "";
    if (!last) return `💬 ${bookId} has no published comments.${waiting}\n${next}`;
    if (last.action === "clear" || !last.book_comments) return `💬 ${bookId}: comments are off.${waiting}\n${next}`;
    return `💬 ${bookId}: ${last.book_comments} comments on ${last.book_questions} questions (latest ${commentJobKey(last)}).${waiting}\n${next}`;
  }
  if (cmd === "/comments-retry") {
    const p = parseCommentsName(String(arg || "").replace(/\.zip$/i, "") + ".zip");
    if (!p) return "Usage: /comments-retry COMMENTS_BOOK-ID_rN";
    const changed = await statement(env, "UPDATE comment_jobs SET status='ready',error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE action='publish' AND book_id=? AND revision=? AND status='failed' RETURNING id", p.book_id, p.revision).first();
    return changed ? `📥 retry queued: ${p.group_key}` : `❌ No failed upload found for ${p.group_key}.`;
  }
  if (cmd === "/comments-off") {
    const bookId = String(arg || "").toUpperCase();
    if (!ID.test(bookId)) return "Usage: /comments-off BOOK-ID";
    if (arg2 !== "CONFIRM") return `⚠️ Take every comment of ${bookId} away from students? Re-run exactly: /comments-off ${bookId} CONFIRM`;
    const open = await statement(env, "SELECT id FROM comment_jobs WHERE action='clear' AND book_id=? AND status IN ('ready','running')", bookId).first();
    if (open) return `📥 already received comments-off ${bookId}`;
    await statement(env, "INSERT INTO comment_jobs(action,book_id) VALUES('clear',?)", bookId).run();
    return `📥 comments-off ${bookId} queued`;
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
  if (body.book_id !== job.book_id || body.action !== job.action || (job.action === "publish" && body.revision !== job.revision))
    return { ok: false, status: 400, error: "job_identity_mismatch" };
  const counts = COUNTS.map(k => body[k] ?? 0);
  if (!counts.every(x => Number.isSafeInteger(x) && x >= 0)) return { ok: false, status: 400, error: "invalid_counts" };
  const done = await statement(env, "UPDATE comment_jobs SET status='published',finished_at=datetime('now'),error_summary=NULL,questions=?,comments=?,book_questions=?,book_comments=? WHERE id=? AND status='running'", ...counts, job.id).run();
  return done?.meta?.changes ? { ok: true } : { ok: false, status: 409, error: "job_not_running" };
}
