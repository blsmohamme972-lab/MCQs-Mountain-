import { verifyTelegramInitData } from './leaderboard.mjs';
import { handleMcqExport, verifyOwnerRequest } from './mcq-export.mjs';
const LIMITS={rows_read:5_000_000,rows_written:100_000};
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'private, no-store','vary':'Authorization'}})}
export async function verifyAdmin(request,env){
  let body;try{body=await request.json()}catch{return null}
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const user=await verifyTelegramInitData(body.initData,env.BOT_TOKEN);
  if(!user)return null;
  const date=Number(new URLSearchParams(body.initData).get('auth_date')),age=Date.now()/1000-date;
  if(!Number.isFinite(date)||age < -60||age>86400)return null;
  // Runtime secrets only. Existing owner access works without adding a public ID.
  const ids=String(env.ADMIN_IDS||env.OWNER_TELEGRAM_ID||'').split(/[\s,]+/).filter(Boolean);
  return ids.includes(user.id)?user:null;
}
const usageCache=new Map();
export async function d1Usage(env,now=new Date()){
  if(!env.D1_ANALYTICS_TOKEN||!env.CLOUDFLARE_ACCOUNT_ID)throw new Error('analytics_not_configured');
  const day=now.toISOString().slice(0,10),start=new Date(now.getTime()-6*86400_000).toISOString().slice(0,10);
  const cacheKey=env.CLOUDFLARE_ACCOUNT_ID+':'+day;
  const hit=usageCache.get(cacheKey);if(hit&&now.getTime()-hit.at<300_000)return hit.data;
  const query=`query D1Usage($accountTag:string!,$start:Date!,$end:Date!){viewer{accounts(filter:{accountTag:$accountTag}){
    d1AnalyticsAdaptiveGroups(limit:7,filter:{date_geq:$start,date_leq:$end},orderBy:[date_DESC]){
      dimensions{date} sum{rowsRead rowsWritten}
    }
  }}}`;
  const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{
    method:'POST',signal:AbortSignal.timeout(10000),headers:{authorization:'Bearer '+env.D1_ANALYTICS_TOKEN,'content-type':'application/json'},
    body:JSON.stringify({query,variables:{accountTag:env.CLOUDFLARE_ACCOUNT_ID,start,end:day}})
  });
  if(!response.ok)throw new Error('analytics_unavailable');
  const result=await response.json(),accounts=result.data?.viewer?.accounts;
  if(result.errors?.length||!accounts?.length)throw new Error('analytics_access_unavailable');
  const groups=accounts[0].d1AnalyticsAdaptiveGroups;
  if(!Array.isArray(groups))throw new Error('analytics_invalid_response');
  const days=groups.map(x=>{
    const reads=x.sum?.rowsRead,writes=x.sum?.rowsWritten;
    if(!Number.isFinite(reads)||!Number.isFinite(writes)||reads<0||writes<0)throw new Error('analytics_invalid_response');
    const read_percent=reads/LIMITS.rows_read*100,write_percent=writes/LIMITS.rows_written*100;
    return {date:x.dimensions.date,rows_read:reads,rows_written:writes,read_percent,write_percent,warning:read_percent>=70||write_percent>=70};
  });
  const data={source:'Cloudflare D1 Analytics',scope:'account',timezone:'UTC',reset:'00:00 UTC (03:00 Baghdad)',
    limits:LIMITS,warning_percent:70,fetched_at:now.toISOString(),today:days.find(x=>x.date===day)||null,days};
  usageCache.set(cacheKey,{at:now.getTime(),data});return data;
}
export async function handleAdmin(request,env,path){
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(path==='/admin/capabilities'){
    let exportProbe=false;
    try{const body=await request.clone().json();exportProbe=body?.capability==='mcq_export'}catch{}
    const owner=await verifyOwnerRequest(request.clone(),env);
    const admin=await verifyAdmin(request,env);
    if(!owner&&!admin)return reply({error:'forbidden'},403);
    if(owner&&!admin&&!exportProbe)return reply({error:'forbidden'},403);
    const capabilities={books:!!admin,d1_usage:!!admin};
    if(exportProbe)capabilities.can_export_mcqs=!!owner;
    return reply(capabilities);
  }
  if(path.startsWith('/admin/mcq-export/'))return handleMcqExport(request,env,path);
  if(!await verifyAdmin(request,env))return reply({error:'forbidden'},403);
  if(path==='/admin/usage'){
    try{
      const usage=await d1Usage(env);
      const day=new Date().toISOString().slice(0,10);
      const result=await env.DB.prepare('SELECT day,submissions,measured_submissions,rows_read,rows_written,max_rows_read FROM leaderboard_submission_usage WHERE day>=? ORDER BY day DESC LIMIT 7')
        .bind(new Date(Date.now()-6*86400_000).toISOString().slice(0,10)).all();
      const days=(result.results||[]).map(x=>({...x,reads_per_submission:x.measured_submissions?x.rows_read/x.measured_submissions:null}));
      return reply({...usage,database_size_bytes:result.meta?.size_after??null,
        submission_usage:{source:'D1 result metadata',excludes:'Telemetry counter update (logged separately)',today:days.find(x=>x.day===day)||null,days}});
    }catch(e){return reply({error:e.message},503)}
  }
  if(path==='/admin/books'){
    const rows=await env.DB.prepare('SELECT book_id,version,questions,chapters,images,active FROM published_books ORDER BY book_id,version DESC').all();
    return reply({books:rows.results||[]});
  }
  return reply({error:'not_found'},404);
}
