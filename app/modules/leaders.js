/* Leaders tab: weekly league and all-time ranking. Everything runs on the device (KafuLeadersCore):
   no network requests and only a few small keys per account in localStorage, so it costs nothing to serve. */
const KafuLeadersModule={name:'leaders',install(){
  'use strict';
  const L=KafuLeadersCore,C=KafuDesign;
  const MIN_GAP=20*60000,MAX_GAP=6*3600000,FIRST_GAP=3*3600000,OPEN_DELAY=1200,TICK=9000,DAY=864e5;
  let period='weekly',ticker=null,pending=null,shownAt=0,league=0,result=null,resultFor=null;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt=n=>Number(n||0).toLocaleString('en-US');
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(_){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}};
  function owner(){
    const u=IN_TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user||{};
    let run=0;try{run=Number(streak())||0}catch(_){}
    return{id:u.id?String(u.id):'browser',name:[u.first_name,u.last_name].filter(Boolean).join(' ')||greetingName(),photo:/^https:\/\//.test(u.photo_url||'')?u.photo_url:null,streak:run};
  }
  const key=k=>'kafu_leaders_'+k+'_'+owner().id; // every key is per Telegram account
  // League: settled week by week from the last week this account saw, using only that week's answers.
  // A week without any study keeps the league (no demotion for being away); a clock that went back is ignored.
  function settle(){
    const me=owner(),now=Date.now(),week=L.clock(now).weekStart;
    let saved=store.get(key('league'),null);
    if(!saved||typeof saved.league!=='number'||typeof saved.start!=='number'){saved={start:week,league:0};store.set(key('league'),saved)}
    if(resultFor!==me.id){result=null;resultFor=me.id}
    if(saved.start<week){
      let lg=saved.league,start=saved.start,last=null;
      for(let i=0;i<8&&start<week;i++,start+=7*DAY){
        const end=start+7*DAY-1,own={...me,...L.ownXp(S.answers,end)};
        if(own.weeklyXp>0){const b=L.board('weekly',end,own,lg),to=L.outcome(b.own.rank,b.size,lg,b.zones);last={rank:b.own.rank,from:lg,to};lg=to}
      }
      if(last)result=last;
      saved={start:week,league:lg};store.set(key('league'),saved);
    }
    league=saved.league;
  }
  const data=at=>L.board(period,at,{...owner(),...L.ownXp(S.answers,at)},league);
  // Icons: one stroke style, matching the tab bar (no emoji as icons).
  const ICON={
    flame:'<svg class="k-lb-i flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.5c.9 3.3 4.9 5.2 4.9 10.6A5.1 5.1 0 0 1 12 18.4a5.1 5.1 0 0 1-5.1-5.3c0-2.6 1.4-4.2 2.6-5.3.2 1.6 1 2.8 2.1 3.1-.6-2.6-.4-5.3.6-8.4z"/></svg>',
    steth:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/></svg>',
    cap:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6"/></svg>',
    pin:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
    clap:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13l-2.5-2.5a1.6 1.6 0 0 1 2.3-2.3L11 11.4M9 8.8 7.6 7.4A1.6 1.6 0 0 1 9.9 5l4.6 4.6M12 6.6l-.4-.4a1.6 1.6 0 0 1 2.3-2.3l4.3 4.3c2.4 2.4 2.4 6.3 0 8.7l-.6.6c-2.4 2.4-6.3 2.4-8.7 0l-4.4-4.4a1.6 1.6 0 0 1 2.3-2.3L8 13"/></svg>',
    check:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    star:'<svg class="k-lb-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>'
  };
  function avatar(x,size){
    // The picture sits over Telegram-style initials; if it cannot load (offline), the initials show.
    return '<span class="k-lb-av'+(size?' '+size:'')+'"><span style="background:linear-gradient('+x.gradient[0]+','+x.gradient[1]+')">'+C.e(x.initials)+'</span>'+
      (x.photo?'<img src="'+C.e(x.photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':'')+
      (x.online&&!x.own?'<i class="k-lb-online"><span class="k-lb-sr">active now</span></i>':'')+'</span>';
  }
  const name=x=>'<bdi class="k-lb-name"'+(/[؀-ۿ]/.test(x.name)?' lang="ar"':'')+'>'+C.e(x.name)+'</bdi>';
  const xpEl=x=>'<strong data-xp="'+x.xp+'">'+fmt(x.xp)+'</strong>';
  const move=x=>!x.move?'<span class="k-lb-move"></span>':x.move>0?'<span class="k-lb-move up" aria-label="Up '+x.move+'">▲'+x.move+'</span>':'<span class="k-lb-move down" aria-label="Down '+-x.move+'">▼'+-x.move+'</span>';
  const tap=(x,label)=>' data-a="leaders-card" data-v="'+x.id+'" role="button" tabindex="0" aria-label="'+C.e(label)+'"';
  function podium(rows){
    const spot=(x,p)=>!x?'<div class="k-lb-spot p'+p+'"></div>':'<div class="k-lb-spot p'+p+(x.own?' own':'')+'" data-id="'+x.id+'"'+tap(x,'#'+p+' '+x.name+', '+x.xp+' XP')+'>'+avatar(x,'lg')+'<span class="k-lb-medal" aria-hidden="true">'+p+'</span>'+name(x)+'<span class="k-lb-pxp">'+xpEl(x)+' XP</span>'+(x.tag?'<small class="k-lb-ptag">'+C.e(x.tag.split(' · ')[0])+'</small>':'')+'</div>';
    return spot(rows[1],2)+spot(rows[0],1)+spot(rows[2],3);
  }
  function row(x,i,zone=''){
    // The green dot says who is active now, so the line carries their training and streak.
    const sub=x.own?'You':(x.tag?'<span class="k-lb-tag">'+C.e(x.tag)+'</span>':'')+(x.streak?'<span class="k-lb-streak">'+ICON.flame+x.streak+'</span>':'');
    return '<li class="k-lb-row'+zone+(x.own?' own" id="k-lb-me':'')+'" data-id="'+x.id+'"'+tap(x,'#'+x.rank+' '+x.name+', '+x.xp+' XP')+' data-rank="'+x.rank+'" style="--i:'+Math.min(i,12)+'"><span class="k-lb-rank">'+x.rank+'</span>'+avatar(x)+'<span class="k-lb-who">'+name(x)+'<small>'+sub+'</small></span><span class="k-lb-xp">'+xpEl(x)+'<small>XP</small></span>'+move(x)+'</li>';
  }
  function list(b){
    const up=b.zones.promote,down=b.zones.demote?b.size-b.zones.demote:0,next=L.LEAGUES[b.league+1],prev=L.LEAGUES[b.league-1];
    return b.rows.slice(3).map((x,i)=>(down&&x.rank===down+1?'<li class="k-lb-zone down" aria-hidden="true">▼ Demotion zone · '+prev+'</li>':'')+
      row(x,i,up&&x.rank<=up?' up':down&&x.rank>down?' down':'')+(up&&x.rank===up?'<li class="k-lb-zone" aria-hidden="true">▲ Promotion zone · '+next+'</li>':'')).join('');
  }
  function mebar(b){
    const ahead=b.ahead?'<b>'+fmt(b.gap)+' XP</b> to pass <bdi>'+C.e(b.ahead.name)+'</bdi>':'You lead the board. Keep it!';
    return '<span class="k-lb-rank">#'+b.own.rank+'</span>'+avatar(b.own,'sm')+'<span class="k-lb-who"><strong>You · '+fmt(b.own.xp)+' XP</strong><small>'+ahead+'</small></span>';
  }
  const GEM=['#C98B5A','#A9B6C4','#F5C342','#3D8BFD','#E5484D','#2FBF71','#7FE3FF'];
  const gem=(i,cls)=>'<svg class="k-lb-gem'+cls+'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 8v8l-9 6-9-6V8z" fill="'+GEM[i]+'"/><path d="M12 2 3 8l9 5z" fill="#fff" fill-opacity=".45"/><path d="M12 2l9 6-9 5z" fill="#fff" fill-opacity=".18"/><path d="M21 8v8l-9 6v-9z" fill="#000" fill-opacity=".22"/><path d="M3 8v8l9 6v-9z" fill="#000" fill-opacity=".06"/></svg>';
  function hero(now){
    if(period!=='weekly')return '<section class="k-lb-hero all"><span class="k-lb-badge">'+ICON.star+'</span><div><p class="k-lb-kicker">Hall of fame</p><h2>All-time XP</h2><p>Every answer earns 10 XP</p></div></section>';
    const top=league>=L.LEAGUES.length-1;
    return '<section class="k-lb-hero lg'+league+'"><span class="k-lb-badge">'+gem(league,'')+'</span><div><p class="k-lb-kicker">'+L.LEAGUES[league]+' League</p><h2>'+(top?'Hold your place at the top':'Top '+L.PROMOTE+' move up to '+L.LEAGUES[league+1])+'</h2><p>Ends in <b>'+L.countdown(now)+'</b> · resets Monday</p><div class="k-lb-gems">'+L.LEAGUES.map((_,i)=>gem(i,i===league?' on':i<league?' done':'')).join('')+'</div></div></section>'+
      (result?'<section class="k-lb-result '+(result.to>result.from?'up':result.to<result.from?'down':'')+'" role="status">'+gem(result.to,'')+'<p><b>'+(result.to>result.from?'Promoted to '+L.LEAGUES[result.to]+' League!':result.to<result.from?'New week in '+L.LEAGUES[result.to]+' League':'You stayed in '+L.LEAGUES[result.to]+' League')+'</b><br>You finished #'+result.rank+' last week.'+(result.to<result.from?' A fresh start: the top 7 move up again.':'')+'</p><button data-a="leaders-ok" aria-label="Close">×</button></section>':'');
  }
  const tabBtn=(v,l)=>'<button role="tab" aria-selected="'+(period===v)+'" data-a="leaders-period" data-v="'+v+'">'+l+'</button>';
  const page=(b,now,intro)=>'<section class="k-lb'+(intro?'':' calm')+'" data-period="'+period+'">'+hero(now)+
    '<div class="k-lb-tabs" role="tablist" aria-label="Leaders period" data-on="'+period+'">'+tabBtn('weekly','This week')+tabBtn('all','All time')+'</div>'+
    '<section class="k-lb-podium" aria-label="Top three">'+podium(b.rows)+'</section>'+live()+'<ol class="k-lb-list" aria-label="Ranking">'+list(b)+'</ol>'+
    '<button class="k-lb-mebar" data-a="leaders-me" aria-label="Your rank '+b.own.rank+'">'+mebar(b)+'</button></section>';
  // "Studying now": on each opening the count catches up in a few small steps, then stays still.
  let liveShown=0,liveTarget=0,liveTimer=null;
  const live=()=>'<p class="k-lb-now" aria-label="'+fmt(liveTarget)+' students studying now"><i aria-hidden="true"></i><b aria-hidden="true">'+fmt(liveShown)+'</b><span aria-hidden="true"> students studying now</span></p>';
  function startLive(){
    clearTimeout(liveTimer);
    const steps=[];let n=3+Math.floor(Math.random()*4);liveTarget=L.activeNow(Date.now());
    while(n--)steps.push(Math.random()<0.12?-1:1+Math.floor(Math.random()*3));
    liveShown=reduced()?liveTarget:liveTarget-steps.reduce((a,b)=>a+b,0);
    if(reduced())return;
    const next=()=>{
      if(!steps.length||cur().v!=='leaders')return;
      liveShown+=steps.shift();const el=document.querySelector('.k-lb-now b');
      if(el){el.textContent=fmt(liveShown);el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump')}
      liveTimer=setTimeout(next,500+Math.random()*700);
    };
    liveTimer=setTimeout(next,500);
  }
  // Open on the board as it was at the last visit (never before this week), then let it catch up.
  VIEWS.leaders=()=>{
    const now=Date.now();let html;settle();
    if(pending===null){
      const last=Number(store.get(key('seen'),0))||0;
      shownAt=reduced()?now:Math.max(L.clock(now).weekStart+60000,now-(last?Math.min(MAX_GAP,Math.max(MIN_GAP,now-last)):FIRST_GAP));
      if(shownAt>now)shownAt=now;
      startLive();html=page(data(shownAt),now,true);pending=setTimeout(()=>{pending=0;update(true)},OPEN_DELAY);startTicker();
    }else html=page(data(shownAt),now,false);
    return{title:'Leaders',html,tabs:'leaders',action:null};
  };
  function countUp(el,from,to){
    el.dataset.xp=to;if(from===to||reduced()){el.textContent=fmt(to);return}
    const start=performance.now();el.classList.add('ticking');
    (function step(t){const k=Math.min(1,(t-start)/900);el.textContent=fmt(Math.round((from+(to-from)*(1-Math.pow(1-k,3)))/10)*10);if(k<1)requestAnimationFrame(step);else el.classList.remove('ticking')})(start);
  }
  // FLIP: read every position first, rebuild once, read the new positions, then write all transforms.
  let lastSig='';
  function update(big){
    const root=document.querySelector('.k-lb');if(!root||cur().v!=='leaders')return;
    const now=Date.now(),b=data(now),q=s=>root.querySelector(s);shownAt=now;store.set(key('seen'),now);
    const left=q('.k-lb-hero b');if(left&&period==='weekly')left.textContent=L.countdown(now);
    const sig=b.rows.map(x=>x.id+':'+x.xp).join();if(!big&&sig===lastSig)return;lastSig=sig;
    root.classList.add('calm');
    const listEl=q('.k-lb-list'),pod=q('.k-lb-podium'),bar=q('.k-lb-mebar');
    const rowsOf=()=>[...listEl.querySelectorAll('.k-lb-row')];
    const before=new Map(rowsOf().map(el=>[el.dataset.id,{top:el.getBoundingClientRect().top,rank:+el.dataset.rank,xp:+el.querySelector('[data-xp]').dataset.xp}]));
    const podXp=new Map([...pod.querySelectorAll('[data-id]')].map(el=>[el.dataset.id,+el.querySelector('[data-xp]').dataset.xp]));
    const focused=document.activeElement?.closest?.('.k-lb-row')?.dataset.id;
    listEl.innerHTML=list(b);
    if([...podXp.keys()].join()!==[b.rows[1],b.rows[0],b.rows[2]].filter(Boolean).map(x=>x.id).join()){pod.innerHTML=podium(b.rows);pod.classList.remove('swap');void pod.offsetWidth;pod.classList.add('swap')}
    else for(const x of b.rows.slice(0,3)){const el=pod.querySelector('[data-id="'+x.id+'"] [data-xp]');countUp(el,podXp.get(x.id),x.xp)}
    const oldRank=+bar.querySelector('.k-lb-rank').textContent.slice(1);
    bar.innerHTML=mebar(b);bar.setAttribute('aria-label','Your rank '+b.own.rank);
    if(oldRank!==b.own.rank){globalThis.KafuGameFeel?.haptic?.(b.own.rank<oldRank?'success':'light');bar.classList.remove('up','down');void bar.offsetWidth;bar.classList.add(b.own.rank<oldRank?'up':'down')}
    const rows=rowsOf(),after=rows.map(el=>el.getBoundingClientRect().top); // one read pass
    rows.forEach((el,i)=>{                                                   // then one write pass
      const was=before.get(el.dataset.id);if(!was)return;
      const x=el.querySelector('[data-xp]'),rank=+el.dataset.rank,dy=was.top-after[i];
      countUp(x,was.xp,+x.dataset.xp);
      if(rank!==was.rank)el.querySelector('.k-lb-move').outerHTML=move({move:was.rank-rank}); // the move just watched
      if(reduced()||Math.abs(dy)<1)return;
      el.style.transition='none';el.style.transform='translateY('+dy+'px)';el.classList.add(rank<was.rank?'climb':'fall');
      requestAnimationFrame(()=>requestAnimationFrame(()=>{el.style.transition='transform '+(big?820:600)+'ms cubic-bezier(.2,.8,.2,1)';el.style.transform=''}));
      setTimeout(()=>el.classList.remove('climb','fall'),1600);
    });
    if(focused)listEl.querySelector('[data-id="'+focused+'"]')?.focus({preventScroll:true});
  }
  function startTicker(){if(!ticker)ticker=setInterval(()=>{if(cur().v!=='leaders'){stopTicker();return}if(pending===0&&document.visibilityState==='visible'&&!SHEET&&!document.querySelector('.k-lb-scrim'))update(false)},TICK)}
  function stopTicker(){clearInterval(ticker);ticker=null}
  const stop=()=>{clearTimeout(pending);clearTimeout(liveTimer);pending=null;lastSig='';stopTicker()};
  // Profile card (Duolingo / Chess.com style): week chart and a Strava-style cheer, all on the device.
  const DAYS=['M','T','W','T','F','S','S'];
  function cheers(){const w=L.clock(Date.now()).weekKey,c=store.get(key('cheers'),{});return c&&c.week===w&&Array.isArray(c.ids)?c:{week:w,ids:[]}}
  function cardHtml(id){
    const now=Date.now(),b=data(now),x=b.rows.find(r=>r.id===id);if(!x)return '';
    let days,info=null;
    if(x.own){const c=L.clock(now),qs=Object.values(S.answers||{});days=[0,1,2,3,4,5,6].map(i=>{const a=c.weekStart+i*DAY;return a>now?null:qs.filter(q=>q&&q.n>0&&q.t>=a&&q.t<a+DAY).length*10})}
    else{info=L.card(id,now,league,b.pace,period==='weekly'?x.xp:null);days=info.days}
    const ch=cheers(),mine=ch.ids.includes(id),base=L.hash('cheer|'+id+ch.week)%9;
    const max=Math.max(10,...days.map(d=>d||0)),today=L.clock(now).weekday;
    const bars=days.map((d,i)=>'<span class="'+(i===today?'today':'')+'"><em>'+(i===today&&d?fmt(d):'')+'</em>'+(d==null?'<i hidden></i>':'<i style="height:'+Math.max(4,Math.round(d/max*100))+'%"></i>')+'<b>'+DAYS[i]+'</b></span>').join('');
    const exam=info&&(info.kind!=='board'?'Finals':/Surg|Urology|ENT|Orthop/.test(info.specialty)?'MRCS':'Board exam');
    return '<section class="k-lb-card" role="dialog" aria-modal="true" aria-label="'+C.e(x.name)+'" data-a="leaders-noop">'+avatar(x,'xl')+'<h3>'+name(x)+'</h3>'+
      (info?'<p class="k-lb-role">'+(info.kind==='board'?ICON.steth+'<span><b>'+C.e(info.board)+'</b> · '+C.e(info.specialty)+' · '+C.e(info.line.split(' · ').pop())+'</span>':ICON.cap+'<span>'+C.e(info.college)+' · <b>'+C.e(info.line.split(' · ').pop())+'</b></span>')+'</p>':'')+
      '<p class="k-lb-meta">'+gem(league,'')+' '+L.LEAGUES[league]+' League'+(info?' · '+ICON.pin+C.e(info.city)+' · on Kafu '+info.weeks+' wk':'')+'</p>'+
      '<div class="k-lb-stats"><span><b>#'+x.rank+'</b>Rank</span><span><b>'+fmt(x.xp)+'</b>'+(period==='weekly'?'XP this week':'XP all time')+'</span><span><b>'+ICON.flame+(x.streak||0)+'</b>Day streak</span>'+
      (info?'<span><b>'+info.accuracy+'%</b>Accuracy</span><span><b>'+fmt(info.questions)+'</b>Questions this week</span><span><b>'+exam+'</b>Preparing for</span>':'')+'</div>'+
      '<div class="k-lb-bars" aria-label="XP each day this week">'+bars+'</div>'+
      (x.own?'':'<button class="k-lb-cheer'+(mine?' on':'')+'" data-a="leaders-cheer" data-v="'+x.id+'" aria-pressed="'+mine+'">'+(mine?ICON.check+'<span>Cheered</span>':ICON.clap+'<span>Cheer</span>')+' <small>'+(base+(mine?1:0))+'</small></button>')+
      '<button class="k-lb-close" data-a="leaders-close" aria-label="Close">×</button></section>';
  }
  let cardFrom=null;
  const back=()=>closeCard();
  function openCard(id){
    closeCard(true);cardFrom=document.activeElement;
    const wrap=document.createElement('div');wrap.className='k-lb-scrim';wrap.dataset.a='leaders-close';wrap.innerHTML=cardHtml(id);
    document.body.appendChild(wrap);document.body.classList.add('k-lb-lock');
    wrap.querySelector('.k-lb-close')?.focus({preventScroll:true});
    if(IN_TG&&TG.BackButton){try{TG.BackButton.show();TG.BackButton.onClick(back)}catch(_){}}
    globalThis.KafuGameFeel?.haptic?.('light');
  }
  function closeCard(instant){
    const wrap=document.querySelector('.k-lb-scrim');if(!wrap)return;
    if(IN_TG&&TG.BackButton){try{TG.BackButton.offClick(back);if(STACK.length<2)TG.BackButton.hide()}catch(_){}}
    document.body.classList.remove('k-lb-lock');
    const done=()=>{wrap.remove();if(cardFrom&&document.contains(cardFrom))cardFrom.focus({preventScroll:true});cardFrom=null};
    if(instant===true||reduced()){done();return}
    wrap.classList.add('closing');setTimeout(done,220);
  }
  document.addEventListener('keydown',e=>{
    const wrap=document.querySelector('.k-lb-scrim');
    if(wrap&&e.key==='Escape'){e.preventDefault();closeCard();return}
    if(wrap&&e.key==='Tab'){const f=[...wrap.querySelectorAll('button')];if(!f.length)return;const i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}return}
    const el=e.target.closest?.('.k-lb [role=button][data-a="leaders-card"]');
    if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openCard(el.dataset.v)}
  });
  ACTIONS['leaders-card']=d=>openCard(d.v);
  ACTIONS['leaders-close']=()=>closeCard();
  ACTIONS['leaders-noop']=()=>{};
  ACTIONS['leaders-cheer']=d=>{
    const c=cheers(),on=!c.ids.includes(d.v);c.ids=on?[...c.ids,d.v]:c.ids.filter(x=>x!==d.v);store.set(key('cheers'),c);
    const card=document.querySelector('.k-lb-card');if(card)card.outerHTML=cardHtml(d.v);
    const btn=document.querySelector('.k-lb-cheer');btn?.focus({preventScroll:true});
    if(on){globalThis.KafuGameFeel?.haptic?.('success');if(btn&&!reduced())for(let i=0;i<6;i++){const e=document.createElement('i');e.className='k-lb-burst';e.style.setProperty('--a',(i*60)+'deg');btn.appendChild(e);setTimeout(()=>e.remove(),800)}}
  };
  ACTIONS['leaders-ok']=()=>{result=null;document.querySelector('.k-lb-result')?.remove()};
  ACTIONS['leaders-period']=d=>{period=d.v==='all'?'all':'weekly';stop();render()};
  ACTIONS['leaders-me']=()=>{const el=document.getElementById('k-lb-me');if(el){el.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse')}};
  // Leaving the tab by any route (tab bar, back, a direct tab()/go() call) stops timers and closes the card.
  const baseRender=render;
  render=function(...args){if(cur().v!=='leaders'){if(pending!==null||ticker)stop();closeCard(true)}return baseRender.apply(this,args)};
  document.addEventListener('visibilitychange',()=>{if(cur().v!=='leaders')return;if(document.visibilityState==='hidden')store.set(key('seen'),Date.now());else if(pending===0)update(false)});
  globalThis.KafuLeaders={update,get period(){return period},get league(){return league}};
}};
// Loaded after start-up by leaders-loader.js, so install straight away (once).
(R=>{if(globalThis.KafuLeaders)return;R.installed?KafuLeadersModule.install():R.installers.push(KafuLeadersModule)})(globalThis.KafuEnhancements);
