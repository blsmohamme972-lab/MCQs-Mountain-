const QID=/^Q\d{9}$/;
const MAX_BATCH=100;
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
const questionCache=new Map(),routeCache=new Map(),chapterCache=new Map(),catalogCache=new Map();
async function catalog(env){
  const base=env.CONTENT_BASE||"https://kafu-content-1.blsmohamme97.workers.dev";
  const hit=catalogCache.get(base);if(hit&&Date.now()-hit.at<60_000)return hit.value;
  const r=await fetch(base+"/catalog.json",{headers:{"user-agent":"kafu-leaderboard/1.0"}});
  if(!r.ok)throw new Error("catalog_unavailable");
  const value=await r.json();catalogCache.set(base,{at:Date.now(),value});return value;
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
  if(!body||typeof body!=="object"||Array.isArray(body))return {error:reply({error:"invalid_json"},400)};
  const verified=await verifyTelegramInitData(body.initData,env.BOT_TOKEN);
  if(!verified)return {error:reply({error:"invalid_init_data"},401)};
  return {body,user:verified,key:await userKey(env.BOT_TOKEN,verified.id)};
}
async function upsertUser(env,key,user){
  await env.DB.prepare(`INSERT INTO leaderboard_users(user_key,display_name,photo_url,updated_at) VALUES(?,?,?,datetime('now'))
    ON CONFLICT(user_key) DO UPDATE SET display_name=excluded.display_name,photo_url=excluded.photo_url,updated_at=datetime('now')
    WHERE display_name IS NOT excluded.display_name OR photo_url IS NOT excluded.photo_url`)
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
  // Read each touched bucket once. Lifetime history is a Set in Worker
  // memory; SQL only does indexed lookups and revision-guarded replacement.
  const buckets=new Map();
  for(const row of rows){
    const id=Number(row.qid.slice(1)),bucket=Math.floor(id/4096);
    if(!buckets.has(bucket))buckets.set(bucket,[]);
    buckets.get(bucket).push({id:id%4096,correct:row.correct});
  }
  let accepted=0;
  for(const [bucket,items] of buckets){
    const read=await env.DB.prepare('SELECT attempted,revision FROM leaderboard_attempt_buckets WHERE user_key=? AND bucket=?').bind(a.key,bucket).all();
    const old=read.results?.[0],attempted=new Set(old?JSON.parse(old.attempted):[]);
    let count=0,delta=0;
    for(const item of items){
      if(attempted.has(item.id))continue;
      attempted.add(item.id);count++;delta+=item.correct;
    }
    if(!count)continue;
    const payload=JSON.stringify([...attempted]);
    const write=old
      ?env.DB.prepare(`UPDATE leaderboard_attempt_buckets SET attempted=?,score_delta=?,accepted_count=?,week_key=?,revision=revision+1
        WHERE user_key=? AND bucket=? AND revision=? RETURNING accepted_count`)
        .bind(payload,delta,count,week,a.key,bucket,old.revision)
      :env.DB.prepare(`INSERT INTO leaderboard_attempt_buckets(user_key,bucket,attempted,score_delta,accepted_count,week_key)
        VALUES(?,?,?,?,?,?) ON CONFLICT(user_key,bucket) DO NOTHING RETURNING accepted_count`)
        .bind(a.key,bucket,payload,delta,count,week);
    const result=await write.all();
    // Never re-read a bucket in this request. The durable client queue retries
    // a conflict; any buckets already committed then become duplicates.
    if(!result.results?.length)return reply({error:'submission_conflict'},409);
    accepted+=count;
  }
  // One indexed summary read per submission supplies a verified score for the
  // device. Opening Top 30 never reads a personal score or rank from D1.
  const summary=(await env.DB.prepare('SELECT total_score,weekly_score,week_key FROM leaderboard_summary WHERE user_key=?').bind(a.key).all()).results?.[0];
  return reply({ok:true,accepted,duplicates:rows.length-accepted,score:{total:Number(summary?.total_score||0),weekly:summary?.week_key===week?Number(summary.weekly_score):0,week_key:week}});
}
export const TOP_CACHE_MS=600_000;
async function board(request,env){
  const a=await auth(request,env);if(a.error)return a.error;
  const period=a.body.period==='all_time'?'all_time':'weekly',week=baghdadWeekKey();
  const weekly=period==='weekly',periodKey=weekly?week:'all_time';
  const score=weekly?'weekly_score':'total_score';
  const filter=weekly?'s.week_key=? AND ':'';
  const binds=weekly?[week]:[];
  const now=Date.now();
  // Shared D1 snapshot survives Worker restarts and is reused across isolates.
  let snapshot=await env.DB.prepare('SELECT payload,refreshed_at FROM leaderboard_snapshots WHERE period_key=?').bind(periodKey).first();
  if(!snapshot||now-Number(snapshot.refreshed_at)>=TOP_CACHE_MS){
    // Conditional refresh is atomic. Only the first request in a ten-minute
    // interval scans the rank index; competing requests reuse that snapshot.
    await env.DB.prepare(`INSERT INTO leaderboard_snapshots(period_key,payload,refreshed_at)
      SELECT ?,COALESCE((SELECT json_group_array(json(row)) FROM (
        SELECT json_object('name',u.display_name,'photo_url',u.photo_url,'score',s.${score},
          'rank',ROW_NUMBER() OVER(ORDER BY s.${score} DESC,s.user_key ASC)) row
        FROM leaderboard_summary s JOIN leaderboard_users u USING(user_key)
        WHERE ${filter}s.hidden=0 ORDER BY s.${score} DESC,s.user_key ASC LIMIT 30
      )),'[]'),?
      WHERE NOT EXISTS(SELECT 1 FROM leaderboard_snapshots WHERE period_key=? AND refreshed_at>?)
      ON CONFLICT(period_key) DO UPDATE SET payload=excluded.payload,refreshed_at=excluded.refreshed_at
    `).bind(periodKey,...binds,now,periodKey,now-TOP_CACHE_MS).run();
    snapshot=await env.DB.prepare('SELECT payload,refreshed_at FROM leaderboard_snapshots WHERE period_key=?').bind(periodKey).first();
  }
  const top=JSON.parse(snapshot.payload);
  return reply({period,week_key:week,refreshed_at:Number(snapshot.refreshed_at),top,
    cutoff:top.length===30?Number(top[29].score):null});
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

