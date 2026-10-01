// Workerd/Miniflare D1 counters, not synthetic SQLite VM instruction estimates.
import { Miniflare } from 'miniflare';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import bot from '../../worker/bot.mjs';
const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-07-30',d1Databases:{DB:'read-bounds-test'}});
const originalFetch=globalThis.fetch,originalLog=console.log,events=[];
try{
  const DB=await mf.getD1Database('DB');
  for(const file of ['0001_publish_queue.sql','0002_publish_warnings.sql','0003_leaderboard.sql','0004_leaderboard_compact.sql','0005_leaderboard_read_bounds.sql']){
    const sql=readFileSync(new URL('../../migrations/'+file,import.meta.url),'utf8').replace(/--[^\n]*/g,'').replace(/\s+/g,' ');
    await DB.exec(sql);
  }
  const env={DB,BOT_TOKEN:'read-test-token',CONTENT_BASE:'https://metered.test'};
  const user={id:321,first_name:'Read test'},params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(user)});
  const secret=createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest();
  params.set('hash',createHmac('sha256',secret).update([...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));
  const initData=params.toString(),key=createHmac('sha256',env.BOT_TOKEN).update('leaderboard:321').digest('hex');
  const bucket=14;
  const questions=Array.from({length:100},(_,i)=>({id:'Q'+String(bucket*4096+3996+i).padStart(9,'0'),type:'sba',options:['A','B'],answer:'A'}));
  globalThis.fetch=async url=>{
    url=String(url);
    if(url.includes('/routes/'))return Response.json({routes:Object.fromEntries(questions.map(q=>[q.id,{book_id:'M',chapter_id:1}]))});
    if(url.endsWith('/catalog.json'))return Response.json({books:[{id:'M',chapters:[{id:1,url:'https://metered.test/pack.json'}]}]});
    if(url.endsWith('/pack.json'))return Response.json({questions});
    throw Error('Unexpected network request');
  };
  console.log=value=>{try{events.push(JSON.parse(value))}catch{}};
  const request=(path,body)=>bot.fetch(new Request('https://test'+path,{method:'POST',body:JSON.stringify({initData,...body})}),env,{});
  await request('/api/leaderboard/privacy',{hidden:false});
  const observed=[];
  for(const batchSize of [1,100])for(const history of [0,1000,3996]){
    await DB.prepare('DELETE FROM leaderboard_attempt_buckets WHERE user_key=?').bind(key).run();
    await DB.prepare('DELETE FROM leaderboard_summary WHERE user_key=?').bind(key).run();
    const attempted=Array.from({length:history},(_,i)=>i);
    await DB.prepare('INSERT INTO leaderboard_attempt_buckets(user_key,bucket,attempted,week_key) VALUES(?,?,?,?)').bind(key,bucket,JSON.stringify(attempted),'2026-09-28').run();
    // Untouched buckets and other students grow too; point lookup must not scan them.
    await DB.prepare('INSERT OR IGNORE INTO leaderboard_attempt_buckets(user_key,bucket,attempted,week_key) VALUES(?,?,?,?)').bind(key,bucket+history+1,JSON.stringify(attempted),'2026-09-28').run();
    events.length=0;
    const response=await request('/api/leaderboard/submit',{answers:questions.slice(0,batchSize).map(q=>({qid:q.id,selection:0}))});
    assert.equal(response.status,200);assert.equal((await response.json()).accepted,batchSize);
    const usage=events.find(x=>x.event==='d1_endpoint_usage');
    assert.ok(Number.isFinite(usage.rows_read)&&usage.rows_read>0,'D1 must provide real metadata');
    observed.push({batchSize,history,rows_read:usage.rows_read,rows_written:usage.rows_written});
  }
  assert.equal(new Set(observed.map(x=>x.rows_read)).size,1,'submission rows_read must stay flat as history grows');
  // Cached board is exactly one snapshot lookup, independent of own rank/history.
  await request('/api/leaderboard/board',{period:'all_time'});events.length=0;
  await request('/api/leaderboard/board',{period:'all_time'});
  const board=events.find(x=>x.event==='d1_endpoint_usage');assert.equal(board.queries,1);assert.equal(board.rows_written,0);
  const stats=await DB.prepare('SELECT * FROM leaderboard_submission_usage').first();
  assert.equal(stats.measured_submissions,6);assert.equal(stats.rows_read,observed.reduce((n,x)=>n+x.rows_read,0));
  assert.equal((await DB.prepare('SELECT COUNT(*) n FROM leaderboard_answers').first()).n,0);
  originalLog(JSON.stringify({d1_read_bounds:observed,cached_board:board,passed:true}));
}finally{globalThis.fetch=originalFetch;console.log=originalLog;await mf.dispose()}
