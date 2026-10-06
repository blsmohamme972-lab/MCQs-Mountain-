"""Built-app browser regression for owner MCQ export controls."""
def install_capability(ctx,allowed):
    body='{"can_export_mcqs":true}' if allowed else '{"can_export_mcqs":false}'
    ctx.route("**/admin/capabilities",lambda route:route.fulfill(status=200,content_type="application/json",body=body))

def assert_book(page,expected):
    page.evaluate("""() => {
      const b=CATALOG.books.find(x=>x.id==='DESIGN-CARDIO');
      b.chapters[0].title='A deliberately very long chapter title that must wrap safely beside the owner export control on narrow layouts';
      go('book',{b:b.id});
    }""")
    page.wait_for_timeout(50)
    assert page.locator('.mcq-export-action').count()==expected
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    assert page.locator('.mcq-export-chapter-row > .mcq-export-chapter-open').count()==1
    assert page.locator('.mcq-export-chapter-row > .mcq-export-actions > .mcq-export-action').count()==(1 if expected else 0)

def run(browser,origin,pack,out,helpers):
    passed=[]
    for device in ('phone','ipad'):
        ctx=helpers['context'](browser,origin,device,'light');install_capability(ctx,True)
        page,errors=helpers['open_app'](ctx,origin,pack)
        page.evaluate("() => { window.Telegram={WebApp:{initData:'query_id=owner'}}; render(); }")
        page.wait_for_timeout(50)
        assert_book(page,2)
        page.locator('[data-a="mcq-export-chapter"]').click()
        page.wait_for_selector('.mcq-export-sheet[role="dialog"]')
        assert 'ID 1' in page.locator('.mcq-export-sheet').inner_text()
        assert page.locator('.k-study').count()==0
        page.evaluate("SHEET=null;render()")
        page.locator('.mcq-export-chapter-open').click()
        page.wait_for_selector('.k-study')
        assert not errors,errors
        ctx.close()
        passed.append(f'{device}: built owner book shows N+1 export controls; chapter C opens export only; chapter button opens study; long title has no overflow')

    ctx=helpers['context'](browser,origin,'phone','light');install_capability(ctx,False)
    page,errors=helpers['open_app'](ctx,origin,pack)
    page.evaluate("() => { window.Telegram={WebApp:{initData:'query_id=denied'}}; render(); }")
    page.wait_for_timeout(50)
    assert_book(page,0)
    assert not errors,errors
    ctx.close()
    passed.append('phone denied capability: zero export controls')
    return {'passed':passed}
