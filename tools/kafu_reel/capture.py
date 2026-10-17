#!/usr/bin/env python3
"""Capture the real Kafu app screens for a reel: layered screenshots plus the geometry the reel needs.

The live app is opened in an iPhone-sized Chromium (390x844 CSS px, 3x pixels). Every screen is saved as two layers,
so the reel can scroll it smoothly and exactly like the phone does:
  <screen>_content.png   the whole scrollable page with the fixed/sticky bars hidden
  <screen>_fixed0.png    only the fixed/sticky bars, transparent elsewhere, at scroll 0
  <screen>_fixedN.png    the same bars once the page is scrolled (the header changes its look)
geometry.json holds every rectangle the reel animates to (in CSS px, page coordinates).

Screens: home (tab bar), leaders, question (the MCQ with its "Watch the lesson" card), player (the inline lesson player).
The leaders "students studying now" line is HIDDEN unless a real number is given (--students-now): the app computes
that line on the device, and an advert must not show an invented count.
"""
from __future__ import annotations
import json
import re
import time
import urllib.request
from pathlib import Path

APP_URL = "https://kafu.blsmohamme97.workers.dev/"
CATALOG_URL = "https://kafu-content-1.blsmohamme97.workers.dev/catalog.json"
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
      "Version/17.0 Mobile/15E148 Safari/604.1")
VIEW = {"width": 390, "height": 844}

MARK_FIXED = """()=>{document.querySelectorAll('[data-kfix],[data-kfix-before],[data-kfix-after]').forEach(e=>{e.removeAttribute('data-kfix');
 e.removeAttribute('data-kfix-before');e.removeAttribute('data-kfix-after')});const out=[];
for(const e of document.querySelectorAll('body *')){
 for(const ps of ['before','after']){const q=getComputedStyle(e,'::'+ps);if(q.content&&q.content!=='none'&&(q.position==='fixed'||q.position==='sticky')){
  e.setAttribute('data-kfix-'+ps,'1');out.push({tag:e.tagName+'::'+ps,cls:String(e.className),pos:q.position,r:[0,0,0,0]})}}
 const s=getComputedStyle(e);
 if((s.position==='fixed'||s.position==='sticky')&&s.display!=='none'&&s.visibility!=='hidden'&&e.getBoundingClientRect().height>0){
  if(e.parentElement&&e.parentElement.closest('[data-kfix]'))continue;e.setAttribute('data-kfix','1');
  const r=e.getBoundingClientRect();out.push({tag:e.tagName,cls:String(e.className),pos:s.position,r:[r.x,r.y,r.width,r.height]})}}
return out}"""
RECT = """(sel)=>[...document.querySelectorAll(sel)].filter(e=>e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect();
 return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height,text:(e.innerText||'').trim()}})"""


class CaptureError(RuntimeError):
    pass


