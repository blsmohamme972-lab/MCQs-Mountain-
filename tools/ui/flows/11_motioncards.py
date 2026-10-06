"""Built-app Kafu MotionCards player integration and security flow."""
from __future__ import annotations
import hashlib,json
from pathlib import Path
from motioncards.lib.compiler import compile_scene
from motioncards.lib.core import content_hash

BASE="https://kafu-motioncards.blsmohamme97.workers.dev"

def fixture(pack,origin):
    q=pack["questions"][0];duration=4000
    scene={"schema_version":1,"qid":q["id"],"duration_ms":duration,
           "takeaway":"A concise deterministic teaching point.",
           "layers":[
             {"type":"circle","cx":170,"cy":220,"r":70,"fill":"#dbeef4","stroke":"#16606A","start_ms":0,"end_ms":duration,"from":{"opacity":0.4},"to":{"opacity":1}},
             {"type":"arrow","x1":255,"y1":220,"x2":440,"y2":220,"stroke":"#c76542","stroke_width":8,"start_ms":800,"end_ms":3300,"from":{"opacity":0,"x":-20},"to":{"opacity":1,"x":0}},
             {"type":"label","text":"Key relationship","x":320,"y":90,"size":26,"start_ms":500,"end_ms":duration,"from":{"opacity":0},"to":{"opacity":1}}
           ]}
    html=compile_scene(scene,[origin]);raw=html.encode();entry_sha=hashlib.sha256(raw).hexdigest()
    url=f"{BASE}/assets/FIXTURE/r1/{q['id']}.{entry_sha[:12]}.html"
    record={"book_id":q["book_id"],"book_version":q["version"],"chapter_id":q["chapter_id"],"qid":q["id"],
            "content_hash":content_hash(q),"publisher_fingerprint":"a"*64,"duration_ms":duration,
            "entry_url":url,"entry_sha256":entry_sha,"package_id":"FIXTURE","package_revision":1,
            "final_panel":{"takeaway":scene["takeaway"],"correct_answer_statements":[q["options"][0]]}}
    index={"schema":1,"runtime_version":1,"protocol_version":1,"book_id":q["book_id"],"book_version":q["version"],"animations":{q["id"]:record}}
    return q,record,index,html

def install_routes(ctx,pack,origin,broken=False):
    q,record,index,html=fixture(pack,origin)
    ctx.route(f"{BASE}/indexes/**",lambda route:route.fulfill(status=200,content_type="application/json",body=json.dumps(index)))
    if broken:
        ctx.route(f"{BASE}/assets/**",lambda route:route.fulfill(status=200,content_type="text/html",body="<!doctype html><title>Broken fixture</title>"))
    else:
        ctx.route(f"{BASE}/assets/**",lambda route:route.fulfill(status=200,content_type="text/html",body=html))
    return q,record

def start(page,qids):
    page.evaluate("qids=>{tab('home');startSession({mode:'study',title:'MotionCards fixture',bookId:'DESIGN-CARDIO',chId:1,qids});}",qids)
    page.wait_for_selector(".k-study .stem")
    page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)

def assert_overlay_geometry(page,label):
    values=page.evaluate("""() => {
      const root=document.querySelector('.kafu-motioncards-overlay'),r=root.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,
        sandbox:document.querySelector('#kafu-motioncards-root iframe')?.getAttribute('sandbox')||''};
    }""")
    assert values["left"]>=-1 and values["right"]<=values["w"]+1 and values["top"]>=-1 and values["bottom"]<=values["h"]+1,(label,values)
    assert values["scroll"]<=values["w"]+1,(label,values)
    assert values["sandbox"]=="allow-scripts",(label,values)

