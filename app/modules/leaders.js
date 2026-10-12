/* Leaders tab: weekly league and all-time ranking. Data comes from KafuLeadersCore on the device. */
globalThis.KafuEnhancements.installers.push({name:'leaders',install(){
  'use strict';
  const L=KafuLeadersCore,C=KafuDesign;
  let period='weekly',ticker=null,seen=false;
  const SCENE={
    sunset:'<rect width="40" height="40" fill="#FF9A62"/><rect y="20" width="40" height="20" fill="#3B4C8A"/><circle cx="20" cy="22" r="8" fill="#FFE07A"/><rect y="22" width="40" height="18" fill="#2F3E73"/><path d="M6 27h10M22 30h12M12 34h16" stroke="#FFB27A" stroke-width="1.4" stroke-linecap="round"/>',
    flower:'<rect width="40" height="40" fill="#BFE3C0"/><g transform="translate(20 19)" fill="#F7A8C4"><circle cx="0" cy="-7" r="5.5"/><circle cx="7" cy="0" r="5.5"/><circle cx="0" cy="7" r="5.5"/><circle cx="-7" cy="0" r="5.5"/></g><circle cx="20" cy="19" r="4" fill="#FFD45E"/><path d="M20 27v13" stroke="#4E9A5B" stroke-width="2.4"/>',
    night:'<rect width="40" height="40" fill="#1E2A4A"/><circle cx="24" cy="15" r="8" fill="#F4E7B5"/><circle cx="28" cy="12" r="7" fill="#1E2A4A"/><g fill="#fff"><circle cx="9" cy="9" r=".9"/><circle cx="14" cy="27" r=".7"/><circle cx="31" cy="30" r=".9"/><circle cx="7" cy="20" r=".6"/></g>',
    mountain:'<rect width="40" height="40" fill="#9ED3F2"/><path d="M-2 40 14 16l9 12 5-6 14 18z" fill="#5B7F95"/><path d="M14 16l4 5.5-3-1-3 2.5z" fill="#fff"/><path d="M-2 40c10-6 20-7 44-3v3z" fill="#6FAE73"/>',
    sea:'<rect width="40" height="40" fill="#BDE7F7"/><rect y="24" width="40" height="16" fill="#2E8FC2"/><path d="M0 27c4-2 6 2 10 0s6 2 10 0 6 2 10 0 6 2 10 0" stroke="#fff" stroke-width="1.3" fill="none"/><path d="M24 23l4-11 1 11z" fill="#fff"/><path d="M21 23h11l-2 3h-8z" fill="#7B4B2A"/>',
    coffee:'<rect width="40" height="40" fill="#E9D8C4"/><path d="M11 17h16v8a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" fill="#fff"/><path d="M27 19h2.5a3 3 0 0 1 0 6H27" stroke="#fff" stroke-width="2" fill="none"/><ellipse cx="19" cy="17.5" rx="7.5" ry="1.8" fill="#7A4A2B"/><path d="M15 13c0-2 2-2 2-4M20 13c0-2 2-2 2-4" stroke="#A88" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
    book:'<rect width="40" height="40" fill="#F4C9A8"/><path d="M8 13c4-1.5 8-1.5 12 1 4-2.5 8-2.5 12-1v16c-4-1.2-8-1.2-12 1-4-2.2-8-2.2-12-1z" fill="#fff"/><path d="M20 14v16" stroke="#C9A" stroke-width="1"/><path d="M11 17h6M11 20h6M23 17h6M23 20h6" stroke="#D8C6B8" stroke-width="1"/>',
    rose:'<rect width="40" height="40" fill="#F6E1E6"/><circle cx="20" cy="17" r="7" fill="#D63E5C"/><path d="M16 15c2-3 6-3 8 0M15.5 19c3 2 6 2 9 0" stroke="#A82444" stroke-width="1.2" fill="none"/><path d="M20 24v14" stroke="#3F8A4D" stroke-width="2"/><path d="M20 31c-4-3-7-2-8 0 3 1.5 6 1.5 8 0" fill="#4E9A5B"/>'
  };
  const fmt=n=>Number(n||0).toLocaleString('en-US');
  function owner(){
    const u=IN_TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user||{};
    const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||greetingName();
    let run=0;try{run=Number(streak())||0}catch(_){}
    return{id:u.id?String(u.id):'browser',name,photo:typeof u.photo_url==='string'&&/^https:\/\//.test(u.photo_url)?u.photo_url:null,streak:run};
  }
  function avatar(x,size){
    const cls='k-lb-av'+(size?' '+size:'');
    let inner;
    if(x.photo)inner='<img src="'+C.e(x.photo)+'" alt="" loading="lazy" referrerpolicy="no-referrer">';
    else if(x.scene&&SCENE[x.scene])inner='<svg viewBox="0 0 40 40" aria-hidden="true">'+SCENE[x.scene]+'</svg>';
    else inner='<span style="background:linear-gradient(180deg,'+x.gradient[0]+','+x.gradient[1]+')">'+C.e(x.initials)+'</span>';
    return '<span class="'+cls+'">'+inner+(x.online&&!x.own?'<i class="k-lb-online" aria-label="Active now"></i>':'')+'</span>';
  }
  const name=x=>'<bdi class="k-lb-name">'+C.e(x.name)+'</bdi>';
  function move(x){
    if(!x.move)return '<span class="k-lb-move same" aria-label="No change">–</span>';
    return x.move>0?'<span class="k-lb-move up" aria-label="Up '+x.move+'">▲'+x.move+'</span>':'<span class="k-lb-move down" aria-label="Down '+(-x.move)+'">▼'+(-x.move)+'</span>';
  }
  function podium(rows){
    const spot=(x,place)=>!x?'':'<div class="k-lb-spot p'+place+(x.own?' own':'')+'">'+(place===1?'<span class="k-lb-crown" aria-hidden="true">👑</span>':'')+avatar(x,'lg')+'<span class="k-lb-medal" aria-hidden="true">'+place+'</span>'+name(x)+'<strong>'+fmt(x.xp)+' XP</strong><span class="k-lb-step"><b>'+place+'</b></span></div>';
    return '<section class="k-lb-podium" aria-label="Top three">'+spot(rows[1],2)+spot(rows[0],1)+spot(rows[2],3)+'</section>';
  }
  function row(x,i){
    const sub=x.own?'You':(x.online?'<span class="k-lb-live">Active now</span>':'')+(x.streak?'<span class="k-lb-fire">🔥 '+x.streak+'</span>':'');
    return '<li class="k-lb-row'+(x.own?' own':'')+'" style="--i:'+Math.min(i,20)+'"'+(x.own?' id="k-lb-me"':'')+'><span class="k-lb-rank">'+x.rank+'</span>'+avatar(x)+'<span class="k-lb-who">'+name(x)+'<small>'+sub+'</small></span><span class="k-lb-xp"><strong>'+fmt(x.xp)+'</strong><small>XP</small></span>'+move(x)+'</li>';
  }
  function build(){
    const now=Date.now(),me=owner(),xp=L.ownXp(S.answers,now);
    const b=L.board(period,now,{...me,...xp});
    const rows=b.rows,rest=rows.slice(3);
    const zone=period==='weekly'?10:null;
    let list='';
    rest.forEach((x,i)=>{list+=row(x,i);if(zone&&x.rank===zone&&rest.length>i+1)list+='<li class="k-lb-zone" aria-hidden="true"><span>Top 10</span></li>'});
    const hero=period==='weekly'
      ?'<section class="k-lb-hero"><span class="k-lb-trophy" aria-hidden="true">🏆</span><div><p class="k-pixel">WEEKLY LEAGUE</p><h2>Top students this week</h2><p>Ends in <b>'+L.countdown(now)+'</b> · resets Monday</p></div></section>'
      :'<section class="k-lb-hero all"><span class="k-lb-trophy" aria-hidden="true">⭐</span><div><p class="k-pixel">HALL OF FAME</p><h2>All-time XP</h2><p>Every answer earns 10 XP</p></div></section>';
    const ahead=b.ahead?'<b>'+fmt(b.gap)+' XP</b> to pass <bdi>'+C.e(b.ahead.name)+'</bdi>':'You lead the board — keep it!';
    const bar='<button class="k-lb-mebar" data-a="leaders-me" aria-label="Your rank '+b.own.rank+'"><span class="k-lb-rank">#'+b.own.rank+'</span>'+avatar(b.own,'sm')+'<span class="k-lb-who"><strong>You</strong><small>'+ahead+'</small></span><span class="k-lb-xp"><strong>'+fmt(b.own.xp)+'</strong><small>XP</small></span></button>';
    return '<section class="k-lb'+(seen?' calm':'')+'" data-period="'+period+'">'+hero+
      '<div class="k-lb-tabs" role="tablist" aria-label="Leaders period"><button role="tab" aria-selected="'+(period==='weekly')+'" data-a="leaders-period" data-v="weekly">This week</button><button role="tab" aria-selected="'+(period==='all')+'" data-a="leaders-period" data-v="all">All time</button></div>'+
      podium(rows)+'<ol class="k-lb-list" aria-label="'+(period==='weekly'?'Weekly':'All-time')+' ranking">'+list+'</ol>'+bar+'</section>';
  }
  VIEWS.leaders=()=>{const html=build();seen=true;return{title:'Leaders',html,tabs:'leaders',action:null}};
  ACTIONS['leaders-period']=d=>{period=d.v==='all'?'all':'weekly';seen=false;render()};
  ACTIONS['leaders-me']=()=>{const el=document.getElementById('k-lb-me');if(el){el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse')}};
  // Keep the board moving while it is on screen; quiet re-render without entrance animation.
  function tick(){
    if(cur().v==='leaders'&&document.visibilityState==='visible'&&!SHEET)render();
  }
  const baseTab=ACTIONS.tab;
  ACTIONS.tab=d=>{if(d.v==='leaders')seen=false;return baseTab(d)};
  if(!ticker)ticker=setInterval(tick,60000);
}});
