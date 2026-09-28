/* Achievements are a read-only projection of the existing personal backup. */
(function(root){
  'use strict';
  const IDS=['first_chapter','week_streak','hundred_questions','first_perfect'];
  const key=owner=>'ui_delight_user_'+(/^\d+$/.test(String(owner))?String(owner):'browser');
  const map=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const dates=v=>map(v)&&Object.values(v).every(x=>typeof x==='string');
  const valid=r=>map(r)&&r.schema===1&&(dates(r.shown)||dates(r.earned))&&
    (r.shown===undefined||dates(r.shown))&&(r.earned===undefined||dates(r.earned));
  function migrate(r){
    if(r==null)return{record:{schema:1,shown:{}},writable:true,write:false};
    if(!valid(r))return{record:null,writable:false,write:false};
    return{record:{...r,...(r.earned?{earned:{...r.earned}}:{}),...(r.shown?{shown:{...r.shown}}:{})},writable:true,write:false};
  }
  // Legacy draft earned fields are preserved but never used as badge evidence.
  function markShown(r,ids,date){
    if(!valid(r))throw new Error('Unknown delight record; preserved');
    const shown={...(r.shown||{})};for(const id of ids)if(IDS.includes(id)&&!shown[id])shown[id]=date;
    return{...r,shown};
  }
  function dayNumber(day){
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
    const stamp=Date.parse(day+'T12:00:00Z');
    return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===day?Math.floor(stamp/86400000):null;
  }
  function streaks(active,today){
    const end=dayNumber(today);if(end===null)return{current:0,longest:0};
    const days=[...new Set(Object.entries(active||{}).filter(([,v])=>v===true).map(([d])=>dayNumber(d)).filter(d=>d!==null&&d<=end))].sort((a,b)=>a-b);
    let longest=0,length=0,previous=null;for(const d of days){length=d===previous+1?length+1:1;longest=Math.max(longest,length);previous=d;}
    const set=new Set(days);let cursor=set.has(end)?end:end-1,current=0;while(set.has(cursor--))current++;
    return{current,longest};
  }
  const answered=a=>map(a)&&Number.isSafeInteger(a.n)&&a.n>0&&typeof a.b==='string';
  const knownCorrect=a=>answered(a)&&(a.c===true||(Number.isSafeInteger(a.correct_count)&&a.correct_count>0&&a.correct_count<=a.n));
  function derive(state={},catalog={},today){
    const answers=state.answers||{},qids=Object.keys(answers).filter(q=>/^Q\d{9}$/.test(q)&&answered(answers[q]));
    const runs=streaks(state.active,today),earned={};
    if(qids.length>=100)earned.hundred_questions=true;
    if(runs.longest>=7)earned.week_streak=true;
    for(const book of catalog.books||[])for(const chapter of book.chapters||[]){
      const ids=Array.isArray(chapter.qids)?chapter.qids:[];
      if(!Number.isSafeInteger(chapter.questions)||chapter.questions<1||ids.length!==chapter.questions||new Set(ids).size!==ids.length||!ids.every(q=>/^Q\d{9}$/.test(q)))continue;
      if(!ids.every(q=>answered(answers[q])&&answers[q].b===book.id))continue;
      earned.first_chapter=true;
      // Known correct at least once, NOT a claim about a historical perfect session.
      if(ids.every(q=>knownCorrect(answers[q])))earned.first_perfect=true;
    }
    return{earned,answered:qids.length,streak:runs.current,longestStreak:runs.longest};
  }
  function phrase(qid,attempt){const choices=['Kafu!','Kafu! Nicely reasoned.','Kafu! One step further.'];let hash=Number(attempt)||0;for(const c of String(qid))hash=(hash+c.charCodeAt(0))%997;return choices[hash%choices.length];}
  const api={IDS,key,valid,migrate,markShown,derive,streaks,phrase};root.KafuDelightCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
