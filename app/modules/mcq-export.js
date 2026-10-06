globalThis.KafuEnhancements.installers.push({ name: "mcq-export", install() {
  "use strict";
  const Core = globalThis.KafuMcqExportCore;
  if (!Core) throw new Error("mcq_export_core_missing");
  const state = {
    session: "", canExport: false, checking: false, active: null, preparing: false,
    error: "", done: 0, total: 0, catalog: null, prepared: null, fallbackText: "", controller: null,
  };
  let run = 0, expiryTimer = null, retryTimer = null, retryAttempt = 0;
  const timeoutSignal = (ms) => typeof globalThis.AbortSignal?.timeout === "function" ? globalThis.AbortSignal.timeout(ms) : undefined;
  /* Telegram can finish attaching WebApp.initData just after the shell has
     evaluated. Read it dynamically so a slow Telegram WebView does not leave
     the owner permanently in the student state until a full reinstall. */
  const telegramWebApp = () => globalThis.Telegram?.WebApp || TG || null;
  const session = () => {
    const webApp = telegramWebApp();
    return webApp?.initData ? String(webApp.initData) : "";
  };
  const current = () => session();
  const escText = (value) => esc(String(value ?? ""));
  const selectedBook = (id) => bookById(id);
  const api = async (path, body, signal) => {
    const controller = signal ? null : new AbortController();
    const r = await fetch("/admin/mcq-export/" + path, {
      method: "POST", cache: "no-store", signal: signal || controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: state.session, ...body }),
    });
    let data = null; try { data = await r.json(); } catch (_) {}
    if (!r.ok) {
      const error = new Error(data?.error || "mcq_export_unavailable");
      error.status = r.status; error.code = data?.error || "mcq_export_unavailable"; error.diagnostic = data?.diagnostic || null;
      throw error;
    }
    return data;
  };
  function readableError(error) {
    const code = String(error?.code || error?.message || "mcq_export_unavailable");
    const d = error?.diagnostic || {};
    const detail = [d.upstream_status ? `HTTP ${d.upstream_status}` : "", d.cf_code ? `CF ${d.cf_code}` : ""].filter(Boolean).join(" · ");
    const suffix = detail ? ` (${detail})` : "";
    if (error?.status === 401 || error?.status === 403 || code === "forbidden") return "Export permission was refused. Reopen Kafu from Telegram and try again.";
    if (/stale_snapshot|catalog changed|content changed/i.test(code)) return "Published content changed while preparing. Reopen the book and retry.";
    if (/catalog_unavailable|book_index_unavailable|chapter_unavailable|fetch_exception/.test(code)) return `Could not reach the published content service. Please retry.${suffix}`;
    if (/redirect/.test(code)) return "Published content returned an unexpected redirect. Export was stopped.";
    if (/invalid_json|invalid|mismatch|count|qid|integrity|incomplete/.test(code)) return "Published content could not be completely verified, so no partial export was created.";
    return "The published export could not be prepared. Please retry.";
  }
  function resetForSession(next) {
    if (state.controller) state.controller.abort();
    if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    state.session = next; state.canExport = false; state.checking = !!next;
    state.active = null; state.preparing = false; state.error = ""; state.catalog = null; state.prepared = null; state.fallbackText = "";
    run += 1; retryAttempt = 0; SHEET = null;
    if (next) {
      const params = typeof URLSearchParams === "function" ? new URLSearchParams(next) : null;
      const rawAuthDate = params?.get("auth_date");
      const authDate = rawAuthDate == null ? NaN : Number(rawAuthDate);
      if (Number.isFinite(authDate)) expiryTimer = setTimeout(() => { if (current() === next) { resetForSession(""); render(); } }, Math.max(0, (authDate + 86400) * 1000 - Date.now() + 1000));
    }
  }
  function ensureSession() {
    const next = current();
    if (next !== state.session) {
      resetForSession(next);
      if (next) probe(next).catch(() => {});
    }
  }
  function scheduleProbe(expected) {
    if (!expected || retryTimer) return;
    const delay = Math.min(30000, 1000 * (2 ** Math.min(retryAttempt++, 5)));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (expected === current() && !state.canExport) probe(expected).catch(() => {});
    }, delay);
  }
  async function probe(expected) {
    let retry = false;
    try {
      const response = await fetch("/admin/capabilities", { method: "POST", cache: "no-store", signal: timeoutSignal(10000), headers: { "content-type": "application/json" }, body: JSON.stringify({ initData: expected, capability: "mcq_export" }) });
      const data = await response.json();
      if (expected !== current()) return;
      state.canExport = response.ok && data.can_export_mcqs === true;
      retry = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
    } catch (_) { if (expected === current()) state.canExport = false; retry = true; }
    if (retry && expected === current() && !state.canExport) scheduleProbe(expected);
    if (expected === current()) { state.checking = false; render(); }
  }
  const previousRender = render;
  render = function (...args) { ensureSession(); return previousRender.apply(this, args); };
  function canExport() { return !!state.session && state.session === current() && state.canExport === true; }
  function control(action, book, chapter, label) {
    const data = ` data-b="${escText(book.id)}"${chapter ? ` data-c="${escText(chapter.id)}"` : ""}`;
    return `<button class="mcq-export-action" data-a="${action}"${data} aria-label="${escText(label)}" title="${escText(label)}">C</button>`;
  }
  function bookControl(book) {
    if (!canExport()) return "";
    return `<div class="mcq-export-book mcq-export-actions"><span class="mcq-export-label">Owner export</span>${control("mcq-export-book", book, null, "Copy whole book MCQs")}</div>`;
  }
  function chapterControl(book, chapter) {
    if (!canExport()) return "";
    return `<span class="mcq-export-actions" style="margin:0 0 0 4px">${control("mcq-export-chapter", book, chapter, "Copy chapter MCQs")}</span>`;
  }
  globalThis.KafuMcqExport = { bookControl, chapterControl };
  function closeSheet() { state.active = null; state.prepared = null; state.fallbackText = ""; if (state.controller) state.controller.abort(); state.controller = null; SHEET = null; render(); }
  function clearError() { state.error = ""; render(); }
  function scopeText() {
    if (!state.active) return "";
    const b = selectedBook(state.active.bookId);
    const ch = b?.chapters?.find((x) => String(x.id) === String(state.active.chapterId));
    return ch ? `${escText(ch.title)} · ID ${escText(ch.id)}` : "Whole book";
  }
  function exportSheet() {
    if (!state.active) return "";
    const b = state.catalog?.book || selectedBook(state.active.bookId);
    const version = b?.version ?? "unknown";
    const expected = state.active.chapterId == null ? Number(b?.questions || 0) : Number(b?.chapters?.find((x) => String(x.id) === String(state.active.chapterId))?.questions || 0);
    const meta = `<div class="export-meta"><div><strong>${escText(b?.title || state.active.bookId)}</strong></div><div>Book ID: ${escText(b?.id || state.active.bookId)} · Version: ${escText(version)}</div><div>Scope: ${scopeText()}</div><div>Expected questions: ${expected.toLocaleString()}</div></div>`;
    let body = meta;
    if (state.preparing) body += `<p class="note" role="status">Preparing published questions… ${state.done} / ${state.total}</p><progress max="${Math.max(1, state.total)}" value="${state.done}"></progress><div class="btns"><button class="btn ghost" data-a="mcq-export-cancel">Cancel</button></div>`;
    else if (state.error) body += `<p class="export-error" role="alert">${escText(state.error)}</p><div class="btns"><button class="btn ghost" data-a="mcq-export-cancel">Close</button><button class="btn" data-a="mcq-export-prepare">Retry</button></div>`;
    else if (!state.prepared) body += `<p class="note">The complete published scope will be checked before copying.</p><div class="btns"><button class="btn ghost" data-a="mcq-export-cancel">Cancel</button><button class="btn" data-a="mcq-export-prepare">Prepare</button></div>`;
    else {
      const p = state.prepared;
      body += `<p class="note" role="status">Validated ${p.count.toLocaleString()} published questions.</p>`;
      if (p.parts.length) body += `<div class="export-parts">${p.parts.map((part, i) => `<button class="btn" data-a="mcq-export-copy" data-part="${i}">Copy part ${i + 1} of ${p.parts.length}</button>`).join("")}</div><div class="btns"><button class="btn" data-a="mcq-export-copy-complete">Copy complete file</button><button class="btn ghost" data-a="mcq-export-download-complete">Download complete JSON</button></div>`;
      else body += `<div class="btns"><button class="btn" data-a="mcq-export-copy">Copy text</button><button class="btn ghost" data-a="mcq-export-download-complete">Download JSON</button></div>`;
      if (state.fallbackText) body += `<p class="note">Clipboard access was unavailable. Select all and copy manually, or download the identical JSON.</p><textarea id="mcq-export-fallback" readonly aria-label="Prepared MCQ JSON">${escText(state.fallbackText)}</textarea><div class="btns"><button class="btn ghost" data-a="mcq-export-select-all">Select all</button><button class="btn ghost" data-a="mcq-export-download-fallback">Download selected JSON</button></div>`;
    }
    return `<div class="scrim" data-a="mcq-export-close"><div class="sheet mcq-export-sheet" role="dialog" aria-modal="true" aria-label="Copy MCQs for AI" data-stop="1"><h4>Copy MCQs for AI</h4>${body}</div></div>`;
  }
  function open(bookId, chapterId = null) {
    if (!canExport()) return;
    const b = selectedBook(bookId); if (!b) return;
    state.active = { bookId, chapterId }; state.preparing = false; state.error = ""; state.catalog = null; state.prepared = null; state.fallbackText = ""; SHEET = exportSheet; render();
  }
  function cancel() { state.active = null; state.preparing = false; state.prepared = null; state.fallbackText = ""; state.error = ""; if (state.controller) state.controller.abort(); state.controller = null; SHEET = null; render(); }
  function validateCatalog(data, active) {
    if (data?.source_kind !== "published" || data?.snapshot?.catalog_sha256 == null) throw new Error("Published catalog could not be verified.");
    const b = data.book;
    if (!b || String(b.id) !== String(active.bookId) || Number(b.version) !== Number(selectedBook(active.bookId)?.version)) throw new Error("The book catalog changed. Reopen the book and try again.");
    if (!Array.isArray(b.chapters) || !b.chapters.length || String(b.id).startsWith("SAMPLE")) throw new Error("This is not a published book; sample content cannot be exported.");
    return b;
  }
  function validateChapter(data, book, chapter) {
    const pack = data?.pack;
    if (!pack || pack.book_id !== book.id || Number(pack.version) !== Number(book.version) || String(pack.chapter_id) !== String(chapter.id) || !Array.isArray(pack.questions)) throw new Error(`Published chapter ${chapter.id} is inconsistent.`);
    const expectedIds = Array.isArray(chapter.qids) ? chapter.qids.map(String) : [];
    if (pack.questions.length !== Number(chapter.questions || 0) || expectedIds.length !== pack.questions.length) throw new Error(`Chapter ${chapter.id} is incomplete.`);
    const seen = new Set();
    for (let i = 0; i < pack.questions.length; i++) {
      const q = pack.questions[i]; const id = String(q?.id || "");
      if (!id || seen.has(id) || id !== expectedIds[i]) throw new Error(`Chapter ${chapter.id} has a missing or duplicate QID.`);
      seen.add(id);
    }
    return pack;
  }
  async function prepare() {
    if (!state.active || !canExport() || state.preparing) return;
    const active = { ...state.active }, serial = ++run;
    state.preparing = true; state.error = ""; state.prepared = null; state.fallbackText = ""; state.done = 0; state.total = 0; state.controller = new AbortController(); render();
    try {
      const catalog = await api("catalog", { book_id: active.bookId, version: Number(selectedBook(active.bookId)?.version) }, state.controller.signal);
      if (serial !== run || !state.active) return;
      const book = validateCatalog(catalog, active);
      const chapters = active.chapterId == null ? book.chapters.slice() : book.chapters.filter((x) => String(x.id) === String(active.chapterId));
      if (chapters.length !== (active.chapterId == null ? book.chapters.length : 1)) throw new Error("Selected chapter is no longer published.");
      state.catalog = catalog; state.total = chapters.length; render();
      const packs = new Map(); const chapterHashes = new Map(); let cursor = 0;
      const worker = async () => {
        while (true) {
          const index = cursor++; if (index >= chapters.length) return;
          const chapter = chapters[index];
          const result = await api("chapter", { book_id: book.id, version: Number(book.version), chapter_id: chapter.id, catalog_sha256: catalog.snapshot.catalog_sha256 }, state.controller.signal);
          if (result.snapshot?.catalog_sha256 !== catalog.snapshot.catalog_sha256) throw new Error("Published content changed while preparing; retry.");
          packs.set(String(chapter.id), validateChapter(result, book, chapter));
          chapterHashes.set(String(chapter.id), result.snapshot?.chapter_sha256 || null);
          state.done += 1; render();
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, chapters.length) }, worker));
      const allIds = new Set(); for (const chapter of chapters) for (const q of packs.get(String(chapter.id)).questions) { if (allIds.has(q.id)) throw new Error("Duplicate QID across chapters."); allIds.add(q.id); }
      const expected = chapters.reduce((sum, chapter) => sum + Number(chapter.questions || 0), 0);
      if (allIds.size !== expected || allIds.size !== Number(active.chapterId == null ? book.questions : chapters[0].questions)) throw new Error("Complete export validation failed; no partial text was kept.");
      const source = { catalog_url: catalog.snapshot.catalog_url, catalog_sha256: catalog.snapshot.catalog_sha256, index_sha256: catalog.snapshot.index_sha256 || null, chapters: chapters.map((chapter) => ({ chapter_id: chapter.id, url: chapter.url, image_url: chapter.image_url || null, sha256: chapterHashes.get(String(chapter.id)) || null })) };
      const object = await Core.buildExport({ book, bookIndex: catalog.book_index || null, chapters, chapterPacks: packs, source, scope: active, exportedAt: new Date().toISOString() });
      const split = Core.partitionExport(object);
      state.prepared = { object, completeText: split.completeText, parts: split.parts, count: expected };
      state.preparing = false; state.controller = null; render();
    } catch (error) {
      if (serial !== run) return;
      state.preparing = false; state.controller = null;
      if (error?.name === "AbortError") return;
      if (error?.status === 401 || error?.status === 403) { state.canExport = false; state.active = null; SHEET = null; render(); return; }
      state.error = readableError(error); render();
    }
  }
  function chosenText(part) { return part == null ? state.prepared?.completeText : state.prepared?.parts?.[Number(part)]?.text; }
  function copyText(text, count) {
    if (!text) return;
    if (!navigator.clipboard?.writeText) { state.fallbackText = text; render(); return; }
    /* This call is deliberately made synchronously by the final click handler. */
    navigator.clipboard.writeText(text).then(() => toast(`Copied ${count.toLocaleString()} questions.`)).catch(() => { state.fallbackText = text; render(); });
  }
  function download(text, suffix) {
    if (!text) return;
    const b = state.catalog?.book || selectedBook(state.active?.bookId); const name = Core.filename(`${b?.id || "mcqs"}-v${b?.version || "export"}-${suffix}`);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = name + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  ACTIONS["mcq-export-book"] = (data) => open(data.b);
  ACTIONS["mcq-export-chapter"] = (data) => open(data.b, data.c);
  ACTIONS["mcq-export-prepare"] = () => prepare();
  ACTIONS["mcq-export-cancel"] = () => cancel();
  ACTIONS["mcq-export-clear-error"] = () => clearError();
  ACTIONS["mcq-export-copy"] = (data) => copyText(chosenText(data.part), state.prepared?.parts?.length ? state.prepared.parts[Number(data.part)]?.object?.questions?.length : state.prepared?.count || 0);
  ACTIONS["mcq-export-copy-complete"] = () => copyText(chosenText(null), state.prepared?.count || 0);
  ACTIONS["mcq-export-download-complete"] = () => download(chosenText(null), "complete");
  ACTIONS["mcq-export-download-fallback"] = () => download(state.fallbackText, "selected");
  ACTIONS["mcq-export-select-all"] = () => { const field = document.getElementById("mcq-export-fallback"); field?.focus(); field?.select(); };
  ACTIONS["mcq-export-close"] = (data, el, event) => { if (event?.target?.closest?.("[data-stop]")) return; closeSheet(); };
  const oldClose = ACTIONS["close-sheet"];
  ACTIONS["close-sheet"] = (...args) => { if (state.active) closeSheet(); else oldClose?.(...args); };
  const refreshSession = () => {
    const next = current();
    if (next !== state.session) { ensureSession(); render(); return; }
    if (next && !state.canExport && !state.checking) probe(next).catch(() => {});
  };
  document.addEventListener("visibilitychange", refreshSession);
  window.addEventListener("focus", refreshSession);
  resetForSession(current());
  if (state.session) probe(state.session).catch(() => {});
  /* Cover Telegram clients that populate initData immediately after ready(). */
  [250, 1000, 3000].forEach((delay) => setTimeout(refreshSession, delay));
}});
