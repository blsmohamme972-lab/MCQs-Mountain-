"""Same-phone A -> B -> A account switch keeps local personal data separated by Telegram user ID."""

SDK=r"""uid => {
 const noop=()=>{};
 window.Telegram={WebApp:{initData:'account-'+uid,initDataUnsafe:{user:{id:uid,first_name:'User'+uid}},colorScheme:'light',themeParams:{},isVersionAtLeast:()=>true,
 ready:noop,expand:noop,onEvent:noop,setHeaderColor:noop,setBackgroundColor:noop,
 HapticFeedback:{selectionChanged:noop,notificationOccurred:noop,impactOccurred:noop},
 BackButton:{show:noop,hide:noop,onClick:noop},MainButton:{setParams:noop,hide:noop,onClick:noop},showConfirm:(message,cb)=>cb(false)}};
}"""

def run(browser,origin,pack,out,helpers):
    ctx=helpers['context'](browser,origin,'phone','light')
    def user(uid):
        page=ctx.new_page();errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.add_init_script(f"({SDK})({uid});")
        page.goto(origin,wait_until='load')
        page.wait_for_function("typeof KafuPersonal!=='undefined'&&!!KafuPersonal.replica&&CATALOG.books.some(b=>b.id==='DESIGN-CARDIO')")
        if page.locator('[data-a=onboard-skip]').count():page.locator('[data-a=onboard-skip]').click()
        page.wait_for_selector('nav')
        page.wait_for_timeout(350)
        return page,errors

    a,ea=user(101)
    a.evaluate("async()=>{await startChapter('DESIGN-CARDIO',1);const q=QI[SESSION.qids[0]].q,r=SESSION.resp[q.id]||(SESSION.resp[q.id]=newResp(q));r.sel=q.answer.charCodeAt(0)-65;submitCurrent();await DB.put('meta','state',S);}")
    a_state=a.evaluate("DB.get('meta','state_user_101')")
    assert len(a_state['answers'])==1 and a_state['answers']['Q000001001']['c'] is True
    assert a.evaluate("KafuLeaderboard.pending.length")==1
    a.close()

    b,eb=user(202)
    assert b.evaluate("Object.keys(S.answers).length")==0
    assert b.evaluate("DB.get('meta','state_user_101').then(x=>Object.keys(x.answers).length)")==1
    b.evaluate("async()=>{S.fav=['Q000001002'];await DB.put('meta','state',S);}")
    assert b.evaluate("DB.get('meta','state_user_202').then(x=>x.fav.includes('Q000001002'))") is True
    assert b.evaluate("KafuLeaderboard.pending.length")==0
    assert b.evaluate("DB.get('meta','leaderboard_score_user_202')") is None
    b.close()

    a2,ea2=user(101)
    assert a2.evaluate("Object.keys(S.answers).length")==1
    assert a2.evaluate("S.answers['Q000001001'].c") is True
    assert a2.evaluate("KafuLeaderboard.pending.length")==1
    assert a2.evaluate("S.fav.includes('Q000001002')") is False
    assert a2.evaluate("DB.get('meta','state_user_202').then(x=>x.fav.includes('Q000001002'))") is True
    assert not ea+eb+ea2,ea+eb+ea2
    a2.close();ctx.close()
    return {'passed':['Same-phone A->B->A: local state is separated by Telegram user ID; A returns to A progress and never inherits B data']}

