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
  db.exec(readFileSync(new URL("../migrations/0004_question_comments.sql", import.meta.url), "utf8"));
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
    const rows=h.DB.sql.prepare("SELECT qid,correct FROM leaderboard_answers ORDER BY qid").all();
    assert.deepEqual(rows.map(x=>[x.qid,x.correct]),[["Q000000001",1],["Q000000002",1]]);
    assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM leaderboard_users").get().n,1);
  }finally{globalThis.fetch=original}
}));

test("leaderboard privacy hides public row but preserves own rank and score", () => harness(async h => {
  const initData=signedInitData({id:321,first_name:"Ada",last_name:"Lovelace",photo_url:"https://example.com/a.jpg"});
  let res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  const real=h.DB.sql.prepare("SELECT user_key,display_name,photo_url FROM leaderboard_users WHERE display_name='Ada Lovelace'").get();
  assert.ok(real);assert.equal(real.photo_url,"https://example.com/a.jpg");
  for(let i=101;i<=120;i++)h.DB.sql.prepare("INSERT OR IGNORE INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,?,?)").run(real.user_key,"Q"+String(i).padStart(9,"0"),1,baghdadWeekKey());

  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  let board=await res.json();assert.equal(board.own.score,20);assert.ok(board.own.rank);assert.ok(board.top.some(x=>x.name==="Ada Lovelace"));

  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/privacy",{method:"POST",body:JSON.stringify({initData,hidden:true})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  board=await res.json();assert.equal(board.own.hidden,true);assert.equal(board.own.score,20);assert.ok(board.own.rank);assert.ok(!board.top.some(x=>x.name==="Ada Lovelace"));
}));

test("leaderboard returns top 30 only plus own rank outside top 30", () => harness(async h => {
  const initData=signedInitData({id:888,first_name:"Private",last_name:"Student",username:"must-not-leak",phone_number:"+000"});
  let res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  assert.equal(res.status,200);
  const ownKey=h.DB.sql.prepare("SELECT user_key FROM leaderboard_users WHERE display_name='Private Student'").get().user_key;
  const week=baghdadWeekKey();
  h.DB.sql.prepare("INSERT INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,0,?)").run(ownKey,"Q000005001",week);
  for(let u=1;u<=35;u++){
    const key="rival-"+String(u).padStart(3,"0");
    h.DB.sql.prepare("INSERT INTO leaderboard_users(user_key,display_name,photo_url) VALUES(?,?,?)").run(key,"Rival "+u,"https://example.com/"+u+".jpg");
    h.DB.sql.prepare("INSERT INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,1,?)").run(key,"Q"+String(6000+u).padStart(9,"0"),week);
  }
  res=await bot.fetch(new Request("https://kafu.test/api/leaderboard/board",{method:"POST",body:JSON.stringify({initData,period:"weekly"})}),h.env,{waitUntil(){}});
  const body=await res.json();
  assert.equal(body.top.length,30);assert.equal(body.own.rank,36);assert.equal(body.own.score,0);
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
  const rows=h.DB.sql.prepare("SELECT qid,correct FROM leaderboard_answers").all();
  assert.deepEqual(rows.map(x=>[x.qid,x.correct]),[["Q000000001",1]]);
  const tables=h.DB.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
  assert.ok(!tables.includes("leaderboard_flags"));assert.ok(!tables.includes("leaderboard_rate"));
}));


async function commentApi(h,path,initData,body={}){
  return bot.fetch(new Request("https://kafu.test/api/comments/"+path,{method:"POST",body:JSON.stringify({initData,...body})}),h.env,{waitUntil(){}});
}
async function postComment(h,initData,body,parent_id=null,nonce="nonce_12345678"){
  const r=await commentApi(h,"create",initData,{qid:"Q000000001",body,parent_id,client_nonce:nonce});
  return {response:r,data:await r.json()};
}

