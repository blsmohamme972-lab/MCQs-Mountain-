import test from "node:test";
import assert from "node:assert/strict";
import bot, { parsePackageName } from "./bot.mjs";

function fakeDB() {
  const groups = new Map(), parts = new Map();
  return { groups, parts, prepare(sql) {
    let args = [];
    return { bind(...v) { args = v; return this; },
      async first() {
        if (sql.startsWith("SELECT file_unique_id")) return parts.get(`${args[0]}:${args[1]}`) || null;
        if (sql.startsWith("SELECT part_total")) return groups.get(args[0]) || null;
        if (sql.startsWith("SELECT COUNT(*)")) return { n: [...parts.keys()].filter(x => x.startsWith(args[0] + ":")).length };
        return null;
      },
      async run() {
        if (sql.startsWith("INSERT OR IGNORE INTO publish_groups")) {
          if (!groups.has(args[0])) groups.set(args[0], { part_total: args[3], status: "waiting" });
        } else if (sql.startsWith("INSERT INTO publish_queue")) {
          parts.set(`${args[0]}:${args[1]}`, { file_unique_id: args[4] });
        } else if (sql.startsWith("UPDATE publish_groups SET status='ready'")) groups.get(args[0]).status = "ready";
        return {};
      },
    };
  } };
}

test("filename rejects malformed or oversized multipart indices", () => {
  assert.equal(parsePackageName("book.pdf"), null);
  assert.equal(parsePackageName("A_v1_part3of2.zip"), null);
  assert.equal(parsePackageName("A_v1_part1of101.zip"), null);
  assert.deepEqual(parsePackageName("BOOK-1_v2_part1of2.zip"), {
    book_id: "BOOK-1", version: 2, part: 1, total: 2, group_key: "BOOK-1_v2",
  });
});

test("webhook silently ignores strangers and only accepts owner private ZIPs", async () => {
  const db = fakeDB();
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("api.github.com")) return { status: 204 };
    return { ok: true, json: async () => ({ ok: true, result: {} }) };
  };
  const env = { DB: db, BOT_TOKEN: "test", WEBHOOK_SECRET: "secret",
    OWNER_TELEGRAM_ID: "123", DISPATCH_TOKEN: "dispatch" };
  const pending = [];
  const ctx = { waitUntil(p) { pending.push(p); } };
  const send = async (id, chat, name, secret = "secret") => {
    const update = { message: { from: { id }, chat: { id, type: chat },
      document: { file_id: `file-${name}`, file_unique_id: `unique-${name}`,
        file_name: name, file_size: 100 } } };
    return bot.fetch(new Request("https://kafu.example/bot", { method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret }, body: JSON.stringify(update) }), env, ctx);
  };
  try {
    assert.equal((await send(123, "private", "A_v1.zip", "bad")).status, 403);
    assert.equal((await send(999, "private", "A_v1.zip")).status, 200);
    assert.equal((await send(123, "group", "A_v1.zip")).status, 200);
    assert.equal(calls.length, 0);
    for (const name of ["A_v1.zip", "B_v1.zip", "C_v1.zip"])
      assert.equal((await send(123, "private", name)).status, 200);
    await Promise.all(pending);
    assert.deepEqual([...db.groups.keys()], ["A_v1", "B_v1", "C_v1"]);
    assert.ok([...db.groups.values()].every(x => x.status === "ready"));
    assert.equal(calls.filter(x => String(x.url).includes("api.github.com")).length, 3);
    assert.equal(calls.filter(x => String(x.url).includes("sendMessage")).length, 3);
  } finally { globalThis.fetch = original; }
});
