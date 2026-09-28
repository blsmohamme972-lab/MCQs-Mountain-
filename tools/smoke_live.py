"""Read-only post-deploy guard; never invokes bot/API/queue mutations."""
from __future__ import annotations
import argparse
import os
import re
import time
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


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--required-book",default="KAFU-UPLOAD-TEST")
    parser.add_argument("--app-url",default=APP_URL,help="Read-only app origin to verify; defaults to production.")
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
    book=check_book(request_json(CATALOG_URL,step="live.catalog",headers={"Cache-Control":"no-cache"}),args.required_book)
    print("[live-check] app shell OK; build",expected or "not requested","; protected book",book["id"],"v"+str(book["version"]),"questions",book.get("questions"))
    # This verifies delivery and content invariants, not physical iPad rendering.

if __name__=="__main__":main()
