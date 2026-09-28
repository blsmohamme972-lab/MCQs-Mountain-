// Queue transitions are guarded in SQL; D1 batch makes multi-write changes atomic.
const MAX_ZIP = 19 * 1024 * 1024;
const NAME = /^([A-Z0-9][A-Z0-9-]*)_v([1-9]\d*)(?:_part([1-9]\d*)of([1-9]\d*))?\.zip$/i;

export function parsePackageName(filename) {
  if (typeof filename !== "string" || filename.length > 255) return null;
  const m = NAME.exec(filename);
  if (!m) return null;
  const version = Number(m[2]), part = Number(m[3] || 1), total = Number(m[4] || 1);
  if (![version, part, total].every(Number.isSafeInteger) || total > 100 || part > total || (total === 1 && m[3])) return null;
  return { book_id: m[1].toUpperCase(), version, part, total, group_key: `${m[1].toUpperCase()}_v${version}` };
}
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const groupRow = (env, key) => statement(env, "SELECT part_total,status FROM publish_groups WHERE group_key=?", key).first();
const partRow = (env, p) => statement(env, "SELECT telegram_file_unique_id FROM publish_queue WHERE group_key=? AND part_index=?", p.group_key, p.part).first();
const countParts = (env, key) => statement(env, "SELECT COUNT(*) AS n FROM publish_queue WHERE group_key=?", key).first();
const READY_SQL = "UPDATE publish_groups SET status=CASE WHEN (SELECT COUNT(*) FROM publish_queue WHERE group_key=?)=part_total THEN 'ready' ELSE 'waiting' END WHERE group_key=? AND status IN ('waiting','ready')";
const PART_VALUES = "group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size";

export async function queueDocument(env, doc) {
  if (!doc || !Number.isInteger(doc.file_size) || doc.file_size < 1 || doc.file_size > MAX_ZIP ||
      typeof doc.file_id !== "string" || !doc.file_id || typeof doc.file_unique_id !== "string" || !doc.file_unique_id)
    return "❌ ZIP required, up to 19 MB.";
  const p = parsePackageName(doc.file_name);
  if (!p) return "❌ Filename must be BOOK-ID_vN.zip or BOOK-ID_vN_partXofY.zip.";
  const group = await groupRow(env, p.group_key);
  const existing = await partRow(env, p);
  if (group?.status !== "failed" && existing) return existing.telegram_file_unique_id === doc.file_unique_id ?
    "📥 already received" : "❌ A different ZIP already occupies this part. Use /queue to inspect it.";
  if (group && !["waiting", "ready", "failed"].includes(group.status))
    return "❌ This release is running or published; it cannot be replaced.";
  if (group && group.status !== "failed" && group.part_total !== p.total)
    return "❌ Conflicting part count for this release.";

  const values = [p.group_key, p.part, p.total, doc.file_id, doc.file_unique_id, doc.file_name, doc.file_size];
  const writes = [];
  if (group?.status === "failed") {
    if (group.part_total !== p.total) {
      // A changed failed multipart layout is a new assembly: do not mix old parts.
      writes.push(statement(env, "DELETE FROM publish_queue WHERE group_key=? AND EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='failed')", p.group_key, p.group_key));
      writes.push(statement(env, "UPDATE publish_groups SET part_total=?,status='waiting',error_summary=NULL,claimed_at=NULL,finished_at=NULL,force_republish=0 WHERE group_key=? AND status='failed'", p.total, p.group_key));
      writes.push(statement(env, `INSERT INTO publish_queue(${PART_VALUES}) SELECT ?,?,?,?,?,?,? FROM publish_groups WHERE group_key=? AND status='waiting' AND part_total=? ON CONFLICT(group_key,part_index) DO NOTHING`, ...values, p.group_key, p.total));
      writes.push(statement(env, READY_SQL, p.group_key, p.group_key));
    } else {
      writes.push(statement(env, "UPDATE publish_queue SET part_total=?,telegram_file_id=?,telegram_file_unique_id=?,filename=?,file_size=?,created_at=datetime('now') WHERE group_key=? AND part_index=? AND EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='failed')", p.total, doc.file_id, doc.file_unique_id, doc.file_name, doc.file_size, p.group_key, p.part, p.group_key));
      writes.push(statement(env, `INSERT INTO publish_queue(${PART_VALUES}) SELECT ?,?,?,?,?,?,? FROM publish_groups WHERE group_key=? AND status='failed' AND NOT EXISTS(SELECT 1 FROM publish_queue WHERE group_key=? AND part_index=?)`, ...values, p.group_key, p.group_key, p.part));
      writes.push(statement(env, "UPDATE publish_groups SET status=CASE WHEN (SELECT COUNT(*) FROM publish_queue WHERE group_key=?)=part_total THEN 'ready' ELSE 'waiting' END,error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE group_key=? AND status='failed' AND EXISTS(SELECT 1 FROM publish_queue WHERE group_key=? AND part_index=? AND telegram_file_unique_id=?)", p.group_key, p.group_key, p.group_key, p.part, doc.file_unique_id));
    }
  } else {
    writes.push(statement(env, "INSERT OR IGNORE INTO publish_groups(group_key,book_id,version,part_total,status) VALUES(?,?,?,?, 'waiting')", p.group_key, p.book_id, p.version, p.total));
    writes.push(statement(env, `INSERT INTO publish_queue(${PART_VALUES}) SELECT ?,?,?,?,?,?,? FROM publish_groups WHERE group_key=? AND part_total=? AND status IN ('waiting','ready') ON CONFLICT(group_key,part_index) DO NOTHING`, ...values, p.group_key, p.total));
    writes.push(statement(env, READY_SQL, p.group_key, p.group_key));
  }
  try {
    await env.DB.batch(writes);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint")) return "❌ This Telegram file is already attached to another queued part.";
    throw error;
  }
  const finalPart = await partRow(env, p);
  if (finalPart?.telegram_file_unique_id !== doc.file_unique_id)
    return "❌ Queue state changed; use /queue before trying again.";
  const row = await countParts(env, p.group_key);
  return `📥 ${group?.status === "failed" ? "replaced failed" : "received"} ${p.group_key} (${row.n}/${p.total})`;
}

