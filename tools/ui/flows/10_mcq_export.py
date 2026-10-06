"""Built-app browser regression for owner MCQ export controls and preparation."""
from __future__ import annotations
import json
from pathlib import Path

CATALOG_SHA="a"*64

def install_capability(ctx,allowed):
    body='{"can_export_mcqs":true}' if allowed else '{"can_export_mcqs":false}'
    ctx.route("**/admin/capabilities",lambda route:route.fulfill(status=200,content_type="application/json",body=body))

def fixture_export(pack):
    questions=[dict(q) for q in pack["questions"]]
    chapters=[
        {"id":1,"title":"Chapter One","questions":2,"qids":[q["id"] for q in questions[:2]],"url":"https://kafu.test/packs/one.json","bytes":0},
        {"id":2,"title":"Chapter Two","questions":2,"qids":[q["id"] for q in questions[2:]],"url":"https://kafu.test/packs/two.json","bytes":0},
    ]
    book={"id":"DESIGN-CARDIO","title":"Clinical Cardiology","authors":["Kafu Practice Series"],"specialty":"Cardiology","version":1,"questions":4,"chapters":chapters}
    packs={
        "1":{"schema":1,"book_id":book["id"],"chapter_id":1,"version":1,"questions":questions[:2]},
        "2":{"schema":1,"book_id":book["id"],"chapter_id":2,"version":1,"questions":questions[2:]},
    }
    return book,packs

def install_export_api(ctx,pack,fail_catalog_once=False,fail_chapter=None):
    book,packs=fixture_export(pack);state={"catalog":0}
    def route_export(route):
        request=route.request
        body=json.loads(request.post_data or "{}")
        if request.url.endswith("/catalog"):
            state["catalog"]+=1
            if fail_catalog_once and state["catalog"]==1:
                route.fulfill(status=503,content_type="application/json",body=json.dumps({"error":"catalog_unavailable","diagnostic":{"upstream_status":530,"cf_code":1042}}));return
            route.fulfill(status=200,content_type="application/json",body=json.dumps({
                "ok":True,"source_kind":"published","snapshot":{"catalog_url":"https://kafu.test/catalog.json","catalog_sha256":CATALOG_SHA,"index_url":None,"index_sha256":None},
                "book":book,"book_index":None,"chapters":book["chapters"]}));return
        if request.url.endswith("/chapter"):
            cid=str(body.get("chapter_id"))
            if fail_chapter is not None and cid==str(fail_chapter):
                route.fulfill(status=503,content_type="application/json",body=json.dumps({"error":"chapter_unavailable","diagnostic":{"upstream_status":503}}));return
            chapter=next(c for c in book["chapters"] if str(c["id"])==cid)
            route.fulfill(status=200,content_type="application/json",body=json.dumps({
                "ok":True,"source_kind":"published","snapshot":{"catalog_url":"https://kafu.test/catalog.json","catalog_sha256":CATALOG_SHA,"chapter_sha256":cid*64},
                "chapter":chapter,"pack":packs[cid]}));return
        route.abort()
    ctx.route("**/admin/mcq-export/**",route_export)
    return book,packs,state

def attach_owner(page):
    page.evaluate("() => { window.Telegram={WebApp:{initData:'query_id=owner'}}; render(); }")
    page.wait_for_timeout(50)

def set_two_chapter_book(page,book):
    page.evaluate("""book => {
      const b=CATALOG.books.find(x=>x.id===book.id);
      Object.assign(b,book);
      go('book',{b:b.id});
    }""",book)
    page.wait_for_timeout(50)

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

def parse_prepared(page):
    raw=page.evaluate("() => KafuMcqExport.__testPreparedText?.() || null")
    if raw is None:
        raw=page.locator('#mcq-export-fallback').input_value() if page.locator('#mcq-export-fallback').count() else None
    return json.loads(raw) if raw else None

def prepare(page,scope="book",chapter=1):
    selector='[data-a="mcq-export-book"]' if scope=="book" else f'[data-a="mcq-export-chapter"][data-c="{chapter}"]'
    page.locator(selector).click()
    page.wait_for_selector('.mcq-export-sheet[role="dialog"]')
    page.locator('[data-a="mcq-export-prepare"]').click()
    page.wait_for_selector('.mcq-export-sheet [data-a="mcq-export-download-complete"]',timeout=10000)

def cover_checks(browser,origin,pack,out,helpers):
    passed=[]
    svg="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420'%3E%3Crect width='100%25' height='100%25' fill='%23233952'/%3E%3Ctext x='20' y='80' fill='white' font-size='24'%3ETEXT ON ART%3C/text%3E%3C/svg%3E"
    for device in ("phone","ipad"):
        ctx=helpers['context'](browser,origin,device,'dark');page,errors=helpers['open_app'](ctx,origin,pack)
        page.evaluate("(url)=>{const b=CATALOG.books.find(x=>x.id==='DESIGN-CARDIO');b.cover_url=url;go('book',{b:b.id});}",svg)
        page.wait_for_selector('.book-head .cover-art')
        page.wait_for_function("getComputedStyle(document.querySelector('.book-head .cover-copy')).display==='none'")
        assert page.locator('.book-head .cover-art').get_attribute('alt')=='Cover of Clinical Cardiology'
        assert page.locator('.book-head .cover-copy:visible').count()==0
        page.screenshot(path=str(out/f'{device}-dark-cover-image.png'),full_page=False,animations='disabled')
        page.evaluate("()=>{const b=CATALOG.books.find(x=>x.id==='DESIGN-CARDIO');b.cover_url='/missing-cover-export-test.webp';go('book',{b:b.id});}")
        page.wait_for_selector('.book-head .cover-image-failed')
        assert page.locator('.book-head .cover-copy:visible').count()==1
        assert 'Clinical Cardiology' in page.locator('.book-head .cover-copy').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.screenshot(path=str(out/f'{device}-dark-cover-fallback.png'),full_page=False,animations='disabled')
        assert not errors,errors;ctx.close()
        passed.append(f'{device} dark: real artwork has no duplicate title overlay; failed image shows textual fallback without overflow')
    return passed

