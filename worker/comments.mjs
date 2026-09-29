import { verifyTelegramInitData } from "./leaderboard.mjs";

const QID=/^Q\d{9}$/;
const NONCE=/^[A-Za-z0-9_-]{8,80}$/;
const MAX_BODY=600, PAGE=20;
const REPORT_REASONS=new Set(["answer_wrong","incorrect","spam","abuse","other"]);
const enc=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");

async function hmac(key,data){
  const k=await crypto.subtle.importKey("raw",enc.encode(String(key)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",k,enc.encode(String(data))));
}
async function commentKey(env,id){return hmac(env.BOT_TOKEN,"comments:"+id)}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})}
function cleanBody(v){const s=String(v??"").trim();const n=[...s].length;return n>=1&&n<=MAX_BODY?s:null}
function intId(v){const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null}

async function auth(request,env){
  let body;try{body=await request.json()}catch{return {error:reply({error:"invalid_json"},400)}}
  const user=await verifyTelegramInitData(body.initData,env.BOT_TOKEN);
  if(!user)return {error:reply({error:"invalid_init_data"},401)};
  const key=await commentKey(env,user.id);
  return {body,user,key,isOwner:String(user.id)===String(env.OWNER_TELEGRAM_ID||"")};
}
async function upsertUser(env,a){
  await env.DB.prepare(`INSERT INTO comment_users(user_key,display_name,photo_url,updated_at)
    VALUES(?,?,?,datetime('now'))
    ON CONFLICT(user_key) DO UPDATE SET display_name=excluded.display_name,photo_url=excluded.photo_url,updated_at=datetime('now')`)
    .bind(a.key,a.user.display_name,a.user.photo_url).run();
  const row=await env.DB.prepare("SELECT banned FROM comment_users WHERE user_key=?").bind(a.key).first();
  return !!row?.banned;
}
const activeCache=new Map();
async function activeQuestion(env,qid){
  const hit=activeCache.get(qid);if(hit&&Date.now()-hit.at<60_000)return hit.value;
  const base=env.CONTENT_BASE||"https://kafu-content-1.blsmohamme97.workers.dev";
  const routeRes=await fetch(`${base}/routes/${qid.slice(0,7)}.json`,{headers:{"user-agent":"kafu-comments/1.0"}});
  if(!routeRes.ok)return null;
  const route=(await routeRes.json()).routes?.[qid];if(!route?.book_id)return null;
  const catRes=await fetch(base+"/catalog.json",{headers:{"user-agent":"kafu-comments/1.0"}});
  if(!catRes.ok)return null;
  const active=(await catRes.json()).books?.some(b=>String(b.id)===String(route.book_id));
  const value=active?{book_id:String(route.book_id)}:null;activeCache.set(qid,{at:Date.now(),value});return value;
}
async function ensureThread(env,qid){
  const active=await activeQuestion(env,qid);if(!active)return null;
  await env.DB.prepare("INSERT OR IGNORE INTO comment_threads(qid,book_id) VALUES(?,?)").bind(qid,active.book_id).run();
  return active;
}
async function limited(env,key,kind){
  if(kind==="post"){
    const ten=await env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE author_key=? AND created_at>=datetime('now','-10 minutes')").bind(key).first();
    const day=await env.DB.prepare("SELECT COUNT(*) n FROM comments WHERE author_key=? AND created_at>=datetime('now','-1 day')").bind(key).first();
    return Number(ten?.n||0)>=5||Number(day?.n||0)>=30;
  }
  if(kind==="vote"){
    const day=await env.DB.prepare("SELECT COUNT(*) n FROM comment_votes WHERE user_key=? AND created_at>=datetime('now','-1 day')").bind(key).first();
    return Number(day?.n||0)>=60;
  }
  const day=await env.DB.prepare("SELECT COUNT(*) n FROM comment_reports WHERE reporter_key=? AND created_at>=datetime('now','-1 day')").bind(key).first();
  return Number(day?.n||0)>=10;
}
function publicComment(r){
  return {id:Number(r.id),qid:r.qid,parent_id:r.parent_id==null?null:Number(r.parent_id),body:r.body||"",name:r.display_name,photo_url:r.photo_url||null,
    helpful:Number(r.helpful_count||0),helpful_by_me:!!r.helpful_by_me,verified:!!r.verified,pinned:!!r.pinned,created_at:r.created_at};
}
async function thread(request,env){
  const a=await auth(request,env);if(a.error)return a.error;await upsertUser(env,a);
  const qid=String(a.body.qid||"");if(!QID.test(qid))return reply({error:"invalid_question_id"},400);
  if(!await activeQuestion(env,qid))return reply({error:"question_inactive"},404);
  const sort=a.body.sort==="newest"?"newest":"helpful";
  let cursor=null;
  if(a.body.cursor){try{cursor=JSON.parse(atob(String(a.body.cursor)).replace(/-/g,"+").replace(/_/g,"/"))}catch{return reply({error:"invalid_cursor"},400)}}
  const order=sort==="newest"?"c.created_at DESC,c.id DESC":"c.verified DESC,c.pinned DESC,c.helpful_count DESC,c.created_at DESC,c.id DESC";
  let cursorSql="",cursorBinds=[];
  if(cursor&&sort==="newest"){
    if(typeof cursor.t!=="string"||!intId(cursor.id))return reply({error:"invalid_cursor"},400);
    cursorSql="AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))";cursorBinds=[cursor.t,cursor.t,Number(cursor.id)];
  }else if(cursor){
    if(![0,1].includes(cursor.v)||![0,1].includes(cursor.p)||!Number.isSafeInteger(cursor.h)||typeof cursor.t!=="string"||!intId(cursor.id))return reply({error:"invalid_cursor"},400);
    cursorSql=`AND (
      c.verified < ? OR
      (c.verified = ? AND c.pinned < ?) OR
      (c.verified = ? AND c.pinned = ? AND c.helpful_count < ?) OR
      (c.verified = ? AND c.pinned = ? AND c.helpful_count = ? AND c.created_at < ?) OR
      (c.verified = ? AND c.pinned = ? AND c.helpful_count = ? AND c.created_at = ? AND c.id < ?)
    )`;
    cursorBinds=[cursor.v,cursor.v,cursor.p,cursor.v,cursor.p,cursor.h,cursor.v,cursor.p,cursor.h,cursor.t,cursor.v,cursor.p,cursor.h,cursor.t,cursor.id];
  }
  const rows=await env.DB.prepare(`SELECT c.*,u.display_name,u.photo_url,
    EXISTS(SELECT 1 FROM comment_votes v WHERE v.comment_id=c.id AND v.user_key=?) helpful_by_me
    FROM comments c JOIN comment_users u ON u.user_key=c.author_key
    WHERE c.qid=? AND c.parent_id IS NULL AND c.status='visible' ${cursorSql}
    ORDER BY ${order} LIMIT ${PAGE}`).bind(a.key,qid,...cursorBinds).all();
  const top=rows.results||[],ids=top.map(x=>Number(x.id));
  let replies=[];
  if(ids.length){
    const marks=ids.map(()=>"?").join(",");
    const rr=await env.DB.prepare(`SELECT c.*,u.display_name,u.photo_url,
      EXISTS(SELECT 1 FROM comment_votes v WHERE v.comment_id=c.id AND v.user_key=?) helpful_by_me
      FROM comments c JOIN comment_users u ON u.user_key=c.author_key
      WHERE c.parent_id IN (${marks}) AND c.status='visible' ORDER BY c.created_at ASC,c.id ASC LIMIT 60`).bind(a.key,...ids).all();
    replies=rr.results||[];
  }
  const grouped=new Map(ids.map(id=>[id,[]]));for(const r of replies)grouped.get(Number(r.parent_id))?.push(publicComment(r));
  const items=top.map(r=>({...publicComment(r),replies:grouped.get(Number(r.id))||[]}));
  let next=null;if(top.length===PAGE){const z=top.at(-1),obj=sort==="newest"?{t:z.created_at,id:Number(z.id)}:{v:Number(z.verified),p:Number(z.pinned),h:Number(z.helpful_count),t:z.created_at,id:Number(z.id)};next=btoa(JSON.stringify(obj)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
  return reply({qid,sort,items,next_cursor:next,notice:"Student discussion — not verified"});
}
async function create(request,env){
  const a=await auth(request,env);if(a.error)return a.error;
  const banned=await upsertUser(env,a);if(banned)return reply({error:"banned"},403);
  const qid=String(a.body.qid||""),body=cleanBody(a.body.body),nonce=String(a.body.client_nonce||"");
  if(!QID.test(qid)||!body||!NONCE.test(nonce))return reply({error:"invalid_comment"},400);
  const active=await ensureThread(env,qid);if(!active)return reply({error:"question_inactive"},404);
  if(await limited(env,a.key,"post"))return reply({error:"rate_limited"},429);
  let parent=null;if(a.body.parent_id!=null){
    parent=intId(a.body.parent_id);if(!parent)return reply({error:"invalid_parent"},400);
    const p=await env.DB.prepare("SELECT id,parent_id,qid,status FROM comments WHERE id=?").bind(parent).first();
    if(!p||p.parent_id!=null||p.qid!==qid||p.status!=="visible")return reply({error:"invalid_parent"},400);
  }
  await env.DB.prepare("INSERT OR IGNORE INTO comments(qid,author_key,parent_id,body,client_nonce) VALUES(?,?,?,?,?)").bind(qid,a.key,parent,body,nonce).run();
  const row=await env.DB.prepare("SELECT c.*,u.display_name,u.photo_url,0 helpful_by_me FROM comments c JOIN comment_users u ON u.user_key=c.author_key WHERE c.author_key=? AND c.client_nonce=?").bind(a.key,nonce).first();
  return reply({ok:true,comment:publicComment(row)},201);
}
async function helpful(request,env){
  const a=await auth(request,env);if(a.error)return a.error;const banned=await upsertUser(env,a);if(banned)return reply({error:"banned"},403);
  const id=intId(a.body.comment_id);if(!id)return reply({error:"invalid_comment_id"},400);
  const c=await env.DB.prepare("SELECT author_key,status FROM comments WHERE id=?").bind(id).first();if(!c||c.status!=="visible")return reply({error:"not_found"},404);
  if(c.author_key===a.key)return reply({error:"self_helpful_not_allowed"},400);
  const existing=await env.DB.prepare("SELECT 1 yes FROM comment_votes WHERE comment_id=? AND user_key=?").bind(id,a.key).first();
  if(existing){await env.DB.prepare("DELETE FROM comment_votes WHERE comment_id=? AND user_key=?").bind(id,a.key).run();await env.DB.prepare("UPDATE comments SET helpful_count=MAX(0,helpful_count-1) WHERE id=?").bind(id).run();return reply({ok:true,helpful:false});}
  if(await limited(env,a.key,"vote"))return reply({error:"rate_limited"},429);
  await env.DB.prepare("INSERT INTO comment_votes(comment_id,user_key) VALUES(?,?)").bind(id,a.key).run();await env.DB.prepare("UPDATE comments SET helpful_count=helpful_count+1 WHERE id=?").bind(id).run();
  return reply({ok:true,helpful:true});
}
async function reportComment(request,env){
  const a=await auth(request,env);if(a.error)return a.error;const banned=await upsertUser(env,a);if(banned)return reply({error:"banned"},403);
  const id=intId(a.body.comment_id),reason=String(a.body.reason||"other");if(!id||!REPORT_REASONS.has(reason))return reply({error:"invalid_report"},400);
  const c=await env.DB.prepare("SELECT id,qid,status FROM comments WHERE id=?").bind(id).first();if(!c||c.status==="deleted")return reply({error:"not_found"},404);
  if(await limited(env,a.key,"report"))return reply({error:"rate_limited"},429);
  const ins=await env.DB.prepare("INSERT OR IGNORE INTO comment_reports(comment_id,qid,reporter_key,reason) VALUES(?,?,?,?)").bind(id,c.qid,a.key,reason).run();
  if(Number(ins?.meta?.changes||0)){
    await env.DB.prepare("UPDATE comments SET report_count=report_count+1 WHERE id=?").bind(id).run();
    await env.DB.prepare("UPDATE comments SET status='hidden_pending',updated_at=datetime('now') WHERE id=? AND report_count>=3 AND status='visible'").bind(id).run();
  }
  return reply({ok:true,deduplicated:Number(ins?.meta?.changes||0)===0});
}
async function removeOwn(request,env){
  const a=await auth(request,env);if(a.error)return a.error;await upsertUser(env,a);
  const id=intId(a.body.comment_id);if(!id)return reply({error:"invalid_comment_id"},400);
  const c=await env.DB.prepare("SELECT author_key FROM comments WHERE id=?").bind(id).first();if(!c)return reply({error:"not_found"},404);
  if(c.author_key!==a.key)return reply({error:"forbidden"},403);
  await env.DB.prepare("UPDATE comments SET status='deleted',body=NULL,verified=0,pinned=0,updated_at=datetime('now') WHERE id=?").bind(id).run();
  return reply({ok:true});
}
async function moderate(request,env){
  const a=await auth(request,env);if(a.error)return a.error;await upsertUser(env,a);if(!a.isOwner)return reply({error:"forbidden"},403);
  const id=intId(a.body.comment_id),action=String(a.body.action||"");if(!id)return reply({error:"invalid_comment_id"},400);
  const c=await env.DB.prepare("SELECT id,parent_id FROM comments WHERE id=?").bind(id).first();if(!c)return reply({error:"not_found"},404);
  if(action==="restore")await env.DB.prepare("UPDATE comments SET status='visible',updated_at=datetime('now') WHERE id=?").bind(id).run();
  else if(action==="hide")await env.DB.prepare("UPDATE comments SET status='hidden',updated_at=datetime('now') WHERE id=?").bind(id).run();
  else if(action==="delete")await env.DB.prepare("UPDATE comments SET status='deleted',body=NULL,verified=0,pinned=0,updated_at=datetime('now') WHERE id=?").bind(id).run();
  else if(action==="verify"){
    if(c.parent_id==null)return reply({error:"only_reply_can_be_verified"},400);
    await env.DB.prepare("UPDATE comments SET verified=0,pinned=0 WHERE qid=(SELECT qid FROM comments WHERE id=?)").bind(id).run();
    await env.DB.prepare("UPDATE comments SET verified=1,pinned=1,status='visible',updated_at=datetime('now') WHERE id=?").bind(id).run();
  } else if(action==="unverify")await env.DB.prepare("UPDATE comments SET verified=0,pinned=0,updated_at=datetime('now') WHERE id=?").bind(id).run();
  else if(action==="ban"){
    await env.DB.prepare("UPDATE comment_users SET banned=1,updated_at=datetime('now') WHERE user_key=(SELECT author_key FROM comments WHERE id=?)").bind(id).run();
  } else return reply({error:"invalid_action"},400);
  return reply({ok:true});
}

async function featureEnabled(env){const row=await env.DB.prepare("SELECT value FROM comment_settings WHERE key='enabled'").first();return row?.value==="1"}
async function setting(request,env){
  const a=await auth(request,env);if(a.error)return a.error;if(!a.isOwner)return reply({error:"forbidden"},403);
  if(typeof a.body.enabled!=="boolean")return reply({error:"invalid_enabled"},400);
  await env.DB.prepare("INSERT INTO comment_settings(key,value,updated_at) VALUES('enabled',?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(a.body.enabled?"1":"0").run();
  return reply({ok:true,enabled:a.body.enabled});
}
export async function handleComments(request,env,path){
  if(request.method!=="POST")return reply({error:"method_not_allowed"},405);
  if(path==="/api/comments/admin-setting")return setting(request,env);
  if(!await featureEnabled(env))return reply({error:"comments_disabled"},503);
  if(path==="/api/comments/thread")return thread(request,env);
  if(path==="/api/comments/create")return create(request,env);
  if(path==="/api/comments/helpful")return helpful(request,env);
  if(path==="/api/comments/report")return reportComment(request,env);
  if(path==="/api/comments/delete")return removeOwn(request,env);
  if(path==="/api/comments/moderate")return moderate(request,env);
  return null;
}
export const COMMENT_LIMITS={MAX_BODY,PAGE};
