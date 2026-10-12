/* The Leaders board loads its own files the first time the tab opens (then the service worker keeps them),
   so app start-up stays as small as before. A retry fetches only what failed; each file gets 10 s. */
globalThis.KafuEnhancements.installers.push({name:'leaders-loader',install(){
  'use strict';
  let state='idle';const done={};
  const add=(tag,attrs)=>new Promise((ok,no)=>{
    const el=Object.assign(document.createElement(tag),attrs),t=setTimeout(()=>{el.remove();no()},10000);
    el.onload=()=>{clearTimeout(t);ok()};el.onerror=()=>{clearTimeout(t);el.remove();no()};document.head.appendChild(el);
  });
  const once=(id,tag,attrs)=>done[id]||(done[id]=add(tag,attrs).catch(e=>{delete done[id];throw e}));
  function load(){
    if(state==='loading'||state==='ready')return;state='loading';
    Promise.all([once('css','link',{rel:'stylesheet',href:'modules/leaders.css'}),once('core','script',{src:'modules/leaders-core.js'}).then(()=>once('view','script',{src:'modules/leaders.js'}))])
      .then(()=>{state='ready'},()=>{state='failed'}).then(()=>{if(cur().v==='leaders')render()});
  }
  VIEWS.leaders=()=>{
    load();
    const html=state==='failed'?'<p>Connect to the internet once to open the leaders.</p>'+KafuDesign.button('Try again',{action:'leaders-retry'}):'<p>Loading leaders…</p>';
    return{title:'Leaders',html:'<section class="k-empty" role="status">'+html+'</section>',tabs:'leaders',action:null};
  };
  ACTIONS['leaders-retry']=()=>{state='idle';render()};
  // Fetch the board quietly once the app is open and idle, so the first tap on Leaders is instant.
  // Skipped on data saver or very slow connections; the pictures still load only when the tab is opened.
  const net=navigator.connection||{};
  if(!net.saveData&&!/(^|-)2g$/.test(net.effectiveType||''))setTimeout(()=>(globalThis.requestIdleCallback||(f=>f()))(()=>{if(navigator.onLine!==false)load()},{timeout:8000}),3000);
}});
