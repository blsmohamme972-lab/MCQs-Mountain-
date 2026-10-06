const MAX_ZIP=19*1024*1024;
const NAME=/^MCARDS_([A-Z0-9][A-Z0-9-]{0,63})_r([1-9]\d*)(?:_part([1-9]\d*)of([1-9]\d*))?\.zip$/i;
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
export function looksMotioncardsFilename(name){return typeof name==="string"&&/^MCARDS_/i.test(name)}
export function parseMotioncardsName(name){
  if(typeof name!=="string"||name.length>255)return null;
  const m=NAME.exec(name);if(!m)return null;
  const revision=Number(m[2]),part=Number(m[3]||1),total=Number(m[4]||1);
  if(![revision,part,total].every(Number.isSafeInteger)||total>100||part>total||(total===1&&m[3]))return null;
  const package_id=m[1].toUpperCase();
  return{package_id,revision,part,total,group_key:package_id+"_r"+revision};
}
export async function queueMotioncardsDocument(env,doc){
  if(!doc||!Number.isInteger(doc.file_size)||doc.file_size<1||doc.file_size>MAX_ZIP||
     typeof doc.file_id!=="string"||!doc.file_id||typeof doc.file_unique_id!=="string"||!doc.file_unique_id)
    return{text:"❌ MotionCards ZIP required, up to 19 MB.",dispatch:false};
  const p=parseMotioncardsName(doc.file_name);
  if(!p)return{text:"❌ MotionCards filename must be MCARDS_PACKAGE-ID_rN.zip or _partXofY.zip.",dispatch:false};
  const group=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=?",p.group_key).first();
  const existing=await stmt(env,"SELECT telegram_file_unique_id FROM motioncards_queue WHERE group_key=? AND part_index=?",p.group_key,p.part).first();
  if(group?.status!=="failed"&&existing)return existing.telegram_file_unique_id===doc.file_unique_id?
    {text:"📥 MotionCards already received",dispatch:false}:{text:"❌ A different MotionCards ZIP already occupies this part.",dispatch:false};
  if(group&&["running","published"].includes(group.status))return{text:"❌ This MotionCards revision is running or published and cannot be replaced.",dispatch:false};
  if(group&&group.status!=="failed"&&Number(group.part_total)!==p.total)return{text:"❌ Conflicting MotionCards part count.",dispatch:false};
  const writes=[];
  if(group?.status==="failed"){
    if(Number(group.part_total)!==p.total)return{text:"❌ Failed MotionCards upload has a different part count; clear it explicitly before changing the batch shape.",dispatch:false};
    if(Number(group.attempts)>=Number(group.max_attempts))return{text:"❌ MotionCards retry limit reached; upload a new revision after review.",dispatch:false};
    // Keep previously accepted parts. A repaired upload replaces only the supplied part.
    writes.push(stmt(env,"UPDATE motioncards_groups SET status='waiting',error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL WHERE group_key=? AND status='failed'",p.group_key));
  }else writes.push(stmt(env,"INSERT OR IGNORE INTO motioncards_groups(group_key,package_id,revision,part_total,status) VALUES(?,?,?,?, 'waiting')",p.group_key,p.package_id,p.revision,p.total));
  writes.push(stmt(env,"INSERT INTO motioncards_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) VALUES(?,?,?,?,?,?,?) ON CONFLICT(group_key,part_index) DO UPDATE SET telegram_file_id=excluded.telegram_file_id,telegram_file_unique_id=excluded.telegram_file_unique_id,filename=excluded.filename,file_size=excluded.file_size,created_at=datetime('now')",p.group_key,p.part,p.total,doc.file_id,doc.file_unique_id,doc.file_name,doc.file_size));
  writes.push(stmt(env,"UPDATE motioncards_groups SET status=CASE WHEN (SELECT COUNT(*) FROM motioncards_queue WHERE group_key=?)=part_total THEN 'ready' ELSE 'waiting' END WHERE group_key=? AND status IN ('waiting','ready')",p.group_key,p.group_key));
  await env.DB.batch(writes);
  const row=await stmt(env,"SELECT status,(SELECT COUNT(*) FROM motioncards_queue WHERE group_key=?) AS n FROM motioncards_groups WHERE group_key=?",p.group_key,p.group_key).first();
  return{text:"📥 MotionCards "+p.group_key+" ("+(row?.n||0)+"/"+p.total+")",dispatch:row?.status==="ready"};
}
function leaseToken(){const b=new Uint8Array(16);crypto.getRandomValues(b);return[...b].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function expireExhausted(env){
  await stmt(env,"UPDATE motioncards_groups SET status='failed',finished_at=datetime('now'),error_summary=COALESCE(error_summary,'motioncards_retry_limit_exhausted'),lease_token=NULL,lease_expires_at=NULL WHERE attempts>=max_attempts AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now')))").run();
}
export async function claimMotioncards(env){
  await expireExhausted(env);
  const token=leaseToken();
  const group=await stmt(env,"UPDATE motioncards_groups SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=datetime('now','+20 minutes'),finished_at=NULL WHERE group_key=(SELECT group_key FROM motioncards_groups WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts ORDER BY created_at LIMIT 1) AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts RETURNING *",token).first();
  if(!group)return{kind:"empty"};
  const parts=await stmt(env,"SELECT * FROM motioncards_queue WHERE group_key=? ORDER BY part_index",group.group_key).all();
  return{kind:"motioncards",group,parts:parts.results||[],lease_token:token};
}
export async function hasReadyMotioncards(env){
  await expireExhausted(env);
  const row=await stmt(env,"SELECT COUNT(*) AS n FROM motioncards_groups WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts").first();
  return{ready:Number(row?.n||0)>0,count:Number(row?.n||0)};
}
export async function finishMotioncards(env,body){
  const key=String(body.group_key||""),lease=String(body.lease_token||"");
  if(body.ok){
    if(!/^[a-f0-9]{64}$/i.test(String(body.package_sha256||""))||!Number.isSafeInteger(body.animations)||body.animations<1)return{ok:false,status:400,error:"motioncards_finish_invalid"};
    const digest=String(body.package_sha256).toLowerCase();
    const results=await env.DB.batch([
      stmt(env,"INSERT INTO motioncards_publications(group_key,package_id,revision,package_sha256,animations) SELECT group_key,package_id,revision,?,? FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now') ON CONFLICT(group_key) DO UPDATE SET package_sha256=excluded.package_sha256,animations=excluded.animations,published_at=datetime('now')",digest,body.animations,key,lease),
      stmt(env,"UPDATE motioncards_groups SET status='published',finished_at=datetime('now'),error_summary=NULL,published_digest=?,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",digest,key,lease)
    ]);
    if(!results.at(-1)?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
    return{ok:true,status:200};
  }
  const error=String(body.error||"motioncards_publish_failed").slice(0,400);
  const result=await stmt(env,"UPDATE motioncards_groups SET status='failed',finished_at=datetime('now'),error_summary=?,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",error,key,lease).run();
  if(!result?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
  return{ok:true,status:200};
}
export async function recoverMotioncards(env,action,key){
  const p=parseMotioncardsName("MCARDS_"+String(key||"")+".zip");
  if(!p||p.total!==1)return{ok:false,text:"Usage: /motioncards-retry PACKAGE-ID_rN"};
  const group=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=?",p.group_key).first();
  if(!group||group.status!=="failed")return{ok:false,text:"❌ No failed MotionCards upload found."};
  if(action==="clear"){
    await env.DB.batch([stmt(env,"DELETE FROM motioncards_queue WHERE group_key=?",p.group_key),stmt(env,"DELETE FROM motioncards_groups WHERE group_key=? AND status='failed'",p.group_key)]);
    return{ok:true,text:"🧹 cleared MotionCards "+p.group_key};
  }
  if(group.attempts>=group.max_attempts)return{ok:false,text:"❌ MotionCards retry limit reached; upload a new revision after review."};
  const parts=await stmt(env,"SELECT COUNT(*) AS n FROM motioncards_queue WHERE group_key=?",p.group_key).first();
  const next=Number(parts?.n||0)===Number(group.part_total)?"ready":"waiting";
  const changed=await stmt(env,"UPDATE motioncards_groups SET status=?,error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL WHERE group_key=? AND status='failed'",next,p.group_key).run();
  if(!changed?.meta?.changes)return{ok:false,text:"❌ MotionCards retry state changed; refresh status."};
  return{ok:true,text:(next==="ready"?"📥 MotionCards retry queued: ":"📥 MotionCards repair waiting for remaining parts: ")+p.group_key,dispatch:next==="ready"};
}
export async function motioncardsStatus(env){
  const r=await stmt(env,"SELECT group_key,status,attempts,error_summary FROM motioncards_groups ORDER BY created_at DESC LIMIT 15").all();
  return(r.results||[]).map(x=>x.group_key+": "+x.status+" ("+x.attempts+" attempts)"+(x.error_summary?" — "+x.error_summary:"")).join("\n")||"MotionCards queue empty.";
}
