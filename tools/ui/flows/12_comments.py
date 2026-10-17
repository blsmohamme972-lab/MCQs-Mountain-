"""Built-app question comments: published index/shards through the real tools; a locked bar above the question
(counts only) and the comments after the explanation once answered; one "By Kafu characters" line; posting times,
likes and reactions; the student's own like; closed composer; offline copy, taken-away comments and phone geometry."""
from __future__ import annotations
import json
import tempfile
from pathlib import Path
from tools import comments as C

BOOK = 'DESIGN-CARDIO'
NOW = '2026-09-28T09:30:00Z'   # the fixed clock of tools/ui/check.py


def fixture(pack):
    """Publish fixture comments with tools/comments.py exactly as the queue would."""
    people = C.people()
    photo = [p['name'] for p in people if p['photo']]
    plain = [p['name'] for p in people if not p['photo']]
    q1, q2, q3 = (q['id'] for q in pack['questions'][:3])
    questions = {
        q1: [
            {'author': photo[0], 'text': 'Fixture comment one: a short English note.', 'kind': 'tip',
             'replies': [{'author': plain[0], 'text': 'نص تجريبي للرد الأول، with English words mixed in.'},
                         {'author': photo[1], 'text': 'Fixture reply two.'},
                         {'author': photo[5], 'text': 'Fixture reply three.', 'at': '2026-09-28T09:00:00Z', 'likes': 4, 'react': ['🔥']},
                         {'author': photo[6], 'text': 'Fixture reply four.'}]},
            {'author': 'Hiba 🌸', 'text': 'نص تجريبي فقط لاختبار اتجاه الكتابة\nسطر ثاني للتجربة', 'kind': 'mnemonic'},
            {'author': plain[1], 'text': 'Fixture comment three with a deliberately long unbroken word Pneumonoultramicroscopicsilicovolcanoconiosis to test wrapping.'},
            {'author': photo[2], 'text': 'Fixture comment four.', 'kind': 'clinical', 'at': '2026-09-26T09:30:00Z', 'likes': 0},
            {'author': photo[3], 'text': 'Fixture comment five.', 'kind': 'exam'},
        ],
        q3: [{'author': photo[4], 'text': 'Fixture comment on the third question.'}],
    }
    tmp = Path(tempfile.mkdtemp(prefix='kafu-comments-ui-'))
    root = tmp / 'content'
    root.mkdir()
    (root / 'catalog.json').write_text(json.dumps({'books': [{'id': BOOK, 'chapters': [{'id': 1, 'qids': [q['id'] for q in pack['questions']]}]}]}))
    zip_path = C.write_package({'schema': 1, 'format': 'kafu-comments', 'book_id': BOOK, 'revision': 1, 'questions': questions}, tmp / 'in', now=NOW)
    C.publish(tmp / 'content.sqlite', root, zip_path)
    files = {'/comments/' + BOOK + '.json': (root / 'comments' / (BOOK + '.json')).read_bytes()}
    for entry in json.loads(files['/comments/' + BOOK + '.json'])['shards'].values():
        files[entry['url']] = (root / entry['url'].lstrip('/')).read_bytes()
    published = C.read_package(zip_path).questions   # with the posting times, likes and reactions pack filled in
    return files, published, {p['name']: p for p in people}


def serve(ctx, origin, files, state):
    def handle(route):
        path = route.request.url[len(origin):].split('?')[0]
        if state.get('offline'):   # routes still answer in an offline context; refuse like the network would
            route.abort('internetdisconnected')
            return
        state['requests'].append(path)
        if state.get('gone') or path not in files:
            route.fulfill(status=404, content_type='text/plain', body='Not found')
        else:
            route.fulfill(status=200, content_type='application/json', body=files[path])
    ctx.route(origin + '/comments/**', handle)
    ctx.route(origin + '/packs/_comments/**', handle)


