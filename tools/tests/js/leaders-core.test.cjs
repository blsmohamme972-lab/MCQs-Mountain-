const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const L=require(path.resolve(__dirname,'../../../app/modules/leaders-core.js'));
const MON=Date.parse('2026-10-11T21:00:00Z'); // Monday 00:00 Baghdad
test('weeks start Monday 00:00 Baghdad and the countdown reaches the next Monday',()=>{
  assert.equal(L.clock(MON).weekStart,MON);assert.equal(L.clock(MON-1).weekEnd,MON);
  assert.equal(L.clock(MON+3*86400000).weekStart,MON);assert.equal(L.countdown(MON+6*86400000+23*3600000),'1h 0m');
});
test('the board is deterministic, ranked, and places the student by their own local XP',()=>{
  const now=MON+3.7*86400000,answers={};for(let i=0;i<120;i++)answers['Q'+String(i).padStart(9,'0')]={n:1,c:true,t:now-i*60000};
  const own={name:'Student',...L.ownXp(answers,now)},a=L.board('weekly',now,own),b=L.board('weekly',now,own);
  assert.deepEqual(a,b);assert.equal(own.weeklyXp,1200);
  assert.ok(a.rows.every((x,i)=>x.rank===i+1&&(i===0||a.rows[i-1].xp>=x.xp)));
  assert.equal(a.rows.filter(x=>x.own).length,1);assert.equal(a.own.xp,1200);
  if(a.ahead)assert.ok(a.own.xp+a.gap>a.ahead.xp);
});
test('rivals only gain XP as the week goes on and the week resets',()=>{
  const at=t=>new Map(L.board('weekly',t,{name:'x'}).rows.filter(x=>!x.own).map(x=>[x.name,x.xp]));
  const early=at(MON+86400000),late=at(MON+5*86400000);
  for(const [n,xp] of early)assert.ok((late.get(n)||0)>=xp,n);
  const next=at(MON+7*86400000+60000);assert.ok([...next.values()].every(x=>x<=200));
});
test('initials follow Telegram: first letters of the first two words, no titles or emoji',()=>{
  assert.equal(L.initials('Mustafa Al-Obaidi'),'MA');assert.equal(L.initials('Hiba 🌸'),'H');assert.equal(L.initials('Dr. Sara'),'S');assert.equal(L.initials('زهراء محمد'),'زم');
});
test('leagues: groups of 30, top 7 move up, bottom 5 move down, the star account stays in the top 7',()=>{
  const now=MON+4.5*86400000;
  for(const league of [0,3,6]){
    const b=L.board('weekly',now,{id:'7',name:'Student',weeklyXp:500},league);
    assert.ok(b.size<=L.COHORT);assert.equal(b.leagueName,L.LEAGUES[league]);
    assert.ok(b.rows.find(x=>x.name===L.STAR).rank<=L.PROMOTE);
    assert.equal(b.zones.promote,league<6?7:0);assert.equal(b.zones.demote,league>0?5:0);
  }
  assert.equal(L.outcome(7,30,2,{promote:7,demote:5}),3);assert.equal(L.outcome(26,30,2,{promote:7,demote:5}),1);
  assert.equal(L.outcome(25,30,2,{promote:7,demote:5}),2);assert.equal(L.outcome(1,30,6,{promote:0,demote:5}),6);
});
test('every rival has an Iraqi city and either a board specialty or a medical college; most are on the board',()=>{
  const now=MON+2*86400000,rows=L.board('all',now,{name:'x'}).rows.filter(x=>!x.own);
  const cards=rows.map(x=>L.card(x.id,now));
  assert.ok(cards.every(c=>c.city&&c.line&&(c.kind==='board'?/Board$/.test(c.board)&&c.specialty:/Medic/.test(c.college))));
  assert.ok(cards.filter(c=>c.kind==='board').length>cards.length/2);
  assert.ok(rows.every(x=>x.tag&&x.tag.length<=24),'short tags fit the row');
  assert.ok(cards.every(c=>c.accuracy>=62&&c.accuracy<=91));
});
test('studying-now count follows the Baghdad day: quiet before dawn, ~1,400 by day, busiest in the evening, smooth',()=>{
  const day=MON+86400000,at=h=>L.activeNow(day+h*3600000);
  assert.ok(at(4)<600&&at(12)>1000&&at(12)<1700&&at(21)>at(12));
  let prev=at(12),worst=0;for(let s=1;s<1800;s++){const v=L.activeNow(day+12*3600000+s*1000);worst=Math.max(worst,Math.abs(v-prev));prev=v}
  assert.ok(worst<=3,'never jumps');
  assert.equal(L.activeNow(day+5e6),L.activeNow(day+5e6),'deterministic');
});