test("comments identity is verified, client author fields ignored, unsafe photo rejected",()=>harness(async h=>{
  const init=signedInitData({id:700,first_name:"Ali",last_name:"Hassan",username:"secret",phone_number:"+964",photo_url:"javascript:alert(1)"});
  const {response,data}=await postComment(h,init,"مرحبا Kafu 123");
  assert.equal(response.status,201);assert.equal(data.comment.name,"Ali Hassan");assert.equal(data.comment.photo_url,null);
  const stored=h.DB.sql.prepare("SELECT display_name,photo_url,user_key FROM comment_users").get();
  assert.equal(stored.display_name,"Ali Hassan");assert.equal(stored.photo_url,null);assert.ok(stored.user_key&&!/700/.test(stored.user_key));
  assert.doesNotMatch(JSON.stringify(data),/username|phone_number|secret|\+964|user_key/);
  const fake=await commentApi(h,"create",init,{qid:"Q000000001",body:"second",client_nonce:"nonce_87654321",author_id:"mallory",moderator:true,verified:true});
  assert.equal(fake.status,201);
  assert.equal(h.DB.sql.prepare("SELECT COUNT(DISTINCT author_key) n FROM comments").get().n,1);
}));

test("comments auth rejects forged, altered and malformed Telegram user",()=>harness(async h=>{
  const good=signedInitData({id:701,first_name:"Good"});
  const forged=new URLSearchParams(good);forged.set("user",JSON.stringify({id:999,first_name:"Mallory"}));
  assert.equal((await commentApi(h,"thread",forged.toString(),{qid:"Q000000001"})).status,401);
  const malformed=signedInitData({id:"not-a-number",first_name:"Bad"});
  assert.equal((await commentApi(h,"thread",malformed,{qid:"Q000000001"})).status,401);
}));

test("comments enforce one reply level, ownership and Helpful identity",()=>harness(async h=>{
  const a=signedInitData({id:710,first_name:"A"}),b=signedInitData({id:711,first_name:"B"});
  const top=(await postComment(h,a,"top",null,"nonce_top_123")).data.comment;
  const reply=(await postComment(h,b,"reply",top.id,"nonce_reply_123")).data.comment;
  const nested=await postComment(h,a,"nested",reply.id,"nonce_nested_1");
  assert.equal(nested.response.status,400);
  assert.equal((await commentApi(h,"helpful",a,{comment_id:top.id})).status,400);
  assert.equal((await commentApi(h,"helpful",b,{comment_id:top.id})).status,200);
  assert.equal(h.DB.sql.prepare("SELECT helpful_count FROM comments WHERE id=?").get(top.id).helpful_count,1);
  assert.equal((await commentApi(h,"delete",b,{comment_id:top.id})).status,403);
  assert.equal((await commentApi(h,"delete",a,{comment_id:top.id})).status,200);
}));

test("reports deduplicate and three unique reports auto-hide",()=>harness(async h=>{
  const author=signedInitData({id:720,first_name:"Author"});
  const top=(await postComment(h,author,"review me",null,"nonce_report_1")).data.comment;
  for(const id of [721,722,723]){
    const u=signedInitData({id,first_name:"R"+id});
    assert.equal((await commentApi(h,"report",u,{comment_id:top.id,reason:"answer_wrong"})).status,200);
    if(id===721)assert.equal((await commentApi(h,"report",u,{comment_id:top.id,reason:"answer_wrong"})).status,200);
  }
  const row=h.DB.sql.prepare("SELECT report_count,status FROM comments WHERE id=?").get(top.id);
  assert.equal(row.report_count,3);assert.equal(row.status,"hidden_pending");
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM comment_reports WHERE comment_id=?").get(top.id).n,3);
}));

test("owner moderation queue is private and resolves reviewed reports",()=>harness(async h=>{
  const author=signedInitData({id:724,first_name:"Author"}),reporter=signedInitData({id:725,first_name:"Reporter"});
  const owner=signedInitData({id:123,first_name:"Owner"}),other=signedInitData({id:726,first_name:"Other"});
  const top=(await postComment(h,author,"possible answer issue",null,"nonce_modqueue_1")).data.comment;
  await commentApi(h,"report",reporter,{comment_id:top.id,reason:"answer_wrong"});
  assert.equal((await commentApi(h,"mod-queue",other,{})).status,403);
  const q=await commentApi(h,"mod-queue",owner,{});assert.equal(q.status,200);
  const data=await q.json();assert.equal(data.items.length,1);assert.equal(data.items[0].qid,"Q000000001");assert.equal(data.items[0].reason,"answer_wrong");
  assert.doesNotMatch(JSON.stringify(data),/user_key|telegram_id|username|phone_number/);
  assert.equal((await commentApi(h,"moderate",owner,{comment_id:top.id,action:"hide"})).status,200);
  const q2=await commentApi(h,"mod-queue",owner,{});assert.equal((await q2.json()).items.length,0);
}));

