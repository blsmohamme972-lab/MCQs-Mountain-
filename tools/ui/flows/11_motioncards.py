"""Built-app Kafu MotionCards player integration and security flow."""
from __future__ import annotations
import hashlib,json,time
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
    # A brand-new study session with the same QID is still a different lifecycle.
    page.evaluate("""() => {
      const qid=SESSION.qids[SESSION.index];
      startSession({mode:'study',title:'Fresh MotionCards session',bookId:'DESIGN-CARDIO',chId:1,qids:[qid]});
    }""")
    page.wait_for_function("!KafuMotionCards.player.active")
    page.wait_for_selector("[data-a='motioncards-open']",timeout=5000)
    page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
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
        if not route.request.is_navigation_request():return route.abort()   # no device copy: the card loads from the network
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

def removal_refresh_case(browser,origin,pack,helpers):
    ctx=helpers["phone_context"](browser,origin,390,"light")
    q,record,index,html=fixture(pack,origin);state={"active":True}
    def index_route(route):
        if state.get("down"):return route.abort()
        body=dict(index);body["animations"]={q["id"]:record} if state["active"] else {}
        route.fulfill(status=200,content_type="application/json",body=json.dumps(body))
    ctx.route(f"{BASE}/indexes/**",index_route)
    ctx.route(f"{BASE}/assets/**",lambda route:route.fulfill(status=200,content_type="text/html",body=html))
    page,errors=helpers["open_app"](ctx,origin,pack)
    page.evaluate("KafuMotionCards.REFRESH_AFTER_MS=120")
    start(page,[q["id"]])
    assert page.locator("[data-a='motioncards-open']").count()==1
    assert page.evaluate("KafuMotionCards.player.productionRefreshWindowMs")==35000
    state["down"]=True;page.wait_for_timeout(800)      # a network blip on refresh must not hide the button
    assert page.locator("[data-a='motioncards-open']").count()==1
    state["down"]=False;state["active"]=False
    page.wait_for_function("!document.querySelector('[data-a=motioncards-open]')",timeout=3000)
    assert page.locator(".k-study .stem").count()==1
    assert not errors,errors;ctx.close()
    return "soft-remove propagation: an already-open question loses its button on the bounded refresh cycle (35s production window); a network blip keeps it"

VOICE=Path(__file__).resolve().parents[3]/"voiceover"/"samples"/"ch10"/"Q000009379.opus"

def voice_fixture(pack,origin,tamper=False):
    """A schema-v2 card with an embedded voice track (voiceover/), and its index record."""
    q=pack["questions"][0];duration=8000;data=VOICE.read_bytes()
    scene={"schema_version":2,"qid":q["id"],"duration_ms":duration,"takeaway":"Voice explains the key relationship.",
           "stage":{"width":640,"height":560,"background":"#f4f8f8"},
           "layers":[{"type":"text","text":"Voiced MotionCard","x":320,"y":60,"size":26,"weight":800,"fixed":True},
                     {"type":"circle","cx":320,"cy":280,"r":90,"fill":"#dbeef4","stroke":"#16606A","stroke_width":4,"keys":[{"t":0,"scale":0.8},{"t":8000,"scale":1.1}]}]}
    html=compile_scene(scene,[origin],voice=data);raw=html.encode();entry_sha=hashlib.sha256(raw).hexdigest()
    url=f"{BASE}/assets/FIXTURE/r2/{q['id']}.{entry_sha[:12]}.html"
    sha=hashlib.sha256(data).hexdigest()
    record={"book_id":q["book_id"],"book_version":q["version"],"chapter_id":q["chapter_id"],"qid":q["id"],
            "content_hash":content_hash(q),"publisher_fingerprint":"a"*64,"duration_ms":duration,
            "entry_url":url,"entry_sha256":entry_sha,"package_id":"FIXTURE","package_revision":2,
            "final_panel":{"takeaway":scene["takeaway"],"correct_answer_statements":[q["options"][0]]},
            "voice":{"mime":"audio/ogg; codecs=opus","bytes":len(data),"sha256":"0"*64 if tamper else sha,"track_ms":7241}}
    index={"schema":1,"runtime_version":1,"protocol_version":1,"book_id":q["book_id"],"book_version":q["version"],"animations":{q["id"]:record}}
    return q,index,html

