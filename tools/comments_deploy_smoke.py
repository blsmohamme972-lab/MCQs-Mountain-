"""Authenticated deployment smoke for Kafu Community.

Uses the real Worker BOT_TOKEN only inside GitHub Actions to generate short-lived
Telegram Mini App initData fixtures. It never prints tokens, initData, Telegram
IDs, or derived user keys. Synthetic comments are cleaned by soft-delete.
"""
from __future__ import annotations
import argparse, hashlib, hmac, json, os, time, urllib.error, urllib.parse, urllib.request

CONTENT_BASE="https://kafu-content-1.blsmohamme97.workers.dev"
PROD_URL="https://kafu.blsmohamme97.workers.dev"
REQUIRED_BOOK="KAFU-UPLOAD-TEST"

def get_json(url):
    req=urllib.request.Request(url,headers={"Cache-Control":"no-cache","User-Agent":"kafu-comments-deploy-smoke/1.0"})
    with urllib.request.urlopen(req,timeout=20) as r:return json.loads(r.read().decode())

def qid_for_book(book_id):
    catalog=get_json(CONTENT_BASE+"/catalog.json")
    book=next((b for b in catalog.get("books",[]) if b.get("id")==book_id),None)
    if not book or not book.get("chapters"):raise AssertionError("protected smoke book missing")
    ch=book["chapters"][0]
    qids=ch.get("qids") or []
    if qids:return str(qids[0])
    pack=get_json(ch["url"])
    questions=pack.get("questions") or []
    if not questions:raise AssertionError("protected smoke chapter empty")
    return str(questions[0]["id"])