def catalog_entry(book_id: str, chapter_id: int) -> tuple[str, str]:
    req = urllib.request.Request(CATALOG_URL, headers={"User-Agent": "kafu-reel/1.0 (+capture)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        cat = json.load(r)
    book = next((b for b in cat.get("books", []) if b.get("id") == book_id), None)
    if not book:
        raise CaptureError(f"book {book_id} is not in the app catalog")
    ch = next((c for c in book.get("chapters", []) if str(c.get("id")) == str(chapter_id)), None)
    if not ch:
        raise CaptureError(f"chapter {chapter_id} is not in book {book_id}")
    return book["title"], ch["title"]


def _norm(t: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", t.lower().replace("’", "'")).strip()


def _style(pg, css: str):
    pg.evaluate("css=>{let s=document.getElementById('kreel-style');if(!s){s=document.createElement('style');s.id='kreel-style';"
                "document.head.appendChild(s)}s.textContent=css}", css)


def _layers(pg, out: Path, name: str, extra_hide: str = "") -> dict:
    """Save <name>_content.png (full page, bars hidden) and <name>_fixed0/N.png (bars only). Returns the page facts."""
    fixed = pg.evaluate(MARK_FIXED)
    sy = pg.evaluate("scrollY")
    height = pg.evaluate("document.documentElement.scrollHeight")
    bg = pg.evaluate("getComputedStyle(document.body).backgroundColor")
    _style(pg, "[data-kfix],[data-kfix-before]::before,[data-kfix-after]::after{visibility:hidden!important}" + extra_hide)
    pg.wait_for_timeout(150)
    pg.screenshot(path=str(out / f"{name}_content.png"), full_page=True, animations="disabled")
    shots = {}
    for key, y in (("fixed0", 0), ("fixedN", max(0, height - VIEW["height"]))):
        pg.evaluate("y=>scrollTo(0,y)", y); pg.wait_for_timeout(250)
        _style(pg, "html,body{background:transparent!important}body *{visibility:hidden!important}"
                   "[data-kfix],[data-kfix] *,[data-kfix-before]::before,[data-kfix-after]::after{visibility:visible!important}" + extra_hide)
        pg.wait_for_timeout(150)
        pg.screenshot(path=str(out / f"{name}_{key}.png"), omit_background=True, animations="disabled")
        shots[key] = y
    _style(pg, extra_hide)
    pg.evaluate("y=>scrollTo(0,y)", sy); pg.wait_for_timeout(200)
    return {"height": height, "scroll": sy, "bg": bg, "fixed": fixed, "fixed_scroll": shots}


def _open(p, chromium: str | None):
    br = p.chromium.launch(executable_path=chromium) if chromium else p.chromium.launch()
    ctx = br.new_context(viewport=VIEW, device_scale_factor=3, color_scheme="dark", is_mobile=True, has_touch=True,
                         user_agent=UA, reduced_motion="reduce")
    pg = ctx.new_page()
    pg.goto(APP_URL, wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(1500)
    for label in ("Skip for now",):
        if pg.get_by_text(label).count():
            pg.get_by_text(label).first.click(); pg.wait_for_timeout(1200)
    return br, pg


def _tab(pg, v: str, wait: int):
    pg.evaluate(f"document.querySelector('button.tab[data-v={v}]').click()")
    pg.wait_for_timeout(wait)


def capture(out: Path, book_id: str, chapter_id: int, number: int, stem: str, answer_text: str,
            students_now: int | None = None, chromium: str | None = None) -> dict:
    from playwright.sync_api import sync_playwright
    out.mkdir(parents=True, exist_ok=True)
    book_title, chapter_title = catalog_entry(book_id, chapter_id)
    geo: dict = {"view": VIEW, "dpr": 3, "app": APP_URL, "book": book_title, "chapter": chapter_title, "number": number,
                 "students_now": students_now}
    with sync_playwright() as p:
        br, pg = _open(p, chromium)
        try:
            # ---- accept the one-time notice first, so no screen shows it
            _tab(pg, "library", 2500)
            if pg.get_by_text("I understand").count():
                pg.get_by_text("I understand").first.click(); pg.wait_for_timeout(800)
            _tab(pg, "home", 2000)
            pg.evaluate("scrollTo(0,0)")
            # ---- home: the tab bar the reel taps
            if not pg.locator("button.tab[data-v=leaders]").count():
                raise CaptureError("the app home screen has no Leaders tab")
            geo["home"] = _layers(pg, out, "home")
            geo["home"]["tabs"] = {v: pg.evaluate(RECT, f"button.tab[data-v={v}]")[0] for v in ("home", "library", "leaders")}
            # ---- leaders
            _tab(pg, "leaders", 9000)          # the board opens on the last visit, then settles (about 6 s)
            if not pg.locator(".k-lb").count():
                raise CaptureError("the Leaders board did not open")
            if students_now is None:
                hide = ".k-lb-now{display:none!important}"
            else:
                pg.evaluate("n=>{const b=document.querySelector('.k-lb-now b');if(b)b.textContent=n.toLocaleString('en-US')}", int(students_now))
                hide = ""
            _style(pg, hide); pg.wait_for_timeout(200)
            lead = _layers(pg, out, "leaders", hide)
            names = pg.evaluate("""()=>{const out=[];document.querySelectorAll('.k-lb *').forEach(e=>{
               if(e.children.length||!e.offsetParent)return;const t=(e.innerText||'').trim();if(!/[\\u0600-\\u06FF]/.test(t)||t.replace(/[^\\u0600-\\u06FF]/g,'').length<3)return;
               if(!e.closest('.k-lb-row,.k-lb-pod,[class*=pod],[class*=row]'))return;
               const r=e.getBoundingClientRect();out.push({x:r.x,y:r.y+scrollY,w:r.width,h:r.height,text:t})});return out}""")
            rows = pg.evaluate(RECT, ".k-lb-row")
            lead.update({"arabic_names": names, "rows": rows, "now": pg.evaluate(RECT, ".k-lb-now") if students_now else [],
                         "hero": pg.evaluate(RECT, ".k-lb-hero")})
            if len(names) < 3 or len(rows) < 6:
                raise CaptureError(f"the Leaders board looks empty ({len(rows)} rows, {len(names)} Arabic names)")
            geo["leaders"] = lead
            _style(pg, "")
            # ---- the question
            _tab(pg, "library", 3000)
            if pg.get_by_text("I understand").count():
                pg.get_by_text("I understand").first.click(); pg.wait_for_timeout(800)
            pg.get_by_text(book_title, exact=True).first.click(); pg.wait_for_timeout(2500)
            pg.get_by_text(chapter_title, exact=True).first.click(); pg.wait_for_timeout(6000)
            pg.click("[data-a=jump]"); pg.wait_for_timeout(800)
            pg.fill("input", str(number)); pg.click("[data-a=jump-go]"); pg.wait_for_timeout(2500)
            shown = pg.evaluate("document.body.innerText")
            if _norm(stem)[:80] not in _norm(shown):
                raise CaptureError(f"question {number} in the app does not show the expected stem")
            pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(300)
            q = _layers(pg, out, "question")
            opts = pg.evaluate(RECT, "[data-a=pick]")
            for o in opts:
                o["text"] = re.sub(r"^[A-E]\s*", "", o["text"]).strip()
            correct = [i for i, o in enumerate(opts) if _norm(o["text"]) == _norm(answer_text)]
            card = pg.evaluate(RECT, "[data-a=motioncards-open]")
            if len(opts) < 2 or len(correct) != 1:
                raise CaptureError("could not find the correct option on the question screen")
            if not card:
                raise CaptureError("this question has no 'Watch the lesson' card in the app (is its lesson published?)")
            play = pg.evaluate(RECT, ".kafu-motioncards-lesson-play")
            q.update({"options": opts, "correct": correct[0], "card": card[0], "play": play[0] if play else None})
            geo["question"] = q
            # ---- the inline player (the lesson itself is drawn by the reel, frame-exact, in the stage)
            pg.evaluate("scrollTo(0,document.documentElement.scrollHeight)"); pg.wait_for_timeout(500)
            sy_card = pg.evaluate("scrollY")
            pg.click("[data-a=motioncards-open]"); pg.wait_for_timeout(2500)
            if not pg.locator(".kafu-motioncards-lesson-stage").count():
                raise CaptureError("the lesson player did not open")
            pg.evaluate("y=>scrollTo(0,y)", sy_card); pg.wait_for_timeout(300)
            ctrl = pg.evaluate("""()=>{const q=s=>document.querySelector(s),R=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y+scrollY,w:r.width,h:r.height}};
               const o=q('.kafu-motioncards-controls output'),i=q('.kafu-motioncards-controls input[type=range]'),st=getComputedStyle(o);
               return{stage:R(q('.kafu-motioncards-lesson-stage')),output:{...R(o),font:st.fontFamily,size:st.fontSize,weight:st.fontWeight,color:st.color,align:st.textAlign},
                      range:R(i),accent:getComputedStyle(i).accentColor,sy:scrollY}}""")
            png = out / "player_probe.png"
            pg.screenshot(path=str(png), animations="disabled")
            ctrl["colors"] = _range_colors(png, ctrl)
            hide = (".kafu-motioncards-lesson-stage iframe,.kafu-motioncards-controls output,.kafu-motioncards-controls input[type=range]"
                    "{visibility:hidden!important}")
            pl = _layers(pg, out, "player", hide)
            pl.update(ctrl)
            geo["player"] = pl
        finally:
            br.close()
    (out / "geometry.json").write_text(json.dumps(geo, ensure_ascii=False, indent=1))
    return geo


def _range_colors(png: Path, c: dict) -> dict:
    """The slider's track and thumb colours, sampled from the real screen (3x pixels)."""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    r, sy = c["range"], c["sy"]
    cy = (r["y"] - sy + r["h"] / 2) * 3
    track = im.getpixel((int((r["x"] + r["w"] * 0.85) * 3), int(cy)))
    best, thumb = 0, track
    for x in range(int(r["x"] * 3), int((r["x"] + r["w"] * 0.4) * 3)):
        px = im.getpixel((x, int(cy)))
        s = max(px) - min(px)
        if s > best:
            best, thumb = s, px
    hexc = lambda p: "#%02x%02x%02x" % p
    return {"track": hexc(track), "thumb": hexc(thumb)}


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--book", required=True); ap.add_argument("--chapter", required=True, type=int)
    ap.add_argument("--number", required=True, type=int); ap.add_argument("--stem", required=True)
    ap.add_argument("--answer", required=True); ap.add_argument("--students-now", type=int)
    ap.add_argument("--chromium")
    a = ap.parse_args()
    g = capture(a.out, a.book, a.chapter, a.number, a.stem, a.answer, a.students_now, a.chromium)
    print(json.dumps({k: (v if not isinstance(v, dict) else list(v)) for k, v in g.items()}, ensure_ascii=False))
