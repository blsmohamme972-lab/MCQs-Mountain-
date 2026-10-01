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
  db.exec(readFileSync(new URL("../migrations/0004_leaderboard_compact.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0005_leaderboard_read_bounds.sql", import.meta.url), "utf8"));
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

function signedInitData(user={id:321,first_name:"Ada",photo_url:"https://example.com/a.jpg"},authDate=Math.floor(Date.now()/1000),token="unit-bot"){
  const params=new URLSearchParams({auth_date:String(authDate),query_id:"AAE",user:JSON.stringify(user)});
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const secret=createHmac("sha256","WebAppData").update(token).digest();
  const hash=createHmac("sha256",secret).update(check).digest("hex");
  params.set("hash",hash);return params.toString();
}
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

test("/books shows readable HTML tables and escapes book titles", () => harness(async h => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url) === "https://content.test/catalog.json" ?
    { ok: true, json: async () => ({ books: [{ id: "ANATOMY", title: "Anatomy <Review> & Notes", version: 2, questions: 643, chapters: [{}, {}, {}, {}, {}, {}, {}] }] }) } : original(url, init);
  await h.send("/books");
  const message = h.messages.at(-1);
  assert.equal(message.parse_mode, "HTML");
  assert.match(message.text, /Anatomy &lt;Review&gt; &amp; Notes/);
  assert.match(message.text, /<code>ANATOMY<\/code>/);
  assert.match(message.text, /<pre>Ver\./);
  assert.match(message.text, /v2\s*│\s*643\s*│\s*7/);
  assert.equal(h.dispatches.length, 0);
}));

test("/books tables use D1 fallback and handle empty lists", () => harness(async h => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => String(url) === "https://content.test/catalog.json" ? { ok: false } : original(url, init);
  await h.send("/books");
  assert.match(h.messages.at(-1).text, /لا توجد كتب/);
  h.DB.sql.exec("INSERT INTO published_books(book_id,version,questions,chapters,active) VALUES('TEST',3,956,37,1),('HIDDEN',1,1,1,0)");
  await h.send("/books");
  assert.match(h.messages.at(-1).text, /v3\s*│\s*956\s*│\s*37/);
  assert.doesNotMatch(h.messages.at(-1).text, /HIDDEN/);
}));

test("/books splits large catalogs at complete book tables", () => harness(async h => {
  const original = globalThis.fetch;
  const books = Array.from({ length: 50 }, (_, i) => ({ id: `BOOK-${i}`, title: `Book ${i} ` + "Long title ".repeat(8), version: 1, questions: 10, chapters: [{}] }));
  globalThis.fetch = async (url, init) => String(url) === "https://content.test/catalog.json" ? { ok: true, json: async () => ({ books }) } : original(url, init);
  await h.send("/books");
  assert.ok(h.messages.length > 1);
  for (const message of h.messages) {
    assert.ok(message.text.length <= 3500);
    assert.equal(message.parse_mode, "HTML");
    assert.equal((message.text.match(/<pre>/g) || []).length, (message.text.match(/<\/pre>/g) || []).length);
  }
  assert.equal((h.messages.map(m => m.text).join("\n").match(/<pre>/g) || []).length, 50);
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

test("warnings stores hundreds of reasons with one atomic D1 batch and supports retries", () => harness(async h => {
  const warnings = Array.from({ length: 404 }, (_, i) => ({
    qid: `Q${String(i + 1).padStart(9, "0")}`, local_id: i + 1, source_page: i + 8,
    reasons: ["Source has one sentence", "Original text preserved"],
  }));
  const payload = { book_id: "ANATOMY", version: 2, warnings };
  const originalBatch = h.DB.batch.bind(h.DB), originalPrepare = h.DB.prepare.bind(h.DB);
  let batches = 0, statements = 0, individualRuns = 0;
  h.DB.prepare = sql => {
    const statement = originalPrepare(sql);
    statement.run = async () => { individualRuns++; return statement.runSync(); };
    return statement;
  };
  h.DB.batch = async writes => { batches++; statements += writes.length; return originalBatch(writes); };
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await h.internal("warnings", payload)).status, 200);
    assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 808);
  }
  assert.equal(batches, 2);
  assert.equal(statements, 4);
  assert.equal(individualRuns, 0);
  assert.equal(h.DB.sql.prepare("SELECT source_page FROM publish_warnings WHERE local_id=404").get().source_page, 411);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM flags").get().n, 0);
}));

