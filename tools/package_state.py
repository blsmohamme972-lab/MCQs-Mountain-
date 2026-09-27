#!/usr/bin/env python3
"""Shared package duplicate-state helper used by Kafu publishing workflows."""

from __future__ import annotations
import argparse, hashlib, sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS published_packages (
  sha256 TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

def digest(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd", required=True)
    c=sub.add_parser("check"); c.add_argument("--db", required=True); c.add_argument("--package", required=True)
    r=sub.add_parser("record"); r.add_argument("--db", required=True); r.add_argument("--package", required=True); r.add_argument("--book-id", required=True); r.add_argument("--version", type=int, required=True)
    a=ap.parse_args()
    db=Path(a.db); db.parent.mkdir(parents=True, exist_ok=True)
    con=sqlite3.connect(db); con.executescript(SCHEMA)
    sha=digest(Path(a.package))
    if a.cmd=="check":
        print("yes" if con.execute("select 1 from published_packages where sha256=?", (sha,)).fetchone() else "no")
        return
    con.execute("insert or ignore into published_packages(sha256,book_id,version) values(?,?,?)",(sha,a.book_id,a.version))
    con.commit()
    print(sha)

if __name__=="__main__":
    main()
