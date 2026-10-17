import { meterDatabase, logD1Request } from './d1-metrics.mjs';
// Kafu control plane. Heavy publishing work stays in GitHub Actions.
import { parsePackageName, queueDocument, retryGroup, clearGroup } from "./queue-state.mjs";
import { looksMotioncardsFilename, parseMotioncardsName, queueMotioncardsDocument, claimMotioncards, finishMotioncards, finishMotioncardsOperation, recoverMotioncards, motioncardsStatus, hasReadyMotioncards, stageReplacementConfirmation, getMotioncardManagement, createMotioncardConfirmation, confirmMotioncardAction } from "./motioncards-queue.mjs";
import { looksCommentsFilename, queueCommentsDocument, commentsCommand, commentsBookView, commentsCallback, claimComments, finishComments, commentJobKey } from "./comments-queue.mjs";
import { handleLeaderboard } from "./leaderboard.mjs";
import { handleAdmin } from "./admin.mjs";
export { parsePackageName, retryGroup, clearGroup, parseMotioncardsName };
const ID = /^[A-Z0-9][A-Z0-9-]*$/;
const QID = /^Q\d{9}$/;

function reply(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status, headers: { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json", "cache-control": "no-store" },
  });
}
function safeText(env, value) {
  let text = String(value || "");
  for (const key of ["BOT_TOKEN", "QUEUE_API_TOKEN", "WEBHOOK_SECRET", "DISPATCH_TOKEN", "CLOUDFLARE_API_TOKEN"]) {
    const secret = String(env[key] || "");
    if (secret.length >= 4) text = text.split(secret).join("<redacted>");
  }
  return text.replace(/(\/(?:file\/)?bot)[^/\s]+\//g, "$1<redacted>/")
    .replace(/(Bearer|Basic)\s+[^\s"'<>]+/gi, "$1 <redacted>")
    .replace(/(https?:\/\/[^\s?"']+)\?[^\s"']+/g, "$1");
}
async function telegram(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json", "user-agent": "kafu-bot/1.0" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram ${method}: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${safeText(env, data.description || "failed")}`);
  return data.result;
}
async function message(env, text, extra = {}) {
  return telegram(env, "sendMessage", { chat_id: env.OWNER_TELEGRAM_ID, text: safeText(env, text).slice(0, 4000), ...extra });
}
function bookTables(env, books) {
  if (!books.length) return { book_pages: ["📚 لا توجد كتب متاحة حاليًا."] };
  const escape = value => safeText(env, value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const header = `📚 <b>الكتب المتاحة: ${books.length}</b>\nVer. الإصدار • MCQs الأسئلة • Ch. الفصول\n\n`;
  const pages = []; let page = header;
  books.forEach((book, index) => {
    const id = String(book.id || book.book_id || "").slice(0, 255);
    const title = String(book.title || id).slice(0, 400);
    const chapters = Array.isArray(book.chapters) ? book.chapters.length : book.chapters || 0;
    const row = `v${book.version}`.padEnd(5) + "│ " + String(book.questions || 0).padStart(6) + " │ " + String(chapters).padStart(3);
    const block = `📖 <b>${index + 1}. ${escape(title)}</b>\n` +
      (title !== id ? `<code>${escape(id)}</code>\n` : "") +
      `<pre>Ver. │   MCQs │ Ch.\n─────┼────────┼────\n${escape(row)}</pre>\n\n`;
    if (page.length + block.length > 3500) { pages.push(page.trimEnd()); page = header; }
    page += block;
  });
  pages.push(page.trimEnd());
  return { book_pages: pages };
}
async function dispatch(env) {
  const repo = env.GITHUB_REPOSITORY || "blsmohamme972-lab/MCQs-Mountain-";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid GitHub repository");
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-queue.yml/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${env.DISPATCH_TOKEN}`, accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28", "user-agent": "kafu-publish-queue" }, body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch: ${res.status}`);
}
async function dispatchMotioncards(env) {
  const repo = env.GITHUB_REPOSITORY || "blsmohamme972-lab/MCQs-Mountain-";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Invalid GitHub repository");
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/publish-motioncards-queue.yml/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${env.DISPATCH_TOKEN}`, accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28", "user-agent": "kafu-motioncards-queue" }, body: JSON.stringify({ ref: "main" }),
  });
  if (res.status !== 204) throw new Error(`GitHub MotionCards dispatch: ${res.status}`);
}
async function adminJob(env, kind, bookId, version = null) {
  if (!ID.test(bookId || "") || (version !== null && (!Number.isSafeInteger(version) || version < 1)))
    return "❌ Invalid book ID or version.";
  await env.DB.prepare("INSERT INTO admin_jobs(kind,book_id,version,status) VALUES(?,?,?,'ready')").bind(kind, bookId, version).run();
  return `📥 ${kind} queued for ${bookId}${version ? ` v${version}` : ""}`;
}
async function bookForQuestion(env, qid) {
  const base = env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev";
  const response = await fetch(`${base}/routes/${qid.slice(0, 7)}.json`, { cache: "no-store", headers: {"user-agent":"kafu-bot/1.0"} });
  if (!response.ok) return null;
  return (await response.json()).routes?.[qid]?.book_id || null;
}
async function command(env, raw) {
  const [cmd, arg, arg2, arg3] = raw.trim().split(/\s+/);
  switch (cmd.toLowerCase().split("@")[0]) {
    case "/help": return "/queue /books /status /warnings BOOK-ID /flags [/flags approve-all BOOK-ID CONFIRM] /hold QID PAGE /retry BOOK-ID_vN /clear BOOK-ID_vN /republish BOOK-ID_vN /rollback BOOK-ID VERSION /remove BOOK-ID /motioncards QID /motioncards-status /motioncards-retry PACKAGE-ID_rN /motioncards-clear PACKAGE-ID_rN — retry renews an expired replacement confirmation; clear cancels a pending replacement. Comments: send COMMENTS_BOOK-ID_rN.zip, then /comments [BOOK-ID] /comments-retry COMMENTS_BOOK-ID_rN /comments-restore BOOK-ID rN /comments-off BOOK-ID";
    case "/queue": {
      const r = await env.DB.prepare("SELECT group_key,status,part_total,error_summary FROM publish_groups ORDER BY created_at DESC LIMIT 15").all();
      const a = await env.DB.prepare("SELECT kind,book_id,status,error_summary FROM admin_jobs ORDER BY id DESC LIMIT 5").all();
      const c = await env.DB.prepare("SELECT action,book_id,revision,status,error_summary FROM comment_jobs ORDER BY id DESC LIMIT 5").all();
      return [...(r.results || []).map(x => `${x.group_key}: ${x.status}${x.error_summary ? ` — ${safeText(env, x.error_summary)}` : ""}`),
        ...(a.results || []).map(x => `${x.kind} ${x.book_id}: ${x.status}${x.error_summary ? ` — ${safeText(env, x.error_summary)}` : ""}`),
        ...(c.results || []).map(x => `${commentJobKey(x)}: ${x.status}${x.error_summary ? ` — ${safeText(env, x.error_summary)}` : ""}`)].join("\n") || "Queue empty.";
    }
    case "/books": {
      try {
        const response = await fetch((env.CONTENT_BASE || "https://kafu-content-1.blsmohamme97.workers.dev") + "/catalog.json", { cache: "no-store", headers: {"user-agent":"kafu-bot/1.0"} });
        if (response.ok) {
          const c = await response.json();
          return bookTables(env, c.books || []);
        }
      } catch (e) {}
      const r = await env.DB.prepare("SELECT book_id,version,questions,chapters FROM published_books WHERE active=1 ORDER BY book_id LIMIT 50").all();
      return bookTables(env, r.results || []);
    }
    case "/status": {
      const r = await env.DB.prepare("SELECT status,COUNT(*) AS n FROM publish_groups GROUP BY status").all();
      return `Kafu queue: ${(r.results || []).map(x => `${x.status} ${x.n}`).join(", ") || "empty"}.`;
    }
    case "/warnings": {
      const bookId = String(arg || "").toUpperCase();
      if (!ID.test(bookId)) return "Usage: /warnings BOOK-ID";
      const r = await env.DB.prepare(
        "SELECT qid,version,local_id,source_page,reason FROM publish_warnings WHERE book_id=? ORDER BY version DESC,local_id LIMIT 100"
      ).bind(bookId).all();
      if (!r.results?.length) return `No recorded publish warnings for ${bookId}.`;
      return r.results.map(x =>
        `${x.qid} — v${x.version}, local ${x.local_id}, page ${x.source_page ?? "unknown"} — ${x.reason}`
      ).join("\n");
    }
    case "/flags": {
      if ((arg || "").toLowerCase() === "approve-all") {
        const bookId = String(arg2 || "").toUpperCase();
        if (!ID.test(bookId)) return "Usage: /flags approve-all BOOK-ID CONFIRM";
        const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM flags WHERE book_id=? AND status='pending'").bind(bookId).first();
        const count = Number(pending?.n || 0);
        if (!count) return `No pending audit warnings for ${bookId}.`;
        if (arg3 !== "CONFIRM") {
          return `⚠️ Approve all ${count} pending audit warnings for ${bookId}? Re-run exactly: /flags approve-all ${bookId} CONFIRM`;
        }
        const changed = await env.DB.prepare("UPDATE flags SET status='approved' WHERE book_id=? AND status='pending'").bind(bookId).run();
        const approved = Number(changed?.meta?.changes || 0);
        if (!approved) return `No pending audit warnings for ${bookId}.`;
        await env.DB.prepare("INSERT INTO admin_jobs(kind,book_id,version,status) VALUES('moderate',?,NULL,'ready')").bind(bookId).run();
        return `📥 approved ${approved} audit warnings for ${bookId}; moderation publish queued.`;
      }
      const r = await env.DB.prepare("SELECT qid,source_page FROM flags WHERE status='pending' ORDER BY created_at LIMIT 10").all();
      if (!r.results?.length) return "No pending flags.";
      return r.results.map(x => `${x.qid} — source page ${x.source_page ?? "unknown"}`).join("\n") + "\nUse /flags QID for actions, or /flags approve-all BOOK-ID to review a bulk approval.";
    }
    case "/hold": {
      const page = Number(arg2);
      if (!QID.test(arg || "") || !Number.isSafeInteger(page) || page < 1) return "Usage: /hold Q000000001 PAGE";
      const bookId = await bookForQuestion(env, arg);
      if (!bookId) return "❌ Question route not found.";
      await env.DB.prepare("INSERT INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending') ON CONFLICT(qid) DO UPDATE SET status='pending',source_page=excluded.source_page")
        .bind(arg, bookId, page).run();
      await adminJob(env, "moderate", bookId);
      return `📥 held ${arg}; moderation publish queued. Use /flags ${arg} to review.`;
    }
    case "/retry": return (await retryGroup(env, arg)).text;
    case "/clear": return (await clearGroup(env, arg)).text;
    case "/republish": {
      const p = parsePackageName(`${arg || ""}.zip`);
      if (!p || p.total !== 1) return "Usage: /republish BOOK-ID_vN";
      const changed = await env.DB.prepare("UPDATE publish_groups SET status='ready',force_republish=1,error_summary=NULL,claimed_at=NULL,finished_at=NULL WHERE group_key=? AND status IN ('failed','published') RETURNING group_key").bind(p.group_key).first();
      return changed ? `📥 republish requested: ${p.group_key}` : "❌ No completed upload found for that release.";
    }
    case "/rollback": return arg && arg2 ? adminJob(env, "rollback", arg.toUpperCase(), Number(arg2)) : "Usage: /rollback BOOK-ID VERSION";
    case "/remove": return arg ? adminJob(env, "remove", arg.toUpperCase()) : "Usage: /remove BOOK-ID";
    case "/comments": case "/comments-retry": case "/comments-restore": case "/comments-off":
      return commentsCommand(env, cmd.toLowerCase().split("@")[0], arg, arg2, arg3, value => safeText(env, value));
    case "/motioncards-status": return motioncardsStatus(env);
    case "/motioncards-retry": return recoverMotioncards(env,"retry",arg);
    case "/motioncards-clear": return recoverMotioncards(env,"clear",arg);
    default: return "Use /help for admin commands.";
  }
}
async function motioncardsOwnerMessage(env,qid){
  const info=await getMotioncardManagement(env,qid);
  if(!info)return{ text:"No published Kafu MotionCards record found for "+qid+".", reply_markup:null };
  const card=info.card,active=Number(card.active)===1,pending=info.pending_replacement;
  const prior=(info.versions||[]).find(v=>!active||v.entry_sha256!==card.entry_sha256);
  const lines=[
    "🎞 Kafu MotionCards",
    "Book: "+card.book_id+" v"+card.book_version,
    "Chapter: "+card.chapter_id,
    "QID: "+card.qid,
    "Status: "+(active?"Published":"Removed from students"),
    "Revision: "+card.package_id+" r"+card.package_revision,
    "Duration: "+card.duration_ms+" ms"
  ];
  if(pending)lines.push("Pending replacement: "+pending.group_key+" — confirmation required/expired");
  const buttons=[];
  if(active)buttons.push([{text:"Preview",url:"https://kafu.blsmohamme97.workers.dev/?motioncards_preview="+encodeURIComponent(card.qid)}]);
  buttons.push([{text:"Replace",callback_data:"mcreplace:"+card.qid},{text:active?"Remove from students":"Removed",callback_data:active?"mcremove:"+card.qid:"mcnoop"}]);
  if(prior)buttons.push([{text:"Restore previous compatible version",callback_data:"mcrestore:"+card.qid+":"+prior.version_id}]);
  if(pending)buttons.push([{text:"Renew confirmation",callback_data:"mcrenew:"+card.qid},{text:"Cancel replacement",callback_data:"mccancel:"+card.qid}]);
  return{text:lines.join("\n"),reply_markup:{inline_keyboard:buttons}};
}
async function callback(env, cb) {
  const data=String(cb.data||"");
  const comments=await commentsCallback(env,data);
  if(comments){
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:comments.answer});
    await message(env,comments.text,comments.reply_markup?{reply_markup:comments.reply_markup}:{});
    return{dispatchBooks:!!comments.dispatch};
  }
  if(data==="mcnoop"){await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:"This card is already removed."});return{};}
  if(data.startsWith("mcrenew:")||data.startsWith("mccancel:")){
    const renew=data.startsWith("mcrenew:"),qid=data.slice(data.indexOf(":")+1);
    if(!QID.test(qid))return{};
    const info=await getMotioncardManagement(env,qid),pending=info?.pending_replacement;
    if(!pending){await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:"No pending replacement for this card.",show_alert:true});return{};}
    const result=await recoverMotioncards(env,renew?"renew":"cancel",pending.group_key);
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:result.ok?(renew?"Renewal queued":"Replacement cancelled"):"Not changed",show_alert:!result.ok});
    await message(env,result.text);
    return{dispatchMotioncards:!!result.dispatch};
  }
  if(data.startsWith("mcreplace:")){
    const qid=data.slice("mcreplace:".length);
    if(!QID.test(qid))return{};
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:"Replacement mode"});
    await message(env,"Create a replacement ZIP containing only the intended MotionCard(s), then upload it here. Kafu will validate it and show the exact cards/revision being replaced before activation. No manual hash or database editing is required.");
    return{};
  }
  if(data.startsWith("mcremove:")){
    const qid=data.slice("mcremove:".length),x=await createMotioncardConfirmation(env,"remove",qid);
    if(!x.ok){await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:x.error,show_alert:true});return{};}
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:"Confirm removal"});
    await message(env,"Remove "+qid+" from students? This is reversible; the previous bytes/history remain recoverable.",{reply_markup:{inline_keyboard:[[{text:"Confirm remove",callback_data:"mcconfirm:"+x.token}]]}});
    return{};
  }
  if(data.startsWith("mcrestore:")){
    const parts=data.split(":"),qid=parts[1],versionId=Number(parts[2]),x=await createMotioncardConfirmation(env,"restore",qid,versionId);
    if(!x.ok){await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:x.error,show_alert:true});return{};}
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:"Confirm restore"});
    await message(env,"Restore the selected compatible prior MotionCard for "+qid+"? The current published question binding will be revalidated before activation.",{reply_markup:{inline_keyboard:[[{text:"Confirm restore",callback_data:"mcconfirm:"+x.token}]]}});
    return{};
  }
  if(data.startsWith("mcconfirm:")){
    const result=await confirmMotioncardAction(env,data.slice("mcconfirm:".length));
    await telegram(env,"answerCallbackQuery",{callback_query_id:cb.id,text:result.ok?"Confirmed":"Not confirmed",show_alert:!result.ok});
    await message(env,result.text);
    return{dispatchMotioncards:!!result.dispatch};
  }
  const m = /^(approve|reject|source):Q\d{9}$/.exec(data);
  if (!m) return{};
  const qid = data.slice(data.indexOf(":") + 1);
  const row = await env.DB.prepare("SELECT book_id,source_page FROM flags WHERE qid=?").bind(qid).first();
  if (!row) return{};
  if (m[1] === "source") {
    await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `Source page: ${row.source_page ?? "unknown"}`, show_alert: true });
    return{};
  }
  await env.DB.prepare("UPDATE flags SET status=? WHERE qid=?").bind(m[1] === "approve" ? "approved" : "rejected", qid).run();
  await adminJob(env, "moderate", row.book_id);
  await telegram(env, "answerCallbackQuery", { callback_query_id: cb.id, text: `${qid}: ${m[1]}` });
  return{dispatchBooks:/^(approve|reject)$/.test(m[1])};
}
async function webhook(request, env, ctx) {
  if (!env.WEBHOOK_SECRET || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return reply("Forbidden", 403);
  const update = await request.json();
  const cb = update.callback_query, m = update.message;
  const actor = cb?.from || m?.from, chat = cb?.message?.chat || m?.chat;
  if (!actor || String(actor.id) !== String(env.OWNER_TELEGRAM_ID) || chat?.type !== "private" || String(chat.id) !== String(env.OWNER_TELEGRAM_ID)) return reply("OK");
  if (cb) {
    const action=await callback(env, cb);
    if(action?.dispatchMotioncards)ctx.waitUntil(dispatchMotioncards(env).catch(e=>message(env,`⚠️ MotionCards queued, but Action dispatch failed: ${safeText(env,e.message)}`)));
    else if(action?.dispatchBooks)ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${safeText(env, e.message)}`)));
    return reply("OK");
  }
  let text, dispatchKind = null, motioncardsHandled = false;
  if (m.document) {
    if (looksCommentsFilename(m.document.file_name)) text = await queueCommentsDocument(env, m.document);
    else if (looksMotioncardsFilename(m.document.file_name)) {
      motioncardsHandled = true;
      const result = await queueMotioncardsDocument(env, m.document);
      text = result.text; if (result.dispatch) dispatchKind = "motioncards";
    } else text = await queueDocument(env, m.document);
  } else if (m.text?.startsWith("/")) {
    const parts = m.text.trim().split(/\s+/);
    if (parts[0].toLowerCase().split("@")[0] === "/motioncards") {
      const qid=String(parts[1]||"").toUpperCase();
      if(!QID.test(qid)){await message(env,"Usage: /motioncards Q000000001");return reply("OK");}
      const view=await motioncardsOwnerMessage(env,qid);
      await message(env,view.text,view.reply_markup?{reply_markup:view.reply_markup}:{});
      return reply("OK");
    }
    if (parts[0].toLowerCase().split("@")[0] === "/comments" && parts[1]) {
      const view = await commentsBookView(env, parts[1]);
      await message(env, view.text, view.reply_markup ? { reply_markup: view.reply_markup } : {});
      return reply("OK");
    }
    if (parts[0].toLowerCase().split("@")[0] === "/flags" && QID.test(parts[1] || "")) {
      const x = await env.DB.prepare("SELECT qid,source_page,status FROM flags WHERE qid=?").bind(parts[1]).first();
      if (x) {
        await message(env, `${x.qid}: ${x.status}; source page ${x.source_page ?? "unknown"}`, { reply_markup: { inline_keyboard: [[
          { text: "Approve", callback_data: `approve:${x.qid}` }, { text: "Reject", callback_data: `reject:${x.qid}` }, { text: "Show source page", callback_data: `source:${x.qid}` },
        ]] } });
        return reply("OK");
      }
    }
    const result = await command(env, m.text);
    if (result && typeof result === "object" && !result.book_pages) {
      text = result.text; if (result.dispatch) dispatchKind = "motioncards";
    } else text = result;
  } else return reply("OK");
  if (text.book_pages) {
    for (const page of text.book_pages) await message(env, page, { parse_mode: "HTML" });
    return reply("OK");
  }
  await message(env, text);
  if (dispatchKind === "motioncards") ctx.waitUntil(dispatchMotioncards(env).catch(e => message(env, `⚠️ MotionCards queued, but Action dispatch failed: ${safeText(env, e.message)}`)));
  else if (!motioncardsHandled && text.startsWith("📥") && !text.includes("already received")) ctx.waitUntil(dispatch(env).catch(e => message(env, `⚠️ Queued, but Action dispatch failed: ${safeText(env, e.message)}`)));
  return reply("OK");
}
async function tokenFingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("").slice(0, 8);
}
async function queueAuthorization(request, env) {
  const expected = String(env.QUEUE_API_TOKEN || "").trim(), header = request.headers.get("Authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const [expectedHash, presentedHash] = await Promise.all([tokenFingerprint(expected), tokenFingerprint(presented)]);
  console.log(`[queue-auth] expected_len=${expected.length} expected_sha256_8=${expectedHash} presented_len=${presented.length} presented_sha256_8=${presentedHash} header='Authorization' scheme='Bearer'`);
  return expected.length > 0 && header.startsWith("Bearer ") && presented === expected;
}
async function internal(request, env, path) {
  if (!(await queueAuthorization(request, env))) return reply({ error: "bad_queue_token" }, 403);
  if (request.method !== "POST") return reply("Method not allowed", 405);
  if (path === "/internal/motioncards/claim") return reply(await claimMotioncards(env));
  if (path === "/internal/motioncards/has-ready") return reply(await hasReadyMotioncards(env));
  if (path === "/internal/motioncards/finish") {
    const body = await request.json();
    const result = body.operation_id ? await finishMotioncardsOperation(env,body) : await finishMotioncards(env, body);
    return reply(result.ok ? { ok: true } : { error: result.error }, result.status);
  }
  if (path === "/internal/motioncards/candidate") {
    const body=await request.json(),result=await stageReplacementConfirmation(env,body);
    if(!result.ok)return reply({error:result.error},result.status);
    const targets=result.targets.map(x=>x.qid+" — active "+x.expected_active_package_id+" r"+x.expected_active_package_revision).join("\n");
    let notification_sent=true;
    try{
      await message(env,"⚠️ Replacement candidate "+result.group_key+" passed validation and would replace:\n"+targets+"\nConfirm only if these are the intended cards. If this notice is missed, use /motioncards QID to renew or cancel.",{reply_markup:{inline_keyboard:[[{text:"Confirm replacement",callback_data:"mcconfirm:"+result.token}]]}});
    }catch(error){notification_sent=false;console.warn("MotionCards replacement confirmation notification failed:",safeText(env,error?.message||error));}
    return reply({ok:true,token:result.token,notification_sent});
  }
  if (path === "/internal/motioncards/recover") {
    const body = await request.json();
    if (!["retry","clear"].includes(body.action)) return reply({ error: "invalid_recovery_action" }, 400);
    const result = await recoverMotioncards(env, body.action, String(body.group_key || ""));
    if (result.ok && body.action === "retry" && body.dispatch !== false) await dispatchMotioncards(env);
    return reply(result, result.ok ? 200 : 409);
  }
  if (path === "/internal/motioncards/notify") {
    const body = await request.json();
    await message(env, String(body.text || "").slice(0, 3500));
    return reply({ ok: true });
  }
  if (path === "/internal/claim") {
    const group = await env.DB.prepare("UPDATE publish_groups SET status='running',claimed_at=datetime('now'),attempts=attempts+1 WHERE group_key=(SELECT g.group_key FROM publish_groups g JOIN publish_queue q ON q.group_key=g.group_key WHERE g.status='ready' GROUP BY g.group_key ORDER BY MIN(q.job_id) LIMIT 1) AND status='ready' RETURNING *").first();
    if (group) {
      const parts = await env.DB.prepare("SELECT * FROM publish_queue WHERE group_key=? ORDER BY part_index").bind(group.group_key).all();
      return reply({ kind: "publish", group, parts: parts.results || [] });
    }
    const job = await env.DB.prepare("UPDATE admin_jobs SET status='running',claimed_at=datetime('now') WHERE id=(SELECT id FROM admin_jobs WHERE status='ready' ORDER BY created_at,id LIMIT 1) AND status='ready' RETURNING *").first();
    if (job) return reply({ kind: "admin", job });
    // Comment packs come last, so a book uploaded together with its comments is published first.
    const comments = await claimComments(env);
    return reply(comments ? { kind: "comments", job: comments } : { kind: "empty" });
  }
  const body = await request.json();
  if (path === "/internal/recover") {
    if (!["retry", "clear"].includes(body.action)) return reply({ error: "invalid_recovery_action" }, 400);
    const result = body.action === "clear" ? await clearGroup(env, String(body.group_key || "")) : await retryGroup(env, String(body.group_key || ""));
    if (result.ok && body.clear_failed_admin_book === true) await env.DB.prepare("DELETE FROM admin_jobs WHERE book_id=? AND status='failed'").bind(result.book_id).run();
    if (result.ok && body.dispatch !== false && body.action === "retry") await dispatch(env);
    return reply(result, result.ok ? 200 : 409);
  }
  if (path === "/internal/finish") {
    const status = body.ok ? "published" : "failed", error = body.ok ? null : safeText(env, body.error).slice(0, 400);
    if (body.kind === "publish") {
      const group = await env.DB.prepare("SELECT book_id,version,status FROM publish_groups WHERE group_key=?").bind(body.group_key).first();
      if (!group || group.status !== "running") return reply({ error: "job_not_running" }, 409);
      if (body.ok && (body.book_id !== group.book_id || body.version !== group.version)) return reply({ error: "job_identity_mismatch" }, 400);
      const writes = [];
      if (body.ok) {
        const counts = [body.questions, body.chapters, body.images, body.skipped, body.held].map(x => x || 0);
        if (!counts.every(x => Number.isSafeInteger(x) && x >= 0)) return reply({ error: "invalid_counts" }, 400);
        writes.push(env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=? AND EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='running')").bind(group.book_id, body.group_key));
        writes.push(env.DB.prepare("INSERT INTO published_books(book_id,version,questions,chapters,images,skipped,held,active) SELECT ?,?,?,?,?,?,?,1 WHERE EXISTS(SELECT 1 FROM publish_groups WHERE group_key=? AND status='running') ON CONFLICT(book_id,version) DO UPDATE SET questions=excluded.questions,chapters=excluded.chapters,images=excluded.images,skipped=excluded.skipped,held=excluded.held,active=1").bind(group.book_id, group.version, ...counts, body.group_key));
      }
      writes.push(env.DB.prepare("UPDATE publish_groups SET status=?,finished_at=datetime('now'),error_summary=? WHERE group_key=? AND status='running'").bind(status, error, body.group_key));
      const results = await env.DB.batch(writes);
      if (!results.at(-1)?.meta?.changes) return reply({ error: "job_not_running" }, 409);
    } else if (body.kind === "admin") {
      const job = await env.DB.prepare("SELECT * FROM admin_jobs WHERE id=?").bind(body.id).first();
      if (!job || job.status !== "running") return reply({ error: "job_not_running" }, 409);
      if (body.ok && (body.book_id !== job.book_id || body.operation !== job.kind || (job.kind === "rollback" && body.version !== job.version))) return reply({ error: "job_identity_mismatch" }, 400);
      const writes = [];
      if (body.ok && job.kind === "remove") writes.push(env.DB.prepare("UPDATE published_books SET active=0 WHERE book_id=? AND EXISTS(SELECT 1 FROM admin_jobs WHERE id=? AND status='running')").bind(job.book_id, job.id));
      if (body.ok && job.kind === "rollback") writes.push(env.DB.prepare("UPDATE published_books SET active=(version=?) WHERE book_id=? AND EXISTS(SELECT 1 FROM admin_jobs WHERE id=? AND status='running')").bind(job.version, job.book_id, job.id));
      writes.push(env.DB.prepare("UPDATE admin_jobs SET status=?,finished_at=datetime('now'),error_summary=? WHERE id=? AND status='running'").bind(status, error, job.id));
      const results = await env.DB.batch(writes);
      if (!results.at(-1)?.meta?.changes) return reply({ error: "job_not_running" }, 409);
    } else if (body.kind === "comments") {
      const result = await finishComments(env, body, error);
      if (!result.ok) return reply({ error: result.error }, result.status);
    } else return reply("Invalid kind", 400);
    return reply({ ok: true });
  }
  if (path === "/internal/notify") { await message(env, String(body.text || "").slice(0, 3500)); return reply({ ok: true }); }
  if (path === "/internal/decisions") {
    const r = await env.DB.prepare("SELECT qid,status FROM flags WHERE book_id=?").bind(body.book_id).all();
    return reply(Object.fromEntries((r.results || []).map(x => [x.qid, x.status === "approved" ? "approved" : "rejected"])));
  }
  if (path === "/internal/flags") {
    for (const x of body.held_details || []) {
      if (!QID.test(x.qid) || !ID.test(x.book_id)) continue;
      await env.DB.prepare("INSERT OR IGNORE INTO flags(qid,book_id,source_page,status) VALUES(?,?,?,'pending')").bind(x.qid, x.book_id, x.source_page || null).run();
    }
    return reply({ ok: true });
  }
  if (path === "/internal/warnings") {
    const bookId = String(body.book_id || "").toUpperCase();
    const version = Number(body.version);
    if (!ID.test(bookId) || !Number.isSafeInteger(version) || version < 1) return reply({ error: "invalid_warning_identity" }, 400);
    if (body.warnings != null && !Array.isArray(body.warnings)) return reply({ error: "invalid_warnings" }, 400);
    const rows = [];
    for (const x of body.warnings || []) {
      if (!x || !QID.test(x.qid) || !Number.isSafeInteger(Number(x.local_id))) continue;
      const reasons = Array.isArray(x.reasons) ? x.reasons : [];
      for (const reason of reasons) {
        const text = String(reason || "").slice(0, 500);
        if (!text) continue;
        rows.push([x.qid, Number(x.local_id), x.source_page || null, text]);
      }
    }
    // One bound JSON array avoids a D1 round-trip per reason. Replace atomically
    // so a failed write leaves the previous warnings intact and retries are safe.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM publish_warnings WHERE book_id=? AND version=?").bind(bookId, version),
      env.DB.prepare(
        "INSERT OR IGNORE INTO publish_warnings(book_id,version,qid,local_id,source_page,reason) " +
        "SELECT ?,?,json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?)"
      ).bind(bookId, version, JSON.stringify(rows)),
    ]);
    return reply({ ok: true });
  }
  return reply("Not found", 404);
}
const application = {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/bot" && request.method === "POST") return webhook(request, env, ctx);
    if (path.startsWith("/api/leaderboard/")) {
      const response = await handleLeaderboard(request, env, path);
      if (response) return response;
    }
    if (path.startsWith("/admin/")) return handleAdmin(request, env, path);
    if (path.startsWith("/internal/")) return internal(request, env, path);
    return env.ASSETS.fetch(request);
  },
};


export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    if(!env.DB||!/^\/(api|admin|internal|bot)(\/|$)/.test(path))return application.fetch(request,env,ctx);
    const meter=meterDatabase(env.DB);let status=500;
    try{const response=await application.fetch(request,{...env,DB:meter.db},ctx);status=response.status;return response}
    finally{await logD1Request(env.DB,path,meter.totals,status)}
  }
};
