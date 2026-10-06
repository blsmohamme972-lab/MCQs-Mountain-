(function(root){
"use strict";
const API=root.KafuMotionCards=root.KafuMotionCards||{};
API.VERSION=1;API.PROTOCOL=1;
API.CONTENT_BASE="https://kafu-motioncards.blsmohamme97.workers.dev";
const HEX64=/^[a-f0-9]{64}$/i,QID=/^Q\d{9}$/;
function canonicalJson(value){
  if(value===null)return"null";
  if(typeof value==="string")return JSON.stringify(value);
  if(typeof value==="boolean")return value?"true":"false";
  if(typeof value==="number"){if(!Number.isFinite(value))throw new TypeError("non_finite_number");return JSON.stringify(value);}
  if(Array.isArray(value))return"["+value.map(canonicalJson).join(",")+"]";
  if(typeof value==="object")return"{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonicalJson(value[k])).join(",")+"}";
  throw new TypeError("unsupported_json_value");
}
async function sha256Hex(text){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function questionHash(q){return sha256Hex(canonicalJson(q));}
function validRecord(r,q,entry){
  return !!r&&r.qid===q.id&&QID.test(r.qid)&&String(r.book_id)===String(entry.b)&&Number(r.book_version)===Number(q.version)&&String(r.chapter_id)===String(entry.ch)&&HEX64.test(String(r.content_hash||""))&&Number.isInteger(r.duration_ms)&&r.duration_ms>=2000&&r.duration_ms<=30000&&typeof r.entry_url==="string"&&r.entry_url.startsWith(API.CONTENT_BASE+"/assets/")&&HEX64.test(String(r.entry_sha256||""));
}
function validMessage(m,active){
  return !!m&&m.protocol===API.PROTOCOL&&m.channel_id===active.channel&&m.qid===active.qid&&["ready","state","ended","error"].includes(m.type);
}
API.core={canonicalJson,sha256Hex,questionHash,validRecord,validMessage,HEX64,QID};
})(globalThis);
