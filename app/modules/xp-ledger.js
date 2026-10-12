/* One XP ledger for level, home, session screens and Leaders. It rewards learning, not clicking:
   new question 10 (5 if wrong: the explanation still teaches), a later-day return 12 (4 if wrong) for
   reviews and mistakes, the same question again the same day 0. Answers from before the ledger, or synced
   from another device, count 10 each on their day, so nobody loses progress. On the device only. */
globalThis.KafuEnhancements.installers.push({name:'xp-ledger',install(){
  'use strict';
  const DAY=864e5,day=t=>Math.floor((Number(t)+108e5)/DAY); // Baghdad calendar day, as Leaders uses
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const key='xp_ledger_user_'+owner,gains=new WeakMap();
  let L={v:1,days:{},last:{}},timer=null;
  const save=()=>{clearTimeout(timer);timer=setTimeout(()=>DB.put('meta',key,L).catch(()=>{}),300)};
  const legacy=()=>Object.entries(S.answers||{}).filter(([q,a])=>a&&a.n>0&&!(q in L.last));
  function sum(from,to){ // XP earned between two times (calendar days, inclusive)
    const a=day(from),b=day(to);let xp=0;
    for(const d in L.days)if(d>=a&&d<=b)xp+=L.days[d];
    for(const[,x]of legacy()){const d=day(x.t||0);if(d>=a&&d<=b)xp+=10}
    return xp;
  }
  const open=DB.open.bind(DB);
  DB.open=async function(...args){const r=await open(...args);try{const v=await DB.get('meta',key);if(v&&v.v===1&&v.days&&v.last)L=v}catch(_){}return r};
  const base=recordAnswer;
  recordAnswer=function(q,r){
    const prior=S.answers?.[q.id],today=day(Date.now()),seen=q.id in L.last;
    // A legacy answer keeps its 10 XP on its own day before the new one is counted.
    if(!seen&&prior&&prior.n>0){const d=day(prior.t||Date.now());L.days[d]=(L.days[d]||0)+10;L.last[q.id]=d}
    const again=q.id in L.last,pts=again&&L.last[q.id]===today?0:again?(r.correct?12:4):(r.correct?10:5);
    if(pts){L.days[today]=(L.days[today]||0)+pts}L.last[q.id]=today;save();
    if(SESSION)gains.set(SESSION,(gains.get(SESSION)||0)+pts);
    return base.apply(this,arguments);
  };
  globalThis.KafuXP={
    total:(at=Date.now())=>sum(0,at),between:sum,day,
    session:s=>gains.get(s)||0,
    get ledger(){return L}
  };
}});
