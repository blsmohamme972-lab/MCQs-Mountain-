import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { handleMcqExport, verifyOwnerRequest, OWNER_AUTH_MAX_AGE_SECONDS } from "./mcq-export.mjs";
import { handleAdmin } from "./admin.mjs";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const encoder = new TextEncoder();
const BOT_TOKEN = "123456:fixture-token";
const OWNER = "777";
const NOW = new Date("2026-10-06T00:00:00.000Z");

async function hmac(key, text) {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, encoder.encode(text)));
}
function hex(bytes) { return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function initData(id = OWNER, authDate = Math.floor(NOW.getTime() / 1000), mutate = false) {
  const params = new URLSearchParams();
  params.set("auth_date", String(authDate));
  params.set("query_id", "fixture-query");
  params.set("user", JSON.stringify({ id: Number(id), first_name: "Fixture" }));
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), BOT_TOKEN);
  params.set("hash", hex(await hmac(secret, check)));
  if (mutate) params.set("hash", "0".repeat(64));
  return params.toString();
}
function env() { return { BOT_TOKEN, OWNER_TELEGRAM_ID: OWNER, CONTENT_BASE: "https://content.example" }; }
function request(body) { return new Request("https://app.example/admin/mcq-export/catalog", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }); }
function adminRequest(body) { return new Request("https://app.example/admin/capabilities", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }); }

const q = { id: "Q000000001", type: "sba", stem: "Which?", options: ["A", "B"], answer: "A", explanation: "Because", chapter_id: 1, book_id: "FIXTURE-BOOK", version: 1 };
const book = { id: "FIXTURE-BOOK", title: "Fixture Book", version: 1, questions: 1, chapters: [{ id: 1, title: "One", questions: 1, qids: [q.id], url: "https://content.example/packs/one.json", image_url: "https://content.example/packs/one.zip" }] };
const catalogRaw = JSON.stringify({ schema: 1, books: [book] });
const chapterRaw = JSON.stringify({ schema: 1, book_id: book.id, chapter_id: 1, version: 1, questions: [q] });

{
  const capability = await handleAdmin(adminRequest({ initData: await initData() }), { ...env(), ADMIN_IDS: "778" }, "/admin/capabilities");
  assert.equal(capability.status, 200);
  assert.deepEqual(await capability.json(), { books: false, d1_usage: false, can_export_mcqs: true });
  const otherAdmin = await handleAdmin(adminRequest({ initData: await initData("778") }), { ...env(), ADMIN_IDS: "778" }, "/admin/capabilities");
  assert.deepEqual(await otherAdmin.json(), { books: true, d1_usage: true, can_export_mcqs: false });
}

async function withFetch(fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/catalog.json")) return new Response(catalogRaw, { status: 200, headers: { "content-type": "application/json" } });
    if (String(url).endsWith("/packs/one.json")) return new Response(chapterRaw, { status: 200, headers: { "content-type": "application/json" } });
    throw new Error("unexpected_fetch");
  };
  try { return await fn(); } finally { globalThis.fetch = previous; }
}
async function withResponses(catalog, chapter, fn) {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/catalog.json")) return typeof catalog === "number" ? new Response("", { status: catalog }) : new Response(JSON.stringify(catalog), { status: 200 });
    if (String(url).endsWith("/packs/one.json")) return typeof chapter === "number" ? new Response("", { status: chapter }) : new Response(JSON.stringify(chapter), { status: 200 });
    throw new Error("unexpected_fetch");
  };
  try { return await fn(); } finally { globalThis.fetch = previous; }
}

await withFetch(async () => {
  const signed = await initData();
  const auth = await verifyOwnerRequest(request({ initData: signed }), env(), NOW);
  assert.equal(auth.user.id, OWNER);
  const catalog = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1 }), env(), "/admin/mcq-export/catalog");
  assert.equal(catalog.status, 200);
  const catalogBody = await catalog.json();
  assert.equal(catalogBody.source_kind, "published");
  assert.equal(catalogBody.book.chapters[0].qids[0], q.id);
  const chapter = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1, chapter_id: 1, catalog_sha256: catalogBody.snapshot.catalog_sha256 }), env(), "/admin/mcq-export/chapter");
  assert.equal(chapter.status, 200);
  assert.deepEqual((await chapter.json()).pack.questions[0], q);
});

await withResponses({ schema: 1, books: [{ ...book, id: "SAMPLE-BOOK" }] }, chapterRaw, async () => {
  const result = await handleMcqExport(request({ initData: await initData(), book_id: "SAMPLE-BOOK", version: 1 }), env(), "/admin/mcq-export/catalog");
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error, "published_book_not_found");
});

await withResponses({ schema: 1, books: [book] }, { schema: 1, book_id: book.id, chapter_id: 1, version: 1, questions: [] }, async () => {
  const signed = await initData();
  const catalog = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1 }), env(), "/admin/mcq-export/catalog");
  const sha = (await catalog.json()).snapshot.catalog_sha256;
  const result = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1, chapter_id: 1, catalog_sha256: sha }), env(), "/admin/mcq-export/chapter");
  assert.equal(result.status, 409);
  assert.equal((await result.json()).error, "chapter_count_mismatch");
});

for (const bad of [
  await initData("778"),
  await initData(OWNER, Math.floor(NOW.getTime() / 1000) - OWNER_AUTH_MAX_AGE_SECONDS - 1),
  await initData(OWNER, Math.floor(NOW.getTime() / 1000) + 61),
  (await initData(OWNER, undefined, true)),
]) {
  const result = await verifyOwnerRequest(request({ initData: bad, book_id: book.id, version: 1 }), env(), NOW);
  assert.equal(result, null);
}

await withFetch(async () => {
  const signed = await initData();
  const first = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1 }), env(), "/admin/mcq-export/catalog");
  const sha = (await first.json()).snapshot.catalog_sha256;
  const stale = await handleMcqExport(request({ initData: signed, book_id: book.id, version: 1, chapter_id: 1, catalog_sha256: "0".repeat(64) }), env(), "/admin/mcq-export/chapter");
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, "stale_snapshot");
  assert.match(sha, /^[a-f0-9]{64}$/);
});

console.log("owner export auth/content contract: PASS");
