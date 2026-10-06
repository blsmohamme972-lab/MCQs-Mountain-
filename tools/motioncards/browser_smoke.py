#!/usr/bin/env python3
from __future__ import annotations
import argparse,json
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

APP="https://kafu.blsmohamme97.workers.dev"
HOST_URL=APP+"/motioncards-staged-smoke-host"

def host_html(entry,qid,duration):
    return f"""<!doctype html><meta charset=utf-8><body data-ready=0 data-mid=0 data-ended=0>
<iframe sandbox="allow-scripts" title="MotionCards staged smoke"></iframe>
<script>
const qid={json.dumps(qid)},duration={int(duration)},entry={json.dumps(entry)},channel='0123456789abcdef0123456789abcdef0123',frame=document.querySelector('iframe');let port;
addEventListener('message',ev=>{{const m=ev.data;if(ev.source!==frame.contentWindow||!m||m.type!=='kafu-motioncards-ready'||m.channel_id!==channel||m.qid!==qid)return;
 const ch=new MessageChannel();port=ch.port1;port.onmessage=e=>{{const x=e.data;if(!x||x.channel_id!==channel||x.qid!==qid)return;
  if(x.type==='ready'){{document.body.dataset.ready='1';port.postMessage({{type:'seek',protocol:1,channel_id:channel,qid,time_ms:Math.floor(duration/2)}})}}
  else if(x.type==='state'&&x.time_ms===Math.floor(duration/2)){{document.body.dataset.mid='1';port.postMessage({{type:'seek',protocol:1,channel_id:channel,qid,time_ms:duration}})}}
  else if(x.type==='ended')document.body.dataset.ended='1';
 }};port.start();frame.contentWindow.postMessage({{type:'connect',protocol:1,channel_id:channel,qid}},'*',[ch.port2]);
}});
frame.src=entry+'#'+channel;
</script>"""

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--url",required=True);ap.add_argument("--result",required=True);a=ap.parse_args()
    base=a.url.rstrip("/");meta=json.load(open(a.result));cards=[x for x in meta.get("cards",[]) if x.get("active") is not False]
    if not cards:
        print(json.dumps({"motioncards_browser_smoke":"PASS","active_cards":0}));return
    allowed_stage=urlsplit(base).netloc
    evidence=[]
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for card in cards:
            path=urlsplit(card["entry_url"]).path;entry=base+path
            ctx=browser.new_context()
            blocked=[]
            def route_all(route):
                u=urlsplit(route.request.url)
                if route.request.url==HOST_URL:
                    route.fulfill(status=200,content_type="text/html",body=host_html(entry,card["qid"],card["duration_ms"]));return
                if u.netloc==allowed_stage and u.path==path:
                    route.continue_();return
                blocked.append(route.request.url);route.abort()
            ctx.route("**/*",route_all)
            page=ctx.new_page();errors=[];page.on("pageerror",lambda e:errors.append(str(e)))
            page.goto(HOST_URL,wait_until="domcontentloaded",timeout=15000)
            page.wait_for_function("document.body.dataset.ready==='1'",timeout=7000)
            page.wait_for_function("document.body.dataset.mid==='1'",timeout=7000)
            page.wait_for_function("document.body.dataset.ended==='1'",timeout=7000)
            assert page.locator("iframe").get_attribute("sandbox")=="allow-scripts"
            assert not errors,errors
            assert not blocked,blocked
            evidence.append({"qid":card["qid"],"entry_path":path,"duration_ms":card["duration_ms"]})
            ctx.close()
        browser.close()
    print(json.dumps({"motioncards_browser_smoke":"PASS","active_cards":len(cards),"entries":evidence}))
if __name__=="__main__":main()