def start(page, pack, mode='study'):
    ids = [q['id'] for q in pack['questions']]
    page.evaluate("([ids,mode])=>{tab('home');startSession({mode,title:'Comments fixture',bookId:'DESIGN-CARDIO',chId:1,qids:ids});}", [ids, mode])
    page.wait_for_selector('.k-study .stem')


def check_section(page, questions, people, qid):
    section = page.locator('.kc[data-q="%s"]' % qid)
    section.wait_for(timeout=8000)
    assert page.locator('.kc').count() == 1
    total = sum(1 + len(c.get('replies', [])) for c in questions[qid])
    assert section.locator('.kc-count').inner_text() == str(total)
    names = section.locator('.kc-name').all_inner_texts()
    assert section.locator('.kc-by').all_inner_texts() == ['By Kafu characters'] and section.locator('.kc-badge').count() == 0
    for name, av in zip(names, section.locator('.kc-av').all()):
        person = people[name]
        img = av.locator('img')
        assert (img.get_attribute('src') if img.count() else None) == person['photo'], name
    # The explanation stays first: comments sit after it, at the end of the study screen.
    assert page.evaluate("()=>{const e=document.querySelector('.k-study .explain'),c=document.querySelector('.kc');return !!(e.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING)}")
    check_bar(page, questions, qid, True)
    return section


def check_bar(page, questions, qid, answered):
    """The bar above the question: counts and faces only, never a comment's words."""
    bar = page.locator('.kc-bar[data-q="%s"]' % qid)
    bar.wait_for(timeout=8000)
    assert page.locator('.kc-bar').count() == 1
    assert ('kc-open' if answered else 'kc-locked') in bar.get_attribute('class')
    items = [c for t in questions[qid] for c in [t, *t.get('replies', [])]]
    mine = page.evaluate("q=>JSON.parse(localStorage.getItem('kafu-comment-likes-v1')||'[]').filter(k=>k.startsWith(q+':')).length", qid)
    text = bar.inner_text()
    assert bar.locator('.kc-bar-main strong').inner_text() == '%d comment%s' % (len(items), '' if len(items) == 1 else 's') and bar.locator('.kc-bar-main b').inner_text() == str(sum(c['likes'] for c in items) + mine), text
    assert not any(c['text'][:12] in text for c in items)
    assert page.evaluate("()=>{const b=document.querySelector('.kc-bar'),q=document.querySelector('.k-question-card');return !!(b.compareDocumentPosition(q)&Node.DOCUMENT_POSITION_FOLLOWING)}"), 'above the question'
    return bar


# WCAG contrast of each selector's text against the first painted background behind it.
CONTRAST = """sels => {const p=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>{c=c.map(v=>v/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]},
          bg=e=>{for(;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(!/rgba\\(.*, 0\\)$/.test(c)&&c!=='transparent')return c}return 'rgb(255,255,255)'},
          r=sel=>{const e=document.querySelector(sel),a=lum(p(getComputedStyle(e).color)),b=lum(p(bg(e)));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
          return Object.fromEntries(sels.map(s=>[s,r(s)]))}"""