def full_player(browser,origin,pack,out,helpers):
    ctx=helpers["phone_context"](browser,origin,390,"dark");install_routes(ctx,pack,origin)
    page,errors=helpers["open_app"](ctx,origin,pack)
    qids=[q["id"] for q in pack["questions"]]
    start(page,qids)
    # Select but do not submit: closing must preserve the exact pending answer and order.
    page.locator("[data-a='pick']").first.click()
    before=page.evaluate("""() => {
      const id=SESSION.qids[SESSION.index];orderFor(QI[id].q);
      return JSON.stringify({index:SESSION.index,resp:SESSION.resp[id],order:SESSION.order[id],qids:SESSION.qids});
    }""")
    page.locator("[data-a='motioncards-open']").click()
    page.wait_for_selector("#kafu-motioncards-root iframe")
    page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
    assert page.evaluate("document.getElementById('app').inert") is True
    assert_overlay_geometry(page,"390 dark open")
    out.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(out/"motioncards-phone-dark-start.png"),full_page=False,animations="disabled")

    page.evaluate("window.__motioncardsFrame=document.querySelector('#kafu-motioncards-root iframe')")
    page.evaluate("render()")
    assert page.evaluate("window.__motioncardsFrame===document.querySelector('#kafu-motioncards-root iframe')")
    page.locator("[data-motioncards-host='play']").click()
    page.wait_for_timeout(450)
    t1=float(page.locator("[data-motioncards-host='seek']").input_value());assert t1>100
    page.locator("[data-motioncards-host='play']").click()
    page.wait_for_timeout(180)
    t2=float(page.locator("[data-motioncards-host='seek']").input_value());assert abs(t2-t1)<120,(t1,t2)
    # Backgrounding while playing pauses the real scene clock and returning cannot jump to completion.
    page.locator("[data-motioncards-host='play']").click();page.wait_for_timeout(160)
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
    hidden_t=float(page.locator("[data-motioncards-host='seek']").input_value());page.wait_for_timeout(260)
    assert abs(float(page.locator("[data-motioncards-host='seek']").input_value())-hidden_t)<100
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
    assert page.locator("[data-motioncards-host='play']").inner_text() in ("Play","Replay")
    page.locator("[data-motioncards-host='seek']").evaluate("(el)=>{el.value='2000';el.dispatchEvent(new Event('input',{bubbles:true}))}")
    frame=page.frame_locator("#kafu-motioncards-root iframe")
    page.wait_for_timeout(80);assert "2.0s" in frame.locator("#time").inner_text()
    page.screenshot(path=str(out/"motioncards-phone-dark-mid.png"),full_page=False,animations="disabled")
    page.locator("[data-motioncards-host='seek']").evaluate("(el)=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.wait_for_selector(".kafu-motioncards-final:not([hidden])")
    assert "A concise deterministic teaching point." in page.locator(".kafu-motioncards-final").inner_text()
    assert pack["questions"][0]["options"][0] in page.locator(".kafu-motioncards-answer").inner_text()
    page.screenshot(path=str(out/"motioncards-phone-dark-end.png"),full_page=False,animations="disabled")
    page.locator("[data-motioncards-host='seek']").evaluate("(el)=>{el.value='1200';el.dispatchEvent(new Event('input',{bubbles:true}))}")
    assert page.locator(".kafu-motioncards-final[hidden]").count()==1
    page.locator("[data-motioncards-host='restart']").click();assert float(page.locator("[data-motioncards-host='seek']").input_value())==0
    page.locator("[data-motioncards-host='close']").click()
    after=page.evaluate("""() => {
      const id=SESSION.qids[SESSION.index];
      return JSON.stringify({index:SESSION.index,resp:SESSION.resp[id],order:SESSION.order[id],qids:SESSION.qids});
    }""")
    assert before==after,(before,after)
    assert page.evaluate("document.getElementById('app').inert") is False
    # Rapid reopen creates a fresh channel/frame; stale messages from the closed frame are ignored.
    page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)
    page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
    first_channel=page.evaluate("KafuMotionCards.player.active.channel")
    page.locator("[data-motioncards-host='close']").click();page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)
    page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
    second_channel=page.evaluate("KafuMotionCards.player.active.channel");assert first_channel!=second_channel
    page.evaluate("""old => window.dispatchEvent(new MessageEvent('message',{data:{type:'kafu-motioncards-ready',protocol:1,qid:SESSION.qids[SESSION.index],channel_id:old},source:window}))""",first_channel)
    assert page.evaluate("KafuMotionCards.player.active.channel")==second_channel
    # Full question identity change closes the player; underlying pending MCQ state remains.
    page.evaluate("QI[SESSION.qids[SESSION.index]].ch=999;render()")
    page.wait_for_function("!KafuMotionCards.player.active");page.evaluate("QI[SESSION.qids[SESSION.index]].ch=1;render()")

    # Unmatched question has no placeholder/button.
    page.evaluate("SESSION.index=1;render()");page.wait_for_timeout(200)
    assert page.locator("[data-a='motioncards-open']").count()==0

    # Active timed exam does not reveal MotionCards.
    page.evaluate("SESSION.index=0;SESSION.mode='exam';SESSION.finished=false;render()");page.wait_for_timeout(150)
    assert page.locator("[data-a='motioncards-open']").count()==0
    # Completed exam review may show the exact hash-bound card.
    page.evaluate("SESSION.finished=true;render()");page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)
    assert not errors,errors;ctx.close()
    return ["390 dark/reduced-motion: matched/unmatched, same-question rerender, deterministic play/pause/seek/restart/end/close, final panel, exact study state, timed-exam guard pass"]

