"""Read-only post-deploy browser smoke for Kafu's production app.

Runs only from the main push UI workflow after local Visual/Flow has passed.
Uses a fresh non-Telegram browser context, so it never reads or writes a student's
personal storage. Content requests are GET-only; study state is ephemeral.
"""
from __future__ import annotations
import argparse
import json
import time
import urllib.request
from playwright.sync_api import sync_playwright

DEFAULT_URL="https://kafu.blsmohamme97.workers.dev"
REQUIRED_BOOK="KAFU-UPLOAD-TEST"


def json_get(url: str) -> dict:
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"kafu-production-ui-smoke/1.0"})
    with urllib.request.urlopen(req,timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_build(origin: str, commit: str, timeout: int=120) -> dict:
    deadline=time.time()+timeout
    last=None
    while time.time()<deadline:
        try:
            last=json_get(f"{origin}/build-info.json?prod-ui={commit}")
            if last.get("commit")==commit:return last
        except Exception as exc:
            last={"error":type(exc).__name__}
        time.sleep(3)
    raise AssertionError(f"production did not reach commit {commit}: {last}")


def geometry(page,label: str) -> None:
    values=page.evaluate("""() => {
      const root=document.documentElement,main=document.querySelector('main.wrap');
      const flow=[...(main?.children||[])].filter(el=>getComputedStyle(el).position!=='fixed');
      const bottoms=flow.map(el=>el.getBoundingClientRect().bottom+scrollY);
      const flowBottom=bottoms.length?Math.max(...bottoms):0;
      const fixed=[...document.querySelectorAll('.actionbar,.tabs,.k-complete-footer')].filter(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=='none'&&s.visibility!=='hidden'&&r.height>0;
      });
      const fixedHeight=fixed.reduce((m,el)=>Math.max(m,el.getBoundingClientRect().height),0);
      return {
        viewport:innerWidth,document:root.scrollWidth,body:document.body.scrollWidth,
        scrollHeight:root.scrollHeight,viewportHeight:innerHeight,
        tail:root.scrollHeight-flowBottom,fixedHeight
      };
    }""")
    assert values["document"]<=values["viewport"],f"{label}: document overflow {values}"
    assert values["body"]<=values["viewport"],f"{label}: body overflow {values}"
    if values["scrollHeight"]>values["viewportHeight"]+1:
        assert values["tail"]<=values["fixedHeight"]+48,f"{label}: blank tail {values}"


def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--app-url",default=DEFAULT_URL)
    parser.add_argument("--commit",required=True)
    args=parser.parse_args()
    origin=args.app_url.rstrip("/")
    build=wait_for_build(origin,args.commit)

    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=["--no-sandbox","--disable-gpu"])
        ctx=browser.new_context(
            viewport={"width":390,"height":844},device_scale_factor=1,
            color_scheme="light",reduced_motion="reduce",
            extra_http_headers={"Cache-Control":"no-cache"},
        )
        errors=[]
        page=ctx.new_page();page.on("pageerror",lambda exc:errors.append(str(exc)))
        page.goto(f"{origin}/?prod-ui={args.commit}",wait_until="load")
        page.wait_for_function("typeof CATALOG!=='undefined'&&Array.isArray(CATALOG.books)&&CATALOG.books.length>0",timeout=30000)
        page.evaluate("document.fonts.ready")
        if page.locator('[data-a="onboard-skip"]').count():
            page.locator('[data-a="onboard-skip"]').click()
            page.wait_for_timeout(100)

        screens=[
            ("home","tab('home')"),
            ("library","tab('library')"),
            ("review","tab('review')"),
            ("me","tab('me')"),
            ("privacy","go('privacy')"),
            ("about","go('about')"),
            ("onboarding","ACTIONS['quick-tour']()"),
        ]
        for label,script in screens:
            page.evaluate(script);page.wait_for_timeout(50);geometry(page,label)

        page.evaluate("""() => {
          const s=CATALOG.specialties?.find(x=>CATALOG.books.some(b=>b.specialty===x.id));
          if(!s)throw new Error('No specialty available for production smoke');
          go('spec',{s:s.id});
        }""")
        geometry(page,"specialty")

        page.evaluate("""id => {
          const b=bookById(id);if(!b)throw new Error('Protected book absent');
          go('book',{b:id});
        }""",REQUIRED_BOOK)
        geometry(page,"book")

        page.evaluate("""async id => {
          const b=bookById(id),ch=b?.chapters?.[0];if(!ch)throw new Error('Protected chapter absent');
          await startChapter(id,ch.id);
        }""",REQUIRED_BOOK)
        page.wait_for_selector(".k-study",timeout=30000)
        geometry(page,"study")

        page.evaluate("ACTIONS.report()");page.wait_for_selector('[role="dialog"]')
        geometry(page,"report-sheet")
        page.evaluate("SHEET=null;render()")

        page.evaluate("""() => {
          const id=SESSION.qids[0],q=QI[id].q;
          SESSION={mode:'exam',title:'Production smoke result',qids:[id],index:0,
            resp:{[id]:{done:true,correct:true,score:1,sel:null}},
            order:{[id]:q.options.map((_,i)=>i)},startedAt:Date.now()-60000,endedAt:Date.now(),finished:true,parent:null};
          STACK.splice(0,STACK.length,{v:'home',p:{}},{v:'results',p:{}});render(true);
        }""")
        geometry(page,"results")

        page.evaluate("""() => {
          const id=Object.keys(QI)[0];if(!id)throw new Error('No downloaded question');
          startSession({mode:'study',title:'Production smoke completion',qids:[id]});
          SESSION.resp[id]={done:true,correct:true,score:1,sel:null};
          nextQuestion();
        }""")
        page.wait_for_selector("[data-session-complete]",timeout=10000)
        geometry(page,"chapter-complete")

        assert not errors,errors
        ctx.close();browser.close()

    print(json.dumps({
        "production_ui":"PASS","commit":args.commit,"version":build.get("version"),
        "screens":["home","library","review","me","privacy","about","onboarding","specialty","book","study","report-sheet","results","chapter-complete"],
        "viewport":"390x844",
    }))
    return 0


if __name__=="__main__":raise SystemExit(main())