def run(browser, origin, pack, out, helpers):
    files, questions, people = fixture(pack)
    q1, q2, q3 = (q['id'] for q in pack['questions'][:3])
    passed = []
    for device, theme in (('phone', 'light'), ('phone', 'dark'), ('ipad', 'light')):
        state = {'requests': []}
        ctx = helpers['context'](browser, origin, device, theme)
        serve(ctx, origin, files, state)
        page, errors = helpers['open_app'](ctx, origin, pack)
        start(page, pack)
        page.wait_for_function("()=>typeof KafuComments==='object'")
        page.wait_for_function("q=>KafuComments._known('DESIGN-CARDIO',q)!==undefined", arg=q1, timeout=8000)
        assert page.locator('.kc').count() == 0, 'no comments before the answer'
        bar = check_bar(page, questions, q1, False)
        ratios = {'locked ' + k: v for k, v in page.evaluate(CONTRAST, ['.kc-bar-main strong', '.kc-bar-main small', '.kc-bar-cta']).items()}
        bar.click()   # locked: it says to answer first and opens nothing
        page.wait_for_function("()=>document.querySelector('.toast')?.textContent==='Answer the question to open the discussion.'")
        assert page.locator('.kc').count() == 0
        page.screenshot(path=str(out / f'comments-{device}-{theme}-locked.png'))
        helpers['study_answer'](page, True)
        section = check_section(page, questions, people, q1)
        assert section.locator('.kc-list>.kc-item').count() == 3
        assert section.locator('.kc-more').inner_text() == 'Show 2 more comments'
        # Times from the fixed clock; likes and reactions from the pack; two replies, then "View 2 more replies".
        first = section.locator('.kc-list>.kc-item').first
        assert first.locator(':scope>.kc-body>.kc-replies>.kc-item').count() == 2
        assert first.locator('.kc-more-replies').inner_text() == 'View 2 more replies'
        top = questions[q1][0]
        assert first.locator('.kc-time').first.get_attribute('datetime') == top['at'].replace('Z', '.000Z')
        assert first.locator('.kc-reacts b').first.inner_text() == str(top['likes'])
        ratios.update(page.evaluate(CONTRAST, ['.kc-more-replies']))
        first.locator('.kc-more-replies').click()
        assert page.locator('.kc-list>.kc-item').first.locator('.kc-replies>.kc-item').count() == 4
        assert page.evaluate("document.activeElement===document.querySelector('.kc-list>.kc-item .kc-replies>.kc-item:nth-child(3)')")
        third = page.locator('.kc-list>.kc-item').first.locator('.kc-replies>.kc-item').nth(2)
        assert third.locator('.kc-time').inner_text() == '30m' and third.locator('.kc-reacts i').all_inner_texts() == ['🔥']
        assert third.locator('.kc-reacts b').inner_text() == '4'
        # The student's own like: one more and a 👍, kept on this phone; a comment with no likes shows no count.
        like = page.locator('.kc-list>.kc-item').first.locator('.kc-like').first
        assert like.get_attribute('aria-pressed') == 'false'
        like.click()
        like = page.locator('.kc-list>.kc-item').first.locator('.kc-like').first
        assert like.get_attribute('aria-pressed') == 'true'
        reacts = page.locator('.kc-list>.kc-item').first.locator('.kc-reacts').first
        assert reacts.locator('i').first.inner_text() == '👍' and reacts.locator('b').inner_text() == str(top['likes'] + 1)
        assert len(page.evaluate("JSON.parse(localStorage.getItem('kafu-comment-likes-v1'))")) == 1
        page.locator('.kc-bar').click()   # open: jumps to the comments
        page.wait_for_function("()=>document.activeElement===document.querySelector('.kc-title')")
        page.evaluate('scrollTo(0,0)')
        page.screenshot(path=str(out / f'comments-{device}-{theme}.png'), full_page=True)
        if device == 'phone':
            for width in (360, 430):
                page.set_viewport_size({'width': width, 'height': 844})
                geometry = page.evaluate("()=>({scroll:document.documentElement.scrollWidth,w:innerWidth,right:Math.max(...[...document.querySelectorAll('.kc *')].map(e=>e.getBoundingClientRect().right))})")
                assert geometry['scroll'] <= geometry['w'] + 1 and geometry['right'] <= geometry['w'] + 1, (width, geometry)
            page.set_viewport_size({'width': 390, 'height': 844})
        # Text contrast (WCAG AA) for the label, count, tag, "Show more" and composer, in both themes.
        ratios.update(page.evaluate(CONTRAST, ['.kc-by', '.kc-count', '.kc-tag', '.kc-more', '.kc-compose', '.kc-text', '.kc-kind', '.kc-time', '.kc-like',
                                               '.kc-like.on', '.kc-reacts b', '.kc-sum b', '.kc-bar-main strong', '.kc-bar-main small', '.kc-bar-cta']))
        assert all(v >= 4.5 for v in ratios.values()), (theme, ratios)
        page.locator('.kc-more').click()
        assert page.locator('.kc-list>.kc-item').count() == 5 and page.locator('.kc-more').count() == 0
        assert page.evaluate("document.activeElement===document.querySelector('.kc-list>.kc-item:nth-child(4)')")
        fourth = page.locator('.kc-list>.kc-item').nth(3)
        assert fourth.locator('.kc-time').first.inner_text() == '2d' and fourth.locator('.kc-reacts').first.is_hidden()
        compose = page.locator('.kc-compose')
        assert compose.get_attribute('aria-expanded') == 'false' and page.locator('.kc-note').is_hidden()
        compose.click()
        assert page.locator('.kc-compose').get_attribute('aria-expanded') == 'true'
        assert page.locator('.kc-note').inner_text() == 'التعليقات مغلقة مؤقتاً'
        page.screenshot(path=str(out / f'comments-{device}-{theme}-open.png'), full_page=True)
        # A full re-render (starring the question) keeps one section with the same state.
        page.locator('.k-study-topbar [data-a="fav-q"]').click()
        page.wait_for_function("()=>document.querySelectorAll('.kc').length===1&&document.querySelectorAll('.kc-list>.kc-item').length===5")
        assert page.locator('.kc-note').is_visible() and 'kc-enter' not in (page.locator('.kc').get_attribute('class') or '')
        assert page.locator('.kc-bar').count() == 1 and 'kc-enter' not in page.locator('.kc-bar').get_attribute('class')
        assert page.locator('.kc-like.on').count() == 1 and page.locator('.kc-list>.kc-item').first.locator('.kc-replies>.kc-item').count() == 4
        page.locator('[data-a="action"]').last.click()
        page.wait_for_selector('.k-study .stem')
        helpers['study_answer'](page, False)
        page.wait_for_timeout(300)
        assert page.locator('.kc,.kc-bar').count() == 0, 'a question without comments shows nothing'
        page.locator('[data-a="action"]').last.click()
        helpers['study_answer'](page, True)
        check_section(page, questions, people, q3)
        assert page.locator('.kc-more').count() == 0
        if device == 'phone' and theme == 'light':
            # Exam: nothing during the exam itself.
            start(page, pack, 'exam')
            page.locator('[data-a="pick"]').first.click()
            page.wait_for_timeout(300)
            assert page.locator('.kc,.kc-bar').count() == 0
            # Offline: the comments fetched while studying stay on the device.
            stored = page.evaluate("async()=>{const c=await caches.open('kafu-comments-v1');return (await c.keys()).length}")
            assert stored == 2, stored
            before = len(state['requests'])
            ctx.set_offline(True)
            state['offline'] = True
            page.evaluate("()=>{location.reload()}")
            page.wait_for_selector("nav[aria-label='Main']", timeout=15000)
            page.wait_for_function("typeof CATALOG!=='undefined'&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
            start(page, pack)
            helpers['study_answer'](page, True)
            check_section(page, questions, people, q1)
            assert len(state['requests']) == before, 'offline study read the saved copy'
            ctx.set_offline(False)
            state['offline'] = False
            # Taken away by the owner (index 404): gone from the screen and from the device.
            state['gone'] = True
            page.evaluate("()=>{location.reload()}")
            page.wait_for_selector("nav[aria-label='Main']", timeout=15000)
            page.wait_for_function("typeof CATALOG!=='undefined'&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
            start(page, pack)
            page.wait_for_function("q=>typeof KafuComments==='object'&&KafuComments._known('DESIGN-CARDIO',q)===null", arg=q1, timeout=8000)
            helpers['study_answer'](page, True)
            page.wait_for_timeout(300)
            assert page.locator('.kc,.kc-bar').count() == 0
            page.wait_for_function("async()=>{const c=await caches.open('kafu-comments-v1');return (await c.keys()).length===0}", timeout=5000)
            passed.append('comments offline copy, exam, taken-away removal')
        assert not errors, errors
        assert not page.evaluate('KafuEnhancements.failures')
        ctx.close()
        passed.append(f'comments {device} {theme}')
    return {'passed': passed}
