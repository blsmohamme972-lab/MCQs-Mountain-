#!/usr/bin/env python3
"""Static Kafu content administration helpers used by Actions."""

from __future__ import annotations
import argparse, json, shutil
from pathlib import Path

def remove_book(root: Path, book_id: str) -> None:
    catalog_path=root/"catalog.json"
    catalog=json.loads(catalog_path.read_text(encoding="utf-8"))
    catalog["books"]=[b for b in catalog.get("books",[]) if b.get("id") != book_id]
    removed=list(catalog.get("removed_books") or [])
    if book_id not in removed:
        removed.append(book_id)
    catalog["removed_books"]=sorted(removed)
    catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    for p in [root/"books"/book_id, root/"packs"/book_id]:
        if p.exists():
            shutil.rmtree(p)
    covers=root/"covers"
    if covers.exists():
        for p in covers.glob(f"{book_id}-v*.webp"):
            p.unlink()

    routes=root/"routes"
    if routes.exists():
        for route in routes.glob("Q*.json"):
            data=json.loads(route.read_text(encoding="utf-8"))
            mapping=data.get("routes") or {}
            mapping={qid:v for qid,v in mapping.items() if v.get("book_id") != book_id}
            if mapping:
                data["routes"]=mapping
                route.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
            else:
                route.unlink()

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    rm=sub.add_parser("remove")
    rm.add_argument("--root",required=True)
    rm.add_argument("--book-id",required=True)
    a=ap.parse_args()
    if a.cmd=="remove":
        remove_book(Path(a.root),a.book_id)
        print(a.book_id)

if __name__=="__main__":
    main()
