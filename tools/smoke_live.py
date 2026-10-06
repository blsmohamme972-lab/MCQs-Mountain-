"""Read-only post-deploy guard; never invokes bot/API/queue mutations."""
from __future__ import annotations
import argparse
import os
import re
import time
from urllib.parse import urlparse
try:
    from tools.http_client import request_bytes, request_json
except ModuleNotFoundError:
    from http_client import request_bytes, request_json

APP_URL="https://kafu.blsmohamme97.workers.dev/"
CATALOG_URL="https://kafu-content-1.blsmohamme97.workers.dev/catalog.json"


def check_app_html(raw: bytes):
    text=raw.decode("utf-8")
    if "<title>Kafu</title>" not in text or "<script" not in text:
        raise ValueError("App did not return the expected Kafu HTML shell")
    return True


def check_build(info,expected):
    if not isinstance(info,dict) or info.get("commit")!=expected or not isinstance(info.get("version"),str):
        raise ValueError("Live app build does not yet match this deployment commit")
    return True


def check_book(catalog,required_book):
    books=catalog.get("books",[])
    if not isinstance(books,list) or not books: raise ValueError("Published catalog is empty")
    book=next((b for b in books if b.get("id")==required_book),None)
    if required_book and (book is None or not book.get("chapters")):
        raise ValueError("Protected published book is missing or has no chapters")
    return book


def check_export_source(catalog, book_id, version, questions):
    books=catalog.get("books",[])
    book=next((b for b in books if b.get("id")==book_id and int(b.get("version",0))==version),None)
    if book is None: raise ValueError(f"Export verification book missing: {book_id} v{version}")
    if int(book.get("questions",-1))!=questions: raise ValueError("Export book question count mismatch")
    chapters=book.get("chapters")
    if not isinstance(chapters,list) or not chapters: raise ValueError("Export book has no chapters")
    base=urlparse(CATALOG_URL)
    seen=[]
    for chapter in chapters:
        qids=[str(q) for q in chapter.get("qids",[])]
        if len(qids)!=int(chapter.get("questions",-1)): raise ValueError("Catalog chapter QID count mismatch")
        target=str(chapter.get("url",""))
        parsed=urlparse(target)
        if parsed.scheme!="https" or parsed.netloc!=base.netloc: raise ValueError("Chapter URL left approved content origin")
        pack=request_json(target,step="live.export.chapter",headers={"Cache-Control":"no-cache"})
        if pack.get("book_id")!=book_id or int(pack.get("version",0))!=version or str(pack.get("chapter_id"))!=str(chapter.get("id")):
            raise ValueError("Published chapter identity mismatch")
        ids=[str(q.get("id","")) for q in pack.get("questions",[])]
        if ids!=qids: raise ValueError("Published chapter order/QIDs mismatch")
        seen.extend(ids)
    if len(seen)!=questions or len(set(seen))!=questions: raise ValueError("Whole-book exported QIDs are incomplete or duplicated")
    if book.get("index_url"):
        parsed=urlparse(str(book["index_url"]))
        if parsed.scheme!="https" or parsed.netloc!=base.netloc: raise ValueError("Book index URL left approved content origin")
        index=request_json(book["index_url"],step="live.export.index",headers={"Cache-Control":"no-cache"})
        if index.get("book_id")!=book_id or int(index.get("version",0))!=version or int(index.get("question_count",-1))!=questions:
            raise ValueError("Published book index mismatch")
    return {"book_id":book_id,"version":version,"questions":questions,"chapters":len(chapters)}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--required-book",default="KAFU-UPLOAD-TEST")
    parser.add_argument("--app-url",default=APP_URL,help="Read-only app origin to verify; defaults to production.")
    parser.add_argument("--export-book",default="")
    parser.add_argument("--export-version",type=int,default=0)
    parser.add_argument("--export-questions",type=int,default=0)
    args=parser.parse_args()
    app_url=args.app_url if args.app_url.endswith("/") else args.app_url+"/"
    expected=os.environ.get("GITHUB_SHA","")
    if expected and not re.fullmatch(r"[a-f0-9]{40}",expected): raise ValueError("Invalid deployment commit")
    for attempt in range(6):
        try:
            check_app_html(request_bytes(app_url,step="live.app",headers={"Cache-Control":"no-cache"}))
            if expected:
                check_build(request_json(app_url+"build-info.json?deploy="+expected,step="live.build",headers={"Cache-Control":"no-cache"}),expected)
            break
        except Exception:
            if attempt==5: raise
            time.sleep(2)
    catalog=request_json(CATALOG_URL,step="live.catalog",headers={"Cache-Control":"no-cache"})
    book=check_book(catalog,args.required_book)
    print("[live-check] app shell OK; build",expected or "not requested","; protected book",book["id"],"v"+str(book["version"]),"questions",book.get("questions"))
    if args.export_book:
        if args.export_version<1 or args.export_questions<1: raise ValueError("Export verification requires positive version and question count")
        verified=check_export_source(catalog,args.export_book,args.export_version,args.export_questions)
        print("[live-check] published export source OK;",verified)
    # This verifies delivery and content invariants, not physical iPad rendering.

if __name__=="__main__":main()
