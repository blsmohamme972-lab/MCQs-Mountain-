from pathlib import Path
import json,time

def run(browser,origin,pack,out,helpers):
    passed=[];first_open_ms=[];cached_open_ms=[];response_sizes=[]
    sizes=[('phone-360',360,844),('phone-390',390,844),('phone-430',430,900),('ipad',820,1180)]
    for theme in ['light','dark']:
        for label,width,height in sizes:
            ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,color_scheme=theme,
                reduced_motion='reduce',ignore_https_errors=True,locale='en-GB',timezone_id='UTC')
            ctx.add_init_script(("""(() => {
              const OriginalDate=Date,fixed=+new OriginalDate('2026-09-28T09:30:00.000Z');
              class TestDate extends OriginalDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
              window.Date=TestDate;Math.random=()=>0.42;
              window.Telegram={WebApp:{initData:'signed-fixture',initDataUnsafe:{user:{id:123,first_name:'Ali',last_name:'Hassan'}},
                colorScheme:'__THEME__',themeParams:{},ready(){},expand(){},isVersionAtLeast(){return false},
                onEvent(){},setHeaderColor(){},setBackgroundColor(){},
                BackButton:{show(){},hide(){},onClick(){}},MainButton:{setParams(){},hide(){},onClick(){}},
                HapticFeedback:{selectionChanged(){},notificationOccurred(){}},CloudStorage:null}};
            })();""").replace('__THEME__',theme))
            requests=[]
            fixture_body='''{"qid":"Q000001001","sort":"helpful","items":[{"id":1,"qid":"Q000001001","parent_id":null,"body":"مرحبا دكتور — MRCS 123 (A/B)","name":"Ali Hassan","photo_url":null,"helpful":4,"helpful_by_me":false,"mine":true,"verified":false,"pinned":false,"created_at":"2026-09-28 09:20:00","replies":[{"id":2,"qid":"Q000001001","parent_id":1,"body":"Useful anatomy note: الشريان 2 cm","name":"Sara","photo_url":null,"helpful":2,"helpful_by_me":false,"mine":false,"verified":true,"pinned":true,"created_at":"2026-09-28 09:22:00"}]}],"next_cursor":null,"notice":"Student discussion — not verified"}'''
            response_sizes.append(len(fixture_body.encode('utf-8')))
            def route_api(route):
                requests.append(route.request.url)
                route.fulfill(status=200,content_type='application/json',body=fixture_body)
            ctx.route('**/api/comments/thread',route_api)
            page,errors=helpers['open_app'](ctx,origin,pack,False)
            page.evaluate("() => {startSession({mode:'study',title:'Comments visual fixture',bookId:'DESIGN-CARDIO',chId:1,qids:['Q000001001']});}")
            page.wait_for_selector('[data-a="open-comments"]')
            page.locator('[data-a="open-comments"]').click();page.wait_for_selector('.k-comment-lock')
            assert not requests,f'locked discussion requested network at {label} {theme}'
            assert page.locator('.k-comment-lock').inner_text().find('Answer this question to unlock student discussion.')>=0
            page.locator('[data-a="close-sheet"]').last.click()
            helpers['study_answer'](page,True)
            assert not requests,f'normal answer path requested comments at {label} {theme}'
            started=time.perf_counter()
            page.locator('[data-a="open-comments"]').click();page.wait_for_selector('.k-comment-card')
            first_open_ms.append((time.perf_counter()-started)*1000)
            assert len(requests)==1,f'unlocked first open expected one request at {label} {theme}: {requests}'
            page.locator('[data-a="close-sheet"]').last.click()
            started=time.perf_counter()
            page.locator('[data-a="open-comments"]').click();page.wait_for_selector('.k-comment-card')
            cached_open_ms.append((time.perf_counter()-started)*1000)
            assert len(requests)==1,f'cached reopen made a network request at {label} {theme}: {requests}'
            assert page.locator('.k-comment-body[dir="auto"]').count()>=2
            assert page.get_by_text('Verified by Kafu').count()==1
            assert page.get_by_text('Student discussion — not verified').count()==1
            assert page.locator('[data-a="comment-delete"]').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.evaluate("document.documentElement.style.fontSize='200%'")
            page.wait_for_timeout(50)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'200% overflow {label} {theme}'
            shot=out/f'comments-{label}-{theme}.png'
            page.screenshot(path=str(shot),full_page=False,animations='disabled')
            assert not errors,errors
            ctx.close()
    metrics={'first_open_ms_max':round(max(first_open_ms),2),'cached_open_ms_max':round(max(cached_open_ms),2),
             'thread_fixture_response_bytes':max(response_sizes),'normal_answer_comments_requests':0,'cached_reopen_extra_requests':0}
    (out/'comments-performance.json').write_text(json.dumps(metrics,indent=2)+'\n')
    passed.append('comments locked zero-request / normal answer zero-request / lazy first open / cached reopen zero-request / Arabic mixed bidi / verified / own-delete across 360 390 430 iPad light dark at 200% text')
    return {'passed':passed,'hashes':{}}
