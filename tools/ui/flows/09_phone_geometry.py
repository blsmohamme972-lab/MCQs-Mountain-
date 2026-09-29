"""Phone geometry regression: all main screens fit 360/390/430px and long chapters stay contained."""
from __future__ import annotations
import json

WIDTHS=(360,390,430)

TG_SDK=r"""(() => {
 const noop=()=>{};
 window.Telegram={WebApp:{initData:'layout-user',initDataUnsafe:{user:{id:909,first_name:'Layout'}},colorScheme:'light',themeParams:{},isVersionAtLeast:()=>true,
 ready:noop,expand:noop,onEvent:noop,setHeaderColor:noop,setBackgroundColor:noop,
 HapticFeedback:{selectionChanged:noop,notificationOccurred:noop,impactOccurred:noop},
 BackButton:{show:noop,hide:noop,onClick:noop},MainButton:{setParams:noop,hide:noop,onClick:noop},showConfirm:(message,cb)=>cb(false)}};
})();"""

def inject_long(page,pack,index=171,count=205):
    subset=pack['questions'][:count]
    page.evaluate("""({questions,index})=>{
      const pack={schema:1,book_id:'DESIGN-LONG',chapter_id:1,version:1,questions};
      CATALOG.books=CATALOG.books.filter(b=>b.id!=='DESIGN-LONG');
      CATALOG.books.push({id:'DESIGN-LONG',title:'Long Surgery Question Bank',authors:['Kafu Layout Fixture'],field:'medicine',specialty:'Surgery',
        collection_type:'textbook',version:1,questions:questions.length,chapters:[{id:1,title:'205-question phone layout fixture',questions:questions.length,qids:questions.map(q=>q.id)}]});
      PACKS['DESIGN-LONG:1']=pack;indexPack(pack);
      tab('home');
      startSession({mode:'study',title:'205-question phone layout fixture',bookId:'DESIGN-LONG',chId:1,qids:questions.map(q=>q.id),index});
    }""",{'questions':subset,'index':min(index,len(subset)-1)})
    page.wait_for_selector('.k-study')

def width_metrics(page):
    return page.evaluate("""() => ({
      viewport:innerWidth,
      document:document.documentElement.scrollWidth,
      body:document.body.scrollWidth,
      scrollX:window.scrollX
    })""")

def tail_metrics(page):
    return page.evaluate("""() => {
      const root=document.documentElement,main=document.querySelector('main.wrap');
      const flow=[...(main?.children||[])].filter(el=>getComputedStyle(el).position!=='fixed');
      const bottoms=flow.map(el=>el.getBoundingClientRect().bottom+scrollY);
      const flowBottom=bottoms.length?Math.max(...bottoms):0;
      const fixed=[...document.querySelectorAll('.actionbar,.tabs,.k-complete-footer')].filter(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.height>0;
      });
      const fixedHeight=fixed.reduce((m,el)=>Math.max(m,el.getBoundingClientRect().height),0);
      const mainBox=main?.getBoundingClientRect(),last=flow.at(-1),lastBox=last?.getBoundingClientRect();
      return {
        scrollHeight:root.scrollHeight,viewportHeight:innerHeight,flowBottom,fixedHeight,tail:root.scrollHeight-flowBottom,
        bodyClass:document.body.className,screen:document.body.dataset.screen||'',
        mainPaddingBottom:main?getComputedStyle(main).paddingBottom:null,
        mainBottom:mainBox?mainBox.bottom+scrollY:null,
        lastTag:last?.tagName||null,lastClass:last?.className||null,lastBottom:lastBox?lastBox.bottom+scrollY:null
      };
    }""")

def assert_geometry(page,label):
    w=width_metrics(page)
    assert w['document']<=w['viewport'] and w['body']<=w['viewport'],f"{label}: horizontal overflow {w}"
    t=tail_metrics(page)
    if t['scrollHeight']>t['viewportHeight']+1:
        allowance=t['fixedHeight']+48
        assert t['tail']<=allowance,f"{label}: scrollable blank tail {t}, allowance={allowance}"
    return {'width':w,'tail':t}

def capture_viewport(page,path,scroll_x=0,bottom=False):
    page.evaluate("() => {for(const t of document.querySelectorAll('.toast'))t.hidden=true;}")
    if bottom:
        page.evaluate("() => window.scrollTo(0,document.documentElement.scrollHeight)")
    else:
        page.evaluate("x => window.scrollTo(x,0)",scroll_x)
    page.wait_for_timeout(100)
    page.screenshot(path=str(path),full_page=False,animations='disabled')

def changed_baseline_evidence(browser,origin,pack,out,helpers):
    out.mkdir(parents=True,exist_ok=True)
    for theme in ('light','dark'):
        ctx=helpers['phone_context'](browser,origin,390,theme);page,errors=helpers['open_app'](ctx,origin,pack)
        page.evaluate("ACTIONS['quick-tour']()");page.wait_for_selector('[data-onboarding-step="0"]')
        page.locator('.actionbar [data-a="action"]').click()
        page.locator('.actionbar [data-a="action"]').click()
        page.wait_for_selector('[data-onboarding-step="2"]')
        helpers['capture'](page,out/f'evidence-phone-{theme}-onboarding-3.png')
        assert not errors,errors;ctx.close()

        ctx=helpers['phone_context'](browser,origin,390,theme);page,errors=helpers['open_app'](ctx,origin,pack)
        ids=['Q000001001','Q000001002','Q000001003','Q000001004']
        page.evaluate("ids=>startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids})",ids)
        for i in range(4):
            helpers['study_answer'](page,i!=0)
            page.locator('[data-a="action"]').last.click()
        page.wait_for_selector('[data-session-complete]')
        helpers['capture'](page,out/f'evidence-phone-{theme}-chapter-complete-mixed.png')
        assert not errors,errors;ctx.close()


