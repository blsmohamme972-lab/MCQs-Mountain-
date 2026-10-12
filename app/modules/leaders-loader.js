/* The Leaders board loads its own files the first time the tab opens (then the service worker keeps them),
   so app start-up stays as small as before. */
globalThis.KafuEnhancements.installers.push({name:'leaders-loader',install(){
  'use strict';
  let state='idle';
  const add=(tag,attrs)=>new Promise((ok,no)=>{const el=Object.assign(document.createElement(tag),attrs,{onload:ok,onerror:no});document.head.appendChild(el)});
  function load(){
    if(state==='loading'||state==='ready')return;state='loading';
    Promise.all([add('link',{rel:'stylesheet',href:'modules/leaders.css'}),add('script',{src:'modules/leaders-core.js'}).then(()=>add('script',{src:'modules/leaders.js'}))])
      .then(()=>{state='ready'},()=>{state='failed'}).then(()=>{if(cur().v==='leaders')render()});
  }
  VIEWS.leaders=()=>{
    load();
    const html=state==='failed'?'<p>Connect to the internet once to open the leaders.</p>'+KafuDesign.button('Try again',{action:'leaders-retry'}):'<p>Loading leaders…</p>';
    return{title:'Leaders',html:'<section class="k-empty" role="status">'+html+'</section>',tabs:'leaders',action:null};
  };
  ACTIONS['leaders-retry']=()=>{state='idle';render()};
}});
