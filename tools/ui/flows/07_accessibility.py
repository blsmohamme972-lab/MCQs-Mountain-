"""Computed contrast, names/targets, focus, text preferences and 200% reflow.

Automated subset, not a complete WCAG/screen-reader certification.
No font preference outside the existing four synced values is persisted.
"""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
AUDIT=(ROOT/'tools/ui/a11y_audit.js').read_text()

def run(browser,origin,pack,out,helpers):
    checks=[];hashes={}
    for device in ('phone','ipad'):
        for theme in ('light','dark'):
            ctx=helpers['context'](browser,origin,device,theme)
            page,errors=helpers['open_app'](ctx,origin,pack)
            def audit(screen):
                result=page.evaluate(AUDIT);checks.append({'device':device,'theme':theme,'screen':screen,**result})
                (out.parent/'accessibility-audit.json').write_text(json.dumps(checks,indent=2))
                assert not result['errors'],f'{device}/{theme}/{screen}: {result["errors"]}'
            page.evaluate("()=>{document.body.tabIndex=-1;document.body.focus();}")
            page.keyboard.press('Tab')
            assert page.evaluate("document.activeElement.id==='kafu-skip'")
            page.keyboard.press('Enter')
            assert page.evaluate("document.activeElement.id==='kafu-main'")
            for screen in ('home','library','me'):
                page.evaluate('v=>tab(v)',screen);audit(screen)
            def samples():
                return page.evaluate("""()=>{
                  tab('me');const size=s=>parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
                  const values=[size('.k-badge strong'),size('.kafu-diagnostic'),size('.about')];
                  startSession({mode:'study',title:'Readable question',bookId:'DESIGN-CARDIO',chId:1,qids:['Q000001001']});
                  values.push(size('.stem'),size('.opt'));return values;
                }""")
            normal=samples()
            for scale in (0.9,1.12,1.25):
                page.evaluate('v=>ACTIONS.fs({v:String(v)})',scale)
                changed=samples()
                assert all(abs(b/a-scale)<.025 for a,b in zip(normal,changed)),(scale,normal,changed)
            page.evaluate("ACTIONS.fs({v:'1'})")
            for index in range(1,5):
                page.evaluate("id=>startSession({mode:'study',title:'A focused practice session',bookId:'DESIGN-CARDIO',chId:1,qids:[id]})",f'Q00000100{index}')
                assert page.evaluate("document.activeElement.id==='kafu-question'")
                assert page.locator('[role=group][aria-label="Answer options"]').count()==1
                if index==2:assert page.locator('.tf[aria-labelledby]').count()==3
                audit('question-'+str(index))
                helpers['study_answer'](page,index%2==0);audit('graded-'+str(index))
            opener=page.locator('[data-a=report]');opener.focus();page.keyboard.press('Enter')
            page.wait_for_selector('.sheet[role=dialog]');audit('report-sheet')
            for _ in range(12):
                page.keyboard.press('Tab');assert page.evaluate("!!document.activeElement.closest('.sheet')")
            page.keyboard.press('Escape');assert page.locator('.sheet').count()==0
            assert page.evaluate("document.activeElement.dataset.a==='report'")
            page.add_style_tag(content='html{font-size:32px!important}')
            for screen in ('home','library','me'):
                page.evaluate('v=>tab(v)',screen);audit(screen+'-200percent')
            page.evaluate("async()=>{await startChapter('DESIGN-CARDIO',1,'Q000001002');}")
            page.wait_for_selector('.stem');audit('true-false-200percent')
            helpers['study_answer'](page,False);audit('feedback-200percent')
            name=f'{device}-{theme}-large-text-study';hashes[name]=helpers['capture'](page,out/(name+'.png'))
            if device=='phone':
                page.set_viewport_size({'width':320,'height':844});page.evaluate("tab('library')");audit('library-320px-200percent')
            assert not errors,errors
            ctx.close()
    return {'hashes':hashes,'passed':['phone/iPad light/dark: computed text/token contrast, named 44px controls, skip link and new-question focus, labelled true/false groups, sheet keyboard trap/Escape, all existing text-size preferences and 200% text-only reflow; saved formats unchanged (manual screen-reader review remains)']}
