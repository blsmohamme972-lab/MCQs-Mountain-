def run(browser,origin,pack,destination,helpers):
    context,open_app=helpers['context'],helpers['open_app']
    ctx=context(browser,origin,'phone','light')
    page,errors=open_app(ctx,origin,pack,True)
    before=page.evaluate("""async()=>({
      state:await DB.get('meta','state_user_browser'),
      keys:[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort()
    })""")
    page.goto(origin+'/#gallery',wait_until='load')
    page.wait_for_selector('#gallery')
    assert page.locator('.gallery-swatch').count()>=9
    assert page.locator('.gallery-option').count()>=4
    assert page.locator('.gallery-token').count()>=70
    assert page.evaluate("KafuGameFeel.soundEnabled") is False
    page.locator('[data-gallery-theme="dark"]').click()
    page.locator('[data-gallery-sound]').click()
    assert page.evaluate("KafuGameFeel.soundEnabled") is True
    page.locator('[data-gallery-sound]').click()
    page.goto(origin+'/#',wait_until='load')
    page.wait_for_selector("nav[aria-label='Main']")
    assert page.evaluate("KafuGameFeel.soundEnabled") is False
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") is None
    after=page.evaluate("""async()=>({
      state:await DB.get('meta','state_user_browser'),
      keys:[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).sort()
    })""")
    assert before==after
    assert not errors,errors
    ctx.close()
    return {'passed':['#gallery renders token/component states without modifying saved progress or localStorage']}
