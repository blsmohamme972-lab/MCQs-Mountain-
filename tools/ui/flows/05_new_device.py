"""Two empty browser contexts share only the CloudStorage SDK callback adapter.

No IndexedDB/localStorage/pack/celebration copying and no production account.
Production sync-core + bridge perform the actual serialized push and pull.
"""

SDK=r"""(() => {
 const call=(op,args,cb)=>window.__testCloud(op,args).then(v=>cb?.(null,v),()=>cb?.('offline'));
 const noop=()=>{},cloud={getKeys(cb){call('keys',[],cb);},getItems(keys,cb){call('get',keys,cb);},setItem(k,v,cb){call('set',[k,v],cb);},removeItems(keys,cb){call('remove',keys,cb);}};
 window.Telegram={WebApp:{initData:'isolated-test-session',initDataUnsafe:{user:{id:123,first_name:'Test'}},colorScheme:'light',themeParams:{},isVersionAtLeast:()=>true,CloudStorage:cloud,
 ready:noop,expand:noop,onEvent:noop,setHeaderColor:noop,setBackgroundColor:noop,
 HapticFeedback:{selectionChanged:noop,notificationOccurred:noop},
 BackButton:{show:noop,hide:noop,onClick:noop},MainButton:{setParams:noop,hide:noop,onClick:noop},showConfirm:(message,cb)=>cb(false)}};
})();"""

def run(browser,origin,pack,out,helpers):
    storage={}
    def cloud(source,op,args):
        if op=='keys':return list(storage)
        if op=='get':return {k:storage.get(k,'') for k in args}
        if op=='set':
            k,v=args
            assert len(v)<=4096 and len(storage)<=716
            assert not k.startswith('ui_')
            storage[k]=v
            return True
        if op=='remove':
            for k in args:storage.pop(k,None)
            return True
        raise AssertionError(op)
    def device():
        ctx=helpers['context'](browser,origin)
        ctx.expose_binding('__testCloud',cloud);ctx.add_init_script(SDK)
        page=ctx.new_page();errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.goto(origin+'/seed/')
        assert page.evaluate('indexedDB.databases().then(x=>x.length)')==0
        page.goto(origin,wait_until='load');page.wait_for_selector('main')
        page.wait_for_function("typeof KafuPersonal!=='undefined'&&!!KafuPersonal.replica&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
        page.evaluate('CloudSync.pull()')
        if page.locator('[data-a=onboard-skip]').count():page.locator('[data-a=onboard-skip]').click()
        page.wait_for_selector('nav')
        return ctx,page,errors
    a,pa,ea=device()
    # Complete the visible four-question chapter through the normal grading API.
    pa.evaluate("async()=>{if(KafuOnboarding.needed)await ACTIONS['onboard-skip']();await startChapter('DESIGN-CARDIO',1);}")
    pa.wait_for_selector('.stem')
    # Telegram uses its MainButton instead of the browser actionbar in this fixture.
    for _ in range(4):
        pa.evaluate("()=>{const q=QI[SESSION.qids[SESSION.index]].q,r=SESSION.resp[q.id]||(SESSION.resp[q.id]=newResp(q));r.sel=q.type==='mtf'?q.answer.slice():q.type==='multi'?q.answer.map(x=>x.charCodeAt(0)-65):q.answer.charCodeAt(0)-65;submitCurrent();nextQuestion();}")
    pa.evaluate('KafuDelight.settled()')
    # Existing compact replica is the sole source of historical days and counts.
    pa.evaluate("""()=>{
      const r=KafuPersonal.replica;
      for(let i=1;i<=96;i++)r.answer('Q'+String(2000+i).padStart(9,'0'),true,'DESIGN-CARDIO','2026-09-'+(22+i%7));
      r.favorite('question','Q000001001',true);r.addTime('2026-09-28',120);
      KafuPersonal.apply();
    }""")
    pa.evaluate('KafuPersonal.flush()')
    assert pa.evaluate('KafuPersonal.status()')=='synced'
    expected=pa.evaluate('KafuDelight.achievements')
    assert len(expected['earned'])==4 and expected['streak']==7
    b,pb,eb=device()
    pb.wait_for_function('Object.keys(S.answers).length===100')
    assert pb.evaluate('KafuDelight.achievements')==expected
    assert pb.evaluate('DB.get("meta",KafuDelight.storageKey)') is None
    assert pb.evaluate("S.fav.includes('Q000001001')&&S.time['2026-09-28']===120")
    pb.evaluate("tab('me')")
    assert pb.locator('.k-badge.earned').count()==4
    # Badge rendering itself must not enqueue additional CloudStorage writes.
    pb.evaluate('KafuPersonal.capture()');pb.evaluate("tab('home');tab('me')")
    assert all(not k.startswith('ui_') for k in storage)
    # Same device can still use the restored personal data offline after reload.
    pb.evaluate("async()=>{await DB.put('meta','state',S);}")
    pb.wait_for_function('navigator.serviceWorker.controller!==null')
    b.set_offline(True);pb.reload(wait_until='load');pb.wait_for_selector('nav')
    assert pb.evaluate('KafuDelight.achievements')==expected
    # A genuinely separate account/context has no badges or inherited streak.
    other=helpers['context'](browser,origin);pc,ec=helpers['open_app'](other,origin,pack,False)
    assert pc.evaluate('Object.keys(KafuDelight.achievements.earned).length')==0
    assert pc.evaluate('KafuDelight.achievements.streak')==0
    assert not ea+eb+ec,ea+eb+ec
    a.close();b.close();other.close()
    return {'passed':['New phone: actual sync bridge and CloudStorage callback roundtrip restores all four badges, seven-day streak, stars and study time into empty IndexedDB without copying ui_delight; offline reload and separate-account isolation pass']}
