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

  const before=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=?",p.group_key).first();
  const occupied=await stmt(env,"SELECT telegram_file_unique_id,file_size,filename FROM motioncards_queue WHERE group_key=? AND part_index=?",p.group_key,p.part).first();
  if(occupied&&occupied.telegram_file_unique_id===doc.file_unique_id&&Number(occupied.file_size)===Number(doc.file_size)&&occupied.filename===doc.file_name)
    return{text:"📥 MotionCards already received",dispatch:false};
  if(before&&["running","awaiting_confirmation","published"].includes(before.status))
    return{text:"❌ This MotionCards revision is running, awaiting confirmation, or published and cannot be overwritten.",dispatch:false};
  if(before&&Number(before.part_total)!==p.total)
    return{text:"❌ MotionCards upload has a different part count; clear the failed batch explicitly before changing its shape.",dispatch:false};
  if(before?.status==="failed"&&Number(before.attempts)>=Number(before.max_attempts))
    return{text:"❌ MotionCards retry limit reached; upload a new revision after review.",dispatch:false};

  const writes=[];let partIndexes=[];
  if(before?.status==="failed"){
    // Repair is allowed only while the group is still failed inside this transaction.
    partIndexes=[0,1];
    writes.push(stmt(env,"INSERT OR IGNORE INTO motioncards_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='failed' AND part_total=? AND attempts<max_attempts)",p.group_key,p.part,p.total,doc.file_id,doc.file_unique_id,doc.file_name,doc.file_size,p.group_key,p.total));
    writes.push(stmt(env,"UPDATE motioncards_queue SET part_total=?,telegram_file_id=?,telegram_file_unique_id=?,filename=?,file_size=?,created_at=datetime('now') WHERE group_key=? AND part_index=? AND EXISTS(SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='failed' AND part_total=? AND attempts<max_attempts)",p.total,doc.file_id,doc.file_unique_id,doc.file_name,doc.file_size,p.group_key,p.part,p.group_key,p.total));
    writes.push(stmt(env,"UPDATE motioncards_groups SET status='waiting',error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL,candidate_digest=NULL,replacement_targets_json=NULL,replacement_auth_json=NULL WHERE group_key=? AND status='failed' AND part_total=? AND attempts<max_attempts",p.group_key,p.total));
  }else{
    partIndexes=[1];
    writes.push(stmt(env,"INSERT OR IGNORE INTO motioncards_groups(group_key,package_id,revision,part_total,status) VALUES(?,?,?,?, 'waiting')",p.group_key,p.package_id,p.revision,p.total));
    writes.push(stmt(env,"INSERT OR IGNORE INTO motioncards_queue(group_key,part_index,part_total,telegram_file_id,telegram_file_unique_id,filename,file_size) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM motioncards_groups WHERE group_key=? AND package_id=? AND revision=? AND part_total=? AND status IN ('waiting','ready'))",p.group_key,p.part,p.total,doc.file_id,doc.file_unique_id,doc.file_name,doc.file_size,p.group_key,p.package_id,p.revision,p.total));
  }
  writes.push(stmt(env,"UPDATE motioncards_groups SET status=CASE WHEN (SELECT COUNT(*) FROM motioncards_queue WHERE group_key=?)=part_total THEN 'ready' ELSE 'waiting' END WHERE group_key=? AND package_id=? AND revision=? AND part_total=? AND status IN ('waiting','ready')",p.group_key,p.group_key,p.package_id,p.revision,p.total));
  const results=await env.DB.batch(writes),partChanged=partIndexes.some(i=>Number(results[i]?.meta?.changes||0)>0);

  const [group,part]=await Promise.all([
    stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=?",p.group_key).first(),
    stmt(env,"SELECT * FROM motioncards_queue WHERE group_key=? AND part_index=?",p.group_key,p.part).first()
  ]);
  if(!group||String(group.package_id)!==p.package_id||Number(group.revision)!==p.revision||Number(group.part_total)!==p.total)
    return{text:"❌ MotionCards queue identity changed; retry after inspecting status.",dispatch:false};
  if(!part||part.telegram_file_unique_id!==doc.file_unique_id||Number(part.file_size)!==Number(doc.file_size)||part.filename!==doc.file_name)
    return{text:"❌ A different MotionCards ZIP already occupies this part.",dispatch:false};
  if(!["waiting","ready"].includes(group.status))
    return{text:"❌ MotionCards queue state changed before intake completed; no part was replaced.",dispatch:false};
  const count=await stmt(env,"SELECT COUNT(*) AS n FROM motioncards_queue WHERE group_key=?",p.group_key).first();
  if(!partChanged)return{text:"📥 MotionCards already received",dispatch:false};
  return{text:"📥 MotionCards "+p.group_key+" ("+Number(count?.n||0)+"/"+p.total+")",dispatch:group.status==="ready"};
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
function validReconciliation(snapshot){
  if(!snapshot||!QID.test(String(snapshot.qid||""))||!snapshot.card||typeof snapshot.card.active!=="boolean"||!validCard(snapshot.card)||String(snapshot.card.qid)!==String(snapshot.qid))return false;
  if(!Array.isArray(snapshot.versions)||snapshot.versions.some(v=>!validCard(v)||String(v.qid)!==String(snapshot.qid)))return false;
  const ref=snapshot.card;
  return snapshot.versions.every(v=>String(v.book_id)===String(ref.book_id)&&Number(v.book_version)===Number(ref.book_version)&&String(v.chapter_id)===String(ref.chapter_id)&&String(v.content_hash).toLowerCase()===String(ref.content_hash).toLowerCase());
}
function reconciliationWrites(env,snapshots,guardSql,guardArgs,extraSql="1",extraArgs=[]){
  if(!Array.isArray(snapshots)||!snapshots.length||snapshots.some(x=>!validReconciliation(x)))return null;
  const versions=snapshots.flatMap(x=>x.versions||[]),cards=snapshots.map(x=>({...x.card,active:x.card.active===true}));
  const versionRaw=JSON.stringify(versions),cardRaw=JSON.stringify(cards),where="EXISTS("+guardSql+") AND ("+extraSql+")";
  return[
    stmt(env,"INSERT OR IGNORE INTO motioncards_card_versions(qid,book_id,book_version,chapter_id,content_hash,package_id,package_revision,entry_sha256,entry_url,duration_ms) SELECT json_extract(value,'$.qid'),json_extract(value,'$.book_id'),json_extract(value,'$.book_version'),CAST(json_extract(value,'$.chapter_id') AS TEXT),json_extract(value,'$.content_hash'),json_extract(value,'$.package_id'),json_extract(value,'$.package_revision'),json_extract(value,'$.entry_sha256'),json_extract(value,'$.entry_url'),json_extract(value,'$.duration_ms') FROM json_each(?) WHERE "+where,versionRaw,...guardArgs,...extraArgs),
    stmt(env,"INSERT INTO motioncards_cards(qid,book_id,book_version,chapter_id,content_hash,active,package_id,package_revision,entry_sha256,entry_url,duration_ms,updated_at) SELECT json_extract(value,'$.qid'),json_extract(value,'$.book_id'),json_extract(value,'$.book_version'),CAST(json_extract(value,'$.chapter_id') AS TEXT),json_extract(value,'$.content_hash'),CASE WHEN json_extract(value,'$.active') THEN 1 ELSE 0 END,json_extract(value,'$.package_id'),json_extract(value,'$.package_revision'),json_extract(value,'$.entry_sha256'),json_extract(value,'$.entry_url'),json_extract(value,'$.duration_ms'),datetime('now') FROM json_each(?) WHERE "+where+" ON CONFLICT(qid) DO UPDATE SET book_id=excluded.book_id,book_version=excluded.book_version,chapter_id=excluded.chapter_id,content_hash=excluded.content_hash,active=excluded.active,package_id=excluded.package_id,package_revision=excluded.package_revision,entry_sha256=excluded.entry_sha256,entry_url=excluded.entry_url,duration_ms=excluded.duration_ms,updated_at=datetime('now')",cardRaw,...guardArgs,...extraArgs)
  ];
}