def voice_case(browser,origin,pack,helpers):
    """Golden rule 7 in the real app: verified voice plays on Play, follows pause/seek, mute persists; a wrong voice is never played."""
    results=[]
    for tamper in (False,True):
        ctx=helpers["phone_context"](browser,origin,390,"light");q,index,html=voice_fixture(pack,origin,tamper)
        def serve(body,ctype):return lambda route:route.fulfill(status=200,content_type=ctype,body=body)
        ctx.route(f"{BASE}/indexes/**",serve(json.dumps(index),"application/json"))
        ctx.route(f"{BASE}/assets/**",serve(html,"text/html"))
        page,errors=helpers["open_app"](ctx,origin,pack);start(page,[q["id"]])
        page.locator("[data-a='motioncards-open']").click();page.wait_for_function("!document.querySelector('[data-motioncards-host=play]').disabled",timeout=7000)
        if tamper:
            page.wait_for_timeout(600)
            assert page.locator("[data-motioncards-host='mute']").is_hidden() and page.evaluate("!KafuMotionCards.player.active.voice")
            page.locator("[data-motioncards-host='play']").click();page.wait_for_timeout(400)
            assert float(page.locator("[data-motioncards-host='seek']").input_value())>100   # the card still plays, silently
            assert not errors,errors;ctx.close();results.append("voice whose bytes do not match the index SHA-256 is never played; the card still plays");continue
        page.wait_for_selector("[data-motioncards-host='mute']:not([hidden])",timeout=5000)
        page.evaluate("localStorage.removeItem('kafu.motioncards.voice.muted')")
        page.locator("[data-motioncards-host='play']").click();page.wait_for_timeout(1500)
        s=page.evaluate("({t:KafuMotionCards.player.active.time,a:KafuMotionCards.player.active.voice.position,p:KafuMotionCards.player.active.voice.paused})")
        assert not s["p"] and s["a"]>800 and abs(s["t"]-s["a"])<150,s
        page.locator("[data-motioncards-host='play']").click();page.wait_for_timeout(200)
        assert page.evaluate("KafuMotionCards.player.active.voice.paused")
        page.locator("[data-motioncards-host='seek']").evaluate("(el)=>{el.value='5000';el.dispatchEvent(new Event('input',{bubbles:true}))}")
        assert abs(page.evaluate("KafuMotionCards.player.active.voice.position")-5000)<60
        page.locator("[data-motioncards-host='mute']").click()
        assert page.locator("[data-motioncards-host='mute']").get_attribute("aria-pressed")=="true"
        assert page.evaluate("localStorage.getItem('kafu.motioncards.voice.muted')")=="1"
        assert_overlay_geometry(page,"390 light voiced")
        page.locator("[data-motioncards-host='close']").click();page.wait_for_function("!KafuMotionCards.player.active")
        page.evaluate("localStorage.removeItem('kafu.motioncards.voice.muted')")
        assert not errors,errors;ctx.close()
        results.append("verified voice plays on the Play tap, picture follows the voice within 150 ms, pause/seek move it, mute persists")
    # A slow phone can run the card's ready message before its voice script; the host must still get the voice.
    ctx=helpers["phone_context"](browser,origin,390,"light");q,index,html=voice_fixture(pack,origin,False)
    html=html.replace('<script type="application/octet-stream" id="kafu-voice"',f'<script src="{BASE}/assets/slow.js"></script><script type="application/octet-stream" id="kafu-voice"')
    def slow(route):time.sleep(1.0);route.fulfill(status=200,content_type="text/javascript",body="")
    ctx.route(f"{BASE}/indexes/**",serve(json.dumps(index),"application/json"));ctx.route(f"{BASE}/assets/**",serve(html,"text/html"));ctx.route(f"{BASE}/assets/slow.js",slow)
    page,errors=helpers["open_app"](ctx,origin,pack);start(page,[q["id"]])
    page.locator("[data-a='motioncards-open']").click();page.wait_for_selector("[data-motioncards-host='mute']:not([hidden])",timeout=9000)
    assert page.evaluate("!!KafuMotionCards.player.active.voice") and not errors,errors;ctx.close()
    results.append("voice still arrives when the card's voice script runs after its ready message (slow phones)")
    return results

def offline_case(browser,origin,pack,helpers):
    """A saved chapter keeps its MotionCards (voice inside) on the device; they play offline and leave with the chapter."""
    ctx=helpers["phone_context"](browser,origin,390,"light");q,index,html=voice_fixture(pack,origin,False);state={"up":True,"hits":0}
    def idx(route):
        if not state["up"]:return route.abort()
        route.fulfill(status=200,content_type="application/json",body=json.dumps(index),headers={"access-control-allow-origin":origin})
    def card(route):
        if not state["up"]:return route.abort()
        state["hits"]+=1;route.fulfill(status=200,content_type="text/html",body=html,headers={"access-control-allow-origin":origin})
    ctx.route(f"{BASE}/indexes/**",idx);ctx.route(f"{BASE}/assets/**",card)
    page,errors=helpers["open_app"](ctx,origin,pack);start(page,[q["id"]])
    key=page.evaluate("(()=>{const e=QI[%s];return e.b+':'+e.ch})()"%json.dumps(q["id"]))
    page.evaluate("k=>KafuMotionCards.player.saveCards(k,PACKS[k])",key)
    assert state["hits"]==1,state
    state["up"]=False
    page.locator("[data-a='motioncards-open']").click();page.wait_for_selector("[data-motioncards-host='mute']:not([hidden])",timeout=9000)
    assert page.evaluate("KafuMotionCards.player.active.frame.src.startsWith('blob:')")
    page.locator("[data-motioncards-host='play']").click();page.wait_for_timeout(1200)
    assert page.evaluate("KafuMotionCards.player.active.voice.position")>500 and state["hits"]==1
    page.locator("[data-motioncards-host='close']").click();page.wait_for_function("!KafuMotionCards.player.active")
    page.evaluate("k=>deleteChapter(k)",key)
    assert page.evaluate("caches.open('kafu-motioncards-v1').then(c=>c.keys()).then(k=>k.length)")==0
    assert not errors,errors;ctx.close()
    return "a saved chapter stores its MotionCards (voice inside, SHA-256 checked); they play offline from the device and are removed with the chapter"

def run(browser,origin,pack,out,helpers):
    passed=full_player(browser,origin,pack,out,helpers)
    passed.extend(variants(browser,origin,pack,out,helpers))
    passed.append(timeout_case(browser,origin,pack,helpers))
    passed.append(account_switch_case(browser,origin,pack,helpers))
    passed.append(removal_refresh_case(browser,origin,pack,helpers))
    passed.extend(voice_case(browser,origin,pack,helpers))
    passed.append(offline_case(browser,origin,pack,helpers))
    return {"passed":passed}