test("warnings replacement rolls back on insert failure", () => harness(async h => {
  const old = { book_id: "TEST", version: 1, warnings: [{ qid: "Q000000001", local_id: 1, reasons: ["old"] }] };
  assert.equal((await h.internal("warnings", old)).status, 200);
  h.DB.sql.exec("CREATE TRIGGER warning_failure BEFORE INSERT ON publish_warnings WHEN NEW.reason='fail' BEGIN SELECT RAISE(ABORT,'insert failed'); END");
  await assert.rejects(h.internal("warnings", { ...old, warnings: [{ ...old.warnings[0], reasons: ["new", "fail"] }] }), /insert failed/);
  assert.deepEqual(h.DB.sql.prepare("SELECT reason FROM publish_warnings").all().map(x => x.reason), ["old"]);
}));

test("warnings validates before replacing and isolates book versions", () => harness(async h => {
  const warning = { qid: "Q000000001", local_id: 1, reasons: ["keep", "keep", "", "x".repeat(600)] };
  for (const [book_id, version] of [["TEST", 1], ["TEST", 2], ["OTHER", 1]]) {
    assert.equal((await h.internal("warnings", { book_id, version, warnings: [null, warning, { qid: "bad", local_id: 2, reasons: ["bad"] }] })).status, 200);
  }
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 6);
  assert.equal(h.DB.sql.prepare("SELECT MAX(length(reason)) n FROM publish_warnings").get().n, 500);
  assert.equal((await h.internal("warnings", { book_id: "TEST", version: 1, warnings: {} })).status, 400);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 6);
  assert.equal((await h.internal("warnings", { book_id: "TEST", version: 1, warnings: [] })).status, 200);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM publish_warnings").get().n, 4);
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

test("leaderboard initData rejects forged signatures and respects Baghdad Monday reset", async () => {
  const good=signedInitData();
  assert.ok(await verifyTelegramInitData(good,"unit-bot"));
  const forged=new URLSearchParams(good);forged.set("user",JSON.stringify({id:999,first_name:"Mallory"}));
  assert.equal(await verifyTelegramInitData(forged.toString(),"unit-bot"),null);
  assert.equal(baghdadWeekKey(new Date("2026-09-27T20:59:59Z")),"2026-09-21");
  assert.equal(baghdadWeekKey(new Date("2026-09-27T21:00:00Z")),"2026-09-28");
});

test("leaderboard computes first-attempt score server-side and rejects fake score totals", () => harness(async h => {
  const original=globalThis.fetch;
  globalThis.fetch=async (url,init={})=>{
    url=String(url);
    if(url==="https://content.test/routes/Q000000.json")return{ok:true,json:async()=>({routes:{
      Q000000001:{book_id:"TEST",chapter_id:1},Q000000002:{book_id:"TEST",chapter_id:1}
    }})};
    if(url==="https://content.test/catalog.json")return{ok:true,json:async()=>({books:[{id:"TEST",chapters:[{id:1,url:"https://content.test/packs/test.json"}]}]})};
    if(url==="https://content.test/packs/test.json")return{ok:true,json:async()=>({questions:[
      {id:"Q000000001",type:"sba",options:["A","B"],answer:"A"},
      {id:"Q000000002",type:"multi",options:["A","B","C"],answer:["A","C"]}
    ]})};
    return original(url,init);
  };
  try{
    const initData=signedInitData();
    let res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/submit",{method:"POST",body:JSON.stringify({
      initData,score:999,answers:[{qid:"Q000000001",selection:0}]
    })}),h.env,{waitUntil(){}});
    assert.equal(res.status,400);assert.equal((await res.json()).error,"score_not_accepted");

    res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/submit",{method:"POST",body:JSON.stringify({
      initData,answers:[
        {qid:"Q000000001",selection:0,answered_at_ms:10000},
        {qid:"Q000000002",selection:[0,2],answered_at_ms:13000}
      ]
    })}),h.env,{waitUntil(){}});
    assert.equal(res.status,200);let body=await res.json();assert.equal(body.accepted,2);

    res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/submit",{method:"POST",body:JSON.stringify({
      initData,answers:[{qid:"Q000000001",selection:1,answered_at_ms:20000}]
    })}),h.env,{waitUntil(){}});
    body=await res.json();assert.equal(body.accepted,0);assert.equal(body.duplicates,1);
    const ledger=h.DB.sql.prepare("SELECT attempted FROM leaderboard_attempt_buckets").get();
    assert.deepEqual(JSON.parse(ledger.attempted),[1,2]);
    assert.equal(h.DB.sql.prepare("SELECT total_score FROM leaderboard_summary").get().total_score,2);
    assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM leaderboard_users").get().n,1);
  }finally{globalThis.fetch=original}
}));

