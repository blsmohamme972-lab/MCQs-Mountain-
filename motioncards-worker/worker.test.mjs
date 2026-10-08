import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
import {readFileSync} from "node:fs";

function env(body="<html>ok</html>",type="text/html"){
  return {ASSETS:{fetch:async request=>new Response(body,{status:200,headers:{"content-type":type}})}};
}

test("entry response has restrictive HTTP sandbox headers",async()=>{
  const url="https://cards.test/assets/DEMO/r1/Q000000001."+("a".repeat(12))+".html";
  const r=await worker.fetch(new Request(url),env());
  assert.equal(r.status,200);
  const csp=r.headers.get("content-security-policy");
  assert.ok(csp.includes("default-src 'none'"));
  assert.ok(csp.includes("connect-src 'none'"));
  assert.ok(csp.includes("worker-src 'none'"));
  assert.ok(csp.includes("form-action 'none'"));
  assert.ok(csp.includes("frame-ancestors https://kafu.blsmohamme97.workers.dev"));
  assert.ok(csp.includes("sandbox allow-scripts"));
  assert.equal(r.headers.get("x-content-type-options"),"nosniff");
  assert.equal(r.headers.get("referrer-policy"),"no-referrer");
  assert.ok(r.headers.get("cache-control").includes("immutable"));
});

test("index response uses Kafu-only CORS and short freshness",async()=>{
  const r=await worker.fetch(new Request("https://cards.test/indexes/BOOK/v2/index.json"),env("{}","application/json"));
  assert.equal(r.headers.get("access-control-allow-origin"),"https://kafu.blsmohamme97.workers.dev");
  assert.ok(r.headers.get("cache-control").includes("max-age=30"));
});

test("unapproved paths are never served",async()=>{
  for(const p of ["/_worker.js","/_headers","/source/questions/Q000000001.json","/assets/DEMO/r1/x.js","/index.html"]){
    const r=await worker.fetch(new Request("https://cards.test"+p),env());
    assert.equal(r.status,404,p);
  }
});

test("write methods are rejected",async()=>{
  const r=await worker.fetch(new Request("https://cards.test/build-info.json",{method:"POST"}),env("{}","application/json"));
  assert.equal(r.status,405);
});

// Cards and indexes are served by the static asset layer with these headers (wrangler.jsonc has no
// run_worker_first, so requests stay free and unlimited). They must say exactly what worker.mjs says.
test("_headers matches the Worker's security and cache headers",async()=>{
  const file=readFileSync(new URL("./_headers",import.meta.url),"utf8");
  const rules={};let cur=null;
  for(const line of file.split("\n")){
    if(!line.trim()||line.trim().startsWith("#"))continue;
    if(!/^\s/.test(line)){cur=line.trim();rules[cur]={};continue;}
    const t=line.trim();if(t.startsWith("!"))continue;const i=t.indexOf(":");rules[cur][t.slice(0,i).trim().toLowerCase()]=t.slice(i+1).trim();
  }
  const entry=await worker.fetch(new Request("https://cards.test/assets/DEMO/r1/Q000000001."+("a".repeat(12))+".html"),env());
  const index=await worker.fetch(new Request("https://cards.test/indexes/BOOK/v2/index.json"),env("{}","application/json"));
  for(const [rule,res] of [["/assets/*",entry],["/indexes/*",index]]){
    const want={...rules["/*"],...rules[rule]};
    for(const [k,v] of Object.entries(want))assert.equal(v,res.headers.get(k),rule+" "+k);
  }
  assert.ok(rules["/assets/*"]["content-security-policy"].includes("sandbox allow-scripts"));
  const cfg=readFileSync(new URL("./wrangler.jsonc",import.meta.url),"utf8");
  assert.ok(!/run_worker_first/.test(cfg),"run_worker_first would put every card view on the 100k/day Worker quota");
});