def regression_evidence(browser,origin,pack,out,helpers,assert_fixed):
    out.mkdir(parents=True,exist_ok=True)
    report={}
    ctx=helpers['phone_context'](browser,origin,390,'light');page,errors=helpers['open_app'](ctx,origin,pack)
    inject_long(page,helpers['long_pack'])
    before=width_metrics(page)
    x=max(0,min(140,before['document']-before['viewport']))
    capture_viewport(page,out/'phone-390-long-study-overflow.png',x)
    report['long_study_width']=width_metrics(page)
    if assert_fixed:
        assert_geometry(page,'390 long study')
        assert page.locator('.k-long-progress').count()==1
        assert page.locator('.k-pips-viewport').count()==0
        assert page.locator('.k-study-count').inner_text().replace('\n','')=='172/205'
    assert not errors,errors
    ctx.close()

    ctx=helpers['phone_context'](browser,origin,390,'light')
    page,errors=helpers['open_app'](ctx,origin,pack)
    inject_long(page,helpers['long_pack'])
    page.evaluate("() => document.body.classList.add('tg')")
    capture_viewport(page,out/'phone-390-telegram-study-bottom.png',bottom=True)
    report['telegram_bottom']=tail_metrics(page)
    if assert_fixed:assert_geometry(page,'390 telegram long study')
    assert not errors,errors
    ctx.close()
    changed_baseline_evidence(browser,origin,pack,out,helpers)
    (out/'phone-layout-metrics.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

def run(browser,origin,pack,out,helpers):
    evidence=regression_evidence(browser,origin,pack,out,helpers,True)
    passed=[]
    for width in WIDTHS:
        ctx=helpers['phone_context'](browser,origin,width,'light');page,errors=helpers['open_app'](ctx,origin,pack)
        screens=[
            ('home',"tab('home')"),
            ('library',"tab('library')"),
            ('specialty',"go('spec',{s:'Cardiology'})"),
            ('book',"go('book',{b:'DESIGN-CARDIO'})"),
            ('review',"tab('review')"),
            ('me',"tab('me')"),
            ('privacy',"go('privacy')"),
            ('about',"go('about')"),
            ('onboarding',"ACTIONS['quick-tour']()"),
        ]
        for label,script in screens:
            page.evaluate(script);page.wait_for_timeout(20);assert_geometry(page,f'{width} {label}')

        page.evaluate("""() => {
          const id='Q000001001',q=QI[id].q;
          SESSION={mode:'exam',title:'Geometry results',qids:[id],index:0,resp:{[id]:{done:true,correct:true,score:1,sel:0}},
            order:{[id]:[0,1,2]},startedAt:Date.now()-60000,endedAt:Date.now(),finished:true,parent:null};
          STACK.splice(0,STACK.length,{v:'home',p:{}},{v:'results',p:{}});render(true);
        }""")
        assert_geometry(page,f'{width} results')

        inject_long(page,helpers['long_pack'])
        assert_geometry(page,f'{width} long-study-205')
        assert page.locator('.k-long-progress').count()==1
        assert page.locator('.k-study-count').inner_text().replace('\n','')=='172/205'
        page.evaluate("ACTIONS.report()");page.wait_for_selector('[role=dialog]')
        assert_geometry(page,f'{width} report-sheet')
        page.evaluate("SHEET=null;render()")

        page.evaluate("""() => {
          window.__progressScrollIntoView=0;
          const native=Element.prototype.scrollIntoView;
          Element.prototype.scrollIntoView=function(...args){
            if(this.matches?.('.k-pip,.k-pips,.k-pips-viewport'))window.__progressScrollIntoView++;
            return native?native.apply(this,args):undefined;
          };
        }""")
        inject_long(page,helpers['long_pack'],30,40)
        viewport=page.locator('.k-pips-viewport')
        assert viewport.count()==1 and viewport.evaluate('el=>el.scrollWidth>el.clientWidth')
        assert viewport.evaluate('el=>el.scrollLeft')>0
        assert page.evaluate('window.__progressScrollIntoView')==0
        assert_geometry(page,f'{width} progress-pips-40')

        page.evaluate("""() => {tab('home');startSession({mode:'study',title:'Completion fixture',bookId:'DESIGN-CARDIO',chId:1,qids:['Q000001001']});}""")
        helpers['study_answer'](page,True)
        page.locator('[data-a="action"]').last.click();page.wait_for_selector('[data-session-complete]')
        assert_geometry(page,f'{width} chapter-complete')

        assert not errors,errors
        ctx.close()
        passed.append(f'{width}px: home/library/specialty/book/review/me/privacy/about/onboarding/results/study/report-sheet/completion have no document overflow or excess scroll tail; 205-question compact progress and 40-dot contained scroller pass')
    return {'passed':passed+[f"Regression evidence: {evidence}"]}