test("leaderboard privacy hides public row and preserves the stored score", () => harness(async h => {
  const initData=signedInitData({id:321,first_name:"Ada",last_name:"Lovelace",photo_url:"https://example.com/a.jpg"});
  let res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  await bot.fetch(new Request("https://kafu.test/api/leaderboard/privacy",{method:"POST",body:JSON.stringify({initData,hidden:false})}),h.env,{});
  const real=h.DB.sql.prepare("SELECT user_key,display_name,photo_url FROM leaderboard_users WHERE display_name='Ada Lovelace'").get();
  assert.ok(real);assert.equal(real.photo_url,"https://example.com/a.jpg");
  h.DB.sql.prepare("INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score) VALUES(?,20,?,20)").run(real.user_key,baghdadWeekKey());
  h.DB.sql.exec("DELETE FROM leaderboard_snapshots");

  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  let board=await res.json();assert.equal(board.own,undefined);assert.ok(board.top.some(x=>x.name==="Ada Lovelace"));

  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/privacy",{method:"POST",body:JSON.stringify({initData,hidden:true})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  board=await res.json();assert.equal(board.own,undefined);assert.equal(h.DB.sql.prepare("SELECT total_score FROM leaderboard_summary").get().total_score,20);assert.ok(!board.top.some(x=>x.name==="Ada Lovelace"));
}));

test("leaderboard returns cached top 30 and cutoff without personal rank", () => harness(async h => {
  const initData=signedInitData({id:888,first_name:"Private",last_name:"Student",username:"must-not-leak",phone_number:"+000"});
  let res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  await bot.fetch(new Request("https://kafu.test/api/leaderboard/privacy",{method:"POST",body:JSON.stringify({initData,hidden:false})}),h.env,{});
  const ownKey=h.DB.sql.prepare("SELECT user_key FROM leaderboard_users WHERE display_name='Private Student'").get().user_key;
  const week=baghdadWeekKey();
  h.DB.sql.prepare("INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score) VALUES(?,0,?,0)").run(ownKey,week);
  for(let u=1;u<=35;u++){
    const key="rival-"+String(u).padStart(3,"0");
    h.DB.sql.prepare("INSERT INTO leaderboard_users(user_key,display_name,photo_url) VALUES(?,?,?)").run(key,"Rival "+u,"https://example.com/"+u+".jpg");
    h.DB.sql.prepare("INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score) VALUES(?,1,?,1)").run(key,week);
  }
  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  h.DB.sql.exec("DELETE FROM leaderboard_snapshots");
  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{});
  const body=await res.json();
  assert.equal(body.top.length,30);assert.equal(body.own,undefined);assert.equal(body.cutoff,1);
  const serialized=JSON.stringify(body);
  assert.doesNotMatch(serialized,/must-not-leak|phone_number|username|user_key|\+000/);
  assert.deepEqual(Object.keys(body.top[0]).sort(),["name","photo_url","rank","score"].sort());
}));

test("leaderboard repeated submits only preserve first attempt", () => harness(async h => {
  const initData=signedInitData({id:777,first_name:"Fast"});
  for(let i=0;i<20;i++){
    const res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/submit",{method:"POST",body:JSON.stringify({
      initData,answers:[{qid:"Q000000001",selection:i===0?0:1}]
    })}),h.env,{waitUntil(){}});
    assert.equal(res.status,200);
  }
  const ledger=h.DB.sql.prepare("SELECT attempted FROM leaderboard_attempt_buckets").get();
  assert.deepEqual(JSON.parse(ledger.attempted),[1]);
  assert.equal(h.DB.sql.prepare("SELECT total_score FROM leaderboard_summary").get().total_score,1);
  const tables=h.DB.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
  assert.ok(!tables.includes("leaderboard_flags"));assert.ok(!tables.includes("leaderboard_rate"));
}));