def init_data(token,user):
    params={"auth_date":str(int(time.time())),"query_id":"KAFU_DEPLOY","user":json.dumps(user,separators=(",",":"),ensure_ascii=False)}
    check="\n".join(f"{k}={params[k]}" for k in sorted(params))
    secret=hmac.new(b"WebAppData",token.encode(),hashlib.sha256).digest()
    params["hash"]=hmac.new(secret,check.encode(),hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(params)

def api(origin,path,init_data_value,body=None,expect=200):
    payload={"initData":init_data_value}
    if body:payload.update(body)
    req=urllib.request.Request(
        origin.rstrip("/")+"/api/comments/"+path,
        data=json.dumps(payload,ensure_ascii=False).encode(),
        method="POST",headers={"Content-Type":"application/json","Cache-Control":"no-cache","User-Agent":"kafu-comments-deploy-smoke/1.0"})
    try:
        with urllib.request.urlopen(req,timeout=20) as r:
            status=r.status;data=json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        status=e.code
        try:data=json.loads(e.read().decode())
        except Exception:data={}
    if status!=expect:raise AssertionError(f"{path}: expected HTTP {expect}, got {status}, error={data.get('error')}")
    return data

def no_private_fields(data):
    raw=json.dumps(data,ensure_ascii=False)
    for forbidden in ("user_key","telegram_id","username","phone_number","author_key","reporter_key"):
        if forbidden in raw:raise AssertionError(f"private field leaked: {forbidden}")

def staged(origin,token,owner_id,qid,run_tag):
    owner=init_data(token,{"id":int(owner_id),"first_name":"Kafu","last_name":"Owner Smoke","photo_url":"https://example.com/kafu-smoke-owner.png"})
    stranger_id=7_100_000_000+(int(hashlib.sha256(run_tag.encode()).hexdigest()[:7],16)%100_000_000)
    stranger=init_data(token,{"id":stranger_id,"first_name":"Kafu Smoke Student"})
    try:
        api(origin,"thread",stranger,{"qid":qid},expect=503)
        gate="students-disabled"
    except AssertionError:
        api(origin,"thread",stranger,{"qid":qid},expect=200)
        gate="already-enabled"
    nonce="stage_"+hashlib.sha256(run_tag.encode()).hexdigest()[:20]
    created=api(origin,"create",owner,{"qid":qid,"body":"مرحبا Kafu — MRCS 123 (A/B)","client_nonce":nonce},expect=201)
    no_private_fields(created)
    comment=created["comment"]
    assert comment["name"]=="Kafu Owner Smoke"
    assert comment["photo_url"]=="https://example.com/kafu-smoke-owner.png"
    thread=api(origin,"thread",owner,{"qid":qid,"sort":"newest"},expect=200)
    no_private_fields(thread)
    assert any(x.get("id")==comment["id"] and x.get("body")=="مرحبا Kafu — MRCS 123 (A/B)" for x in thread.get("items",[]))
    api(origin,"delete",owner,{"comment_id":comment["id"]},expect=200)
    print(json.dumps({"comments_staged_smoke":"PASS","gate":gate,"qid_format_ok":qid.startswith("Q") and len(qid)==10}))

def enable_and_verify(origin,token,owner_id,qid,run_tag):
    owner=init_data(token,{"id":int(owner_id),"first_name":"Kafu","last_name":"Owner Smoke","photo_url":"https://example.com/kafu-smoke-owner.png"})
    seed=int(hashlib.sha256((run_tag+"students").encode()).hexdigest()[:7],16)%50_000_000
    a=init_data(token,{"id":7_200_000_000+seed,"first_name":"Kafu Smoke","last_name":"A","photo_url":"https://example.com/kafu-smoke-a.png"})
    b=init_data(token,{"id":7_300_000_000+seed,"first_name":"Kafu Smoke","last_name":"B"})
    enabled=False
    top_id=reply_id=None
    try:
        api(origin,"admin-setting",owner,{"enabled":True},expect=200);enabled=True
        api(origin,"thread",a,{"qid":qid},expect=200)
        top=api(origin,"create",a,{"qid":qid,"body":"Arabic العربية + English MRCS 42 (A/B)","client_nonce":"prod_a_"+hashlib.sha256(run_tag.encode()).hexdigest()[:18]},expect=201)["comment"]
        top_id=top["id"];assert top["name"]=="Kafu Smoke A" and top["photo_url"]=="https://example.com/kafu-smoke-a.png"
        reply=api(origin,"create",b,{"qid":qid,"body":"Reply: مفيد 2 cm","parent_id":top_id,"client_nonce":"prod_b_"+hashlib.sha256(run_tag.encode()).hexdigest()[:18]},expect=201)["comment"]
        reply_id=reply["id"]
        api(origin,"helpful",b,{"comment_id":top_id},expect=200)
        api(origin,"report",b,{"comment_id":top_id,"reason":"answer_wrong"},expect=200)
        api(origin,"moderate",b,{"comment_id":reply_id,"action":"verify","moderator":True},expect=403)
        api(origin,"moderate",owner,{"comment_id":reply_id,"action":"verify"},expect=200)
        thread=api(origin,"thread",a,{"qid":qid,"sort":"newest"},expect=200);no_private_fields(thread)
        found=next(x for x in thread.get("items",[]) if x.get("id")==top_id)
        assert found["helpful"]>=1 and found["body"]=="Arabic العربية + English MRCS 42 (A/B)"
        verified=next(x for x in found.get("replies",[]) if x.get("id")==reply_id)
        assert verified["verified"] is True and verified["pinned"] is True
        api(origin,"delete",b,{"comment_id":reply_id},expect=200)
        api(origin,"delete",a,{"comment_id":top_id},expect=200)
        print(json.dumps({"comments_production_smoke":"PASS","enabled_for_students":True,"lazy_api_lifecycle":"PASS","identity_fields":"PASS","arabic_mixed":"PASS","helpful_report_reply":"PASS","owner_moderation":"PASS"}))
    except Exception:
        if enabled:
            try:api(origin,"admin-setting",owner,{"enabled":False},expect=200)
            except Exception:pass
        raise

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--app-url",default=PROD_URL)
    p.add_argument("--mode",choices=("staged","enable-and-verify"),required=True)
    p.add_argument("--required-book",default=REQUIRED_BOOK)
    args=p.parse_args()
    token=os.environ.get("BOT_TOKEN","")
    owner=os.environ.get("OWNER_TELEGRAM_ID","")
    if not token or not owner or not owner.isdigit():raise AssertionError("deployment smoke secrets unavailable")
    qid=qid_for_book(args.required_book)
    if not (len(qid)==10 and qid.startswith("Q") and qid[1:].isdigit()):raise AssertionError("invalid permanent QID")
    run_tag=os.environ.get("GITHUB_RUN_ID","run")+"-"+os.environ.get("GITHUB_RUN_ATTEMPT","1")+"-"+os.environ.get("GITHUB_SHA","")
    if args.mode=="staged":staged(args.app_url,token,owner,qid,run_tag)
    else:enable_and_verify(args.app_url,token,owner,qid,run_tag)

if __name__=="__main__":main()
