"""Deterministic question-screen evidence matching the owner reference states."""
IDS=['Q000001001','Q000001002','Q000001003','Q000001004']

def shot(page,path,scroll=False):
    page.evaluate("() => {for(const t of document.querySelectorAll('.toast'))t.hidden=true;}")
    if scroll: page.evaluate("() => window.scrollTo(0,Math.min(document.documentElement.scrollHeight-innerHeight,Math.max(0,document.querySelector('.explain')?.getBoundingClientRect().top+scrollY-150||0)))")
    else: page.evaluate("() => window.scrollTo(0,0)")
    page.wait_for_timeout(100);page.screenshot(path=str(path),full_page=False,animations='disabled')

def run(browser,origin,pack,out,helpers):
    hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            prefix=f'reference-{device}-{theme}'

            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids,index:0});}",IDS)
            shot(page,out/f'{prefix}-unanswered.png')

            page.locator('[data-a="pick"][data-i="0"]').click()
            shot(page,out/f'{prefix}-selected.png')
            page.locator('[data-a="action"]').last.click();page.wait_for_selector('.explain')
            shot(page,out/f'{prefix}-correct.png')

            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids,index:0});}",IDS)
            page.locator('[data-a="pick"][data-i="1"]').click();page.locator('[data-a="action"]').last.click();page.wait_for_selector('.explain')
            shot(page,out/f'{prefix}-wrong.png')

            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids,index:2});}",IDS)
            for i in (0,1):page.locator(f'[data-a="pick"][data-i="{i}"]').click()
            shot(page,out/f'{prefix}-select-all.png')

            page.evaluate("ids=>{tab('home');startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:ids,index:1});}",IDS)
            q=page.evaluate('QI[SESSION.qids[SESSION.index]].q')
            for i,v in enumerate(q['answer']):page.locator(f'[data-a="tf"][data-i="{i}"][data-v="{v}"]').click()
            shot(page,out/f'{prefix}-true-false.png')

            # Current app intentionally has no question navigator sheet yet; capture the closest current state as evidence.
            assert page.locator('.k-study-count').count()==1 and page.locator('[role="dialog"]').count()==0
            shot(page,out/f'{prefix}-question-map-absent.png')

            page.locator('[data-a="action"]').last.click();page.wait_for_selector('.explain')
            shot(page,out/f'{prefix}-feedback-panel.png',True)
            assert not errors,errors
            ctx.close()
    return {'passed':['Reference-state evidence captured: unanswered, selected, correct, wrong, multi-select, true/false, current no-map state, feedback panel']}