test('compact migration preserves wrong attempts, scores and old Worker overlap',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0003_leaderboard.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO leaderboard_users(user_key,display_name,hidden) VALUES('old','Old',1)");
  const put=db.prepare('INSERT INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,?,?)');
  put.run('old','Q000000001',0,'2026-09-21');put.run('old','Q000000002',1,'2026-09-21');put.run('old','Q000000003',1,'2026-09-28');
  db.exec(readFileSync(new URL('../migrations/0004_leaderboard_compact.sql',import.meta.url),'utf8'));
  let summary=db.prepare('SELECT * FROM leaderboard_summary').get();
  assert.equal(summary.total_score,2);assert.equal(summary.weekly_score,1);assert.equal(summary.hidden,1);
  assert.deepEqual(JSON.parse(db.prepare('SELECT attempted FROM leaderboard_attempt_buckets').get().attempted),[1,2,3]);
  assert.equal(put.run('old','Q000000001',1,'2026-09-28').changes,0);
  put.run('old','Q000000004',1,'2026-10-05');
  summary=db.prepare('SELECT * FROM leaderboard_summary').get();
  assert.equal(summary.total_score,3);assert.equal(summary.weekly_score,1);assert.equal(summary.week_key,'2026-10-05');
  db.close();
});

test('top snapshot stays cached; opening never reads personal rank or history',()=>harness(async h=>{
  const initData=signedInitData({id:321,first_name:'Cache'});
  await bot.fetch(new Request('https://kafu.test/api/leaderboard/privacy',{method:'POST',body:JSON.stringify({initData,hidden:false})}),h.env,{});
  const key=h.DB.sql.prepare('SELECT user_key FROM leaderboard_users').get().user_key,week=baghdadWeekKey();
  h.DB.sql.prepare('INSERT INTO leaderboard_summary(user_key,total_score,week_key,weekly_score) VALUES(?,1,?,1)').run(key,week);
  const get=async(period='weekly')=>(await bot.fetch(new Request('https://kafu.test/api/leaderboard/board',{method:'POST',body:JSON.stringify({initData,period})}),h.env,{})).json();
  let board=await get();assert.equal(board.top[0].score,1);
  const refreshed=board.refreshed_at;
  h.DB.sql.exec('UPDATE leaderboard_summary SET total_score=9,weekly_score=9');
  const before=h.DB.sql.prepare('SELECT total_changes() n').get().n;
  board=await get();assert.equal(board.top[0].score,1);assert.equal(board.own,undefined);assert.equal(board.refreshed_at,refreshed);
  assert.equal(h.DB.sql.prepare('SELECT total_changes() n').get().n,before,'cached board does not write');
  h.DB.sql.exec('UPDATE leaderboard_snapshots SET refreshed_at=0');
  board=await get();assert.equal(board.top[0].score,9);
  board=await get('all_time');assert.equal(board.top[0].score,9);
  h.DB.sql.prepare('UPDATE leaderboard_summary SET week_key=?').run('2026-09-21');
  board=await get();assert.equal(board.own,undefined);h.DB.sql.exec("UPDATE leaderboard_snapshots SET refreshed_at=0");board=await get();assert.equal(board.top.length,0);
  const plans=h.DB.sql.prepare('EXPLAIN QUERY PLAN SELECT user_key FROM leaderboard_summary WHERE week_key=? AND hidden=0 ORDER BY weekly_score DESC,user_key ASC LIMIT 30').all(week);
  assert.ok(plans.some(x=>x.detail.includes('leaderboard_week_rank')));
}));