export async function retryGroup(env, key) {
  const p = parsePackageName(`${key || ""}.zip`);
  if (!p || p.total !== 1) return { ok: false, text: "Usage: /retry BOOK-ID_vN" };
  const group = await groupRow(env, p.group_key);
  if (!group || group.status !== "failed") return { ok: false, text: "❌ No failed upload found for that release." };
  const changed = await statement(env, "UPDATE publish_groups SET status='ready',error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE group_key=? AND status='failed' AND (SELECT COUNT(*) FROM publish_queue WHERE group_key=? AND part_total=publish_groups.part_total AND part_index BETWEEN 1 AND publish_groups.part_total)=part_total RETURNING group_key", p.group_key, p.group_key).first();
  if (!changed) return { ok: false, text: "❌ Upload is incomplete or no longer failed; inspect /queue." };
  return { ok: true, text: `📥 retry queued: ${p.group_key}`, group_key: p.group_key, book_id: p.book_id };
}

export async function clearGroup(env, key) {
  const p = parsePackageName(`${key || ""}.zip`);
  if (!p || p.total !== 1) return { ok: false, text: "Usage: /clear BOOK-ID_vN" };
  const result = await env.DB.batch([
    statement(env, "DELETE FROM publish_queue WHERE group_key=? AND EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='failed')", p.group_key, p.group_key),
    statement(env, "DELETE FROM publish_groups WHERE group_key=? AND status='failed'", p.group_key),
  ]);
  if (!result[1]?.meta?.changes) return { ok: false, text: "❌ Only failed uploads can be cleared." };
  return { ok: true, text: `🧹 cleared failed upload: ${p.group_key}`, group_key: p.group_key, book_id: p.book_id };
}
