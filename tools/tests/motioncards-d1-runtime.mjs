import { Miniflare } from "miniflare";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  queueMotioncardsDocument, claimMotioncards, finishMotioncards,
  stageReplacementConfirmation, recoverMotioncards
} from "../../worker/motioncards-queue.mjs";

const mf=new Miniflare({
  modules:true,
  script:'export default {fetch(){return new Response("motioncards d1 test")}}',
  compatibilityDate:"2026-07-30",
  d1Databases:{DB:"motioncards-d1-runtime"},
});

const doc=(name,unique)=>({
  file_name:name,file_id:"file-"+unique,file_unique_id:"unique-"+unique,file_size:1234,
});
const card=(qid,id="PKG",rev=1,sha="a".repeat(64))=>({
  qid,book_id:"BOOK",book_version:1,chapter_id:"1",content_hash:"b".repeat(64),
  package_id:id,package_revision:rev,entry_sha256:sha,
  entry_url:`https://kafu-motioncards.blsmohamme97.workers.dev/assets/${id}/r${rev}/${qid}.${sha.slice(0,12)}.html`,
  duration_ms:6000,final_panel:{takeaway:"x",correct_answer_statements:["A"]},
});
const snapshot=(c,active=true,versions=[c])=>({qid:c.qid,card:{...c,active},versions:versions.map(x=>({...x}))});