test('500 answers in five batches use five compact rows updates and no per-answer writes',()=>harness(async h=>{
  const orig=globalThis.fetch;
  h.env.CONTENT_BASE='https://batch.test';
  const questions=Array.from({length:500},(_,i)=>({id:'Q'+String(61000+i).padStart(9,'0'),type:'sba',options:['A','B'],answer:'A'}));
  globalThis.fetch=async url=>{
    url=String(url);
    if(url.includes('/routes/'))return {ok:true,json:async()=>({routes:Object.fromEntries(questions.map(q=>[q.id,{book_id:'BATCH',chapter_id:1}]))})};
    if(url.endsWith('/catalog.json'))return {ok:true,json:async()=>({books:[{id:'BATCH',chapters:[{id:1,url:'https://content.test/batch.json'}]}]})};
    if(url.endsWith('/batch.json'))return {ok:true,json:async()=>({questions})};
    throw Error('Unmocked fetch');
  };
  try{
    const initData=signedInitData({id:997,first_name:'Batch'});
    const send=async qs=>{
      const res=await bot.fetch(new Request('https://kafu.test/api/leaderboard/submit',{method:'POST',body:JSON.stringify({initData,answers:qs.map(q=>({qid:q.id,selection:0}))})}),h.env,{});
      assert.equal(res.status,200);return res.json();
    };
    await bot.fetch(new Request('https://kafu.test/api/leaderboard/privacy',{method:'POST',body:JSON.stringify({initData,hidden:false})}),h.env,{});
    const before=h.DB.sql.prepare('SELECT total_changes() n').get().n;
    for(let i=0;i<5;i++)assert.equal((await send(questions.slice(i*100,(i+1)*100))).accepted,100);
    assert.equal(h.DB.sql.prepare('SELECT total_score FROM leaderboard_summary').get().total_score,500);
    assert.equal(h.DB.sql.prepare('SELECT COUNT(*) n FROM leaderboard_attempt_buckets').get().n,2);
    assert.equal(h.DB.sql.prepare('SELECT COUNT(*) n FROM leaderboard_answers').get().n,0);
    // Five batches cross one bucket boundary: 6 ledger + 6 summary changes.
    // With two ranking indexes this models 24 billed writes for an existing student.
    // Production rows_written from Cloudflare, not this model, is authoritative.
    assert.equal(h.DB.sql.prepare('SELECT total_changes() n').get().n-before,17); // +5 daily telemetry counter writes
    const changes=h.DB.sql.prepare('SELECT total_changes() n').get().n;
    const [one,two]=await Promise.all([send(questions.slice(0,100)),send(questions.slice(0,100))]);
    assert.equal(one.accepted+two.accepted,0);assert.equal(h.DB.sql.prepare('SELECT total_changes() n').get().n,changes+2); // only telemetry counters
  }finally{globalThis.fetch=orig}
}));

test('admin usage and books reject strangers, forged/expired sessions and GET; never write data',()=>harness(async h=>{
  const post=(path,initData)=>bot.fetch(new Request('https://kafu.test/admin/'+path,{method:'POST',body:JSON.stringify({initData})}),h.env,{});
  for(const path of ['books','usage','capabilities']){
    assert.equal((await post(path,signedInitData({id:999,first_name:'Stranger'}))).status,403);
    assert.equal((await post(path,'forged')).status,403);
    assert.equal((await post(path,signedInitData({id:123},1))).status,403);
    assert.equal((await bot.fetch(new Request('https://kafu.test/admin/'+path),h.env,{})).status,405);
  }
  assert.equal((await bot.fetch(new Request('https://kafu.test/admin/capabilities',{method:'POST',body:'null'}),h.env,{})).status,403);
  const initData=signedInitData({id:123,first_name:'Owner'}),before=h.DB.sql.prepare('SELECT total_changes() n').get().n;
  const cap=await post('capabilities',initData);assert.equal(cap.status,200);assert.equal(cap.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(await cap.json(),{books:true,d1_usage:true});
  const books=await post('books',initData);assert.deepEqual(await books.json(),{books:[]});
  const unavailable=await post('usage',initData);assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).error,'analytics_not_configured');
  assert.equal(h.DB.sql.prepare('SELECT total_changes() n').get().n,before);
  h.env.ADMIN_IDS='999';assert.equal((await post('capabilities',initData)).status,403);
}));