test("Verified by Kafu is owner-only and only applies to a reply",()=>harness(async h=>{
  const author=signedInitData({id:730,first_name:"Student"}),other=signedInitData({id:731,first_name:"Other"}),owner=signedInitData({id:123,first_name:"Owner"});
  const top=(await postComment(h,author,"question",null,"nonce_verify_t")).data.comment;
  const reply=(await postComment(h,other,"valuable reply",top.id,"nonce_verify_r")).data.comment;
  assert.equal((await commentApi(h,"moderate",other,{comment_id:reply.id,action:"verify",moderator:true})).status,403);
  assert.equal((await commentApi(h,"moderate",owner,{comment_id:top.id,action:"verify"})).status,400);
  assert.equal((await commentApi(h,"moderate",owner,{comment_id:reply.id,action:"verify"})).status,200);
  const row=h.DB.sql.prepare("SELECT verified,pinned FROM comments WHERE id=?").get(reply.id);
  assert.deepEqual([row.verified,row.pinned],[1,1]);
}));

test("comment thread read is lazy data-only, escaped rendering responsibility is preserved",()=>harness(async h=>{
  const a=signedInitData({id:740,first_name:"XSS"});
  const raw='<img src=x onerror=alert(1)> مرحبا (MRCS) 123';
  await postComment(h,a,raw,null,"nonce_xss_123");
  const r=await commentApi(h,"thread",a,{qid:"Q000000001",sort:"newest"});assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.items[0].body,raw);assert.equal(data.notice,"Student discussion — not verified");
  assert.doesNotMatch(JSON.stringify(data),/user_key|telegram_id|username|phone_number/);
}));

test("removed content immediately hides its existing discussion without deleting history",()=>harness(async h=>{
  const a=signedInitData({id:750,first_name:"Archive"});
  await postComment(h,a,"persistent",null,"nonce_archive_1");
  const original=globalThis.fetch;
  globalThis.fetch=async(url,init={})=>{
    url=String(url);
    if(url==="https://content.test/routes/Q000000.json")return{ok:true,json:async()=>({routes:{Q000000001:{book_id:"TEST",chapter_id:1}}})};
    if(url==="https://content.test/catalog.json")return{ok:true,json:async()=>({books:[]})};
    return original(url,init);
  };
  try{
    const r=await commentApi(h,"thread",a,{qid:"Q000000001"});assert.equal(r.status,404);
    assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM comments").get().n,1);
  }finally{globalThis.fetch=original}
}));

test("stable QID re-upload preserves the same thread and comments",()=>harness(async h=>{
  const a=signedInitData({id:751,first_name:"Stable"});
  const first=await postComment(h,a,"survives re-upload",null,"nonce_stable_1");assert.equal(first.response.status,201);
  await h.DB.prepare("INSERT OR IGNORE INTO comment_threads(qid,book_id) VALUES(?,?)").bind("Q000000001","TEST").run();
  const r=await commentApi(h,"thread",a,{qid:"Q000000001",sort:"newest"});assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.items.length,1);assert.equal(data.items[0].body,"survives re-upload");
  assert.equal(h.DB.sql.prepare("SELECT COUNT(*) n FROM comment_threads WHERE qid='Q000000001'").get().n,1);
}));

test("comments hot-path query plans use declared indexes",()=>harness(async h=>{
  const plans=[
    ["comments_author_rate","SELECT COUNT(*) FROM comments WHERE author_key='a' AND created_at>=datetime('now','-10 minutes')"],
    ["comment_votes_user_rate","SELECT COUNT(*) FROM comment_votes WHERE user_key='a' AND created_at>=datetime('now','-1 day')"],
    ["comment_reports_reporter_rate","SELECT COUNT(*) FROM comment_reports WHERE reporter_key='a' AND created_at>=datetime('now','-1 day')"],
    ["comments_thread_top_newest","SELECT id FROM comments WHERE qid='Q000000001' AND parent_id IS NULL AND status='visible' ORDER BY created_at DESC,id DESC LIMIT 20"],
  ];
  for(const [index,sql] of plans){const detail=h.DB.sql.prepare("EXPLAIN QUERY PLAN "+sql).all().map(x=>x.detail).join(" ");assert.match(detail,new RegExp(index));assert.doesNotMatch(detail,/SCAN comments(?:\s|$)/)}
}));
