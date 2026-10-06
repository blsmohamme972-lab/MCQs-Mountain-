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
  if (typeof raw !== "string" || !raw.trim()) throw new Error("content_url_invalid");
  let url;
  try { url = new URL(String(raw || ""), base); } catch (_) { throw new Error("content_url_invalid"); }
  if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.hash) throw new Error("content_url_invalid");
  return url;
}

function safeUpstreamDiagnostic(result, raw = "") {
  const contentType = String(result.headers.get("content-type") || "").slice(0, 120);
  const cfRay = String(result.headers.get("cf-ray") || "").slice(0, 80);
  const match = String(raw || "").match(/(?:error\s*(?:code)?\s*[:#-]?\s*)(10\d{2})/i);
  return {
    upstream_status: Number(result.status) || 0,
    content_type: contentType,
    ...(match ? { cf_code: Number(match[1]) } : {}),
    ...(cfRay ? { cf_ray: cfRay } : {}),
  };
}

async function readErrorSnippet(result, limit = 4096) {
  if (!result.body?.getReader) return (await result.text()).slice(0, limit);
  const reader = result.body.getReader(); const chunks = []; let total = 0;
  try {
    while (total < limit) {
      const part = await reader.read(); if (part.done) break;
      const take = part.value.subarray(0, Math.min(part.value.length, limit - total));
      chunks.push(take); total += take.length;
      if (take.length < part.value.length) break;
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

async function contentFetch(env, url) {
  const target = new URL(url);
  const base = contentBase(env);
  const init = { cache: "no-store", redirect: "manual", headers: { "user-agent": "kafu-owner-mcq-export/1.0" } };
  if (target.origin === base.origin && env.CONTENT_SERVICE?.fetch) return env.CONTENT_SERVICE.fetch(new Request(target.href, init));
  return fetch(target.href, init);
}

async function fetchJson(env, url, label) {
  let result;
  try { result = await contentFetch(env, url); }
  catch (_) {
    console.warn("mcq_export_upstream", JSON.stringify({ label, origin: new URL(url).origin, path: new URL(url).pathname, fetch_exception: true }));
    const error = new Error(label + "_unavailable"); error.upstream = { fetch_exception: true }; throw error;
  }
  if (result.status >= 300 && result.status < 400) {
    const error = new Error(label + "_redirect"); error.upstream = safeUpstreamDiagnostic(result); throw error;
  }
  if (!result.ok) {
    const snippet = await readErrorSnippet(result);
    const diagnostic = safeUpstreamDiagnostic(result, snippet);
    console.warn("mcq_export_upstream", JSON.stringify({ label, origin: new URL(url).origin, path: new URL(url).pathname, ...diagnostic }));
    const error = new Error(label + "_unavailable"); error.upstream = diagnostic; throw error;
  }
  const raw = await result.text();
  const bytes = new TextEncoder().encode(raw).byteLength;
  if (bytes > MAX_CONTENT_BYTES) throw new Error(label + "_too_large");
  let data;
  try { data = JSON.parse(raw); } catch (_) { throw new Error(label + "_invalid_json"); }
  return { data, sha256: await sha256Hex(raw), bytes };
}

async function readCatalog(env, bookId, version) {
  if (!BOOK_ID.test(String(bookId || ""))) throw new Error("book_identity_invalid");
  if (!Number.isSafeInteger(Number(version)) || Number(version) < 1) throw new Error("book_version_invalid");
  const base = contentBase(env);
  const catalogUrl = new URL("/catalog.json", base).href;
  const loaded = await fetchJson(env, catalogUrl, "catalog");
  if (!loaded.data || !Array.isArray(loaded.data.books)) throw new Error("catalog_invalid");
  const book = (loaded.data.books || []).find((candidate) => String(candidate?.id) === String(bookId) && Number(candidate?.version) === Number(version));
  if (!book || String(book.id).toUpperCase().startsWith("SAMPLE")) throw new Error("published_book_not_found");
  if (typeof book.title !== "string" || !Number.isSafeInteger(Number(book.questions)) || Number(book.questions) < 0) throw new Error("published_book_manifest_invalid");
  if (!Array.isArray(book.chapters) || !book.chapters.length) throw new Error("published_chapters_missing");
  const seenQids = new Set();
  const chapters = book.chapters.map((chapter) => {
    if (chapter?.id == null || typeof chapter.title !== "string" || !Number.isSafeInteger(Number(chapter.questions)) || Number(chapter.questions) < 0 || !Array.isArray(chapter.qids) || chapter.qids.length !== Number(chapter.questions)) throw new Error("published_chapter_manifest_invalid");
    const url = approvedContentUrl(chapter.url, base).href;
    const qids = chapter.qids.map((qid) => String(qid));
    if (qids.some((qid) => !qid || seenQids.has(qid))) throw new Error("published_qid_duplicate");
    qids.forEach((qid) => seenQids.add(qid));
    const resolved = { ...chapter, url, qids };
    if (chapter.image_url) resolved.image_url = approvedContentUrl(chapter.image_url, base).href;
    return resolved;
  });
  const expectedTotal = chapters.reduce((sum, chapter) => sum + Number(chapter.questions), 0);
  if (expectedTotal !== Number(book.questions)) throw new Error("published_book_count_mismatch");
  const indexUrl = book.index_url ? approvedContentUrl(book.index_url, base).href : null;
  let bookIndex = null;
  let indexSha256 = null;
  if (indexUrl) {
    const loadedIndex = await fetchJson(env, indexUrl, "book_index");
    const index = loadedIndex.data;
    if (!index || String(index.book_id) !== String(book.id) || Number(index.version) !== Number(book.version) || typeof index.title !== "string" || !Array.isArray(index.chapters)) throw new Error("book_index_mismatch");
    if (Number(index.question_count) !== expectedTotal || index.chapters.length !== chapters.length) throw new Error("book_index_mismatch");
    for (let i = 0; i < chapters.length; i++) {
      const fromCatalog = chapters[i], fromIndex = index.chapters[i];
      if (!fromIndex || String(fromIndex.id) !== String(fromCatalog.id) || fromIndex.title !== fromCatalog.title || Number(fromIndex.questions) !== Number(fromCatalog.questions) || JSON.stringify((fromIndex.qids || []).map(String)) !== JSON.stringify(fromCatalog.qids) || approvedContentUrl(fromIndex.url, base).href !== fromCatalog.url || (fromCatalog.image_url || null) !== (fromIndex.image_url ? approvedContentUrl(fromIndex.image_url, base).href : null)) throw new Error("book_index_mismatch");
    }
    bookIndex = { ...index, index_url: indexUrl, chapters: index.chapters.map((chapter) => ({ ...chapter, url: approvedContentUrl(chapter.url, base).href, ...(chapter.image_url ? { image_url: approvedContentUrl(chapter.image_url, base).href } : {}) })) };
    indexSha256 = loadedIndex.sha256;
  }
  const resolvedBook = { ...book, index_url: indexUrl, chapters };
  return {
    base,
    book: resolvedBook,
    bookIndex,
    snapshot: { catalog_url: catalogUrl, catalog_sha256: loaded.sha256, index_url: indexUrl, index_sha256: indexSha256 },
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
      const { book, bookIndex, snapshot } = await readCatalog(env, auth.body.book_id, auth.body.version);
      return response({ ok: true, source_kind: "published", snapshot, book, book_index: bookIndex, chapters: book.chapters });
    }
    if (path === "/admin/mcq-export/chapter") {
      const loaded = await readCatalog(env, auth.body.book_id, auth.body.version);
      if (String(auth.body.catalog_sha256 || "") !== loaded.snapshot.catalog_sha256) return response({ error: "stale_snapshot" }, 409);
      const chapter = safeChapter(loaded.book, auth.body.chapter_id);
      const url = approvedContentUrl(chapter.url, loaded.base);
      const pack = await fetchJson(env, url.href, "chapter");
      const data = pack.data;
      if (!data || data.schema !== 1 || data.book_id !== loaded.book.id || Number(data.version) !== Number(loaded.book.version) || String(data.chapter_id) !== String(chapter.id) || !Array.isArray(data.questions)) return response({ error: "chapter_identity_mismatch" }, 409);
      if (data.questions.length !== Number(chapter.questions) || data.questions.length > 20_000) return response({ error: "chapter_count_mismatch" }, 409);
      if ((Number.isSafeInteger(Number(chapter.bytes)) && Number(chapter.bytes) !== pack.bytes) || (/^[a-f0-9]{64}$/i.test(String(chapter.sha256 || "")) && String(chapter.sha256).toLowerCase() !== pack.sha256)) return response({ error: "chapter_integrity_mismatch" }, 409);
      const seen = new Set();
      for (let i = 0; i < data.questions.length; i++) {
        const qid = String(data.questions[i]?.id || "");
        if (!qid || seen.has(qid) || qid !== String(chapter.qids[i])) return response({ error: "chapter_qid_mismatch" }, 409);
        seen.add(qid);
      }
      return response({ ok: true, source_kind: "published", snapshot: { ...loaded.snapshot, chapter_sha256: pack.sha256 }, chapter, pack: data });
    }
    return response({ error: "not_found" }, 404);
  } catch (error) {
    const code = String(error?.message || "export_unavailable").replace(/[^a-z0-9_:-]/gi, "_").slice(0, 80) || "export_unavailable";
    const status = /stale|mismatch|count|identity/.test(code) ? 409 : 503;
    return response({ error: code, ...(error?.upstream ? { diagnostic: error.upstream } : {}) }, status);
  }
}

export { validAuthDate };