test('D1 panel uses real account-wide Cloudflare row totals, UTC days and 70 percent threshold',async()=>{
  const {d1Usage}=await import('./admin.mjs'),original=globalThis.fetch;let calls=0;
  const env={D1_ANALYTICS_TOKEN:'test-only',CLOUDFLARE_ACCOUNT_ID:'test-account'};
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'https://api.cloudflare.com/client/v4/graphql');
    const body=JSON.parse(init.body);assert.deepEqual(body.variables,{accountTag:'test-account',start:'2026-09-24',end:'2026-09-30'});
    assert.doesNotMatch(body.query,/databaseId/);assert.match(body.query,/rowsRead rowsWritten/);calls++;
    return Response.json({data:{viewer:{accounts:[{d1AnalyticsAdaptiveGroups:[
      {dimensions:{date:'2026-09-30'},sum:{rowsRead:3500000,rowsWritten:69999}},
      {dimensions:{date:'2026-09-29'},sum:{rowsRead:100,rowsWritten:70000}}
    ]}]}}});
  };
  try{
    const data=await d1Usage(env,new Date('2026-09-30T20:00:00Z'));
    assert.equal(data.today.read_percent,70);assert.equal(data.today.warning,true);assert.equal(data.days[1].write_percent,70);
    assert.equal(data.scope,'account');assert.equal(data.timezone,'UTC');
    await d1Usage(env,new Date('2026-09-30T20:04:00Z'));assert.equal(calls,1);
    globalThis.fetch=async()=>Response.json({errors:[{message:'private token permission detail'}]});
    await assert.rejects(d1Usage({...env,CLOUDFLARE_ACCOUNT_ID:'other'},new Date('2026-09-30T20:06:00Z')),/analytics_access_unavailable/);
    globalThis.fetch=async()=>Response.json({data:{viewer:{accounts:[{d1AnalyticsAdaptiveGroups:[]}]}}});
    const missing=await d1Usage({...env,CLOUDFLARE_ACCOUNT_ID:'empty'},new Date('2026-09-30T20:06:00Z'));assert.equal(missing.today,null);
  }finally{globalThis.fetch=original}
});


test('additive revision migration supports historical ledgers and old Worker updates without double scores',()=>{
  const db=new DatabaseSync(':memory:');
  for(const file of ['0003_leaderboard.sql','0004_leaderboard_compact.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  db.exec("INSERT INTO leaderboard_users(user_key,display_name) VALUES('old','Old')");
  const put=db.prepare('INSERT INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,?,?)');
  put.run('old','Q000000001',0,'2026-09-28');put.run('old','Q000000002',1,'2026-09-28');
  db.exec(readFileSync(new URL('../migrations/0005_leaderboard_read_bounds.sql',import.meta.url),'utf8'));
  put.run('old','Q000000003',1,'2026-09-28');
  const ledger=db.prepare('SELECT * FROM leaderboard_attempt_buckets').get();
  assert.deepEqual(JSON.parse(ledger.attempted),[1,2,3]);assert.equal(ledger.revision,1);
  assert.equal(db.prepare('SELECT total_score FROM leaderboard_summary').get().total_score,2);
  assert.equal(put.run('old','Q000000001',1,'2026-09-28').changes,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM leaderboard_answers').get().n,3);
  db.close();
});

test('simultaneous fresh submissions use revision guard; loser retries without double award',()=>harness(async h=>{
  const initData=signedInitData({id:543,first_name:'Race'});
  const send=async()=>bot.fetch(new Request('https://kafu.test/api/leaderboard/submit',{method:'POST',body:JSON.stringify({initData,answers:[{qid:'Q000000001',selection:0}]})}),h.env,{});
  const responses=await Promise.all([send(),send()]);
  assert.ok(responses.every(x=>[200,409].includes(x.status)));
  assert.equal((await (await send()).json()).accepted,0);
  assert.equal(h.DB.sql.prepare('SELECT total_score FROM leaderboard_summary').get().total_score,1);
  assert.equal(h.DB.sql.prepare('SELECT COUNT(*) n FROM leaderboard_answers').get().n,0);
}));

test('meter preserves D1 metadata, avoids fabricated zero and logs no identity',async()=>{
  const {meterDatabase,logD1Request}=await import('./d1-metrics.mjs');
  const totalsDB={prepare(){return {bind(){return this},all:async()=>({results:[{value:4}],meta:{rows_read:3,rows_written:0,size_after:40960}})}}};
  const meter=meterDatabase(totalsDB);assert.deepEqual(await meter.db.prepare('unused').first(),{value:4});
  assert.equal(meter.totals.rows_read,3);assert.equal(meter.totals.available,true);
  const logs=[],orig=console.log;console.log=x=>logs.push(JSON.parse(x));
  try{await logD1Request(totalsDB,'/admin/books',meter.totals,200)}finally{console.log=orig}
  assert.equal(logs[0].rows_read,3);assert.equal(logs[0].endpoint,'/admin/books');
  assert.doesNotMatch(JSON.stringify(logs),/user_key|initData|sql|token/);
});
