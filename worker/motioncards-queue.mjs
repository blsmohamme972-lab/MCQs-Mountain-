const MAX_ZIP=19*1024*1024;
const NAME=/^MCARDS_([A-Z0-9][A-Z0-9-]{0,63})_r([1-9]\d*)(?:_part([1-9]\d*)of([1-9]\d*))?\.zip$/i;
const QID=/^Q\d{9}$/;
const HEX64=/^[a-f0-9]{64}$/i;
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
function randomToken(bytes=16){const b=new Uint8Array(bytes);crypto.getRandomValues(b);return[...b].map(x=>x.toString(16).padStart(2,"0")).join("")}
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
  if(group&&["running","awaiting_confirmation","published"].includes(group.status))return{text:"❌ This MotionCards revision is running, awaiting confirmation, or published and cannot be overwritten.",dispatch:false};
  if(group&&group.status!=="failed"&&Number(group.part_total)!==p.total)return{text:"❌ Conflicting MotionCards part count.",dispatch:false};
  const writes=[];
  if(group?.status==="failed"){
    if(Number(group.part_total)!==p.total)return{text:"❌ Failed MotionCards upload has a different part count; clear it explicitly before changing the batch shape.",dispatch:false};
    if(Number(group.attempts)>=Number(group.max_attempts))return{text:"❌ MotionCards retry limit reached; upload a new revision after review.",dispatch:false};
    writes.push(stmt(env,"UPDATE motioncards_groups SET status='waiting',error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL,candidate_digest=NULL,replacement_targets_json=NULL,replacement_auth_json=NULL WHERE group_key=? AND status='failed'",p.group_key));
  }else writes.push(stmt(env,"INSERT OR IGNORE INTO motioncards_groups(group_key,package_id,revision,part_total,status) VALUES(?,?,?,?, 'waiting')",p.group_key,p.package_id,p.revision,p.total));
  writes.push(stmt(env,"INSERT INTO motioncards_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) VALUES(?,?,?,?,?,?,?) ON CONFLICT(group_key,part_index) DO UPDATE SET telegram_file_id=excluded.telegram_file_id,telegram_file_unique_id=excluded.telegram_file_unique_id,filename=excluded.filename,file_size=excluded.file_size,created_at=datetime('now')",p.group_key,p.part,p.total,doc.file_id,doc.file_unique_id,doc.file_name,doc.file_size));
  writes.push(stmt(env,"UPDATE motioncards_groups SET status=CASE WHEN (SELECT COUNT(*) FROM motioncards_queue WHERE group_key=?)=part_total THEN 'ready' ELSE 'waiting' END WHERE group_key=? AND status IN ('waiting','ready')",p.group_key,p.group_key));
  await env.DB.batch(writes);
  const row=await stmt(env,"SELECT status,(SELECT COUNT(*) FROM motioncards_queue WHERE group_key=?) AS n FROM motioncards_groups WHERE group_key=?",p.group_key,p.group_key).first();
  return{text:"📥 MotionCards "+p.group_key+" ("+(row?.n||0)+"/"+p.total+")",dispatch:row?.status==="ready"};
}
async function expireExhausted(env){
  await env.DB.batch([
    stmt(env,"UPDATE motioncards_groups SET status='failed',finished_at=datetime('now'),error_summary=COALESCE(error_summary,'motioncards_retry_limit_exhausted'),lease_token=NULL,lease_expires_at=NULL WHERE attempts>=max_attempts AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now')))"),
    stmt(env,"UPDATE motioncards_operations SET status='failed',finished_at=datetime('now'),error_summary=COALESCE(error_summary,'motioncards_retry_limit_exhausted'),lease_token=NULL,lease_expires_at=NULL WHERE attempts>=max_attempts AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now')))")
  ]);
}
export async function claimMotioncards(env){
  await expireExhausted(env);
  const token=randomToken();
  const operation=await stmt(env,"UPDATE motioncards_operations SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=datetime('now','+20 minutes'),finished_at=NULL WHERE operation_id=(SELECT operation_id FROM motioncards_operations WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts ORDER BY created_at LIMIT 1) AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts RETURNING *",token).first();
  if(operation)return{kind:"motioncards-admin",operation,lease_token:token};
  const group=await stmt(env,"UPDATE motioncards_groups SET status='running',attempts=attempts+1,lease_token=?,lease_expires_at=datetime('now','+20 minutes'),finished_at=NULL WHERE group_key=(SELECT group_key FROM motioncards_groups WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts ORDER BY created_at LIMIT 1) AND (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts RETURNING *",token).first();
  if(!group)return{kind:"empty"};
  const parts=await stmt(env,"SELECT * FROM motioncards_queue WHERE group_key=? ORDER BY part_index",group.group_key).all();
  return{kind:"motioncards",group,parts:parts.results||[],lease_token:token};
}
export async function hasReadyMotioncards(env){
  await expireExhausted(env);
  const [groups,ops]=await Promise.all([
    stmt(env,"SELECT COUNT(*) AS n FROM motioncards_groups WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts").first(),
    stmt(env,"SELECT COUNT(*) AS n FROM motioncards_operations WHERE (status='ready' OR (status='running' AND lease_expires_at<datetime('now'))) AND attempts<max_attempts").first()
  ]);
  const count=Number(groups?.n||0)+Number(ops?.n||0);return{ready:count>0,count};
}
function validCard(x){
  return x&&QID.test(String(x.qid||""))&&typeof x.book_id==="string"&&x.book_id&&Number.isSafeInteger(Number(x.book_version))&&Number(x.book_version)>0&&
    String(x.chapter_id||"")&&HEX64.test(String(x.content_hash||""))&&HEX64.test(String(x.entry_sha256||""))&&
    typeof x.entry_url==="string"&&x.entry_url.startsWith("https://kafu-motioncards.blsmohamme97.workers.dev/assets/")&&
    typeof x.package_id==="string"&&Number.isSafeInteger(Number(x.package_revision))&&Number(x.package_revision)>0&&Number.isSafeInteger(Number(x.duration_ms));
}
function cardWrites(env,cards,guardSql,guardArgs){
  if(!Array.isArray(cards)||!cards.length||cards.some(x=>!validCard(x)))return null;
  const raw=JSON.stringify(cards);
  return[
    stmt(env,"INSERT OR IGNORE INTO motioncards_card_versions(qid,book_id,book_version,chapter_id,content_hash,package_id,package_revision,entry_sha256,entry_url,duration_ms) SELECT json_extract(value,'$.qid'),json_extract(value,'$.book_id'),json_extract(value,'$.book_version'),CAST(json_extract(value,'$.chapter_id') AS TEXT),json_extract(value,'$.content_hash'),json_extract(value,'$.package_id'),json_extract(value,'$.package_revision'),json_extract(value,'$.entry_sha256'),json_extract(value,'$.entry_url'),json_extract(value,'$.duration_ms') FROM json_each(?) WHERE EXISTS("+guardSql+")",raw,...guardArgs),
    stmt(env,"INSERT INTO motioncards_cards(qid,book_id,book_version,chapter_id,content_hash,active,package_id,package_revision,entry_sha256,entry_url,duration_ms,updated_at) SELECT json_extract(value,'$.qid'),json_extract(value,'$.book_id'),json_extract(value,'$.book_version'),CAST(json_extract(value,'$.chapter_id') AS TEXT),json_extract(value,'$.content_hash'),1,json_extract(value,'$.package_id'),json_extract(value,'$.package_revision'),json_extract(value,'$.entry_sha256'),json_extract(value,'$.entry_url'),json_extract(value,'$.duration_ms'),datetime('now') FROM json_each(?) WHERE EXISTS("+guardSql+") ON CONFLICT(qid) DO UPDATE SET book_id=excluded.book_id,book_version=excluded.book_version,chapter_id=excluded.chapter_id,content_hash=excluded.content_hash,active=1,package_id=excluded.package_id,package_revision=excluded.package_revision,entry_sha256=excluded.entry_sha256,entry_url=excluded.entry_url,duration_ms=excluded.duration_ms,updated_at=datetime('now')",raw,...guardArgs)
  ];
}
export async function finishMotioncards(env,body){
  const key=String(body.group_key||""),lease=String(body.lease_token||"");
  if(body.ok){
    if(!HEX64.test(String(body.package_sha256||""))||!Number.isSafeInteger(body.animations)||body.animations<1||!Array.isArray(body.cards)||body.cards.length!==body.animations)return{ok:false,status:400,error:"motioncards_finish_invalid"};
    const digest=String(body.package_sha256).toLowerCase();
    const guard="SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')";
    const cw=cardWrites(env,body.cards,guard,[key,lease]);if(!cw)return{ok:false,status:400,error:"motioncards_cards_invalid"};
    const results=await env.DB.batch([
      ...cw,
      stmt(env,"INSERT INTO motioncards_publications(group_key,package_id,revision,package_sha256,animations) SELECT group_key,package_id,revision,?,? FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now') ON CONFLICT(group_key) DO UPDATE SET package_sha256=excluded.package_sha256,animations=excluded.animations,published_at=datetime('now')",digest,body.animations,key,lease),
      stmt(env,"UPDATE motioncards_groups SET status='published',finished_at=datetime('now'),error_summary=NULL,published_digest=?,lease_token=NULL,lease_expires_at=NULL,replacement_auth_json=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",digest,key,lease)
    ]);
    if(!results.at(-1)?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
    return{ok:true,status:200};
  }
  const error=String(body.error||"motioncards_publish_failed").slice(0,400);
  const result=await stmt(env,"UPDATE motioncards_groups SET status='failed',finished_at=datetime('now'),error_summary=?,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",error,key,lease).run();
  if(!result?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
  return{ok:true,status:200};
}
export async function finishMotioncardsOperation(env,body){
  const id=String(body.operation_id||""),lease=String(body.lease_token||"");
  const op=await stmt(env,"SELECT * FROM motioncards_operations WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",id,lease).first();
  if(!op)return{ok:false,status:409,error:"motioncards_operation_lease_invalid_or_expired"};
  if(!body.ok){
    const error=String(body.error||"motioncards_management_failed").slice(0,400);
    const changed=await stmt(env,"UPDATE motioncards_operations SET status='failed',finished_at=datetime('now'),error_summary=?,lease_token=NULL,lease_expires_at=NULL WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",error,id,lease).run();
    return changed?.meta?.changes?{ok:true,status:200}:{ok:false,status:409,error:"motioncards_operation_lease_invalid_or_expired"};
  }
  const card=body.card;if(!card||!validCard(card)||String(card.qid)!==String(op.qid))return{ok:false,status:400,error:"motioncards_operation_card_invalid"};
  const guard="SELECT 1 FROM motioncards_operations WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')";
  const writes=[];
  if(op.kind==="remove"){
    writes.push(stmt(env,"UPDATE motioncards_cards SET active=0,updated_at=datetime('now') WHERE qid=? AND entry_sha256=? AND EXISTS("+guard+")",op.qid,op.expected_active_digest,id,lease));
  }else{
    const cw=cardWrites(env,[card],guard,[id,lease]);if(!cw)return{ok:false,status:400,error:"motioncards_operation_card_invalid"};writes.push(...cw);
  }
  writes.push(stmt(env,"UPDATE motioncards_operations SET status='published',finished_at=datetime('now'),error_summary=NULL,lease_token=NULL,lease_expires_at=NULL WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",id,lease));
  const results=await env.DB.batch(writes);
  if(!results.at(-1)?.meta?.changes)return{ok:false,status:409,error:"motioncards_operation_lease_invalid_or_expired"};
  return{ok:true,status:200};
}
export async function stageReplacementConfirmation(env,body){
  const key=String(body.group_key||""),lease=String(body.lease_token||""),digest=String(body.candidate_digest||"").toLowerCase();
  const targets=Array.isArray(body.targets)?body.targets:[];
  if(!HEX64.test(digest)||!targets.length||targets.some(x=>!QID.test(String(x.qid||""))||!HEX64.test(String(x.expected_active_digest||""))||String(x.candidate_digest||"").toLowerCase()!==digest))
    return{ok:false,status:400,error:"motioncards_replacement_candidate_invalid"};
  const group=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",key,lease).first();
  if(!group)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
  const token=randomToken(),auth=Object.fromEntries(targets.map(x=>[x.qid,x]));
  const changed=await stmt(env,"UPDATE motioncards_groups SET status='awaiting_confirmation',candidate_digest=?,replacement_targets_json=?,replacement_auth_json=NULL,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='running' AND lease_token=?",digest,JSON.stringify(targets),key,lease).run();
  if(!changed?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
  await stmt(env,"INSERT INTO motioncards_confirmations(token,kind,group_key,owner_id,chat_id,candidate_digest,targets_json,expires_at) VALUES(?,'replace',?,?,?,?,?,datetime('now','+15 minutes'))",token,key,String(env.OWNER_TELEGRAM_ID),String(env.OWNER_TELEGRAM_ID),digest,JSON.stringify(auth)).run();
  return{ok:true,status:200,token,group_key:key,targets};
}
export async function getMotioncardManagement(env,qid){
  if(!QID.test(String(qid||"")))return null;
  const card=await stmt(env,"SELECT * FROM motioncards_cards WHERE qid=?",qid).first();
  if(!card)return null;
  const versions=await stmt(env,"SELECT * FROM motioncards_card_versions WHERE qid=? AND book_id=? AND book_version=? AND chapter_id=? AND content_hash=? ORDER BY version_id DESC LIMIT 8",qid,card.book_id,card.book_version,String(card.chapter_id),card.content_hash).all();
  return{card,versions:versions.results||[]};
}
export async function createMotioncardConfirmation(env,kind,qid,targetVersionId=null){
  if(!["remove","restore"].includes(kind)||!QID.test(String(qid||"")))return{ok:false,error:"motioncards_management_invalid"};
  const card=await stmt(env,"SELECT * FROM motioncards_cards WHERE qid=?",qid).first();
  if(!card)return{ok:false,error:"motioncards_card_not_found"};
  if(kind==="remove"&&!Number(card.active))return{ok:false,error:"motioncards_card_already_removed"};
  let target=null;
  if(kind==="restore"){
    if(!Number.isSafeInteger(Number(targetVersionId)))return{ok:false,error:"motioncards_restore_version_invalid"};
    target=await stmt(env,"SELECT * FROM motioncards_card_versions WHERE version_id=? AND qid=?",Number(targetVersionId),qid).first();
    if(!target)return{ok:false,error:"motioncards_restore_version_missing"};
    if(Number(card.active)&&target.entry_sha256===card.entry_sha256)return{ok:false,error:"motioncards_restore_already_active"};
  }
  const token=randomToken(),expected=Number(card.active)?String(card.entry_sha256):"";
  const identity={book_id:String(target?.book_id||card.book_id),book_version:Number(target?.book_version||card.book_version),chapter_id:String(target?.chapter_id||card.chapter_id),qid:String(qid)};
  await stmt(env,"INSERT INTO motioncards_confirmations(token,kind,qid,owner_id,chat_id,expected_active_digest,target_digest,targets_json,expires_at) VALUES(?,?,?,?,?,?,?,?,datetime('now','+10 minutes'))",token,kind,qid,String(env.OWNER_TELEGRAM_ID),String(env.OWNER_TELEGRAM_ID),expected,target?String(target.entry_sha256):null,JSON.stringify(identity)).run();
  return{ok:true,token,kind,qid,expected_active_digest:expected,target};
}
export async function confirmMotioncardAction(env,token){
  const owner=String(env.OWNER_TELEGRAM_ID),row=await stmt(env,"SELECT * FROM motioncards_confirmations WHERE token=? AND owner_id=? AND chat_id=? AND used_at IS NULL AND expires_at>datetime('now')",String(token||""),owner,owner).first();
  if(!row)return{ok:false,text:"❌ MotionCards confirmation expired, stale, or already used."};
  if(row.kind==="replace"){
    const group=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=? AND status='awaiting_confirmation' AND candidate_digest=?",row.group_key,row.candidate_digest).first();
    if(!group)return{ok:false,text:"❌ Replacement candidate is stale; upload or inspect the current card again."};
    let auth;try{auth=JSON.parse(row.targets_json||"{}")}catch(_){return{ok:false,text:"❌ Replacement confirmation data is invalid."};}
    for(const [qid,target] of Object.entries(auth)){
      const card=await stmt(env,"SELECT * FROM motioncards_cards WHERE qid=? AND active=1",qid).first();
      if(!card||String(card.entry_sha256)!==String(target.expected_active_digest)||String(card.package_id)!==String(target.expected_active_package_id)||Number(card.package_revision)!==Number(target.expected_active_package_revision))
        return{ok:false,text:"❌ Replacement target changed since validation; inspect the card again."};
    }
    const results=await env.DB.batch([
      stmt(env,"UPDATE motioncards_groups SET status='ready',replacement_auth_json=?,error_summary=NULL WHERE group_key=? AND status='awaiting_confirmation' AND candidate_digest=?",row.targets_json,row.group_key,row.candidate_digest),
      stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE token=? AND used_at IS NULL AND expires_at>datetime('now')",row.token)
    ]);
    if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)return{ok:false,text:"❌ Replacement confirmation became stale."};
    return{ok:true,dispatch:true,text:"📥 Confirmed replacement "+row.group_key+"; validation/publishing queued."};
  }
  const card=await stmt(env,"SELECT * FROM motioncards_cards WHERE qid=?",row.qid).first();
  const current=card&&Number(card.active)?String(card.entry_sha256):"";
  if(current!==String(row.expected_active_digest||""))return{ok:false,text:"❌ MotionCards state changed; inspect the card again before confirming."};
  const identity=JSON.parse(row.targets_json||"{}"),op="mcop-"+row.token;
  const results=await env.DB.batch([
    stmt(env,"INSERT OR IGNORE INTO motioncards_operations(operation_id,kind,qid,book_id,book_version,chapter_id,status,owner_id,chat_id,expected_active_digest,target_digest) VALUES(?,?,?,?,?,?,'ready',?,?,?,?)",op,row.kind,row.qid,identity.book_id,identity.book_version,String(identity.chapter_id),owner,owner,String(row.expected_active_digest||""),row.target_digest),
    stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE token=? AND used_at IS NULL AND expires_at>datetime('now')",row.token)
  ]);
  if(!results[1]?.meta?.changes)return{ok:false,text:"❌ MotionCards confirmation became stale."};
  return{ok:true,dispatch:true,text:"📥 "+row.kind+" queued for "+row.qid+"."};
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
  const [g,o]=await Promise.all([
    stmt(env,"SELECT group_key,status,attempts,error_summary FROM motioncards_groups ORDER BY created_at DESC LIMIT 12").all(),
    stmt(env,"SELECT operation_id,kind,qid,status,attempts,error_summary FROM motioncards_operations ORDER BY created_at DESC LIMIT 8").all()
  ]);
  return[...(g.results||[]).map(x=>x.group_key+": "+x.status+" ("+x.attempts+" attempts)"+(x.error_summary?" — "+x.error_summary:"")),
    ...(o.results||[]).map(x=>x.operation_id+" "+x.kind+" "+x.qid+": "+x.status+(x.error_summary?" — "+x.error_summary:""))].join("\n")||"MotionCards queue empty.";
}
