#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,urllib.request,urllib.error
from playwright.sync_api import sync_playwright

APP="https://kafu.blsmohamme97.workers.dev"
CARDS="https://kafu-motioncards.blsmohamme97.workers.dev"
HOST="""<!doctype html><meta charset=utf-8><body data-ready=0 data-state=-1 data-ended=0><iframe sandbox="allow-scripts"></iframe><script>
const qid='Q000000001',channel='0123456789abcdef0123456789abcdef0123',frame=document.querySelector('iframe');let port;
addEventListener('message',ev=>{const m=ev.data;if(ev.source!==frame.contentWindow||!m||m.type!=='kafu-motioncards-ready'||m.channel_id!==channel)return;const c=new MessageChannel();port=c.port1;port.onmessage=e=>{const x=e.data;if(!x||x.channel_id!==channel)return;if(x.type==='ready'){document.body.dataset.ready='1';port.postMessage({type:'seek',protocol:1,channel_id:channel,qid,time_ms:1500})}else if(x.type==='state'){document.body.dataset.state=String(x.time_ms);if(x.time_ms===1500)port.postMessage({type:'seek',protocol:1,channel_id:channel,qid,time_ms:4000})}else if(x.type==='ended'){document.body.dataset.ended='1'}};port.start();frame.contentWindow.postMessage({type:'connect',protocol:1,channel_id:channel,qid},'*',[c.port2])});
frame.src='ENTRY#'+channel;
</script>"""

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"kafu-motioncards-runtime-test/1.0"})
    opener=urllib.request.build_opener(urllib.request.HTTPHandler())
    with opener.open(req,timeout=15) as r:return r.status,dict(r.headers),r.read()

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--worker-url",required=True);ap.add_argument("--meta",required=True);a=ap.parse_args()
    meta=json.load(open(a.meta));base=a.worker_url.rstrip("/")
    status,headers,body=get(base+meta["entry_path"])
    assert status==200,(status,headers)
    assert "location" not in {k.lower() for k in headers},headers
    assert "text/html" in headers.get("Content-Type",headers.get("content-type","")).lower(),headers
    csp=headers.get("Content-Security-Policy",headers.get("content-security-policy",""))
    for token in ["default-src 'none'","connect-src 'none'","worker-src 'none'","sandbox allow-scripts","frame-ancestors "+APP]:assert token in csp,csp
    assert headers.get("X-Content-Type-Options",headers.get("x-content-type-options"))=="nosniff"
    assert headers.get("Referrer-Policy",headers.get("referrer-policy"))=="no-referrer"
    assert headers.get("Cache-Control",headers.get("cache-control"))=="public, max-age=31536000, immutable"
    import hashlib
    assert hashlib.sha256(body).hexdigest()==meta["entry_sha256"]
    s,ih,_=get(base+meta["index_path"]);assert s==200
    assert ih.get("Access-Control-Allow-Origin",ih.get("access-control-allow-origin"))==APP
    assert "max-age=30" in ih.get("Cache-Control",ih.get("cache-control",""))

    with sync_playwright() as p:
        browser=p.chromium.launch()
        ctx=browser.new_context()
        ctx.route(APP+"/motioncards-worker-host",lambda route:route.fulfill(status=200,content_type="text/html",body=HOST.replace("ENTRY",CARDS+meta["entry_path"])))
        def proxy(route):
            url=route.request.url
            path=url[len(CARDS):]
            st,hs,raw=get(base+path)
            route.fulfill(status=st,headers=hs,body=raw)
        ctx.route(CARDS+"/**",proxy)
        page=ctx.new_page();page.goto(APP+"/motioncards-worker-host",wait_until="domcontentloaded")
        page.wait_for_function("document.body.dataset.ready==='1'",timeout=7000)
        page.wait_for_function("document.body.dataset.state==='1500'",timeout=7000)
        page.wait_for_function("document.body.dataset.ended==='1'",timeout=7000)
        assert not page.locator("iframe").get_attribute("sandbox").find("allow-scripts")
        browser.close()
    print(json.dumps({"motioncards_worker_runtime":"PASS","entry":meta["entry_path"],"sha256":meta["entry_sha256"]}))
if __name__=="__main__":main()
