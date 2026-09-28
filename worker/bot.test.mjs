import test from "node:test";
import assert from "node:assert/strict";
import bot, { clearGroup, parsePackageName, retryGroup } from "./bot.mjs";

function fakeDB() {
  const groups = new Map(), parts = new Map();
  return { groups, parts, prepare(sql) {
    let args = [];
    return { bind(...v) { args = v; return this; },
      async first() {
        if (sql.startsWith("SELECT telegram_file_unique_id")) return parts.get(`${args[0]}:${args[1]}`) || null;
        if (sql.startsWith("SELECT part_total") || sql.startsWith("SELECT status")) return groups.get(args[0]) || null;
        if (sql.startsWith("SELECT COUNT(*)")) return { n: [...parts.keys()].filter(x => x.startsWith(args[0] + ":")).length };
        return null;
      },
      async run() {
        if (sql.startsWith("INSERT OR IGNORE INTO publish_groups")) {
          if (!groups.has(args[0])) groups.set(args[0], { part_total: args[3], status: "waiting" });
        } else if (sql.startsWith("INSERT INTO publish_queue")) {
          parts.set(`${args[0]}:${args[1]}`, { telegram_file_unique_id: args[4] });
        } else if (sql.startsWith("UPDATE publish_queue SET")) {
          parts.set(`${args[5]}:${args[6]}`, { telegram_file_unique_id: args[2] });
        } else if (sql.startsWith("UPDATE publish_groups SET status=?")) {
          const group = groups.get(args[1]); if (group) group.status = args[0];
        } else if (sql.startsWith("UPDATE publish_groups SET status='ready'")) {
          const group = groups.get(args[0]); if (group) group.status = "ready";
        } else if (sql.startsWith("DELETE FROM publish_queue")) {
          for (const key of [...parts.keys()]) if (key.startsWith(args[0] + ":")) parts.delete(key);
        } else if (sql.startsWith("DELETE FROM publish_groups")) {
          groups.delete(args[0]);
        }
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


test("internal queue auth trims token whitespace and returns a JSON auth error", async () => {
  const env = { DB: fakeDB(), QUEUE_API_TOKEN: "  queue-secret\n" };
  const good = await bot.fetch(new Request("https://kafu.example/internal/claim", {
    method: "POST", headers: { Authorization: "Bearer queue-secret" },
  }), env, {});
  assert.equal(good.status, 200);
  assert.deepEqual(await good.json(), { kind: "empty" });

  const bad = await bot.fetch(new Request("https://kafu.example/internal/claim", {
    method: "POST", headers: { Authorization: "Bearer wrong-secret" },
  }), env, {});
  assert.equal(bad.status, 403);
  assert.deepEqual(await bad.json(), { error: "bad_queue_token" });
});


test("failed upload can be replaced, retried, and cleared", async () => {
  const db = fakeDB();
  db.groups.set("BOOK_v1", { part_total: 1, status: "failed" });
  db.parts.set("BOOK_v1:1", { telegram_file_unique_id: "old-unique" });

  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("api.github.com")) return { status: 204 };
    return { ok: true, json: async () => ({ ok: true, result: {} }) };
  };
  const env = { DB: db, BOT_TOKEN: "test", WEBHOOK_SECRET: "secret",
    OWNER_TELEGRAM_ID: "123", DISPATCH_TOKEN: "dispatch" };
  const pending = [];
  const ctx = { waitUntil(p) { pending.push(p); } };
  try {
    const update = { message: { from: { id: 123 }, chat: { id: 123, type: "private" },
      document: { file_id: "new-file", file_unique_id: "new-unique",
        file_name: "BOOK_v1.zip", file_size: 100 } } };
    const response = await bot.fetch(new Request("https://kafu.example/bot", { method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" }, body: JSON.stringify(update) }), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(pending);
    assert.equal(db.groups.get("BOOK_v1").status, "ready");
    assert.equal(db.parts.get("BOOK_v1:1").telegram_file_unique_id, "new-unique");

    db.groups.get("BOOK_v1").status = "failed";
    const retried = await retryGroup(env, "BOOK_v1");
    assert.equal(retried.ok, true);
    assert.equal(db.groups.get("BOOK_v1").status, "ready");

    db.groups.get("BOOK_v1").status = "failed";
    const cleared = await clearGroup(env, "BOOK_v1");
    assert.equal(cleared.ok, true);
    assert.equal(db.groups.has("BOOK_v1"), false);
    assert.equal(db.parts.has("BOOK_v1:1"), false);
  } finally {
    globalThis.fetch = original;
  }
});
