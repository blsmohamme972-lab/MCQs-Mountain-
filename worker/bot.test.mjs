import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import bot, { parsePackageName, retryGroup, clearGroup } from "./bot.mjs";
import { verifyTelegramInitData, baghdadWeekKey } from "./leaderboard.mjs";
import { createHmac } from "node:crypto";

// Exercise the real SQL/schema, not a mock that silently ignores unknown queries.
function testDB() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(readFileSync(new URL("../migrations/0001_publish_queue.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0002_publish_warnings.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0003_leaderboard.sql", import.meta.url), "utf8"));
  return {
    sql: db,
    prepare(sql) {
      const compiled = db.prepare(sql); let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { const row = compiled.get(...args); return row ? { ...row } : null; },
        async all() { return { results: compiled.all(...args).map(x => ({ ...x })) }; },
        runSync() { const info = compiled.run(...args); return { meta: { changes: Number(info.changes) } }; },
        async run() { return this.runSync(); },
      };
    },
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const results = statements.map(s => s.runSync()); db.exec("COMMIT"); return results; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
  };
}
async function harness(fn) {
  const DB = testDB(), messages = [], dispatches = [], pending = [], callbacks = [];
  const env = { DB, BOT_TOKEN: "unit-bot", WEBHOOK_SECRET: "unit-hook", OWNER_TELEGRAM_ID: "123",
    DISPATCH_TOKEN: "unit-dispatch", QUEUE_API_TOKEN: "  unit-queue\n", CONTENT_BASE: "https://content.test" };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith("https://api.telegram.org/")) {
      const body = JSON.parse(init.body);
      if (url.endsWith("sendMessage")) messages.push(body);
      if (url.endsWith("answerCallbackQuery")) callbacks.push(body);
      return { ok: true, json: async () => ({ ok: true, result: {} }) };
    }
    if (url.startsWith("https://api.github.com/")) { dispatches.push(JSON.parse(init.body)); return { status: 204 }; }
    if (url === "https://content.test/routes/Q000000.json") return { ok: true, json: async () => ({ routes: { Q000000001: { book_id: "TEST", chapter_id: 1 } } }) };
    if (url === "https://content.test/catalog.json") return { ok: true, json: async () => ({ books: [{ id: "TEST", version: 1, questions: 4, chapters: [{ id: 1 }] }] }) };
    throw new Error("Unmocked network request refused");
  };
  const ctx = { waitUntil(p) { pending.push(p); } };
  const send = async (value, id = 123, type = "private", chatId = id, secret = "unit-hook") => {
    const message = { from: { id }, chat: { id: chatId, type }, ...(typeof value === "string" ? { text: value } : { document: value }) };
    const result = await bot.fetch(new Request("https://kafu.test/bot", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": secret }, body: JSON.stringify({ message }) }), env, ctx);
    await Promise.all(pending.splice(0));
    return result;
  };
  const internal = (path, body = {}, token = "unit-queue", method = "POST") => bot.fetch(new Request("https://kafu.test/internal/" + path, {
    method, headers: { Authorization: "Bearer " + token }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  }), env, ctx);
  const cb = async (data, id = 123, type = "private") => {
    const response = await bot.fetch(new Request("https://kafu.test/bot", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": "unit-hook" }, body: JSON.stringify({ callback_query: { id: "callback", data, from: { id }, message: { chat: { id, type } } } }) }), env, ctx);
    await Promise.all(pending.splice(0)); return response;
  };
  try { await fn({ env, DB, messages, dispatches, callbacks, send, internal, cb }); }
  finally { globalThis.fetch = original; DB.sql.close(); }
}
const document = (name, unique = name) => ({ file_name: name, file_id: "file-" + unique, file_unique_id: "unique-" + unique, file_size: 100 });
const state = (h, key) => h.DB.sql.prepare("SELECT * FROM publish_groups WHERE group_key=?").get(key);

test("package naming rejects malformed, unsafe numeric and oversized multipart names", () => {
  for (const name of ["book.pdf", "A_v0.zip", "A_v1_part3of2.zip", "A_v1_part1of101.zip", "A_v1 (1).zip", "A_v9999999999999999999999.zip"])
    assert.equal(parsePackageName(name), null);
  assert.deepEqual(parsePackageName("BOOK-1_v2_part1of2.zip"), { book_id: "BOOK-1", version: 2, part: 1, total: 2, group_key: "BOOK-1_v2" });
});

test("owner/private/webhook gates ignore stranger and group messages and callbacks", () => harness(async h => {
  assert.equal((await h.send("/status", 123, "private", 123, "wrong")).status, 403);
  for (const command of ["/status", "/retry TEST_v1", "/clear TEST_v1", "/remove TEST"]) {
    await h.send(command, 999); await h.send(command, 123, "group"); await h.send(command, 123, "private", 456);
  }
  await h.cb("approve:Q000000001", 999); await h.cb("approve:Q000000001", 123, "group");
  await h.send(document("TEST_v1.zip"), 999);
  assert.equal(h.messages.length, 0); assert.equal(h.dispatches.length, 0);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_groups").get().n, 0);
}));

test("plausible ZIP only, duplicate no-op, two-part assembly in reverse order", () => harness(async h => {
  await h.send(document("bad.pdf")); await h.send({ ...document("HUGE_v1.zip"), file_size: 20 * 1024 * 1024 });
  assert.ok(h.messages.every(x => x.text.startsWith("❌"))); assert.equal(h.dispatches.length, 0);
  await h.send(document("TWO_v1_part2of2.zip")); assert.equal(state(h, "TWO_v1").status, "waiting");
  await h.send(document("TWO_v1_part1of2.zip")); assert.equal(state(h, "TWO_v1").status, "ready");
  const before = h.dispatches.length;
  await h.send(document("TWO_v1_part1of2.zip"));
  assert.match(h.messages.at(-1).text, /already received/); assert.equal(h.dispatches.length, before);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_queue").get().n, 2);
  await h.send(document("TWO_v1_part1of2.zip", "other")); assert.match(h.messages.at(-1).text, /different ZIP/);
}));

test("failed part replaced atomically; running/published releases protected", () => harness(async h => {
  await h.send(document("TEST_v1.zip", "old"));
  h.DB.sql.exec("UPDATE publish_groups SET status='failed',error_summary='old failure'");
  await h.send(document("TEST_v1.zip", "replacement"));
  assert.equal(state(h, "TEST_v1").status, "ready"); assert.equal(state(h, "TEST_v1").error_summary, null);
  assert.equal(h.DB.sql.prepare("SELECT telegram_file_unique_id id FROM publish_queue").get().id, "unique-replacement");
  for (const status of ["running", "published"]) {
    h.DB.sql.prepare("UPDATE publish_groups SET status=?").run(status);
    await h.send(document("TEST_v1.zip", "blocked")); assert.ok(h.messages.at(-1).text.startsWith("❌"));
    assert.equal(h.DB.sql.prepare("SELECT telegram_file_unique_id id FROM publish_queue").get().id, "unique-replacement");
  }
}));

test("changed failed multipart layout starts a fresh assembly, without stale parts", () => harness(async h => {
  await h.send(document("TEST_v1_part1of2.zip")); await h.send(document("TEST_v1_part2of2.zip"));
  h.DB.sql.exec("UPDATE publish_groups SET status='failed'");
  await h.send(document("TEST_v1.zip", "single"));
  assert.equal(state(h, "TEST_v1").status, "ready"); assert.equal(state(h, "TEST_v1").part_total, 1);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_queue").get().n, 1);
}));

test("/retry requires failed complete group; /clear cannot delete running or published work", () => harness(async h => {
  await h.send(document("TEST_v1_part1of2.zip")); h.DB.sql.exec("UPDATE publish_groups SET status='failed'");
  await h.send("/retry TEST_v1"); assert.ok(h.messages.at(-1).text.startsWith("❌"));
  await h.send(document("TEST_v1_part2of2.zip")); h.DB.sql.exec("UPDATE publish_groups SET status='failed'");
  await h.send("/retry TEST_v1"); assert.equal(state(h, "TEST_v1").status, "ready");
  assert.deepEqual(h.dispatches.at(-1), { ref: "main" });
  await h.send("/clear TEST_v1"); assert.ok(state(h, "TEST_v1"));
  h.DB.sql.exec("UPDATE publish_groups SET status='running'");
  assert.equal((await clearGroup(h.env, "TEST_v1")).ok, false);
  h.DB.sql.exec("UPDATE publish_groups SET status='published'");
  assert.equal((await clearGroup(h.env, "TEST_v1")).ok, false);
  h.DB.sql.exec("UPDATE publish_groups SET status='failed'");
  await h.send("/clear TEST_v1"); assert.equal(state(h, "TEST_v1"), undefined);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_queue").get().n, 0);
  assert.equal((await retryGroup(h.env, "TEST_v1")).ok, false);
}));

test("/warnings lists future publish warnings without creating held flags", () => harness(async h => {
  const payload = {
    book_id: "TEST",
    version: 2,
    warnings: [
      { qid: "Q000000001", local_id: 1, source_page: 12, reasons: ["audit warning: partial source match", "parser flag: doubtful book answer"] },
      { qid: "Q000000002", local_id: 2, source_page: 13, reasons: ["audit unverifiable: scan"] },
    ],
  };
  const response = await h.internal("warnings", payload);
  assert.equal(response.status, 200);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 3);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags").get().n, 0);
  await h.send("/warnings TEST");
  assert.match(h.messages.at(-1).text, /Q000000001/);
  assert.match(h.messages.at(-1).text, /audit warning/);
  assert.match(h.messages.at(-1).text, /Q000000002/);
  await h.send("/warnings OTHER");
  assert.match(h.messages.at(-1).text, /No recorded publish warnings/);

  await h.internal("warnings", { ...payload, warnings: [payload.warnings[0]] });
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 2);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags").get().n, 0);
}));

test("/hold + /flags approval/rejection/source produce durable moderation jobs", () => harness(async h => {
  await h.send("/hold Q000000001 7");
  let row = h.DB.sql.prepare("SELECT * FROM flags").get(); assert.equal(row.status, "pending"); assert.equal(row.source_page, 7);
  await h.send("/flags"); assert.match(h.messages.at(-1).text, /Q000000001/);
  await h.send("/flags Q000000001"); assert.equal(h.messages.at(-1).reply_markup.inline_keyboard[0].length, 3);
  const count = h.dispatches.length; await h.cb("source:Q000000001"); assert.equal(h.dispatches.length, count);
  assert.match(h.callbacks.at(-1).text, /7/);
  await h.cb("approve:Q000000001"); assert.equal(h.DB.sql.prepare("SELECT status FROM flags").get().status, "approved");
  await h.cb("reject:Q000000001"); assert.equal(h.DB.sql.prepare("SELECT status FROM flags").get().status, "rejected");
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM admin_jobs WHERE kind='moderate'").get().n, 3);
  const flags = await (await h.internal("decisions", {book_id:"TEST"})).json(); assert.equal(flags.Q000000001, "rejected");
  await h.send("/hold Q000000001"); assert.match(h.messages.at(-1).text, /Usage/);
}));

test("/flags approve-all requires explicit confirmation and queues one moderation publish", () => harness(async h => {
  h.DB.sql.exec("INSERT INTO flags(qid,book_id,source_page,status) VALUES('Q000000001','TEST',1,'pending'),('Q000000002','TEST',2,'pending'),('Q000000003','OTHER',3,'pending')");
  await h.send("/flags approve-all TEST");
  assert.match(h.messages.at(-1).text, /Approve all 2 pending audit warnings/);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags WHERE book_id='TEST' AND status='pending'").get().n, 2);
  assert.equal(h.dispatches.length, 0);

  await h.send("/flags approve-all TEST CONFIRM");
  assert.match(h.messages.at(-1).text, /approved 2 audit warnings/);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags WHERE book_id='TEST' AND status='approved'").get().n, 2);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags WHERE book_id='OTHER' AND status='pending'").get().n, 1);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM admin_jobs WHERE kind='moderate' AND book_id='TEST'").get().n, 1);
  assert.deepEqual(h.dispatches.at(-1), { ref: "main" });

  await h.send("/flags approve-all TEST CONFIRM");
  assert.match(h.messages.at(-1).text, /No pending audit warnings/);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM admin_jobs WHERE kind='moderate' AND book_id='TEST'").get().n, 1);
}));

