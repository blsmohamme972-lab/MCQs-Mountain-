/* Leaders tab: weekly league and all-time ranking. Everything runs on the device (KafuLeadersCore):
   no network requests, no storage beyond one "last seen" time, so it costs nothing to serve. */
const KafuLeadersModule={name:'leaders',install(){
  'use strict';
  const L=KafuLeadersCore,C=KafuDesign;
  const SEEN='kafu_leaders_seen',MIN_GAP=20*60000,MAX_GAP=6*3600000,FIRST_GAP=3*3600000;
  const OPEN_DELAY=1200,TICK=9000;
  let period='weekly',ticker=null,pending=null,shownAt=0;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt=n=>Number(n||0).toLocaleString('en-US');
  function seen(){try{return Number(localStorage.getItem(SEEN))||0}catch(_){return 0}}
  function markSeen(t){try{localStorage.setItem(SEEN,String(t))}catch(_){}}
  // League per Telegram account: settled once per week from where the student finished last week.
  let league=null,result=null;
  function settle(){
    const me=owner(),key='kafu_leaders_league_'+me.id,now=Date.now(),week=L.clock(now).weekKey;
    let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}
    if(!saved||typeof saved.league!=='number'){saved={week,league:0};try{localStorage.setItem(key,JSON.stringify(saved))}catch(_){}}
    if(saved.week!==week){
      // Rank at the very end of the stored week, using only answers from that week.
      const end=L.clock(now-7*86400000).weekKey===saved.week?L.clock(now).weekStart-1:null;
      if(end){const b=L.board('weekly',end,{...me,...L.ownXp(S.answers,end)},saved.league),to=L.outcome(b.own.rank,b.size,saved.league,b.zones);
        result={rank:b.own.rank,from:saved.league,to};saved={week,league:to}}
      else saved={week,league:Math.max(0,saved.league-1)}; // missed a whole week
      try{localStorage.setItem(key,JSON.stringify(saved))}catch(_){}
    }
    league=saved.league;
  }
  function owner(){
    const u=IN_TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user||{};
    let run=0;try{run=Number(streak())||0}catch(_){}
    return{id:u.id?String(u.id):'browser',name:[u.first_name,u.last_name].filter(Boolean).join(' ')||greetingName(),photo:/^https:\/\//.test(u.photo_url||'')?u.photo_url:null,streak:run};
  }
  const data=at=>L.board(period,at,{...owner(),...L.ownXp(S.answers,Date.now())},league||0);
  function avatar(x,size){
    // The picture sits over Telegram-style initials; if it cannot load (offline), the initials show.
    return '<span class="k-lb-av'+(size?' '+size:'')+'"><span style="background:linear-gradient('+x.gradient[0]+','+x.gradient[1]+')">'+C.e(x.initials)+'</span>'+
      (x.photo?'<img src="'+C.e(x.photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':'')+
      (x.online&&!x.own?'<i class="k-lb-online" aria-label="Active now"></i>':'')+'</span>';
  }
  const name=x=>'<bdi class="k-lb-name">'+C.e(x.name)+'</bdi>';
  const xpEl=x=>'<strong data-xp="'+x.xp+'">'+fmt(x.xp)+'</strong>';
  const move=x=>!x.move?'<span class="k-lb-move">–</span>':x.move>0?'<span class="k-lb-move up" aria-label="Up '+x.move+'">▲'+x.move+'</span>':'<span class="k-lb-move down" aria-label="Down '+-x.move+'">▼'+-x.move+'</span>';
  function podium(rows){
    const spot=(x,p)=>!x?'<div class="k-lb-spot p'+p+'"></div>':'<div class="k-lb-spot p'+p+(x.own?' own':'')+'" data-id="'+x.id+'">'+(p===1?'<span class="k-lb-crown" aria-hidden="true">👑</span>':'')+avatar(x,'lg')+'<span class="k-lb-medal" aria-hidden="true">'+p+'</span>'+name(x)+'<span class="k-lb-pxp">'+xpEl(x)+' XP</span><span class="k-lb-step"><b>'+p+'</b></span></div>';
    return spot(rows[1],2)+spot(rows[0],1)+spot(rows[2],3);
  }
  function row(x,i,zone=''){
    const sub=x.own?'You':(x.online?'<span class="k-lb-live">Active now</span>':'')+(x.streak?'<span>🔥 '+x.streak+'</span>':'');
    return '<li class="k-lb-row'+zone+(x.own?' own" id="k-lb-me':'')+'" data-id="'+x.id+'" data-rank="'+x.rank+'" style="--i:'+Math.min(i,20)+'"><span class="k-lb-rank">'+x.rank+'</span>'+avatar(x)+'<span class="k-lb-who">'+name(x)+'<small>'+sub+'</small></span><span class="k-lb-xp">'+xpEl(x)+'<small>XP</small></span>'+move(x)+'</li>';
  }
  function list(b){
    const up=b.zones.promote,down=b.zones.demote?b.size-b.zones.demote:0,next=L.LEAGUES[b.league+1],prev=L.LEAGUES[b.league-1];
    return b.rows.slice(3).map((x,i)=>(down&&x.rank===down+1?'<li class="k-lb-zone down" aria-hidden="true">▼ Demotion zone · '+prev+'</li>':'')+
      row(x,i,up&&x.rank<=up?' up':down&&x.rank>down?' down':'')+(up&&x.rank===up?'<li class="k-lb-zone" aria-hidden="true">▲ Promotion zone · '+next+'</li>':'')).join('');
  }
  function mebar(b){
    const ahead=b.ahead?'<b>'+fmt(b.gap)+' XP</b> to pass <bdi>'+C.e(b.ahead.name)+'</bdi>':'You lead the board — keep it!';
    return '<span class="k-lb-rank">#'+b.own.rank+'</span>'+avatar(b.own,'sm')+'<span class="k-lb-who"><strong>You</strong><small>'+ahead+'</small></span><span class="k-lb-xp">'+xpEl(b.own)+'<small>XP</small></span>';
  }
  const GEM=['#C98B5A','#A9B6C4','#F5C342','#3D8BFD','#E5484D','#2FBF71','#7FE3FF'];
  const gem=(i,cls)=>'<svg class="k-lb-gem'+cls+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 8v8l-9 6-9-6V8z" fill="'+GEM[i]+'"/><path d="M12 2v20M3 8l9 5 9-5" stroke="#fff6" stroke-width="1.2" fill="none"/></svg>';
  const hero=now=>period==='weekly'
    ?'<section class="k-lb-hero lg'+(league||0)+'">'+gem(league||0,' big')+'<div><p class="k-pixel">'+L.LEAGUES[league||0].toUpperCase()+' LEAGUE</p><h2>Top '+L.PROMOTE+' move up'+(league>=L.LEAGUES.length-1?' — you are at the top':'')+'</h2><p>Ends in <b>'+L.countdown(now)+'</b> · resets Monday</p><div class="k-lb-gems">'+L.LEAGUES.map((_,i)=>gem(i,i===league?' on':i<league?' done':'')).join('')+'</div></div></section>'+
      (result?'<section class="k-lb-result '+(result.to>result.from?'up':result.to<result.from?'down':'')+'" role="status">'+gem(result.to,'')+'<p><b>'+(result.to>result.from?'Promoted to '+L.LEAGUES[result.to]+' League!':result.to<result.from?'Moved down to '+L.LEAGUES[result.to]+' League':'You stayed in '+L.LEAGUES[result.to]+' League')+'</b><br>You finished #'+result.rank+' last week.</p><button data-a="leaders-ok" aria-label="Close">×</button></section>':'')
    :'<section class="k-lb-hero all"><span class="k-lb-trophy" aria-hidden="true">⭐</span><div><p class="k-pixel">HALL OF FAME</p><h2>All-time XP</h2><p>Every answer earns 10 XP</p></div></section>';
  const tabBtn=(v,l)=>'<button role="tab" aria-selected="'+(period===v)+'" data-a="leaders-period" data-v="'+v+'">'+l+'</button>';
  const page=(b,now,intro)=>'<section class="k-lb'+(intro?'':' calm')+'" data-period="'+period+'">'+hero(now)+
    '<div class="k-lb-tabs" role="tablist" aria-label="Leaders period">'+tabBtn('weekly','This week')+tabBtn('all','All time')+'</div>'+
    '<section class="k-lb-podium" aria-label="Top three">'+podium(b.rows)+'</section><ol class="k-lb-list" aria-label="Ranking">'+list(b)+'</ol>'+
    '<button class="k-lb-mebar" data-a="leaders-me" aria-label="Your rank '+b.own.rank+'">'+mebar(b)+'</button></section>';
  // Open on the board as it was at the last visit, then let it catch up in front of the student.
  VIEWS.leaders=()=>{
    const now=Date.now();let html;settle();
    if(pending===null){
      const last=seen();shownAt=reduced()?now:now-(last?Math.min(MAX_GAP,Math.max(MIN_GAP,now-last)):FIRST_GAP);
      html=page(data(shownAt),now,true);pending=setTimeout(()=>{pending=0;update(true)},OPEN_DELAY);
    }else html=page(data(shownAt),now,false);
    return{title:'Leaders',html,tabs:'leaders',action:null};
  };
  function countUp(el,from,to){
    el.dataset.xp=to;if(from===to||reduced()){el.textContent=fmt(to);return}
    const start=performance.now();el.classList.add('ticking');
    (function step(t){const k=Math.min(1,(t-start)/900);el.textContent=fmt(Math.round((from+(to-from)*(1-Math.pow(1-k,3)))/10)*10);if(k<1)requestAnimationFrame(step);else el.classList.remove('ticking')})(start);
  }
  // FLIP: measure every row, swap in the new order, then glide each row from where it was.
  function update(big){
    const root=document.querySelector('.k-lb');if(!root||cur().v!=='leaders')return;
    const now=Date.now(),b=data(now),q=s=>root.querySelector(s);shownAt=now;markSeen(now);
    const listEl=q('.k-lb-list'),pod=q('.k-lb-podium'),bar=q('.k-lb-mebar');
    const before=new Map([...listEl.children].filter(el=>el.dataset.id).map(el=>[el.dataset.id,{top:el.getBoundingClientRect().top,rank:+el.dataset.rank,xp:+el.querySelector('[data-xp]').dataset.xp}]));
    const podXp=new Map([...pod.querySelectorAll('[data-id]')].map(el=>[el.dataset.id,+el.querySelector('[data-xp]').dataset.xp]));
    listEl.innerHTML=list(b);
    if([...podXp.keys()].join()!==[b.rows[1],b.rows[0],b.rows[2]].filter(Boolean).map(x=>x.id).join()){pod.innerHTML=podium(b.rows);pod.classList.remove('swap');void pod.offsetWidth;pod.classList.add('swap')}
    else for(const x of b.rows.slice(0,3)){const el=pod.querySelector('[data-id="'+x.id+'"] [data-xp]');countUp(el,podXp.get(x.id),x.xp)}
    const oldRank=+bar.querySelector('.k-lb-rank').textContent.slice(1),oldXp=+bar.querySelector('[data-xp]').dataset.xp;
    bar.innerHTML=mebar(b);bar.setAttribute('aria-label','Your rank '+b.own.rank);countUp(bar.querySelector('[data-xp]'),oldXp,b.own.xp);
    if(oldRank!==b.own.rank){bar.classList.remove('up','down');void bar.offsetWidth;bar.classList.add(b.own.rank<oldRank?'up':'down')}
    for(const el of listEl.querySelectorAll('.k-lb-row')){
      const was=before.get(el.dataset.id),x=el.querySelector('[data-xp]');
      if(!was)continue;
      countUp(x,was.xp,+x.dataset.xp);
      const dy=was.top-el.getBoundingClientRect().top,rank=+el.dataset.rank;
      // The arrow shows the move the student just watched.
      if(rank!==was.rank)el.querySelector('.k-lb-move').outerHTML=move({move:was.rank-rank});
      if(reduced()||Math.abs(dy)<1)continue;
      el.style.transition='none';el.style.transform='translateY('+dy+'px)';el.classList.add(rank<was.rank?'climb':'fall');
      requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='transform '+(big?820:600)+'ms cubic-bezier(.2,.8,.2,1)';el.style.transform=''}));
      setTimeout(()=>el.classList.remove('climb','fall'),1600);
    }
    const left=q('.k-lb-hero b');if(left&&period==='weekly')left.textContent=L.countdown(now);
  }
  const stop=()=>{clearTimeout(pending);pending=null};
  ACTIONS['leaders-ok']=()=>{result=null;document.querySelector('.k-lb-result')?.remove()};
  ACTIONS['leaders-period']=d=>{period=d.v==='all'?'all':'weekly';stop();render()};
  ACTIONS['leaders-me']=()=>{const el=document.getElementById('k-lb-me');if(el){el.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse')}};
  const baseTab=ACTIONS.tab;
  ACTIONS.tab=d=>{if(d.v==='leaders'||cur().v==='leaders')stop();return baseTab(d)};
  document.addEventListener('visibilitychange',()=>{if(cur().v!=='leaders')return;if(document.visibilityState==='hidden')markSeen(Date.now());else if(pending===0)update(false)});
  if(!ticker)ticker=setInterval(()=>{if(cur().v==='leaders'&&pending===0&&document.visibilityState==='visible'&&!SHEET)update(false)},TICK);
  globalThis.KafuLeaders={update,get period(){return period}};
}};
// Loaded after start-up by leaders-loader.js, so install straight away.
(R=>R.installed?KafuLeadersModule.install():R.installers.push(KafuLeadersModule))(globalThis.KafuEnhancements);
