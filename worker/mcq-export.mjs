import { verifyTelegramInitData } from "./leaderboard.mjs";

export const OWNER_AUTH_MAX_AGE_SECONDS = 86_400;
export const OWNER_AUTH_MAX_FUTURE_SECONDS = 60;
export const MAX_CONTENT_BYTES = 12 * 1024 * 1024;
const DEFAULT_CONTENT_BASE = "https://kafu-content-1.blsmohamme97.workers.dev";
const BOOK_ID = /^[A-Z0-9][A-Z0-9-]{0,127}$/;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "pragma": "no-cache",
      vary: "Authorization",
    },
  });
}

function validAuthDate(initData, now = new Date()) {
  const date = Number(new URLSearchParams(initData).get("auth_date"));
  if (!Number.isSafeInteger(date) || date <= 0) return false;
  const age = now.getTime() / 1000 - date;
  return age >= -OWNER_AUTH_MAX_FUTURE_SECONDS && age <= OWNER_AUTH_MAX_AGE_SECONDS;
}

export async function verifyOwnerRequest(request, env, now = new Date()) {
  let body;
  try { body = await request.json(); } catch (_) { return null; }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.initData !== "string") return null;
  const user = await verifyTelegramInitData(body.initData, env.BOT_TOKEN, now);
  if (!user || !validAuthDate(body.initData, now)) return null;
  const owner = String(env.OWNER_TELEGRAM_ID || "").trim();
  if (!owner || user.id !== owner) return null;
  return { body, user };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function contentBase(env) {
  const raw = String(env.CONTENT_BASE || DEFAULT_CONTENT_BASE).replace(/\/+$/, "");
  const base = new URL(raw);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("content_origin_invalid");
  return base;
}

function approvedContentUrl(raw, base) {
  let url;
  try { url = new URL(String(raw || ""), base); } catch (_) { throw new Error("content_url_invalid"); }
  if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.hash) throw new Error("content_url_invalid");
  return url;
}

async function fetchJson(url, label) {
  const result = await fetch(url, { cache: "no-store", redirect: "manual", headers: { "user-agent": "kafu-owner-mcq-export/1.0" } });
  if (result.status >= 300 && result.status < 400) throw new Error(label + "_redirect");
  if (!result.ok) throw new Error(label + "_unavailable");
  const raw = await result.text();
  if (raw.length > MAX_CONTENT_BYTES) throw new Error(label + "_too_large");
  let data;
  try { data = JSON.parse(raw); } catch (_) { throw new Error(label + "_invalid_json"); }
  return { data, sha256: await sha256Hex(raw) };
}

async function readCatalog(env, bookId, version) {
  if (!BOOK_ID.test(String(bookId || ""))) throw new Error("book_identity_invalid");
  if (!Number.isSafeInteger(Number(version)) || Number(version) < 1) throw new Error("book_version_invalid");
  const base = contentBase(env);
  const catalogUrl = new URL("/catalog.json", base).href;
  const loaded = await fetchJson(catalogUrl, "catalog");
  if (!loaded.data || !Array.isArray(loaded.data.books)) throw new Error("catalog_invalid");
  const book = (loaded.data.books || []).find((candidate) => String(candidate?.id) === String(bookId) && Number(candidate?.version) === Number(version));
  if (!book || String(book.id).toUpperCase().startsWith("SAMPLE")) throw new Error("published_book_not_found");
  if (!Array.isArray(book.chapters) || !book.chapters.length) throw new Error("published_chapters_missing");
  for (const chapter of book.chapters) {
    if (chapter?.id == null || typeof chapter.title !== "string" || !Number.isSafeInteger(Number(chapter.questions)) || Number(chapter.questions) < 0 || !Array.isArray(chapter.qids) || chapter.qids.length !== Number(chapter.questions)) throw new Error("published_chapter_manifest_invalid");
    approvedContentUrl(chapter.url, base);
    if (chapter.image_url) approvedContentUrl(chapter.image_url, base);
  }
  const indexUrl = book.index_url ? approvedContentUrl(book.index_url, base).href : null;
  return {
    base,
    book,
    snapshot: { catalog_url: catalogUrl, catalog_sha256: loaded.sha256, index_url: indexUrl },
  };
}

function safeChapter(book, chapterId) {
  const chapter = book.chapters.find((candidate) => String(candidate.id) === String(chapterId));
  if (!chapter) throw new Error("published_chapter_not_found");
  return chapter;
}

export async function handleMcqExport(request, env, path) {
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405);
  const auth = await verifyOwnerRequest(request, env);
  if (!auth) return response({ error: "forbidden" }, 403);
  try {
    if (path === "/admin/mcq-export/catalog") {
      const { book, snapshot } = await readCatalog(env, auth.body.book_id, auth.body.version);
      return response({ ok: true, source_kind: "published", snapshot, book, chapters: book.chapters });
    }
    if (path === "/admin/mcq-export/chapter") {
      const loaded = await readCatalog(env, auth.body.book_id, auth.body.version);
      if (String(auth.body.catalog_sha256 || "") !== loaded.snapshot.catalog_sha256) return response({ error: "stale_snapshot" }, 409);
      const chapter = safeChapter(loaded.book, auth.body.chapter_id);
      const url = approvedContentUrl(chapter.url, loaded.base);
      const pack = await fetchJson(url.href, "chapter");
      const data = pack.data;
      if (!data || data.book_id !== loaded.book.id || Number(data.version) !== Number(loaded.book.version) || String(data.chapter_id) !== String(chapter.id) || !Array.isArray(data.questions)) return response({ error: "chapter_identity_mismatch" }, 409);
      if (data.questions.length !== Number(chapter.questions) || data.questions.length > 20_000) return response({ error: "chapter_count_mismatch" }, 409);
      return response({ ok: true, source_kind: "published", snapshot: { ...loaded.snapshot, chapter_sha256: pack.sha256 }, chapter, pack: data });
    }
    return response({ error: "not_found" }, 404);
  } catch (error) {
    const code = String(error?.message || "export_unavailable").replace(/[^a-z0-9_:-]/gi, "_").slice(0, 80) || "export_unavailable";
    const status = /stale|mismatch|count|identity/.test(code) ? 409 : 503;
    return response({ error: code }, status);
  }
}

export { validAuthDate };