def run(browser,origin,pack,out,helpers):
    passed=[];out.mkdir(parents=True,exist_ok=True)
    for device in ('phone','ipad'):
        ctx=helpers['context'](browser,origin,device,'light');install_capability(ctx,True)
        page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page)
        assert_book(page,2)
        page.locator('[data-a="mcq-export-chapter"]').click()
        page.wait_for_selector('.mcq-export-sheet[role="dialog"]')
        assert 'ID 1' in page.locator('.mcq-export-sheet').inner_text()
        assert page.locator('.k-study').count()==0
        page.evaluate("SHEET=null;render()")
        page.locator('.mcq-export-chapter-open').click();page.wait_for_selector('.k-study')
        assert not errors,errors;ctx.close()
        passed.append(f'{device}: N+1 export controls and study/export action separation pass')

    ctx=helpers['context'](browser,origin,'phone','light');install_capability(ctx,False)
    page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page);assert_book(page,0)
    assert not errors,errors;ctx.close();passed.append('phone denied capability: zero export controls')

    # Whole-book Prepare, successful clipboard copy, and complete JSON download.
    ctx=helpers['context'](browser,origin,'phone','light');install_capability(ctx,True)
    book,packs,_=install_export_api(ctx,pack)
    page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page);set_two_chapter_book(page,book)
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copied=t}}})")
    prepare(page,"book")
    assert 'Validated 4 published questions.' in page.locator('.mcq-export-sheet').inner_text()
    copy_button=page.locator('[data-a="mcq-export-copy-complete"],[data-a="mcq-export-copy"]').first
    copy_button.click();page.wait_for_function("!!window.__copied")
    copied=json.loads(page.evaluate("window.__copied"))
    assert len(copied["questions"])==4
    assert [q["id"] for q in copied["questions"]]==[q["id"] for q in pack["questions"]]
    with page.expect_download() as info: page.locator('[data-a="mcq-export-download-complete"]').click()
    download=info.value;download_path=download.path();downloaded=json.loads(Path(download_path).read_text())
    assert [q["id"] for q in downloaded["questions"]]==[q["id"] for q in pack["questions"]]
    assert not errors,errors;ctx.close();passed.append('built phone: whole-book Prepare validates 4/4 QIDs, Copy and downloaded JSON are complete and ordered')

    # Single-chapter Prepare plus clipboard rejection fallback.
    ctx=helpers['context'](browser,origin,'ipad','light');install_capability(ctx,True)
    book,packs,_=install_export_api(ctx,pack)
    page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page);set_two_chapter_book(page,book)
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}})")
    prepare(page,"chapter",2)
    assert 'Validated 2 published questions.' in page.locator('.mcq-export-sheet').inner_text()
    page.locator('[data-a="mcq-export-copy-complete"],[data-a="mcq-export-copy"]').first.click();page.wait_for_selector('#mcq-export-fallback')
    fallback=json.loads(page.locator('#mcq-export-fallback').input_value())
    assert [q["id"] for q in fallback["questions"]]==book["chapters"][1]["qids"]
    assert not errors,errors;ctx.close();passed.append('built iPad: chapter Prepare returns exact chapter QIDs and clipboard denial exposes identical manual-copy JSON')

    # Retry a transient catalog failure; raw catalog_unavailable must not leak to the user.
    ctx=helpers['context'](browser,origin,'phone','light');install_capability(ctx,True)
    book,packs,state=install_export_api(ctx,pack,fail_catalog_once=True)
    page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page);set_two_chapter_book(page,book)
    page.locator('[data-a="mcq-export-book"]').click();page.locator('[data-a="mcq-export-prepare"]').click()
    page.wait_for_selector('.export-error')
    text=page.locator('.export-error').inner_text()
    assert 'Could not reach the published content service' in text and 'HTTP 530' in text and 'CF 1042' in text
    assert 'catalog_unavailable' not in text
    page.locator('[data-a="mcq-export-prepare"]').click();page.wait_for_selector('[data-a="mcq-export-download-complete"]')
    assert state["catalog"]==2
    assert not errors,errors;ctx.close();passed.append('built phone: transient upstream failure shows readable diagnostics and Retry completes')

    # One failed chapter must never create a partial successful export.
    ctx=helpers['context'](browser,origin,'phone','light');install_capability(ctx,True)
    book,packs,_=install_export_api(ctx,pack,fail_chapter=2)
    page,errors=helpers['open_app'](ctx,origin,pack);attach_owner(page);set_two_chapter_book(page,book)
    page.locator('[data-a="mcq-export-book"]').click();page.locator('[data-a="mcq-export-prepare"]').click();page.wait_for_selector('.export-error')
    assert page.locator('[data-a="mcq-export-download-complete"]').count()==0
    assert page.locator('[data-a="mcq-export-copy-complete"]').count()==0
    assert 'Validated' not in page.locator('.mcq-export-sheet').inner_text()
    assert not errors,errors;ctx.close();passed.append('built phone: failed second chapter cannot produce a partial successful export')

    passed.extend(cover_checks(browser,origin,pack,out,helpers))
    return {'passed':passed}