test("claim/finish are identity checked and stale completions cannot alter published records", () => harness(async h => {
  await h.send(document("TEST_v1.zip"));
  const item = await (await h.internal("claim")).json(); assert.equal(item.kind, "publish");
  const bad = await h.internal("finish", {kind:"publish",group_key:"TEST_v1",ok:true,book_id:"OTHER",version:1});
  assert.equal(bad.status, 400);
  const payload = {kind:"publish",group_key:"TEST_v1",ok:true,book_id:"TEST",version:1,questions:4,chapters:1,images:2};
  assert.equal((await h.internal("finish", payload)).status, 200); assert.equal(state(h, "TEST_v1").status, "published");
  assert.equal((await h.internal("finish", {...payload,questions:0})).status, 409);
  assert.equal(h.DB.sql.prepare("SELECT questions FROM published_books").get().questions, 4);
  assert.equal((await h.internal("claim", {}, "wrong")).status, 403);
  assert.equal((await h.internal("claim", {}, "unit-queue", "GET")).status, 405);
}));

test("rollback/remove affect only their book, and /queue includes admin failures", () => harness(async h => {
  h.DB.sql.exec("INSERT INTO published_books(book_id,version,active) VALUES('TEST',1,0),('TEST',2,1),('KEEP',1,1)");
  await h.send("/rollback TEST 1");
  let item = await (await h.internal("claim")).json(); assert.equal(item.job.kind, "rollback");
  await h.internal("finish", {kind:"admin",id:item.job.id,ok:true,operation:"rollback",book_id:"TEST",version:1});
  assert.equal(h.DB.sql.prepare("SELECT version FROM published_books WHERE book_id='TEST' AND active=1").get().version, 1);
  await h.send("/remove TEST"); item = await (await h.internal("claim")).json();
  await h.internal("finish", {kind:"admin",id:item.job.id,ok:true,operation:"remove",book_id:"TEST"});
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM published_books WHERE book_id='TEST' AND active=1").get().n, 0);
  assert.equal(h.DB.sql.prepare("SELECT active FROM published_books WHERE book_id='KEEP'").get().active, 1);
  await h.send("/remove TEST"); item = await (await h.internal("claim")).json();
  await h.internal("finish", {kind:"admin",id:item.job.id,ok:false,error:"step=candidate.catalog method=GET host=preview.test path=/catalog.json status=403 Bearer unit-queue"});
  await h.send("/queue"); assert.match(h.messages.at(-1).text, /candidate.catalog/); assert.doesNotMatch(h.messages.at(-1).text, /unit-queue/);
  await h.send("/rollback TEST -1"); assert.ok(h.messages.at(-1).text.startsWith("❌"));
}));
