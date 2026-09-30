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