def variants(browser,origin,pack,out,helpers):
    passed=[]
    for width in (360,430):
        ctx=helpers["phone_context"](browser,origin,width,"light");install_routes(ctx,pack,origin)
        page,errors=helpers["open_app"](ctx,origin,pack);start(page,[pack["questions"][0]["id"]])
        page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
        assert_overlay_geometry(page,f"{width} light");assert not errors,errors;ctx.close();passed.append(f"{width}px light/reduced-motion overlay contained")
    for theme in ("light","dark"):
        ctx=helpers["context"](browser,origin,"ipad",theme);install_routes(ctx,pack,origin)
        page,errors=helpers["open_app"](ctx,origin,pack)
        page.evaluate("document.documentElement.style.setProperty('--fs','1.25')")
        start(page,[pack["questions"][0]["id"]]);page.locator("[data-a='motioncards-open']").click()
        page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
        assert_overlay_geometry(page,f"ipad {theme}");assert not errors,errors;ctx.close();passed.append(f"iPad {theme} large-text/reduced-motion overlay contained")
    return passed

def timeout_case(browser,origin,pack,helpers):
    ctx=helpers["phone_context"](browser,origin,390,"light")
    q,record,index,html=fixture(pack,origin);attempt={"n":0}
    ctx.route(f"{BASE}/indexes/**",lambda route:route.fulfill(status=200,content_type="application/json",body=json.dumps(index)))
    def asset(route):
        attempt["n"]+=1
        route.fulfill(status=200,content_type="text/html",body="<!doctype html><title>Broken fixture</title>" if attempt["n"]==1 else html)
    ctx.route(f"{BASE}/assets/**",asset)
    page,errors=helpers["open_app"](ctx,origin,pack);start(page,[pack["questions"][0]["id"]])
    page.locator("[data-a='motioncards-open']").click()
    page.wait_for_selector(".kafu-motioncards-error:not([hidden])",timeout=7000)
    assert "did not become ready" in page.locator(".kafu-motioncards-error").inner_text()
    assert page.locator("[data-motioncards-host='retry']:visible").count()==1
    old=page.evaluate("KafuMotionCards.player.active.channel")
    page.locator("[data-motioncards-host='retry']").click()
    page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
    assert page.evaluate("KafuMotionCards.player.active.channel")!=old
    page.locator("[data-motioncards-host='close']").click();assert page.locator(".k-study .stem").count()==1
    assert not errors,errors;ctx.close()
    return "ready-timeout exposes a real retry; retry uses a fresh channel and studying remains available"

def account_switch_case(browser,origin,pack,helpers):
    ctx=helpers["phone_context"](browser,origin,390,"light");install_routes(ctx,pack,origin)
    page,errors=helpers["open_app"](ctx,origin,pack);start(page,[pack["questions"][0]["id"]])
    page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
    if page.evaluate("typeof TG!=='undefined' && !!TG && !!TG.initDataUnsafe"):
        page.evaluate("TG.initDataUnsafe.user={id:222,first_name:'B'};render()")
        page.wait_for_function("!KafuMotionCards.player.active")
        page.evaluate("TG.initDataUnsafe.user={id:111,first_name:'A'};render()")
        page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)
    else:
        # Browser-only sessions still bind to full book/version/chapter/QID identity.
        page.evaluate("QI[SESSION.qids[SESSION.index]].b='OTHER';render()")
        page.wait_for_function("!KafuMotionCards.player.active")
    assert not errors,errors;ctx.close()
    return "account/session or full-question identity switch closes the active player without leaking state"

def run(browser,origin,pack,out,helpers):
    passed=full_player(browser,origin,pack,out,helpers)
    passed.extend(variants(browser,origin,pack,out,helpers))
    passed.append(timeout_case(browser,origin,pack,helpers))
    passed.append(account_switch_case(browser,origin,pack,helpers))
    return {"passed":passed}
