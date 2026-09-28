#!/usr/bin/env python3
"""Poll the live static catalog until an expected publishing state is visible."""

from __future__ import annotations
import argparse, json, time

try:
    from tools.http_client import request_json
except ModuleNotFoundError:
    from http_client import request_json

def fetch(url: str, attempt: int):
    sep = "&" if "?" in url else "?"
    return request_json(
        f"{url}{sep}proof={int(time.time()*1000)}-{attempt}",
        step="verify.catalog",
        headers={"Cache-Control": "no-cache"},
        timeout=15,
    )
def matches(c, a):
    books={b.get("id"): b for b in c.get("books", [])}
    removed=set(c.get("removed_books") or [])
    if a.present and a.present not in books:
        return False
    if a.absent and a.absent in books:
        return False
    if a.removed and a.removed not in removed:
        return False
    if a.not_removed and a.not_removed in removed:
        return False
    if a.book_id:
        b=books.get(a.book_id)
        if not b:
            return False
        if a.version is not None and int(b.get("version",-1)) != a.version:
            return False
        if a.questions is not None and int(b.get("questions",-1)) != a.questions:
            return False
    return True

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--book-id")
    ap.add_argument("--version", type=int)
    ap.add_argument("--questions", type=int)
    ap.add_argument("--present")
    ap.add_argument("--absent")
    ap.add_argument("--removed")
    ap.add_argument("--not-removed")
    ap.add_argument("--attempts", type=int, default=15)
    ap.add_argument("--sleep", type=float, default=2.0)
    a=ap.parse_args()
    last=None
    for i in range(1,a.attempts+1):
        try:
            last=fetch(a.url,i)
            if matches(last,a):
                print(json.dumps({"attempt":i,"books":[b.get("id") for b in last.get("books",[])],"removed_books":last.get("removed_books",[])},indent=2))
                return 0
        except Exception as exc:
            last={"error":str(exc)}
        time.sleep(a.sleep)
    print("Expected catalog state did not become visible.")
    print(json.dumps(last,indent=2))
    return 1

if __name__=="__main__":
    raise SystemExit(main())
