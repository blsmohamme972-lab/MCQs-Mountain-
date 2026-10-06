import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

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
  assert.ok(r.headers.get("cache-control").includes("max-age=60"));
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
