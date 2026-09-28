/* Kafu personal sync v2: compact per-writer counters and deterministic registers.
 * Only the injected Telegram CloudStorage performs I/O. No application backend.
 * Immutable chunks are published by a manifest written last; failed writes never
 * destroy the last committed generation. Full answer events remain device-local.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.KafuSyncCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const KEY_LIMIT = 716, VALUE_LIMIT = 4096, CHUNK_SIZE = 3800;
  const QID = /^Q\d{9}$/, ACTOR = /^[a-f0-9]{32}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
  const BOOK = /^[A-Za-z0-9_-]{1,128}$/, KEY = /^[A-Za-z0-9_-]{1,128}$/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const dict = () => Object.create(null);
  const number = n => Number.isSafeInteger(n) && n >= 0;
  const map = value => value && typeof value === "object" && !Array.isArray(value);
  const bookOK = key => typeof key === "string" && BOOK.test(key) && !["__proto__","constructor","prototype"].includes(key);
  const fontOK = value => [0.9,1,1.12,1.25].includes(value);
  const asciiJSON = value => JSON.stringify(value).replace(/[\u007f-\uffff]/g, ch => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
  function resumeOK(value) {
    return value === null || (map(value) && bookOK(value.b) && QID.test(value.q || "") &&
      ((typeof value.ch === "string" && value.ch.length <= 128) || number(value.ch)));
  }
  function randomId() {
    const bytes = new Uint8Array(16);
    if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random generator unavailable");
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  async function digest(text) {
    const raw = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(raw), b => b.toString(16).padStart(2, "0")).join("");
  }
  function empty(id) {
    if (!ACTOR.test(id)) throw new Error("Invalid sync actor");
    return { v:2, id, seq:0, clock:0, epoch:0, legacyImported:false,
      base:{a:dict(),time:dict(),days:dict()}, a:dict(),f:dict(),fb:dict(),time:dict(),days:dict(),fs:dict(),prefs:dict(),r:null };
  }
  function validate(s, expectedId) {
    if (!map(s) || s.v !== 2 || !ACTOR.test(s.id) || (expectedId && s.id !== expectedId) ||
        !number(s.seq) || !number(s.clock) || !number(s.epoch) || !map(s.base)) return false;
    for (const k of ["a","f","fb","time","days","fs","prefs"]) if (!map(s[k])) return false;
    for (const k of ["a","time","days"]) if (!map(s.base[k])) return false;
    for (const [qid,v] of Object.entries(s.a)) if (!QID.test(qid) || !Array.isArray(v) || v.length !== 5 ||
      !number(v[0]) || !number(v[1]) || v[1] > v[0] || !number(v[2]) || typeof v[3] !== "boolean" || !bookOK(v[4])) return false;
    for (const [qid,v] of Object.entries(s.base.a)) if (!QID.test(qid) || !Array.isArray(v) || v.length !== 6 ||
      !number(v[0]) || !number(v[1]) || !number(v[2]) || v[1]+v[2] > v[0] || !number(v[3]) || typeof v[4] !== "boolean" || !bookOK(v[5])) return false;
    for (const [values, kind] of [[s.f,"question"],[s.fb,"book"]]) for (const [key,v] of Object.entries(values))
      if (!(kind === "book" ? bookOK(key) : QID.test(key)) || !Array.isArray(v) || v.length !== 2 || typeof v[0] !== "boolean" || !number(v[1])) return false;
    for (const values of [s.time,s.base.time]) for (const [day,v] of Object.entries(values)) if (!DAY.test(day) || !number(v)) return false;
    for (const values of [s.days,s.base.days]) for (const [day,v] of Object.entries(values)) if (!DAY.test(day) || v !== true) return false;
    for (const [qid,v] of Object.entries(s.fs)) if (!QID.test(qid) || !Array.isArray(v) || v.length !== 2 || !number(v[1]) || !map(v[0]) || asciiJSON(v[0]).length > 3000) return false;
    for (const [key,v] of Object.entries(s.prefs)) if (key !== "fs" || !Array.isArray(v) || v.length !== 2 || !number(v[1]) || !fontOK(v[0])) return false;
    if (s.r !== null && (!Array.isArray(s.r) || s.r.length !== 2 || !number(s.r[1]) || !resumeOK(s.r[0]))) return false;
    return true;
  }
  function legacy(id, state = {}) {
    const s = empty(id);
    for (const [qid,a] of Object.entries(state.answers || {})) {
      if (!QID.test(qid) || !bookOK(a.b) || !number(a.n)) continue;
      const known = number(a.correct_count) ? Math.min(a.n,a.correct_count) : (a.c && a.n ? 1 : 0);
      const unknown = number(a.unknown_count) ? Math.min(a.n-known,a.unknown_count) : Math.max(0,a.n-1);
      const stamp = number(a.t) ? a.t : 0;
      s.base.a[qid] = [a.n,known,unknown,stamp,!!a.c,a.b]; s.clock = Math.max(s.clock,stamp);
    }
    for (const qid of state.fav || []) if (QID.test(qid)) s.f[qid] = [true,0];
    for (const book of state.favBooks || []) if (bookOK(book)) s.fb[book] = [true,0];
    for (const [day,seconds] of Object.entries(state.time || {})) if (DAY.test(day) && number(seconds)) s.base.time[day] = seconds;
    for (const [day,active] of Object.entries(state.active || {})) if (DAY.test(day) && active) s.base.days[day] = true;
    if (state.resume && resumeOK(state.resume)) { const stamp = number(state.resume.t) ? state.resume.t : 0; s.r = [copy(state.resume),stamp]; s.clock = Math.max(s.clock,stamp); }
    for (const [qid,card] of Object.entries(state.fsrs || {})) if (QID.test(qid) && map(card) && asciiJSON(card).length <= 3000) s.fs[qid] = [copy(card),0];
    if (fontOK(state.settings?.fs)) s.prefs.fs = [state.settings.fs,0];
    return s;
  }
  function newer(a,b) { return !b || a.stamp > b.stamp || (a.stamp === b.stamp && a.actor > b.actor); }
  function project(sources) {
    if (!sources.every(s => validate(s))) throw new Error("Invalid sync snapshot");
    const epoch = Math.max(0,...sources.map(s=>s.epoch));
    const answers=dict(),bases=dict(),latest=dict(),fav=dict(),favBooks=dict(),fsrs=dict(),settings=dict(),time=dict(),baseTime=dict(),active=dict();
    let resume=null;
    const put=(target,key,value,stamp,actor)=>{ const item={value,stamp,actor}; if(newer(item,target[key])) target[key]=item; };
    for(const s of sources) {
      const actor=s.id;
      for(const [key,v] of Object.entries(s.f)) put(fav,key,v[0],v[1],actor);
      for(const [key,v] of Object.entries(s.fb)) put(favBooks,key,v[0],v[1],actor);
      for(const [key,v] of Object.entries(s.prefs)) put(settings,key,v[0],v[1],actor);
      if(s.epoch !== epoch) continue; // a deliberate synchronized reset is a tombstone
      for(const [qid,v] of Object.entries(s.base.a)) {
        const prior=bases[qid];
        if(!prior || v[0]>prior.value[0] || (v[0]===prior.value[0] && newer({stamp:v[3],actor},{stamp:prior.value[3],actor:prior.actor}))) bases[qid]={value:v,actor};
        put(latest,qid,{c:v[4],b:v[5]},v[3],actor);
      }
      for(const [qid,v] of Object.entries(s.a)) {
        const sum=answers[qid] || (answers[qid]={n:0,correct_count:0,unknown_count:0});
        sum.n+=v[0]; sum.correct_count+=v[1]; put(latest,qid,{c:v[3],b:v[4]},v[2],actor);
      }
      for(const [key,v] of Object.entries(s.fs)) put(fsrs,key,v[0],v[1],actor);
      for(const [day,seconds] of Object.entries(s.base.time)) baseTime[day]=Math.max(baseTime[day]||0,seconds);
      for(const [day,seconds] of Object.entries(s.time)) time[day]=(time[day]||0)+seconds;
      Object.assign(active,s.base.days,s.days);
      if(s.r) { const item={value:s.r[0],stamp:s.r[1],actor}; if(newer(item,resume)) resume=item; }
    }
    for(const [qid,base] of Object.entries(bases)) {
      const sum=answers[qid] || (answers[qid]={n:0,correct_count:0,unknown_count:0});
      sum.n+=base.value[0]; sum.correct_count+=base.value[1]; sum.unknown_count+=base.value[2];
    }
    for(const [qid,last] of Object.entries(latest)) Object.assign(answers[qid],last.value,{t:last.stamp});
    for(const [day,seconds] of Object.entries(baseTime)) time[day]=(time[day]||0)+seconds;
    return {epoch,answers,fav:Object.keys(fav).filter(k=>fav[k].value).sort(),favBooks:Object.keys(favBooks).filter(k=>favBooks[k].value).sort(),
      fsrs:Object.fromEntries(Object.entries(fsrs).map(([key,item])=>[key,copy(item.value)])),
      settings:Object.fromEntries(Object.entries(settings).map(([key,item])=>[key,item.value])),time,active,resume:resume?copy(resume.value):null};
  }
  class Replica {
    constructor({id,source={},stored=null,now=()=>Date.now()}) {
      this.now=now; this.remote=dict();
      if(stored !== null) {
        if(!stored?.own || !validate(stored.own)) throw new Error("Unsupported local sync state; local progress preserved");
        this.own=copy(stored.own);
        for(const [actor,s] of Object.entries(stored.remote||{})) if(actor!==this.own.id && validate(s,actor)) this.remote[actor]=copy(s);
      } else this.own=legacy(id||randomId(),source);
      this.dirty=true; this.observeReset();
    }
    tick() {
      this.own.seq++;
      this.own.clock=Math.max(Math.floor(this.now()),this.own.clock+1,...Object.values(this.remote).map(s=>s.clock+1));
      this.dirty=true; return this.own.clock;
    }
    sources(){return [this.own,...Object.values(this.remote)];}
    project(){return project(this.sources());}
    export(){return {own:copy(this.own),remote:copy(this.remote)};}
    clearProgress(epoch) {
      Object.assign(this.own,{epoch,base:{a:dict(),time:dict(),days:dict()},a:dict(),time:dict(),days:dict(),fs:dict(),r:[null,epoch]});
      this.tick();
    }
    observeReset(){const epoch=Math.max(this.own.epoch,...Object.values(this.remote).map(s=>s.epoch));if(epoch>this.own.epoch)this.clearProgress(epoch);}
    resetProgress(){this.clearProgress(this.tick());}
    merge(s) {
      if(!validate(s))throw new Error("Invalid sync snapshot");
      if(s.id===this.own.id) { if(s.seq>this.own.seq)this.own=copy(s); }
      else if(!this.remote[s.id] || s.seq>this.remote[s.id].seq)this.remote[s.id]=copy(s);
      this.observeReset();
    }
    forkWriter(id=randomId()) {
      const old=copy(this.own);this.remote[old.id]=old;this.own=empty(id);
      this.own.clock=old.clock;this.own.epoch=old.epoch;this.own.legacyImported=true;this.tick();
    }
    answer(qid,correct,book,day) {
      if(!QID.test(qid)||!bookOK(book)||!DAY.test(day))throw new Error("Invalid answer identity");
      const prior=this.own.a[qid]||[0,0,0,false,book],stamp=this.tick();
      this.own.a[qid]=[prior[0]+1,prior[1]+(correct?1:0),stamp,!!correct,book];this.own.days[day]=true;
      return {id:this.own.id+"_"+this.own.seq,qid,correct:!!correct,at:stamp,book};
    }
    favorite(kind,key,enabled){const values=kind==="book"?this.own.fb:this.own.f;if(!(kind==="book"?bookOK(key):QID.test(key)))return;values[key]=[!!enabled,this.tick()];}
    addTime(day,seconds){if(!DAY.test(day)||!number(seconds)||!seconds)return;this.tick();this.own.time[day]=(this.own.time[day]||0)+seconds;}
    setResume(value){if(!resumeOK(value))return;const stamp=this.tick();this.own.r=[value?{b:value.b,ch:value.ch,q:value.q,t:stamp}:null,stamp];}
    setFSRS(qid,card){if(!QID.test(qid)||!map(card)||asciiJSON(card).length>3000)return;this.own.fs[qid]=[copy(card),this.tick()];}
    preference(key,value){if(key==="fs"&&fontOK(value))this.own.prefs[key]=[value,this.tick()];}
    importLegacy(values) {
      if(this.own.legacyImported)return;
      let total=0;
      if(typeof values.v1_fav==="string")for(const word of values.v1_fav.split(".")) {
        if(!/^[a-z0-9]+$/i.test(word))continue;total+=parseInt(word,36);const qid="Q"+String(total).padStart(9,"0");
        if(QID.test(qid)&&!Object.hasOwn(this.own.f,qid))this.own.f[qid]=[true,0];
      }
      if(typeof values.v1_favbooks==="string")for(const book of values.v1_favbooks.split("."))if(bookOK(book)&&!Object.hasOwn(this.own.fb,book))this.own.fb[book]=[true,0];
      if(!this.own.epoch)try{const r=JSON.parse(values.v1_resume||"null");if(r&&resumeOK(r)&&number(r.t)&&(!this.own.r||r.t>this.own.r[1]))this.own.r=[r,r.t];}catch(_){}
      this.own.legacyImported=true;this.tick();
    }
  }
  class CapacityError extends Error{constructor(){super("Telegram sync capacity reached; all progress remains on this device");this.name="CapacityError";}}
  class IncompleteError extends Error{constructor(){super("Incomplete Telegram snapshot; keeping the previous local copy");this.name="IncompleteError";}}
  const metaKey=id=>"k2m_"+id;
  const chunkKey=(id,r,i)=>"k2c_"+id+"_"+r+"_"+i.toString(36);
  const descriptorValid=v=>v&&typeof v.r==="string"&&/^[a-z0-9_]{1,64}$/.test(v.r)&&Number.isSafeInteger(v.n)&&v.n>=1&&v.n<=KEY_LIMIT&&typeof v.hash==="string"&&/^[a-f0-9]{64}$/.test(v.hash)&&number(v.seq);
  class CloudClient {
    constructor(replica,cloud,{timeout=6000}={}){Object.assign(this,{replica,cloud,timeout,busy:null,status:cloud?"pending":"local-only",lastSuccess:0,usedKeys:null});}
    rpc(method,...args){return new Promise((resolve,reject)=>{
      if(!this.cloud||typeof this.cloud[method]!=="function")return reject(new Error("CloudStorage unavailable"));
      const timer=setTimeout(()=>reject(new Error("CloudStorage timeout")),this.timeout);
      try{this.cloud[method](...args,(error,value)=>{clearTimeout(timer);if(error||((method==="setItem"||method==="removeItems")&&value===false))reject(new Error("CloudStorage operation failed"));else resolve(value);});}
      catch(_){clearTimeout(timer);reject(new Error("CloudStorage unavailable"));}
    });}
    async keys(){const keys=await this.rpc("getKeys");if(!Array.isArray(keys))throw new IncompleteError();this.usedKeys=keys.length;return keys;}
    async items(keys){const all=dict();for(let i=0;i<keys.length;i+=40)Object.assign(all,await this.rpc("getItems",keys.slice(i,i+40))||{});return all;}
    async readSnapshot(id,d){
      if(!descriptorValid(d))throw new IncompleteError();
      const keys=Array.from({length:d.n},(_,i)=>chunkKey(id,d.r,i)),values=await this.items(keys);
      if(keys.some(k=>typeof values[k]!=="string"||values[k].length>VALUE_LIMIT))throw new IncompleteError();
      const serialized=keys.map(k=>values[k]).join("");if(await digest(serialized)!==d.hash)throw new IncompleteError();
      let s;try{s=JSON.parse(serialized);}catch(_){throw new IncompleteError();}
      if(!validate(s,id)||s.seq!==d.seq)throw new IncompleteError();return s;
    }
    async pullRaw(){
      const keys=await this.keys(),metas=keys.filter(k=>/^k2m_[a-f0-9]{32}$/.test(k)),values=await this.items(metas);let incomplete=false;
      for(const key of metas){
        const id=key.slice(4);let pointer;
        try{if(typeof values[key]!=="string"||values[key].length>VALUE_LIMIT)throw new Error();pointer=JSON.parse(values[key]);}catch(_){incomplete=true;continue;}
        if(pointer?.v!==2||pointer.id!==id){incomplete=true;continue;}
        try{this.replica.merge(await this.readSnapshot(id,pointer.current));}
        catch(_){incomplete=true;if(pointer.previous)try{this.replica.merge(await this.readSnapshot(id,pointer.previous));}catch(_){} }
      }
      if(!this.replica.own.legacyImported)this.replica.importLegacy(await this.items(["v1_fav","v1_favbooks","v1_resume"]));
      return incomplete;
    }
    async remove(keys){for(let i=0;i<keys.length;i+=40)await this.rpc("removeItems",keys.slice(i,i+40));}
    async commit(){
      const s=copy(this.replica.own);if(!validate(s))throw new IncompleteError();
      const id=s.id,serialized=asciiJSON(s),n=Math.max(1,Math.ceil(serialized.length/CHUNK_SIZE));if(n+1>KEY_LIMIT)throw new CapacityError();
      const revision=s.seq.toString(36)+"_"+randomId().slice(0,12),current={r:revision,n,seq:s.seq,hash:await digest(serialized)};
      let keys=await this.keys(),old=null;const existing=await this.items([metaKey(id)]);
      if(existing[metaKey(id)]){try{old=JSON.parse(existing[metaKey(id)]);}catch(_){throw new IncompleteError();}if(old?.v!==2||old.id!==id||!descriptorValid(old.current))throw new IncompleteError();}
      const keep=new Set();for(const d of [old?.current,old?.previous].filter(descriptorValid))for(let i=0;i<d.n;i++)keep.add(chunkKey(id,d.r,i));
      const orphan=keys.filter(k=>k.startsWith("k2c_"+id+"_")&&!keep.has(k));await this.remove(orphan);keys=keys.filter(k=>!orphan.includes(k));
      if(keys.length+n+(keys.includes(metaKey(id))?0:1)>KEY_LIMIT&&descriptorValid(old?.previous)){
        const previous=Array.from({length:old.previous.n},(_,i)=>chunkKey(id,old.previous.r,i));await this.remove(previous);keys=keys.filter(k=>!previous.includes(k));
      }
      if(keys.length+n+(keys.includes(metaKey(id))?0:1)>KEY_LIMIT)throw new CapacityError();
      const staged=[];let manifestAttempted=false;
      try{
        for(let i=0;i<n;i++){
          const key=chunkKey(id,revision,i),value=serialized.slice(i*CHUNK_SIZE,(i+1)*CHUNK_SIZE);
          if(!KEY.test(key)||value.length>VALUE_LIMIT)throw new CapacityError();
          staged.push(key);await this.rpc("setItem",key,value);
        }
        if((await this.keys()).length+(keys.includes(metaKey(id))?0:1)>KEY_LIMIT)throw new CapacityError();
        manifestAttempted=true;
        await this.rpc("setItem",metaKey(id),JSON.stringify({v:2,id,current,previous:old?.current||null}));
      }catch(error){
        // A timed-out manifest write may have succeeded: never delete its chunks.
        // The next pull resolves that ambiguity; orphan GC reads the pointer first.
        if(!manifestAttempted)try{await this.remove(staged);}catch(_){}
        throw error;
      }
      this.replica.dirty=this.replica.own.id!==id||this.replica.own.seq!==s.seq;this.lastSuccess=Date.now();
    }
    transact(write){
      if(!this.cloud){this.status="local-only";return Promise.resolve(false);}if(this.busy)return this.busy;this.status="syncing";
      this.busy=(async()=>{try{const incomplete=await this.pullRaw();if(write&&this.replica.dirty)await this.commit();this.status=incomplete?"partial":(this.replica.dirty?"pending":"synced");return !incomplete;}
        catch(error){this.status=error instanceof CapacityError?"capacity":"offline";return false;}finally{this.busy=null;}})();return this.busy;
    }
    pull(){return this.transact(false);}
    flush(){return this.transact(true);}
  }
  return {KEY_LIMIT,VALUE_LIMIT,CHUNK_SIZE,randomId,digest,asciiJSON,validate,legacy,project,Replica,CloudClient,CapacityError,IncompleteError};
});
