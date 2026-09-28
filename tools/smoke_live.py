"""Read-only post-deploy guard. Never calls bot, API or queue mutation routes."""
from __future__ import annotations
import argparse
try:
    from tools.http_client import request_bytes, request_json
except ModuleNotFoundError:
    from http_client import request_bytes, request_json

APP_URL = "https://kafu.blsmohamme97.workers.dev/"
CATALOG_URL = "https://kafu-content-1.blsmohamme97.workers.dev/catalog.json"


def check_app_html(raw: bytes):
    text = raw.decode("utf-8")
    if "<title>Kafu</title>" not in text or "<script" not in text:
        raise ValueError("App did not return the expected Kafu HTML shell")
    return True


def check_book(catalog, required_book):
    books = catalog.get("books", [])
    if not isinstance(books, list) or not books:
        raise ValueError("Published catalog is empty")
    book = next((b for b in books if b.get("id") == required_book), None)
    if required_book and (book is None or not book.get("chapters")):
        raise ValueError("Protected published book is missing or has no chapters")
    return book


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--required-book", default="KAFU-UPLOAD-TEST")
    args = parser.parse_args()
    check_app_html(request_bytes(APP_URL, step="live.app", headers={"Cache-Control":"no-cache"}))
    book = check_book(request_json(CATALOG_URL, step="live.catalog", headers={"Cache-Control":"no-cache"}), args.required_book)
    print("[live-check] app shell OK; published catalog OK; protected book", book["id"], "v" + str(book["version"]), "questions", book.get("questions"))
    # This checks delivery and content invariants, not Telegram/iOS rendering.

if __name__ == "__main__":
    main()
