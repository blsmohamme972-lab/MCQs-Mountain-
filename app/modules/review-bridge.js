globalThis.KafuEnhancements.installers.push({name:"review-due",install(){
  "use strict";
  const Core=globalThis.KafuReviewCore,engine=Core.create(globalThis.FSRS);
  const due=()=>Core.dueIds(S.fsrs||{}).filter(id=>{
    const book=S.answers[id]?.b;
    return !book||!(CATALOG?.removed_books||[]).includes(book);
  });
  const existingRecord=recordAnswer;
  function schedule(qid,rating){
    S.fsrs=S.fsrs||{};S.fsrs[qid]=engine.grade(S.fsrs[qid],rating,new Date());saveState();
  }
  recordAnswer=function(q,r){
    existingRecord(q,r);
    if(SESSION?.mode==="due")return; // explicit rating follows the answered due question
    try{schedule(q.id,r.correct?3:1);}catch(_){toast("Answer saved; review scheduling needs attention.");}
  };
  function row(){
    const ids=due(),available=ids.filter(id=>QI[id]).length;
    return rowHTML("review-due",{},ICON.clock,"Review Due",ids.length?`${available} available offline; scheduled by FSRS`:"Answer questions to build your review schedule",ids.length);
  }
  for(const name of ["home","review"]){const original=VIEWS[name];VIEWS[name]=function(...args){const view=original.apply(this,args);view.html=`<div class="list" style="margin-top:12px">${row()}</div>`+view.html;return view;};}
  ACTIONS["review-due"]=async()=>{
    const ids=due();if(!ids.length){toast("Nothing due right now.");return;}
    const missing=new Map();
    for(const id of ids.filter(id=>!QI[id]))for(const book of CATALOG.books){
      const chapter=book.chapters.find(ch=>Array.isArray(ch.qids)&&ch.qids.includes(id));
      if(chapter){missing.set(book.id+":"+chapter.id,{b:book.id,ch:chapter.id});break;}
    }
    if(navigator.onLine!==false)for(const item of missing.values())await downloadChapter(item.b,item.ch,true);
    const ready=ids.filter(id=>QI[id]);if(!ready.length){toast("Download the due questions' chapters before reviewing offline.");return;}
    if(ready.length<ids.length)toast("Reviewing available questions; the remaining due cards stay saved.");
    startSession({mode:"due",title:"Review Due",qids:ready});
  };
  const originalStudy=VIEWS.study;
  VIEWS.study=function(...args){
    const view=originalStudy.apply(this,args);
    if(SESSION?.mode!=="due")return view;
    const qid=SESSION.qids[SESSION.index],r=SESSION.resp[qid];
    if(r?.done&&!r.fsrsRated){
      let previews;try{previews=engine.preview(S.fsrs?.[qid],new Date());}catch(_){
        view.html+='<p class="note">Your saved review card is invalid. It has not been overwritten.</p>';return view;
      }
      view.html+='<h3 class="sec">How well did you remember?</h3><p class="note">Choose a rating to schedule the next review. A wrong answer should be Again.</p><div class="choice">'+
        [[1,"Again"],[2,"Hard"],[3,"Good"],[4,"Easy"]].map(([rating,label])=>`<button data-a="fsrs-rate" data-v="${rating}">${label}<br><small>${Core.delayLabel(previews[rating].due)}</small></button>`).join('')+'</div>';
      view.action={label:"Choose a review rating",enabled:false,fn:()=>{}};
    }else if(r?.fsrsRated)view.html+=`<p class="note">Next review: ${esc(new Date(S.fsrs[qid].due).toLocaleString("en"))}</p>`;
    return view;
  };
  ACTIONS["fsrs-rate"]=data=>{
    if(SESSION?.mode!=="due")return;
    const qid=SESSION.qids[SESSION.index],r=SESSION.resp[qid],rating=Number(data.v);
    if(!r?.done||r.fsrsRated||![1,2,3,4].includes(rating))return;
    try{schedule(qid,rating);r.fsrsRated=true;render();}catch(_){toast("Review state was not changed. Please report this card.");}
  };
  // A skipped unanswered card remains due; a rated card is scheduled exactly once.
  const next=nextQuestion;
  nextQuestion=function(...args){
    if(SESSION?.mode==="due"){
      const r=SESSION.resp[SESSION.qids[SESSION.index]];
      if(r?.done&&!r.fsrsRated&&Core.valid(S.fsrs?.[SESSION.qids[SESSION.index]])){toast("Choose a review rating first.");return;}
    }
    return next.apply(this,args);
  };
  globalThis.KafuReview={engine,due,schedule};
}});
