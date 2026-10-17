const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const C=require(path.resolve(__dirname,'../../../app/modules/comments-core.js'));
const L=require(path.resolve(__dirname,'../../../app/modules/leaders-core.js'));
const SHA='a'.repeat(64),A=L.NAMES[0],B=L.NAMES[3];
const index=(extra={})=>({schema:1,book_id:'BOOK',revision:2,shards:{Q000001:{url:'/packs/_comments/BOOK/Q000001.'+SHA.slice(0,12)+'.json',sha256:SHA,questions:1,comments:2},...extra}});
test('an index is accepted only for its book, with content-addressed shard URLs',()=>{
  assert.equal(C.validIndex(index(),'BOOK'),true);
  assert.equal(C.validIndex(index(),'OTHER'),false);
  assert.equal(C.validIndex({...index(),schema:2},'BOOK'),false);
  assert.equal(C.validIndex(index({Q000002:{url:'https://evil.test/x.json',sha256:SHA}}),'BOOK'),false);
  assert.equal(C.validIndex(index({Q000002:{url:'/packs/_comments/BOOK/Q000002.'+SHA.slice(0,12)+'.json',sha256:'nothex'}}),'BOOK'),false);
  assert.equal(C.validIndex(index({Q00002:{url:'/packs/_comments/BOOK/Q00002.'+SHA.slice(0,12)+'.json',sha256:SHA}}),'BOOK'),false);
  assert.equal(C.validShard({schema:1,book_id:'BOOK',shard:'Q000001',questions:{}},'BOOK','Q000001'),true);
  assert.equal(C.validShard({schema:1,book_id:'BOOK',shard:'Q000002',questions:{}},'BOOK','Q000001'),false);
  assert.equal(C.shardOf('Q000001234'),'Q000001');
});
test('comments resolve to the Leaders personas and anything else is left out',()=>{
  const list=C.clean([
    {author:A,text:'  Fixture comment.  ',kind:'tip',replies:[{author:B,text:'Fixture reply.'},{author:'Stranger',text:'Dropped.'},{author:B,text:'   '}]},
    {author:'Stranger',text:'Dropped.'},
    {author:B,text:'Fixture two.',kind:'unknown'},
    null,
  ],L.person);
  assert.equal(list.length,2);
  assert.deepEqual(list[0].who,L.person(A));
  assert.equal(list[0].text,'Fixture comment.');assert.equal(list[0].kind,'tip');
  assert.deepEqual(list[0].replies.map(r=>r.text),['Fixture reply.']);
  assert.equal(list[1].kind,null);
  assert.equal(C.count(list),3);
  assert.deepEqual(C.clean('not a list',L.person),[]);
  assert.equal(C.clean([{author:A,text:'x'.repeat(900)}],L.person)[0].text.length,600);
  assert.equal(C.clean(Array.from({length:20},(_,i)=>({author:A,text:'Fixture '+i})),L.person).length,12);
});
test('the first three threads show and the rest open with "Show N more"',()=>{
  const list=C.clean(Array.from({length:5},(_,i)=>({author:A,text:'Fixture '+i,replies:i===4?[{author:B,text:'Fixture reply'}]:[]})),L.person);
  const closed=C.view(list,false),open=C.view(list,true);
  assert.equal(closed.shown.length,3);assert.equal(closed.hidden,3);assert.equal(closed.total,6);
  assert.equal(open.shown.length,5);assert.equal(open.hidden,0);
});
test('every persona has the same face in the comments as on the board',()=>{
  const people=L.people();
  assert.equal(people.length,L.NAMES.length);
  for(const p of people){assert.ok(p.initials&&p.gradient.length===2&&p.tag,p.name);if(p.photo)assert.match(p.photo,/^assets\/avatars\/a\d{2}\.webp$/);}
  assert.equal(L.person('Nobody'),null);
  const row=L.board('weekly',Date.parse('2026-10-14T12:00:00Z'),{name:'x'}).rows.find(r=>!r.own);
  const p=L.person(row.name);assert.equal(p.photo,row.photo);assert.deepEqual(p.gradient,row.gradient);assert.equal(p.tag,row.tag);
});
test('posting times, likes and reactions are read safely; older packs without them still show',()=>{
  const [c]=C.clean([{author:A,text:'Fixture.',at:'2026-10-17T09:00:00Z',likes:14,react:['❤️','🔥','🤡','❤️'],
    replies:[{author:B,text:'Reply.',at:'yesterday',likes:99,react:'👍'}]}],L.person,'Q000000101');
  assert.equal(c.at,Date.parse('2026-10-17T09:00:00Z'));assert.equal(c.likes,14);assert.deepEqual(c.react,['❤️','🔥']);
  assert.match(c.key,/^Q000000101:[0-9a-z]+$/);
  const r=c.replies[0];assert.equal(r.at,null);assert.equal(r.likes,0);assert.deepEqual(r.react,[]);
  assert.notEqual(r.key,c.key);
  assert.equal(C.clean([{author:A,text:'Fixture.'}],L.person,'Q1')[0].key,C.clean([{author:A,text:' Fixture. '}],L.person,'Q1')[0].key);
});
test('times read like a social app, and a clock behind the server reads "now"',()=>{
  const now=Date.parse('2026-10-17T12:00:00Z'),at=s=>now-s*1000;
  assert.deepEqual([30,90,3599,3600,86399,86400,6*86400,7*86400,364*86400,400*86400,-600].map(s=>C.ago(at(s),now)),
    ['now','1m','59m','1h','23h','1d','6d','1w','52w','1y','now']);
  assert.equal(C.ago(null,now),'');
});
test('the student\'s own like adds one and a 👍, and the activity line sums every comment',()=>{
  const list=C.clean([
    {author:A,text:'One.',at:'2026-10-17T09:00:00Z',likes:10,react:['❤️','🔥'],replies:[{author:B,text:'Two.',at:'2026-10-17T11:00:00Z',likes:2,react:['😂']}]},
    {author:B,text:'Three.',at:'2026-10-16T09:00:00Z',likes:4,react:['🔥']},
  ],L.person,'Q1');
  assert.deepEqual(C.reactions(list[0],false),{count:10,icons:['❤️','🔥']});
  assert.deepEqual(C.reactions(list[0],true),{count:11,icons:['👍','❤️','🔥']});
  assert.deepEqual(C.reactions({likes:0,react:[]},true),{count:1,icons:['👍']});
  const s=C.stats(list),mine=C.stats(list,key=>key===list[1].key);
  assert.equal(s.comments,3);assert.equal(s.reactions,16);assert.equal(s.last,Date.parse('2026-10-17T11:00:00Z'));
  assert.deepEqual(s.icons,['❤️','🔥','😂']);assert.deepEqual(s.faces.map(w=>w.name),[A,B]);
  assert.equal(mine.reactions,17);
});
test('a thread shows two replies (three when that is all) and opens the rest on demand',()=>{
  const thread=n=>({author:A,text:'Thread '+n,replies:Array.from({length:n},(_,i)=>({author:B,text:'Reply '+i}))});
  const list=C.clean([thread(3),thread(5)],L.person,'Q1');
  const closed=C.view(list,false),open=C.view(list,false,new Set([list[1].key]));
  assert.deepEqual(closed.shown.map(c=>[c.shownReplies.length,c.hiddenReplies]),[[3,0],[2,3]]);
  assert.deepEqual(open.shown.map(c=>[c.shownReplies.length,c.hiddenReplies]),[[3,0],[5,0]]);
  assert.equal(closed.total,10);
});
