globalThis.KafuEnhancements.installers.push({name:'question-reports',install(){
  'use strict';
  const Core=globalThis.KafuReportCore;let sending=null,problem='';
  const freshId=()=>crypto.randomUUID();
  const bookFor=q=>{
    const entry=QI[q],book=entry&&CATALOG?.books?.find(x=>x.id===entry.b);
    if(book)return book;
    return CATALOG?.books?.find(b=>b.chapters?.some(ch=>ch.qids?.includes(q)));
  };
  function prepareLegacy(){
    let changed=false;
    for(const item of S.reports||[]){
      if(item.id)continue;
      const book=bookFor(item.q);
      if(!book||!Number.isSafeInteger(book.version))continue;
      Object.assign(item,Core.create(freshId(),item.q,book.id,book.version,item.reason,'',item.t||Date.now()));changed=true;
    }
    return changed;
  }
  async function flush(){
    if(sending)return sending;
    if(!IN_TG||!TG.initData||navigator.onLine===false)return false;
    sending=(async()=>{
      if(prepareLegacy())await DB.put('meta','state',S);
      for(const item of [...(S.reports||[])]){
        if(!Core.valid(item)){problem='An older report needs its book information before it can be sent.';continue;}
        try{
          const response=await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:TG.initData,report:{id:item.id,q:item.q,book:item.book,version:item.version,reason:item.reason,note:item.note}})});
          if(!response.ok){problem=response.status===429?'Report sending is limited for now; retry later.':response.status===401?'Telegram session expired; reopen Kafu to send pending reports.':'Report saved on this device; retry when online.';break;}
          const result=await response.json();if(result.accepted!==true)throw new Error('Report not acknowledged');
          S.reports=S.reports.filter(x=>x.id!==item.id);await DB.put('meta','state',S);problem='';
        }catch(_){problem='Report saved on this device; retry when online.';break;}
      }
      if(CATALOG&&cur().v==='me')render();
      return !(S.reports||[]).length;
    })().finally(()=>{sending=null;});
    return sending;
  }
  reportSheet=function(){
    const reasons=['Wrong answer','Wrong explanation','Typo','Missing image','Duplicate','Outdated information'];let chosen=reasons[0],note='';
    SHEET=()=>`<div class="scrim" data-a="close-sheet"><div class="sheet" role="dialog" aria-label="Report a problem" data-stop="1"><h4>Report a problem</h4><p class="note">Send a question correction to the Kafu owner. No patient information.</p>${reasons.map(r=>`<button class="radio" data-a="reason" data-r="${esc(r)}" aria-pressed="${r===chosen}"><i></i>${esc(r)}</button>`).join('')}<label for="kafu-report-note">Optional note (300 characters maximum)</label><textarea id="kafu-report-note" maxlength="300" rows="3" placeholder="Describe the problem, without patient details">${esc(note)}</textarea><div class="btns"><button class="btn ghost" data-a="close-sheet">Cancel</button><button class="btn" data-a="send-report">Save report</button></div></div></div>`;
    SHEET.set=r=>{note=document.getElementById('kafu-report-note')?.value??note;chosen=r;};
    SHEET.get=()=>chosen;SHEET.note=()=>document.getElementById('kafu-report-note')?.value??note;
    render();
  };
  ACTIONS['send-report']=async()=>{
    if(!SESSION||!SHEET)return;
    const q=SESSION.qids[SESSION.index],book=bookFor(q);
    if(!book||!Number.isSafeInteger(book.version)){toast('Book details are unavailable. Please retry after reopening this chapter.');return;}
    const report=Core.create(freshId(),q,book.id,book.version,SHEET.get(),SHEET.note(),Date.now());
    if(!Core.valid(report)){toast('Report could not be saved. Please try again.');return;}
    S.reports.push(report);
    try{await DB.put('meta','state',S);}catch(_){S.reports=S.reports.filter(x=>x.id!==report.id);toast('Report could not be saved on this device.');return;}
    SHEET=null;render();toast('Saved — will send when online');
    flush().then(sent=>{if(sent)toast('Report sent to the Kafu owner.');}).catch(()=>{});
  };
  const pull=CloudSync.pull;CloudSync.pull=async function(...args){const value=await pull.apply(this,args);flush().catch(()=>{});return value;};
  window.addEventListener('online',()=>flush().catch(()=>{}));
  const me=VIEWS.me;VIEWS.me=function(...args){const view=me.apply(this,args);if(S.reports?.length)view.html+=`<p class="note" role="status">${esc(problem||'Reports saved on this device; they will send when online.')}</p><button class="btn small ghost" data-a="retry-reports">Retry reports</button>`;return view;};
  ACTIONS['retry-reports']=()=>flush().then(done=>toast(done?'Reports sent.':problem||'Reports remain saved on this device.'));
  globalThis.KafuReports={flush,get pending(){return S.reports?.length||0;}};
}});