try{
  const DB=await mf.getD1Database("DB");
  const sql=readFileSync(new URL("../../migrations/0006_motioncards_queue.sql",import.meta.url),"utf8");
  await DB.exec(sql);
  const env={DB,OWNER_TELEGRAM_ID:"123"};

  // Workerd/D1: two different files racing for one part cannot both win.
  const [a,b]=await Promise.all([
    queueMotioncardsDocument(env,doc("MCARDS_RACE_r1.zip","a")),
    queueMotioncardsDocument(env,doc("MCARDS_RACE_r1.zip","b")),
  ]);
  assert.equal([a,b].filter(x=>x.dispatch).length,1);
  assert.equal([a,b].filter(x=>/different MotionCards ZIP/.test(x.text)).length,1);
  const occupied=await DB.prepare("SELECT telegram_file_unique_id FROM motioncards_queue WHERE group_key='RACE_r1' AND part_index=1").first();
  assert.ok(["unique-a","unique-b"].includes(occupied.telegram_file_unique_id));
  await DB.prepare("UPDATE motioncards_groups SET status='failed',attempts=max_attempts WHERE group_key='RACE_r1'").run();

  // Durable publication exists, but first queue acknowledgement was lost.
  await queueMotioncardsDocument(env,doc("MCARDS_RECOVER_r1.zip","recover"));
  const claim=await claimMotioncards(env);
  assert.equal(claim.kind,"motioncards");
  const current=card("Q000000901","RECOVER",1,"c".repeat(64));
  const done=await finishMotioncards(env,{
    group_key:"RECOVER_r1",lease_token:claim.lease_token,ok:true,duplicate:true,
    animations:1,package_sha256:"d".repeat(64),cards:[current],
    reconciliation:[snapshot(current,true,[current])],
  });
  assert.equal(done.status,200);
  assert.equal(done.reconciled,true);
  assert.equal((await DB.prepare("SELECT active FROM motioncards_cards WHERE qid=?").bind(current.qid).first()).active,1);
  assert.equal((await DB.prepare("SELECT COUNT(*) n FROM motioncards_card_versions WHERE qid=?").bind(current.qid).first()).n,1);

  // Once acknowledgement exists, a later duplicate cannot overwrite newer D1 management state.
  const newer=card(current.qid,"NEWER",9,"e".repeat(64));
  await DB.prepare("UPDATE motioncards_cards SET active=0,package_id=?,package_revision=?,entry_sha256=?,entry_url=? WHERE qid=?")
    .bind(newer.package_id,newer.package_revision,newer.entry_sha256,newer.entry_url,current.qid).run();
  await DB.prepare("INSERT OR IGNORE INTO motioncards_card_versions(qid,book_id,book_version,chapter_id,content_hash,package_id,package_revision,entry_sha256,entry_url,duration_ms) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(newer.qid,newer.book_id,newer.book_version,newer.chapter_id,newer.content_hash,newer.package_id,newer.package_revision,newer.entry_sha256,newer.entry_url,newer.duration_ms).run();
  await DB.prepare("UPDATE motioncards_groups SET status='ready',lease_token=NULL,lease_expires_at=NULL WHERE group_key='RECOVER_r1'").run();
  const again=await claimMotioncards(env);
  const noOp=await finishMotioncards(env,{
    group_key:"RECOVER_r1",lease_token:again.lease_token,ok:true,duplicate:true,
    animations:1,package_sha256:"d".repeat(64),cards:[current],
    reconciliation:[snapshot(current,true,[current])],
  });
  assert.equal(noOp.status,200);
  assert.equal(noOp.reconciled,false);
  const preserved=await DB.prepare("SELECT active,package_id,package_revision,entry_sha256 FROM motioncards_cards WHERE qid=?").bind(current.qid).first();
  assert.equal(preserved.active,0);assert.equal(preserved.package_id,"NEWER");assert.equal(preserved.package_revision,9);assert.equal(preserved.entry_sha256,newer.entry_sha256);

  // Expired replacement can be renewed from its existing parts and current target.
  const targetCard=card("Q000000902","OLD",1,"f".repeat(64));
  await DB.prepare("INSERT INTO motioncards_cards(qid,book_id,book_version,chapter_id,content_hash,active,package_id,package_revision,entry_sha256,entry_url,duration_ms) VALUES(?,?,?,?,?,1,?,?,?,?,?)")
    .bind(targetCard.qid,targetCard.book_id,targetCard.book_version,targetCard.chapter_id,targetCard.content_hash,targetCard.package_id,targetCard.package_revision,targetCard.entry_sha256,targetCard.entry_url,targetCard.duration_ms).run();
  await DB.prepare("INSERT OR IGNORE INTO motioncards_card_versions(qid,book_id,book_version,chapter_id,content_hash,package_id,package_revision,entry_sha256,entry_url,duration_ms) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(targetCard.qid,targetCard.book_id,targetCard.book_version,targetCard.chapter_id,targetCard.content_hash,targetCard.package_id,targetCard.package_revision,targetCard.entry_sha256,targetCard.entry_url,targetCard.duration_ms).run();
  await queueMotioncardsDocument(env,doc("MCARDS_RENEW_r2.zip","renew"));
  const pendingClaim=await claimMotioncards(env),digest="1".repeat(64);
  const target={qid:targetCard.qid,book_id:"BOOK",book_version:1,chapter_id:"1",candidate_digest:digest,
    expected_active_digest:targetCard.entry_sha256,expected_active_package_id:"OLD",expected_active_package_revision:1};
  const staged=await stageReplacementConfirmation(env,{group_key:"RENEW_r2",lease_token:pendingClaim.lease_token,candidate_digest:digest,targets:[target]});
  assert.equal(staged.status,200);
  await DB.prepare("UPDATE motioncards_confirmations SET expires_at=datetime('now','-1 minute') WHERE token=?").bind(staged.token).run();
  const renewed=await recoverMotioncards(env,"renew","RENEW_r2");
  assert.equal(renewed.ok,true);assert.equal(renewed.dispatch,true);
  assert.equal((await DB.prepare("SELECT status FROM motioncards_groups WHERE group_key='RENEW_r2'").first()).status,"ready");
  assert.ok((await DB.prepare("SELECT used_at FROM motioncards_confirmations WHERE token=?").bind(staged.token).first()).used_at);

  console.log(JSON.stringify({motioncards_d1_runtime:true,concurrent_intake:true,lost_ack_reconciled:true,acknowledged_duplicate_noop:true,confirmation_renewal:true}));
}finally{
  await mf.dispose();
}
