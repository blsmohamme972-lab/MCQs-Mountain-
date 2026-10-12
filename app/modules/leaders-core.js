/* Leaders board data: a deterministic weekly field of study rivals plus the student's own local XP.
   Everything is computed on the device from the clock; no network, no storage. Real users can later be
   merged into `field()` from the server without changing the view. */
(function(root){
  'use strict';
  const DAY=86400000,HOUR=3600000,TZ=3*HOUR; // Baghdad, UTC+3, no daylight saving
  const NAMES=[
    'علي الساعدي','Zainab.H','مصطفى كريم','Hiba 🌸','زهراء محمد','Ali Kareem','نور الهدى','Mustafa Al-Obaidi',
    'حسين العبيدي','Dr. Sara','مريم','Ahmed Raad','سجاد عباس','Fatima Alzahraa','فاطمة الزهراء 🤍','Mohammed Qasim',
    'ياسر الجبوري','Ruqaya','رقية','Abbas Fadhil','محمد باقر','Teeba ✨','آية حسن','Murtadha','د. أحمد الربيعي','Dania',
    'حوراء','Omar Al-Ani','عبدالله الدليمي','Mays','تبارك','Haider Salih','مرتضى','Lina','بنين علي','Sajjad','كرار حيدر',
    'Rusul 🌷','شهد','Ameer','أمير الخفاجي','Shahad.M','سارة 🌙','Yaseen','حسن التميمي','Hawraa','زينب ع','Zahraa Ali',
    'يوسف','Noor Alhuda','Karrar','همسة','Hussein Jabbar','ديانا','Baneen','Mohammed','رسل','Dr. Hasan','منتظر'
  ];
  // Telegram's own placeholder gradients, so photo-less accounts look exactly like Telegram's.
  const GRADIENTS=[['#FF885E','#FF516A'],['#FFCD6A','#FFA85C'],['#82B1FF','#665FFF'],['#A0DE7E','#54CB68'],
    ['#53EDD6','#28C9B7'],['#72D5FD','#2A9EF1'],['#E0A2F3','#D669ED']];
  const PHOTOS=47; // app/assets/avatars/a01..a47.webp (see SOURCES.txt): a01-a30 general, a31 the star's, a32-a47 feminine
  const WOMEN=new Set(['Zainab.H','Hiba 🌸','زهراء محمد','نور الهدى','Dr. Sara','مريم','Fatima Alzahraa','فاطمة الزهراء 🤍','Ruqaya','رقية',
    'Teeba ✨','آية حسن','Dania','حوراء','Mays','تبارك','Lina','بنين علي','Rusul 🌷','شهد','Shahad.M','سارة 🌙','Hawraa','زينب ع',
    'Zahraa Ali','Noor Alhuda','همسة','ديانا','Baneen','رسل']);
  const CITIES=['Baghdad','Baghdad','Baghdad','Basra','Najaf','Karbala','Mosul','Erbil','Hilla','Kirkuk','Diwaniyah','Nasiriyah','Kut','Ramadi'];
  // Duolingo-style leagues: a group of 30, top 7 move up, bottom 5 move down. Higher leagues study harder.
  const LEAGUES=['Bronze','Silver','Gold','Sapphire','Ruby','Emerald','Diamond'],FACTOR=[0.35,0.5,0.65,0.8,1,1.2,1.45];
  const COHORT=30,PROMOTE=7,DEMOTE=5,STAR='Hiba 🌸';
  function hash(s){let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  const roll=(...k)=>rng(hash(k.join('|')))();
  function clock(now){
    const local=now+TZ,day=Math.floor(local/DAY),weekday=(day+3)%7; // 1970-01-01 was a Thursday; Monday = 0
    const weekStartDay=day-weekday,hour=(local-day*DAY)/HOUR;
    return{day,weekday,hour,weekStartDay,weekStart:weekStartDay*DAY-TZ,weekEnd:(weekStartDay+7)*DAY-TZ,weekKey:'w'+weekStartDay};
  }
  function initials(name){
    // Telegram shows the first letter of the first and last name; titles and emoji are not letters.
    const words=String(name).replace(/^(Dr\.|د\.)\s*/,'').split(/\s+/).map(w=>w.replace(/[^\p{L}]/gu,'')).filter(Boolean);
    return words.slice(0,2).map(w=>[...w][0]).join('').toUpperCase()||'K';
  }
  function profile(name,i){
    const r=rng(hash('rival|'+name));
    const pace=60+1300*Math.pow(r(),2.1);           // XP per active day
    const loyalty=0.5+0.45*r();                     // chance of studying on a given day
    const evening=0.6+0.8*r();                      // how late in the day they study
    const weeks=r()<0.2?0:1+Math.floor(r()*20);
    const gradient=GRADIENTS[hash(name)%GRADIENTS.length];
    const star=name===STAR,woman=WOMEN.has(name);
    return{id:'r'+i,name,pace:star?1250:woman?pace*1.12:pace,loyalty:star?0.93:loyalty,evening,weeks,star,woman,photo:null,gradient,initials:initials(name),city:CITIES[Math.floor(r()*CITIES.length)]};
  }
  const RIVALS=NAMES.map(profile);
  // About half the accounts have a profile picture, each picture used once, like a real group.
  const pic=k=>'assets/avatars/a'+String(k).padStart(2,'0')+'.webp';
  const order=list=>list.map(p=>[hash('photo|'+p.name),p]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
  // Most women get one of the feminine pictures; the general pictures go to everyone else and a few women.
  const women=order(RIVALS.filter(p=>p.woman&&!p.star)),fem=women.slice(0,16),others=order(RIVALS.filter(p=>!p.star&&!fem.includes(p)));
  fem.forEach((p,k)=>{p.photo=pic(32+k)});others.slice(0,30).forEach((p,k)=>{p.photo=pic(1+k)});
  RIVALS.find(p=>p.star).photo=pic(31);
  const tens=x=>Math.max(0,Math.round(x/10)*10);
  function dayXp(p,day){
    if(roll(p.name,'on',day)<=p.loyalty)return tens(p.pace*(0.35+1.3*roll(p.name,'amt',day)));
    // Off days are often a quick review to keep the streak, sometimes nothing at all.
    return roll(p.name,'light',day)<0.25+0.7*p.loyalty?tens(20+70*roll(p.name,'lamt',day)):0;
  }
  function dayShare(p,hour){
    // Little before 7:00, most between afternoon and midnight; late studiers shift right.
    const x=Math.min(1,Math.max(0,(hour-7)/16));
    return Math.pow(x,p.evening);
  }
  function weekly(p,now,f=1){
    const c=clock(now);let xp=0;
    for(let d=c.weekStartDay;d<c.day;d++)xp+=dayXp(p,d);
    return tens(f*(xp+dayXp(p,c.day)*dayShare(p,c.hour)));
  }
  function allTime(p,now){
    return tens(p.pace*p.loyalty*7*p.weeks*(0.2+0.2*roll(p.name,'past'))+weekly(p,now));
  }
  function streak(p,now){
    const c=clock(now);let run=0;
    for(let d=c.day;d>c.day-400;d--){const on=d===c.day?dayXp(p,d)*dayShare(p,c.hour)>0:dayXp(p,d)>0;if(on)run++;else if(d!==c.day)break}
    return run;
  }
  function online(p,now){
    const c=clock(now),slot=Math.floor(now/(10*60000));
    return dayXp(p,c.day)>0&&c.hour>=8&&roll(p.name,'online',slot)<0.08+0.25*dayShare(p,c.hour)*(p.pace/1400);
  }
  function score(p,period,now,f){return period==='all'?allTime(p,now):weekly(p,now,f)}
  function rank(entries){
    return entries.slice().sort((a,b)=>b.xp-a.xp||(a.own?-1:b.own?1:0)||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}));
  }
  // This week's group: 29 rivals picked per student and week (the star account is always in it).
  function cohort(weekKey,uid){
    const star=RIVALS.find(p=>p.star),rest=RIVALS.filter(p=>!p.star).map(p=>[hash(weekKey+'|'+uid+'|'+p.name),p]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
    return [star,...rest.slice(0,COHORT-2)];
  }
  function field(period,now,league,uid){
    const f=FACTOR[league]||1,pool=period==='all'?RIVALS:cohort(clock(now).weekKey,uid);
    const rows=pool.map(p=>({id:p.id,name:p.name,star:p.star,xp:score(p,period,now,f),initials:p.initials,gradient:p.gradient,photo:p.photo})).filter(x=>x.xp>0);
    if(period==='weekly'){
      // Keep the star account among the leaders, just above whoever would otherwise be 7th.
      const star=rows.find(x=>x.star),others=rows.filter(x=>!x.star).sort((a,b)=>b.xp-a.xp),seventh=others[PROMOTE-2];
      if(star&&seventh&&star.xp<=seventh.xp)star.xp=tens(seventh.xp+10+40*roll(STAR,'lead',clock(now).day));
    }
    return rows;
  }
  function board(period,now,own,league=0){
    period=period==='all'?'all':'weekly';league=Math.max(0,Math.min(LEAGUES.length-1,league|0));
    const uid=own.id||'me';
    const me={id:'me',own:true,name:own.name||'You',photo:own.photo||null,initials:initials(own.name||'You'),gradient:GRADIENTS[hash(own.id||'me')%GRADIENTS.length],xp:tens(own[period==='all'?'allXp':'weeklyXp']||0),streak:own.streak||0};
    const ranked=rank([...field(period,now,league,uid),me]);
    // Movement since yesterday; early in a new week, since the start of the week (at least an hour).
    const c=clock(now),span=period==='weekly'?Math.max(HOUR,Math.min(DAY,(now-c.weekStart)/2)):DAY;
    const ownBefore=period==='all'?own.allXpBefore:own.weeklyXpBefore;
    const then=field(period,now-span,league,uid),was=new Map(then.map(x=>[x.id,x.xp]));
    const before=new Map(rank([...then,{...me,xp:tens(typeof ownBefore==='function'?ownBefore(span):0)}]).map(x=>[x.id,x.rank]));
    const rows=ranked.map(x=>{
      const p=x.own?null:RIVALS[Number(x.id.slice(1))];
      return{...x,move:x.own||was.get(x.id)?(before.get(x.id)||x.rank)-x.rank:0,streak:p?streak(p,now):x.streak,online:p?online(p,now):true};
    });
    const mine=rows.find(x=>x.own),ahead=rows[mine.rank-2]||null;
    const zones=period==='weekly'?{promote:league<LEAGUES.length-1?PROMOTE:0,demote:league>0&&rows.length>PROMOTE+DEMOTE?DEMOTE:0}:{promote:0,demote:0};
    return{period,rows,own:mine,ahead,gap:ahead?Math.max(10,ahead.xp-mine.xp+10):0,clock:clock(now),size:rows.length,league,leagueName:LEAGUES[league],zones};
  }
  // Profile card: this week's XP per day (Monday first, today so far), city and how long they have studied.
  function card(id,now,league=0){
    const p=RIVALS[Number(String(id).slice(1))];if(!p)return null;
    const c=clock(now),f=[0.35,0.5,0.65,0.8,1,1.2,1.45][league]||1;
    const days=[0,1,2,3,4,5,6].map(i=>{const d=c.weekStartDay+i;return d<c.day?tens(f*dayXp(p,d)):d===c.day?tens(f*dayXp(p,d)*dayShare(p,c.hour)):null});
    return{days,city:p.city,weeks:p.weeks+1,streak:streak(p,now),woman:p.woman};
  }
  // Where a finished week leaves the student: up, down or the same league.
  function outcome(rank,size,league,zones){
    if(zones.promote&&rank<=zones.promote)return Math.min(LEAGUES.length-1,league+1);
    if(zones.demote&&rank>size-zones.demote)return Math.max(0,league-1);
    return league;
  }
  function ownXp(answers,now){
    const c=clock(now),valid=Object.values(answers||{}).filter(a=>a&&Number.isSafeInteger(a.n)&&a.n>0);
    const since=t=>valid.filter(a=>Number(a.t)>=t&&Number(a.t)<=now).length*10;
    const all=valid.filter(a=>!(Number(a.t)>now)).length*10;
    return{weeklyXp:since(c.weekStart),allXp:all,
      allXpBefore:span=>valid.filter(a=>Number(a.t)<=now-span).length*10,
      weeklyXpBefore:span=>valid.filter(a=>Number(a.t)>=c.weekStart&&Number(a.t)<=now-span).length*10};
  }
  function countdown(now){
    const left=Math.max(0,clock(now).weekEnd-now),d=Math.floor(left/DAY),h=Math.floor(left%DAY/HOUR),m=Math.floor(left%HOUR/60000);
    return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m';
  }
  const api={NAMES,GRADIENTS,PHOTOS,LEAGUES,COHORT,PROMOTE,DEMOTE,STAR,clock,initials,board,outcome,card,ownXp,countdown,hash};
  root.KafuLeadersCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
