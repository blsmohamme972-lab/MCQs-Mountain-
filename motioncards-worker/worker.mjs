const APP_ORIGIN="https://kafu.blsmohamme97.workers.dev";
const CSP=[
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-ancestors "+APP_ORIGIN,
  "sandbox allow-scripts"
].join("; ");

function headersFor(path,response){
  const h=new Headers(response.headers);
  h.set("X-Content-Type-Options","nosniff");
  h.set("Referrer-Policy","no-referrer");
  h.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()");
  h.set("Cross-Origin-Resource-Policy","cross-origin");
  if(path.startsWith("/indexes/")){
    h.set("Access-Control-Allow-Origin",APP_ORIGIN);
    h.set("Cache-Control","public, max-age=60, stale-while-revalidate=120");
  }else if(path.startsWith("/assets/")){
    h.set("Cache-Control","public, max-age=31536000, immutable");
    h.set("Content-Security-Policy",CSP);
  }else h.set("Cache-Control","public, max-age=60");
  return h;
}
function allowed(path){
  return path==="/build-info.json"||
    /^\/indexes\/[A-Z0-9][A-Z0-9-]{0,127}\/v[1-9]\d*\/index\.json$/.test(path)||
    /^\/assets\/[A-Z0-9][A-Z0-9-]{0,63}\/r[1-9]\d*\/Q\d{9}\.[a-f0-9]{12}\.html$/.test(path);
}
export default{
  async fetch(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(request.method==="OPTIONS"&&path.startsWith("/indexes/")){
      return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":APP_ORIGIN,"Access-Control-Allow-Methods":"GET,HEAD,OPTIONS","Access-Control-Allow-Headers":"content-type","Access-Control-Max-Age":"86400"}});
    }
    if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405,headers:{"Allow":"GET, HEAD, OPTIONS"}});
    if(!allowed(path))return new Response("Not found",{status:404,headers:headersFor(path,new Response()).entries()});
    const response=await env.ASSETS.fetch(request);
    return new Response(request.method==="HEAD"?null:response.body,{status:response.status,statusText:response.statusText,headers:headersFor(path,response)});
  }
};