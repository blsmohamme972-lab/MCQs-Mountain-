const QID=/^Q\d{9}$/;
const MAX_BATCH=50;
const enc=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
const safeName=value=>String(value||"Student").replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,64)||"Student";
const safePhoto=value=>{try{const u=new URL(String(value||""));return u.protocol==="https:"?u.href.slice(0,500):null}catch{return null}};

async function hmac(key,data,rawKey=false){
  const material=rawKey?key:enc.encode(String(key));
  const cryptoKey=await crypto.subtle.importKey("raw",material,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,enc.encode(data)));
}
function constantEqual(a,b){
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export async function verifyTelegramInitData(initData,botToken,now=new Date()){
  if(!initData||!botToken)return null;
  const params=new URLSearchParams(initData), hash=params.get("hash");
  if(!/^[a-f0-9]{64}$/i.test(hash||""))return null;
  params.delete("hash");
  const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("\n");
  const secret=await hmac(enc.encode("WebAppData"),String(botToken),true);
  const expected=hex(await hmac(secret,check,true));
  if(!constantEqual(expected,hash.toLowerCase()))return null;
  let user;try{user=JSON.parse(params.get("user")||"null")}catch{return null}
  if(!user||!Number.isSafeInteger(Number(user.id)))return null;
  const displayName=safeName([user.first_name,user.last_name].filter(Boolean).join(" "));
  return {id:String(user.id),display_name:displayName,photo_url:safePhoto(user.photo_url)};
}
async function userKey(botToken,id){return hex(await hmac(String(botToken),`leaderboard:${id}`));}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})}
function baghdadParts(now=new Date()){
  const shifted=new Date(now.getTime()+3*3600_000);
  return {date:shifted,year:shifted.getUTCFullYear(),month:shifted.getUTCMonth(),day:shifted.getUTCDate(),dow:shifted.getUTCDay()};
}
export function baghdadDayKey(now=new Date()){
  const p=baghdadParts(now);return `${p.year}-${String(p.month+1).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
}
export function baghdadWeekKey(now=new Date()){
  const p=baghdadParts(now), mondayOffset=(p.dow+6)%7;
  const monday=new Date(Date.UTC(p.year,p.month,p.day-mondayOffset));
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth()+1).padStart(2,"0")}-${String(monday.getUTCDate()).padStart(2,"0")}`;
}
function selectionCorrect(q,sel){
  if(!q||!Array.isArray(q.options))return false;
  if(q.type==="mtf")return Array.isArray(sel)&&Array.isArray(q.answer)&&sel.length===q.answer.length&&q.answer.every((v,i)=>sel[i]===v);
  if(q.type==="multi"){
    if(!Array.isArray(sel)||!Array.isArray(q.answer))return false;
    const got=[...new Set(sel.map(Number).filter(Number.isSafeInteger))].sort((a,b)=>a-b);
    const key=q.answer.map(x=>String(x).charCodeAt(0)-65).sort((a,b)=>a-b);
    return got.length===key.length&&got.every((v,i)=>v===key[i]);
  }
  const idx=String(q.answer||"").charCodeAt(0)-65;
  return Number(sel)===idx;
}
const questionCache=new Map(),routeCache=new Map(),chapterCache=new Map(),catalogCache={at:0,value:null};
async function catalog(env){
  if(catalogCache.value&&Date.now()-catalogCache.at<60_000)return catalogCache.value;
  const base=env.CONTENT_BASE||"https://kafu-content-1.blsmohamme97.workers.dev";
  const r=await fetch(base+"/catalog.json",{headers:{"user-agent":"kafu-leaderboard/1.0"}});
  if(!r.ok)throw new Error("catalog_unavailable");
  catalogCache.value=await r.json();catalogCache.at=Date.now();return catalogCache.value;
}
async function routes(env,shard){
  const hit=routeCache.get(shard);if(hit&&Date.now()-hit.at<300_000)return hit.routes;
  const base=env.CONTENT_BASE||"https://kafu-content-1.blsmohamme97.workers.dev";
  const rr=await fetch(`${base}/routes/${shard}.json`,{headers:{"user-agent":"kafu-leaderboard/1.0"}});
  if(!rr.ok)throw new Error("question_route_missing");
  const value=(await rr.json()).routes||{};routeCache.set(shard,{at:Date.now(),routes:value});return value;
}
async function chapter(url){
  const hit=chapterCache.get(url);if(hit&&Date.now()-hit.at<300_000)return hit.pack;
  const pr=await fetch(url,{headers:{"user-agent":"kafu-leaderboard/1.0"}});if(!pr.ok)throw new Error("question_chapter_unavailable");
  const pack=await pr.json();chapterCache.set(url,{at:Date.now(),pack});return pack;
}
async function question(env,qid){
  const hit=questionCache.get(qid);if(hit&&Date.now()-hit.at<300_000)return hit.q;
  const route=(await routes(env,qid.slice(0,7)))[qid];if(!route)throw new Error("question_route_missing");
  const cat=await catalog(env),book=(cat.books||[]).find(b=>b.id===route.book_id);
  const ch=book?.chapters?.find(x=>String(x.id)===String(route.chapter_id));if(!ch?.url)throw new Error("question_chapter_missing");
  const q=(await chapter(ch.url)).questions?.find(x=>x.id===qid);if(!q)throw new Error("question_missing");
  questionCache.set(qid,{at:Date.now(),q});return q;
}
async function auth(request,env){
  let body;try{body=await request.json()}catch{return {error:reply({error:"invalid_json"},400)}}
  const verified=await verifyTelegramInitData(body.initData,env.BOT_TOKEN);
  if(!verified)return {error:reply({error:"invalid_init_data"},401)};
  return {body,user:verified,key:await userKey(env.BOT_TOKEN,verified.id)};
}
async function upsertUser(env,key,user){
  await env.DB.prepare(`INSERT INTO leaderboard_users(user_key,display_name,photo_url,updated_at) VALUES(?,?,?,datetime('now'))
    ON CONFLICT(user_key) DO UPDATE SET display_name=excluded.display_name,photo_url=excluded.photo_url,updated_at=datetime('now')`)
    .bind(key,user.display_name,user.photo_url).run();
}
async function submit(request,env){
  const a=await auth(request,env);if(a.error)return a.error;
  if("score" in a.body||"total" in a.body)return reply({error:"score_not_accepted"},400);
  const items=Array.isArray(a.body.answers)?a.body.answers:[];
  if(!items.length||items.length>MAX_BATCH)return reply({error:"invalid_answer_batch"},400);
  if(items.some(x=>!x||!QID.test(String(x.qid||""))))return reply({error:"invalid_question_id"},400);
  await upsertUser(env,a.key,a.user);
  const week=baghdadWeekKey(), seen=new Set(), rows=[];
  for(const item of items){
    const qid=String(item.qid);if(seen.has(qid))continue;seen.add(qid);
    let q;try{q=await question(env,qid)}catch(e){return reply({error:String(e.message||e),qid},422)}
    rows.push({qid,correct:selectionCorrect(q,item.selection)?1:0});
  }
  const statements=rows.map(x=>env.DB.prepare("INSERT OR IGNORE INTO leaderboard_answers(user_key,qid,correct,week_key) VALUES(?,?,?,?)").bind(a.key,x.qid,x.correct,week));
  const result=statements.length?await env.DB.batch(statements):[];
  const accepted=result.reduce((n,x)=>n+Number(x?.meta?.changes||0),0);
  return reply({ok:true,accepted,duplicates:rows.length-accepted});
}
function periodWhere(period){return period==="weekly"?"AND a.week_key=?":""}
async function board(request,env){
  const a=await auth(request,env);if(a.error)return a.error;
  await upsertUser(env,a.key,a.user);
  const period=a.body.period==="all_time"?"all_time":"weekly", week=baghdadWeekKey();
  const filter=periodWhere(period), binds=period==="weekly"?[week]:[];
  const sql=`WITH scores AS (
    SELECT u.user_key,u.display_name,u.photo_url,u.hidden,SUM(a.correct) score
    FROM leaderboard_users u JOIN leaderboard_answers a ON a.user_key=u.user_key
    WHERE 1=1 ${filter}
    GROUP BY u.user_key
  ), ranked AS (
    SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,user_key ASC) rank
    FROM scores WHERE hidden=0
  )
  SELECT display_name,photo_url,score,rank FROM ranked ORDER BY rank LIMIT 30`;
  const top=await env.DB.prepare(sql).bind(...binds).all();
  const ownSql=`WITH scores AS (
    SELECT u.user_key,u.hidden,SUM(a.correct) score
    FROM leaderboard_users u JOIN leaderboard_answers a ON a.user_key=u.user_key
    WHERE 1=1 ${filter}
    GROUP BY u.user_key
  ), ranked AS (
    SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,user_key ASC) rank
    FROM scores WHERE hidden=0 OR user_key=?
  )
  SELECT s.score,s.hidden,r.rank FROM scores s LEFT JOIN ranked r ON r.user_key=s.user_key WHERE s.user_key=?`;
  const own=await env.DB.prepare(ownSql).bind(...binds,a.key,a.key).first();
  return reply({
    period,week_key:week,
    top:(top.results||[]).map(x=>({name:x.display_name,photo_url:x.photo_url||null,score:Number(x.score),rank:Number(x.rank)})),
    own:own?{score:Number(own.score),rank:own.rank==null?null:Number(own.rank),hidden:!!own.hidden}:{score:0,rank:null,hidden:false}
  });
}
async function privacy(request,env){
  const a=await auth(request,env);if(a.error)return a.error;
  if(typeof a.body.hidden!=="boolean")return reply({error:"invalid_hidden"},400);
  await upsertUser(env,a.key,a.user);
  await env.DB.prepare("UPDATE leaderboard_users SET hidden=?,updated_at=datetime('now') WHERE user_key=?").bind(a.body.hidden?1:0,a.key).run();
  return reply({ok:true,hidden:a.body.hidden});
}
export async function handleLeaderboard(request,env,path){
  if(request.method!=="POST")return reply({error:"method_not_allowed"},405);
  if(path==="/api/leaderboard/submit")return submit(request,env);
  if(path==="/api/leaderboard/board")return board(request,env);
  if(path==="/api/leaderboard/privacy")return privacy(request,env);
  return null;
}
export const LEADERBOARD_LIMITS={MAX_BATCH,TOP:30};