export async function finishMotioncards(env,body){
  const key=String(body.group_key||""),lease=String(body.lease_token||"");
  if(body.ok){
    if(!HEX64.test(String(body.package_sha256||""))||!Number.isSafeInteger(body.animations)||body.animations<1)return{ok:false,status:400,error:"motioncards_finish_invalid"};
    const digest=String(body.package_sha256).toLowerCase(),duplicate=body.duplicate===true;
    const guard="SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')";
    const writes=[];let reconciliationIndex=-1;
    if(!duplicate){
      if(!Array.isArray(body.cards)||body.cards.length!==body.animations)return{ok:false,status:400,error:"motioncards_finish_invalid"};
      const cw=cardWrites(env,body.cards,guard,[key,lease]);if(!cw)return{ok:false,status:400,error:"motioncards_cards_invalid"};
      writes.push(...cw);
    }else{
      if(!Array.isArray(body.reconciliation)||!body.reconciliation.length)return{ok:false,status:400,error:"motioncards_reconciliation_required"};
      const rw=reconciliationWrites(env,body.reconciliation,guard,[key,lease],"NOT EXISTS(SELECT 1 FROM motioncards_publications WHERE group_key=? AND package_sha256=?)",[key,digest]);
      if(!rw)return{ok:false,status:400,error:"motioncards_reconciliation_invalid"};
      reconciliationIndex=writes.length+1;writes.push(...rw);
    }
    writes.push(
      stmt(env,"INSERT INTO motioncards_publications(group_key,package_id,revision,package_sha256,animations) SELECT group_key,package_id,revision,?,? FROM motioncards_groups WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now') ON CONFLICT(group_key) DO UPDATE SET package_sha256=excluded.package_sha256,animations=excluded.animations,published_at=datetime('now')",digest,body.animations,key,lease),
      stmt(env,"UPDATE motioncards_groups SET status='published',finished_at=datetime('now'),error_summary=NULL,published_digest=?,lease_token=NULL,lease_expires_at=NULL,replacement_auth_json=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",digest,key,lease)
    );
    const results=await env.DB.batch(writes);
    if(!results.at(-1)?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
    const reconciled=duplicate&&reconciliationIndex>=0&&Number(results[reconciliationIndex]?.meta?.changes||0)>0;
    return{ok:true,status:200,duplicate,reconciled};
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
  const duplicate=body.duplicate===true,guard="SELECT 1 FROM motioncards_operations WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')";
  const writes=[];
  if(duplicate){
    if(!Array.isArray(body.reconciliation)||body.reconciliation.length!==1)return{ok:false,status:400,error:"motioncards_operation_reconciliation_required"};
    const rw=reconciliationWrites(env,body.reconciliation,guard,[id,lease]);if(!rw)return{ok:false,status:400,error:"motioncards_operation_reconciliation_invalid"};
    writes.push(...rw);
  }else{
    const card=body.card;if(!card||!validCard(card)||String(card.qid)!==String(op.qid))return{ok:false,status:400,error:"motioncards_operation_card_invalid"};
    if(op.kind==="remove"){
      writes.push(stmt(env,"UPDATE motioncards_cards SET active=0,updated_at=datetime('now') WHERE qid=? AND entry_sha256=? AND EXISTS("+guard+")",op.qid,op.expected_active_digest,id,lease));
    }else{
      const cw=cardWrites(env,[card],guard,[id,lease]);if(!cw)return{ok:false,status:400,error:"motioncards_operation_card_invalid"};writes.push(...cw);
    }
  }
  writes.push(stmt(env,"UPDATE motioncards_operations SET status='published',finished_at=datetime('now'),error_summary=NULL,lease_token=NULL,lease_expires_at=NULL WHERE operation_id=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",id,lease));
  const results=await env.DB.batch(writes);
  if(!results.at(-1)?.meta?.changes)return{ok:false,status:409,error:"motioncards_operation_lease_invalid_or_expired"};
  return{ok:true,status:200,duplicate,reconciled:duplicate};
}
export async function stageReplacementConfirmation(env,body){
  const key=String(body.group_key||""),lease=String(body.lease_token||""),digest=String(body.candidate_digest||"").toLowerCase();
  const targets=Array.isArray(body.targets)?body.targets:[];
  if(!HEX64.test(digest)||!targets.length||targets.some(x=>!QID.test(String(x.qid||""))||!HEX64.test(String(x.expected_active_digest||""))||
      typeof x.expected_active_package_id!=="string"||!x.expected_active_package_id||!Number.isSafeInteger(Number(x.expected_active_package_revision))||Number(x.expected_active_package_revision)<1||
      String(x.candidate_digest||"").toLowerCase()!==digest))
    return{ok:false,status:400,error:"motioncards_replacement_candidate_invalid"};
  const rawTargets=JSON.stringify(targets);
  const stale=await stmt(env,"SELECT COUNT(*) AS n FROM json_each(?) t LEFT JOIN motioncards_cards c ON c.qid=json_extract(t.value,'$.qid') AND c.active=1 WHERE c.qid IS NULL OR lower(c.entry_sha256)<>lower(json_extract(t.value,'$.expected_active_digest')) OR c.package_id<>json_extract(t.value,'$.expected_active_package_id') OR c.package_revision<>CAST(json_extract(t.value,'$.expected_active_package_revision') AS INTEGER)",rawTargets).first();
  if(Number(stale?.n||0)>0)return{ok:false,status:409,error:"motioncards_replacement_target_stale"};
  const token=randomToken(),auth=Object.fromEntries(targets.map(x=>[x.qid,x])),owner=String(env.OWNER_TELEGRAM_ID);
  const results=await env.DB.batch([
    stmt(env,"UPDATE motioncards_groups SET status='awaiting_confirmation',attempts=CASE WHEN attempts>0 THEN attempts-1 ELSE 0 END,candidate_digest=?,replacement_targets_json=?,replacement_auth_json=NULL,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='running' AND lease_token=? AND lease_expires_at>=datetime('now')",digest,JSON.stringify(targets),key,lease),
    stmt(env,"INSERT INTO motioncards_confirmations(token,kind,group_key,owner_id,chat_id,candidate_digest,targets_json,expires_at) SELECT ?,'replace',?,?,?,?,?,datetime('now','+15 minutes') WHERE EXISTS(SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='awaiting_confirmation' AND candidate_digest=?)",token,key,owner,owner,digest,JSON.stringify(auth),key,digest)
  ]);
  if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)return{ok:false,status:409,error:"motioncards_lease_invalid_or_expired"};
  return{ok:true,status:200,token,group_key:key,targets};
}
export async function getMotioncardManagement(env,qid){
  if(!QID.test(String(qid||"")))return null;
  const card=await stmt(env,"SELECT * FROM motioncards_cards WHERE qid=?",qid).first();
  if(!card)return null;
  const [versions,pending]=await Promise.all([
    stmt(env,"SELECT * FROM motioncards_card_versions WHERE qid=? AND book_id=? AND book_version=? AND chapter_id=? AND content_hash=? ORDER BY version_id DESC LIMIT 8",qid,card.book_id,card.book_version,String(card.chapter_id),card.content_hash).all(),
    stmt(env,"SELECT group_key,candidate_digest,replacement_targets_json FROM motioncards_groups WHERE status='awaiting_confirmation' AND EXISTS(SELECT 1 FROM json_each(replacement_targets_json) WHERE json_extract(value,'$.qid')=?) ORDER BY created_at DESC LIMIT 1",qid).first()
  ]);
  return{card,versions:versions.results||[],pending_replacement:pending||null};
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
  const owner=String(env.OWNER_TELEGRAM_ID),value=String(token||"");
  const row=await stmt(env,"SELECT * FROM motioncards_confirmations WHERE token=? AND owner_id=? AND chat_id=? AND used_at IS NULL AND expires_at>datetime('now')",value,owner,owner).first();
  if(!row)return{ok:false,text:"❌ MotionCards confirmation expired, stale, or already used."};

  if(row.kind==="replace"){
    let auth;try{auth=JSON.parse(row.targets_json||"{}")}catch(_){return{ok:false,text:"❌ Replacement confirmation data is invalid."};}
    if(!auth||Array.isArray(auth)||!Object.keys(auth).length)return{ok:false,text:"❌ Replacement confirmation data is invalid."};
    const envelope=JSON.stringify({confirmation_token:row.token,targets:auth});
    const results=await env.DB.batch([
      stmt(env,"UPDATE motioncards_groups SET status='ready',replacement_auth_json=?,error_summary=NULL WHERE group_key=? AND status='awaiting_confirmation' AND candidate_digest=? AND EXISTS(SELECT 1 FROM motioncards_confirmations c WHERE c.token=? AND c.kind='replace' AND c.group_key=motioncards_groups.group_key AND c.owner_id=? AND c.chat_id=? AND c.used_at IS NULL AND c.expires_at>datetime('now') AND c.candidate_digest=motioncards_groups.candidate_digest AND NOT EXISTS(SELECT 1 FROM json_each(c.targets_json) t LEFT JOIN motioncards_cards card ON card.qid=t.key AND card.active=1 WHERE card.qid IS NULL OR lower(card.entry_sha256)<>lower(json_extract(t.value,'$.expected_active_digest')) OR card.package_id<>json_extract(t.value,'$.expected_active_package_id') OR card.package_revision<>CAST(json_extract(t.value,'$.expected_active_package_revision') AS INTEGER) OR lower(json_extract(t.value,'$.candidate_digest'))<>lower(c.candidate_digest)))",envelope,row.group_key,row.candidate_digest,row.token,owner,owner),
      stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE token=? AND kind='replace' AND owner_id=? AND chat_id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM motioncards_groups g WHERE g.group_key=motioncards_confirmations.group_key AND g.status='ready' AND g.candidate_digest=motioncards_confirmations.candidate_digest AND g.replacement_auth_json=?)",row.token,owner,owner,envelope)
    ]);
    if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)return{ok:false,text:"❌ Replacement confirmation became stale."};
    return{ok:true,dispatch:true,text:"📥 Confirmed replacement "+row.group_key+"; validation/publishing queued."};
  }

  let identity;try{identity=JSON.parse(row.targets_json||"{}")}catch(_){return{ok:false,text:"❌ MotionCards confirmation data is invalid."};}
  if(!identity||Array.isArray(identity)||String(identity.qid||"")!==String(row.qid||""))return{ok:false,text:"❌ MotionCards confirmation data is invalid."};
  const op="mcop-"+row.token;
  const results=await env.DB.batch([
    stmt(env,"INSERT OR IGNORE INTO motioncards_operations(operation_id,kind,qid,book_id,book_version,chapter_id,status,owner_id,chat_id,expected_active_digest,target_digest) SELECT 'mcop-'||c.token,c.kind,c.qid,json_extract(c.targets_json,'$.book_id'),CAST(json_extract(c.targets_json,'$.book_version') AS INTEGER),CAST(json_extract(c.targets_json,'$.chapter_id') AS TEXT),'ready',c.owner_id,c.chat_id,COALESCE(c.expected_active_digest,''),c.target_digest FROM motioncards_confirmations c JOIN motioncards_cards card ON card.qid=c.qid WHERE c.token=? AND c.kind IN ('remove','restore') AND c.owner_id=? AND c.chat_id=? AND c.used_at IS NULL AND c.expires_at>datetime('now') AND COALESCE(CASE WHEN card.active=1 THEN card.entry_sha256 ELSE '' END,'')=COALESCE(c.expected_active_digest,'') AND card.book_id=json_extract(c.targets_json,'$.book_id') AND card.book_version=CAST(json_extract(c.targets_json,'$.book_version') AS INTEGER) AND CAST(card.chapter_id AS TEXT)=CAST(json_extract(c.targets_json,'$.chapter_id') AS TEXT) AND (c.kind='remove' OR EXISTS(SELECT 1 FROM motioncards_card_versions v WHERE v.qid=c.qid AND v.entry_sha256=c.target_digest AND v.book_id=json_extract(c.targets_json,'$.book_id') AND v.book_version=CAST(json_extract(c.targets_json,'$.book_version') AS INTEGER) AND CAST(v.chapter_id AS TEXT)=CAST(json_extract(c.targets_json,'$.chapter_id') AS TEXT)))",row.token,owner,owner),
    stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE token=? AND owner_id=? AND chat_id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM motioncards_operations o WHERE o.operation_id='mcop-'||motioncards_confirmations.token AND o.kind=motioncards_confirmations.kind AND o.qid=motioncards_confirmations.qid AND o.owner_id=motioncards_confirmations.owner_id AND o.chat_id=motioncards_confirmations.chat_id AND COALESCE(o.expected_active_digest,'')=COALESCE(motioncards_confirmations.expected_active_digest,'') AND COALESCE(o.target_digest,'')=COALESCE(motioncards_confirmations.target_digest,''))",row.token,owner,owner)
  ]);
  if(!results[0]?.meta?.changes||!results[1]?.meta?.changes)return{ok:false,text:"❌ MotionCards confirmation became stale."};
  return{ok:true,dispatch:true,text:"📥 "+row.kind+" queued for "+row.qid+"."};
}
export async function recoverMotioncards(env,action,key){
  const p=parseMotioncardsName("MCARDS_"+String(key||"")+".zip");
  if(!p||p.total!==1)return{ok:false,text:"Usage: /motioncards-retry PACKAGE-ID_rN"};
  const group=await stmt(env,"SELECT * FROM motioncards_groups WHERE group_key=?",p.group_key).first();
  if(!group)return{ok:false,text:"❌ No MotionCards upload found."};

  if(group.status==="awaiting_confirmation"){
    if(action==="retry"||action==="renew"){
      const results=await env.DB.batch([
        stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE kind='replace' AND group_key=? AND used_at IS NULL",p.group_key),
        stmt(env,"UPDATE motioncards_groups SET status='ready',candidate_digest=NULL,replacement_targets_json=NULL,replacement_auth_json=NULL,error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL WHERE group_key=? AND status='awaiting_confirmation'",p.group_key)
      ]);
      if(!results[1]?.meta?.changes)return{ok:false,text:"❌ MotionCards replacement state changed; refresh status."};
      return{ok:true,text:"📥 Replacement candidate will be revalidated and a fresh confirmation issued: "+p.group_key,dispatch:true,renewed:true};
    }
    if(action==="clear"||action==="cancel"){
      const results=await env.DB.batch([
        stmt(env,"UPDATE motioncards_confirmations SET used_at=datetime('now') WHERE kind='replace' AND group_key=? AND used_at IS NULL",p.group_key),
        stmt(env,"UPDATE motioncards_groups SET status='failed',finished_at=datetime('now'),error_summary='motioncards_replacement_cancelled_by_owner',candidate_digest=NULL,replacement_targets_json=NULL,replacement_auth_json=NULL,lease_token=NULL,lease_expires_at=NULL WHERE group_key=? AND status='awaiting_confirmation'",p.group_key)
      ]);
      if(!results[1]?.meta?.changes)return{ok:false,text:"❌ MotionCards replacement state changed; refresh status."};
      return{ok:true,text:"🛑 Cancelled pending replacement "+p.group_key+". The active MotionCard was not changed.",dispatch:false,cancelled:true};
    }
  }

  if(group.status!=="failed")return{ok:false,text:"❌ MotionCards upload is not failed or awaiting confirmation."};
  if(action==="clear"){
    const results=await env.DB.batch([
      stmt(env,"DELETE FROM motioncards_queue WHERE group_key=? AND EXISTS(SELECT 1 FROM motioncards_groups WHERE group_key=? AND status='failed')",p.group_key,p.group_key),
      stmt(env,"DELETE FROM motioncards_groups WHERE group_key=? AND status='failed'",p.group_key)
    ]);
    if(!results[1]?.meta?.changes)return{ok:false,text:"❌ MotionCards clear lost the race; current work was left untouched."};
    return{ok:true,text:"🧹 cleared MotionCards "+p.group_key};
  }
  if(action!=="retry")return{ok:false,text:"❌ Invalid MotionCards recovery action."};
  if(group.attempts>=group.max_attempts)return{ok:false,text:"❌ MotionCards retry limit reached; upload a new revision after review."};
  const parts=await stmt(env,"SELECT COUNT(*) AS n FROM motioncards_queue WHERE group_key=?",p.group_key).first();
  const next=Number(parts?.n||0)===Number(group.part_total)?"ready":"waiting";
  const changed=await stmt(env,"UPDATE motioncards_groups SET status=?,error_summary=NULL,lease_token=NULL,lease_expires_at=NULL,finished_at=NULL WHERE group_key=? AND status='failed'",next,p.group_key).run();
  if(!changed?.meta?.changes)return{ok:false,text:"❌ MotionCards retry state changed; refresh status."};
  return{ok:true,text:(next==="ready"?"📥 MotionCards retry queued: ":"📥 MotionCards repair waiting for remaining parts: ")+p.group_key,dispatch:next==="ready"};
}
export async function motioncardsStatus(env){
  const [g,o]=await Promise.all([
    stmt(env,"SELECT group_key,status,attempts,error_summary,replacement_targets_json FROM motioncards_groups ORDER BY created_at DESC LIMIT 12").all(),
    stmt(env,"SELECT operation_id,kind,qid,status,attempts,error_summary FROM motioncards_operations ORDER BY created_at DESC LIMIT 8").all()
  ]);
  return[...(g.results||[]).map(x=>{
      let hint="";
      if(x.status==="awaiting_confirmation"){
        try{const qids=(JSON.parse(x.replacement_targets_json||"[]")||[]).map(v=>v.qid).filter(Boolean);hint=qids.length?" — use /motioncards "+qids[0]+" to Renew/Cancel":"";}catch(_){}
      }
      return x.group_key+": "+x.status+" ("+x.attempts+" attempts)"+(x.error_summary?" — "+x.error_summary:"")+hint;
    }),
    ...(o.results||[]).map(x=>x.operation_id+" "+x.kind+" "+x.qid+": "+x.status+(x.error_summary?" — "+x.error_summary:""))].join("\n")||"MotionCards queue empty.";
}
