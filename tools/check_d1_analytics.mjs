// Verify the exact server query against configured Cloudflare analytics without
// logging credentials, IDs, row counts or account analytics payloads.
import { d1Usage } from '../worker/admin.mjs';
try {
  await d1Usage({D1_ANALYTICS_TOKEN:process.env.D1_ANALYTICS_TOKEN,CLOUDFLARE_ACCOUNT_ID:process.env.CLOUDFLARE_ACCOUNT_ID});
  console.log('D1 analytics access verified.');
} catch (error) {
  const safe=['analytics_not_configured','analytics_unavailable','analytics_access_unavailable','analytics_invalid_response'];
  console.error(safe.includes(error.message)?error.message:'analytics_request_failed');
  process.exitCode=1;
}

// Read-only production size lookup. No credentials or database IDs in logs.
try {
  const account=process.env.CLOUDFLARE_ACCOUNT_ID,id=process.env.D1_DATABASE_ID;
  const token=process.env.CLOUDFLARE_API_TOKEN;
  if(!account||!id||!token)throw Error('database_size_not_configured');
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${id}`,{
    headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
  const result=await response.json();
  if(!response.ok||!result.success||!Number.isFinite(result.result?.file_size))throw Error('database_size_unavailable');
  console.log('Current production D1 database size: '+result.result.file_size+' bytes ('+(result.result.file_size/1048576).toFixed(2)+' MiB).');
} catch {console.error('database_size_unavailable');process.exitCode=1}
