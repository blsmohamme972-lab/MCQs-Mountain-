globalThis.KafuEnhancements.installers.push({name:'admin-usage',install(){
  'use strict';
  const C=KafuDesign;
  let checked=null,authorized=null,loading=false,error='',books=[],usage=null;
  const session=()=>IN_TG?String(TG?.initData||''):'';
  async function api(path,initData){
    const r=await fetch('/admin/'+path,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{'content-type':'application/json'},body:JSON.stringify({initData})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'admin_unavailable');return data;
  }
  async function probe(){
    const current=session();if(!current||checked===current)return;
    checked=current;authorized=null;books=[];usage=null;error='';
    try{const data=await api('capabilities',current);if(session()===current&&data.books){authorized=current;render()}}catch(_){}
  }
  const open=DB.open.bind(DB);
  DB.open=async function(...args){const result=await open(...args);probe().catch(()=>{});return result};
  async function load(){
    const current=session();if(!current||authorized!==current)return;
    loading=true;error='';render();
    try{
      const results=await Promise.allSettled([api('books',current),api('usage',current)]);
      if(session()!==current){authorized=null;books=[];usage=null;return}
      if(results[0].status==='fulfilled')books=results[0].value.books||[];
      else{books=[];error='Book inventory unavailable.'}
      if(results[1].status==='fulfilled')usage=results[1].value;
      else{usage=null;error+=(error?' ':'')+'D1 analytics unavailable. Check the server analytics token permission.'}
    }finally{loading=false;render()}
  }
  function metric(label,value,percent,limit){
    return '<article class="k-card"><h3>'+label+'</h3><strong>'+Number(value).toLocaleString()+' / '+Number(limit).toLocaleString()+'</strong><p>'+Number(percent).toFixed(1)+'% of free daily limit</p><progress max="100" value="'+Math.min(100,percent)+'" aria-label="'+label+' daily allowance"></progress></article>';
  }
  VIEWS['admin-books']=()=>{
    if(authorized!==session()||!authorized){books=[];usage=null;return {title:'Books dashboard',html:'<section class="kafu-admin"><p>Administrator access required.</p></section>',tabs:'me',action:null}}
    const today=usage?.today;
    let panel=today?metric('Rows read',today.rows_read,today.read_percent,usage.limits.rows_read)+metric('Rows written',today.rows_written,today.write_percent,usage.limits.rows_written):'<p>Today’s D1 metrics are not available yet.</p>';
    if(today?.warning)panel='<p class="kafu-admin-warning" role="alert">Warning: D1 usage has reached 70% of a free daily limit.</p>'+panel;
    if(usage)panel+='<p class="note">Account-wide D1 rows · resets '+C.e(usage.reset)+'. Cloudflare reporting may lag. Last fetched '+C.e(usage.fetched_at)+'.</p>'+
      '<div class="kafu-admin-scroll"><table><caption>Daily D1 usage (UTC)</caption><thead><tr><th>Date</th><th>Rows read</th><th>Read %</th><th>Rows written</th><th>Write %</th></tr></thead><tbody>'+usage.days.map(d=>'<tr><th>'+C.e(d.date)+'</th><td>'+Number(d.rows_read).toLocaleString()+'</td><td>'+Number(d.read_percent).toFixed(1)+'%</td><td>'+Number(d.rows_written).toLocaleString()+'</td><td>'+Number(d.write_percent).toFixed(1)+'%</td></tr>').join('')+'</tbody></table></div>';
    const inventory='<div class="kafu-admin-scroll"><table><caption>Books recorded in D1</caption><thead><tr><th>Book</th><th>Version</th><th>Questions</th><th>Chapters</th><th>Images</th><th>Active</th></tr></thead><tbody>'+books.map(b=>'<tr><th>'+C.e(b.book_id)+'</th><td>'+Number(b.version)+'</td><td>'+Number(b.questions)+'</td><td>'+Number(b.chapters)+'</td><td>'+Number(b.images)+'</td><td>'+(b.active?'Yes':'No')+'</td></tr>').join('')+'</tbody></table></div>';
    return {title:'Books dashboard',tabs:'me',action:null,html:'<section class="kafu-admin"><h2>D1 usage</h2>'+C.button('Refresh',{action:'admin-usage-refresh',variant:'ghost'})+(loading?'<p role="status">Loading…</p>':'')+(error?'<p role="status">'+C.e(error)+'</p>':'')+panel+'<h2>Books</h2>'+inventory+'</section>'};
  };
  const me=VIEWS.me;
  VIEWS.me=function(...args){
    probe().catch(()=>{});const view=me.apply(this,args);
    if(authorized&&authorized===session())view.html+='<button class="row" data-a="admin-books-open"><span class="grow"><span class="t">Books dashboard</span><span class="s">Admin · D1 usage</span></span><span aria-hidden="true">›</span></button>';
    return view;
  };
  ACTIONS['admin-books-open']=()=>{if(authorized!==session())return;go('admin-books');load().catch(()=>{})};
  ACTIONS['admin-usage-refresh']=()=>load();
}});
