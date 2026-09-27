#!/usr/bin/env python3
"""Apply an owner takedown to the active static tree and master ID database."""
from __future__ import annotations
import argparse
import sqlite3
from pathlib import Path

from content_admin import remove_book


def remove(root: Path, db: Path, book_id: str) -> None:
    remove_book(root, book_id)
    if not db.exists():
        return
    with sqlite3.connect(db) as conn:
        # Keep ID mappings and publication history so an ID is never reused.
        conn.execute("UPDATE questions SET status='removed' WHERE book_id=?", (book_id,))
        conn.execute("UPDATE id_map SET status='removed' WHERE book_id=?", (book_id,))
        conn.commit()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("remove", choices=["remove"])
    p.add_argument("--root", type=Path, required=True)
    p.add_argument("--db", type=Path, required=True)
    p.add_argument("--book-id", required=True)
    a = p.parse_args()
    remove(a.root, a.db, a.book_id)


if __name__ == "__main__":
    main()
