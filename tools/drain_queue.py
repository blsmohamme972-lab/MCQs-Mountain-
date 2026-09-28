#!/usr/bin/env python3
"""Drain Kafu's D1 queue in a single GitHub Actions publisher run.

The Worker stores metadata only. This runner downloads, checks, builds, stages,
tests and promotes one book at a time, then continues even after a bad package.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
CONTENT_URL = "https://kafu-content-1.blsmohamme97.workers.dev"
MAX_ZIP = 19 * 1024 * 1024


class StepFailure(RuntimeError):
    def __init__(self, step: str, method: str, host: str, path: str, detail: str = "") -> None:
        summary = f"step={step} method={method} host={host} path={path}"
        if detail:
            summary += f" — {detail}"
        super().__init__(summary)


def run(*args: str, cwd: Path = ROOT, capture: bool = True,
        failure_context: tuple[str, str, str, str] | None = None) -> str:
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=capture)
    if p.returncode:
        detail = (p.stdout + p.stderr)[-1200:].replace("\n", " ").strip()
        if failure_context:
            raise StepFailure(*failure_context, detail)
        raise RuntimeError(f"{' '.join(args[:3])} failed: {detail}")
    return p.stdout + p.stderr


def post(url: str, payload: dict, headers: dict | None = None, step: str = "http.post") -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "kafu-drain/1.0", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read(200).decode("utf-8", errors="replace")
        server = exc.headers.get("server", "")
        cf_ray = exc.headers.get("cf-ray", "")
        parsed = urllib.parse.urlparse(url)
        print(
            f"[queue-http] status={exc.code} server={server!r} cf-ray={cf_ray!r} "
            f"body={body[:200]!r}"
        )
        raise StepFailure(step, "POST", parsed.hostname or "", parsed.path or "/", f"HTTP {exc.code}") from None


class Queue:
    def __init__(self) -> None:
        self.url = os.environ["QUEUE_API_URL"].rstrip("/")
        token = os.environ["QUEUE_API_TOKEN"].strip()
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:8]
        print(
            f"[queue-auth] token_len={len(token)} token_sha256_8={token_hash} "
            "header='Authorization' scheme='Bearer'"
        )
        self.headers = {"Authorization": f"Bearer {token}"}

    def call(self, path: str, data: dict | None = None) -> dict:
        return post(self.url + "/internal/" + path, data or {}, self.headers, step=f"queue.{path}")

    def notify(self, text: str) -> None:
        self.call("notify", {"text": text[:3500]})


def telegram_file(file_id: str, target: Path) -> None:
    token = os.environ["BOT_TOKEN"]
    try:
        data = post(f"https://api.telegram.org/bot{token}/getFile", {"file_id": file_id}, step="telegram.getFile")
    except urllib.error.HTTPError as exc:
        raise ValueError(f"Telegram getFile returned HTTP {exc.code}") from None
    if not data.get("ok") or not data.get("result", {}).get("file_path"):
        raise ValueError("Telegram getFile failed")
    url = f"https://api.telegram.org/file/bot{token}/{data['result']['file_path']}"
    try:
        with urllib.request.urlopen(url, timeout=90) as src, target.open("wb") as out:
            remaining = MAX_ZIP + 1
            while remaining:
                block = src.read(min(65536, remaining))
                if not block:
                    break
                out.write(block)
                remaining -= len(block)
    except urllib.error.HTTPError as exc:
        parsed = urllib.parse.urlparse(url)
        raise StepFailure("telegram.download", "GET", parsed.hostname or "", "/file/bot<redacted>/" + data["result"]["file_path"], f"HTTP {exc.code}") from None
    if target.stat().st_size > MAX_ZIP:
        raise ValueError("ZIP exceeds 19 MB")


def image_count_and_validate(packages: list[Path]) -> int:
    """Pillow decodes pixels, not just the WebP/PNG header."""
    count = 0
    for path in packages:
        with zipfile.ZipFile(path) as zf:
            if zf.testzip():
                raise ValueError(f"Corrupt ZIP member in {path.name}")
            for entry in zf.infolist():
                if not (entry.filename == "cover.webp" or entry.filename.startswith("images/")):
                    continue
                if entry.is_dir():
                    continue
                try:
                    with Image.open(BytesIO(zf.read(entry))) as image:
                        image.verify()
                    with Image.open(BytesIO(zf.read(entry))) as image:
                        image.load()  # fully decode; verify() alone checks headers
                except (UnidentifiedImageError, OSError, ValueError) as exc:
                    raise ValueError(f"Broken image {path.name}:{entry.filename}: {exc}") from exc
                if entry.filename.startswith("images/"):
                    count += 1
    return count


def restore(root: Path) -> tuple[Path, Path]:
    state = root / "state"
    build = root / "build"
    state.mkdir(); (build / "content").mkdir(parents=True)
    try:
        run("gh", "release", "download", "kafu-content-state", "--pattern", "content.sqlite",
            "--pattern", "site-bundle.tar.gz", "--dir", str(state),
            failure_context=("state.restore", "GET", "api.github.com", "/repos/<repo>/releases/tags/kafu-content-state/assets"))
    except RuntimeError:
        pass  # first publish: use the repository's starter catalog
    bundle = state / "site-bundle.tar.gz"
    if bundle.exists():
        # This archive is written by our own GitHub Action, not supplied by Telegram.
        run("tar", "-xzf", str(bundle), "-C", str(build))
    else:
        shutil.copytree(ROOT / "content-worker/dist/content", build / "content", dirs_exist_ok=True)
    return state, build / "content"


def candidate(root: Path, content: Path, expected_book: str | None = None) -> None:
    active = ROOT / "content-worker/dist/content"
    if active.exists():
        shutil.rmtree(active)
    shutil.copytree(content, active)
    # A unique tag identifies exactly the candidate we smoke-test.
    tag = "queue-" + os.environ.get("GITHUB_RUN_ID", "local") + "-" + str(int(time.time()))
    output = run("npx", "--yes", "wrangler@4", "versions", "upload", "--config",
                 "content-worker/wrangler.jsonc", "--tag", tag,
                 failure_context=("candidate.upload", "POST", "api.cloudflare.com", "/client/v4/accounts/<account>/workers/scripts/kafu-content-1/versions"))
    urls = re.findall(r"https://[a-zA-Z0-9.-]+\.workers\.dev", output)
    if not urls:
        raise RuntimeError("Wrangler did not report a Version URL; candidate not promoted")
    preview = urls[-1].rstrip("/")
    with urllib.request.urlopen(preview + "/catalog.json", timeout=30) as response:
        live = json.load(response)
    local = json.loads((content / "catalog.json").read_text())
    if live != local:
        raise RuntimeError("Version URL catalog does not match candidate")
    with urllib.request.urlopen(preview + "/config.json", timeout=30) as response:
        json.load(response)
    for book in local.get("books", []):
        if expected_book and book["id"] != expected_book:
            continue
        for chapter in book.get("chapters", []):
            path = urllib.parse.urlparse(chapter["url"]).path
            with urllib.request.urlopen(preview + path, timeout=30) as response:
                pack = json.load(response)
            if len(pack.get("questions", [])) != chapter["questions"]:
                raise RuntimeError(f"Candidate chapter mismatch: {path}")
            if chapter.get("image_url"):
                path = urllib.parse.urlparse(chapter["image_url"]).path
                with urllib.request.urlopen(preview + path, timeout=30) as response:
                    with zipfile.ZipFile(BytesIO(response.read())) as zf:
                        if zf.testzip():
                            raise RuntimeError(f"Candidate image ZIP corrupt: {path}")
    run("npx", "--yes", "wrangler@4", "versions", "deploy", "--config",
        "content-worker/wrangler.jsonc", "--version-tag", tag, "--percentage", "100", "--yes",
        failure_context=("candidate.promote", "POST", "api.cloudflare.com", "/client/v4/accounts/<account>/workers/scripts/kafu-content-1/deployments"))


def save_state(state: Path, content: Path) -> None:
    bundle = state / "site-bundle.tar.gz"
    with tarfile.open(bundle, "w:gz") as tf:
        tf.add(content, arcname="content")
    assets = [str(state / "content.sqlite"), str(bundle)]
    try:
        run("gh", "release", "view", "kafu-content-state",
            failure_context=("state.release_view", "GET", "api.github.com", "/repos/<repo>/releases/tags/kafu-content-state"))
        run("gh", "release", "upload", "kafu-content-state", *assets, "--clobber",
            failure_context=("state.release_upload", "POST", "uploads.github.com", "/repos/<repo>/releases/<id>/assets"))
    except StepFailure as exc:
        if "state.release_view" not in str(exc):
            raise
        run("gh", "release", "create", "kafu-content-state", *assets,
            "--title", "Kafu active content state", "--notes", "Current active state",
            failure_context=("state.release_create", "POST", "api.github.com", "/repos/<repo>/releases"))


def save_book_release(book_id: str, version: int, packages: list[Path]) -> None:
    tag = f"kafu-book-{book_id}-v{version}"
    try:
        run("gh", "release", "view", tag,
            failure_context=("book_release.view", "GET", "api.github.com", f"/repos/<repo>/releases/tags/{tag}"))
        run("gh", "release", "upload", tag, *map(str, packages), "--clobber",
            failure_context=("book_release.upload", "POST", "uploads.github.com", "/repos/<repo>/releases/<id>/assets"))
    except StepFailure as exc:
        if "book_release.view" not in str(exc):
            raise
        run("gh", "release", "create", tag, *map(str, packages),
            "--title", f"{book_id} v{version}", "--notes", "Validated owner package",
            failure_context=("book_release.create", "POST", "api.github.com", "/repos/<repo>/releases"))


def decisions_for(queue: Queue, book_id: str, root: Path) -> Path:
    path = root / "decisions.json"
    path.write_text(json.dumps(queue.call("decisions", {"book_id": book_id})))
    return path


def process_publish(item: dict, root: Path, queue: Queue) -> dict:
    group, parts = item["group"], item["parts"]
    if len(parts) != group["part_total"] or [p["part_index"] for p in parts] != list(range(1, group["part_total"] + 1)):
        raise ValueError("Incomplete multipart group")
    packages = []
    for part in parts:
        target = root / part["filename"]
        telegram_file(part["telegram_file_id"], target)
        if target.stat().st_size != part["file_size"]:
            raise ValueError(f"Telegram file size changed: {part['filename']}")
        packages.append(target)
    images = image_count_and_validate(packages)
    for path in packages:
        run("python", "tools/validate.py", "--require-audit", str(path))
    run("python", "tools/validate_release.py", *map(str, packages))
    state, content = restore(root)
    # An exact archive duplicate is a successful no-op. Multipart releases are checked per part.
    duplicates = [run("python", "tools/package_state.py", "check", "--db", str(state / "content.sqlite"),
                      "--package", str(path)).strip() == "yes" for path in packages]
    if all(duplicates) and not group.get("force_republish"):
        return {"duplicate": True, "book_id": group["book_id"], "version": group["version"],
                "questions": 0, "chapters": 0, "images": images, "skipped": 0, "held": 0}
    options = ["--decisions", str(decisions_for(queue, group["book_id"], root))]
    if group.get("force_republish"):
        options.append("--allow-version-reuse")
    output = run("python", "tools/publish.py", "--db", str(state / "content.sqlite"),
                 "--out", str(content), "--base-url", CONTENT_URL, *options, *map(str, packages))
    summary = json.loads(output[output.find("{"):])
    report = json.loads(Path(summary["report"]).read_text())
    for path in packages:
        run("python", "tools/package_state.py", "record", "--db", str(state / "content.sqlite"),
            "--package", str(path), "--book-id", group["book_id"], "--version", str(group["version"]))
    catalog = json.loads((content / "catalog.json").read_text())
    book = next(b for b in catalog["books"] if b["id"] == group["book_id"])
    candidate(root, content, group["book_id"])
    save_state(state, content)
    save_book_release(group["book_id"], group["version"], packages)
    queue.call("flags", {"held_details": report.get("held_details", [])})
    return {"book_id": group["book_id"], "version": group["version"],
            "questions": summary["visible_questions"], "chapters": len(book["chapters"]),
            "images": images, "skipped": len(report.get("skipped", [])), "held": summary["held"]}


def process_admin(item: dict, root: Path, queue: Queue) -> dict:
    job = item["job"]
    state, content = restore(root)
    if job["kind"] == "remove":
        run("python", "tools/queue_admin.py", "remove", "--root", str(content),
            "--db", str(state / "content.sqlite"), "--book-id", job["book_id"])
    elif job["kind"] in {"rollback", "moderate"}:
        version = job["version"]
        if job["kind"] == "moderate":
            catalog = json.loads((content / "catalog.json").read_text())
            book = next((b for b in catalog["books"] if b["id"] == job["book_id"]), None)
            if not book: raise ValueError("Book is not active")
            version = book["version"]
        tag = f"kafu-book-{job['book_id']}-v{version}"
        packages_dir = root / "packages"; packages_dir.mkdir()
        run("gh", "release", "download", tag, "--pattern", "*.zip", "--dir", str(packages_dir),
            failure_context=("admin.release_download", "GET", "api.github.com", f"/repos/<repo>/releases/tags/{tag}/assets"))
        packages = sorted(packages_dir.glob("*.zip"))
        if not packages:
            raise ValueError(f"No historical ZIPs for {tag}")
        image_count_and_validate(packages)
        run("python", "tools/validate.py", "--require-audit", *map(str, packages))
        run("python", "tools/validate_release.py", *map(str, packages))
        run("python", "tools/publish.py", "--db", str(state / "content.sqlite"), "--out", str(content),
            "--base-url", CONTENT_URL, "--allow-version-reuse", "--decisions",
            str(decisions_for(queue, job["book_id"], root)), *map(str, packages))
    else:
        raise ValueError("Unsupported admin operation")
    candidate(root, content, None)
    save_state(state, content)
    return {"book_id": job["book_id"], "version": job["version"]}


def send_report(path: Path) -> None:
    token = os.environ["BOT_TOKEN"]
    boundary = "kafu-report-boundary"
    data = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{os.environ['OWNER_TELEGRAM_ID']}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"repair_report.md\"\r\n"
            "Content-Type: text/markdown\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendDocument", data=data,
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=30) as response:
        if not json.load(response).get("ok"):
            raise RuntimeError("Could not attach repair report")


def main() -> None:
    queue = Queue()
    processed = 0
    while processed < 100:
        item = queue.call("claim")
        if item["kind"] == "empty":
            return
        processed += 1
        with tempfile.TemporaryDirectory(prefix="kafu-queue-") as td:
            root = Path(td)
            try:
                if item["kind"] == "publish":
                    result = process_publish(item, root, queue)
                    queue.call("finish", {"kind": "publish", "group_key": item["group"]["group_key"],
                                          "ok": True, **result})
                    queue.notify("✅ " + item["group"]["group_key"] +
                                 (" already published (same ZIP)." if result.get("duplicate") else
                                  f" published: {result['questions']} questions, {result['chapters']} chapters, "
                                  f"{result['images']} images, {result['skipped']} skipped, {result['held']} held."))
                else:
                    result = process_admin(item, root, queue)
                    queue.call("finish", {"kind": "admin", "id": item["job"]["id"], "ok": True,
                                          "operation": item["job"]["kind"], **result})
                    queue.notify(f"✅ {item['job']['kind']} {item['job']['book_id']} complete.")
            except Exception as exc:
                title = item["group"]["group_key"] if item["kind"] == "publish" else item["job"]["book_id"]
                report = root / "repair_report.md"
                report.write_text(f"# Kafu repair report\n\nJob: {title}\n\n❌ {type(exc).__name__}: {exc}\n")
                safe_error = str(exc) if isinstance(exc, StepFailure) else f"step=processing method=LOCAL host=- path=- — {type(exc).__name__}: {str(exc)[:240]}"
                payload = {"kind": item["kind"], "ok": False, "error": safe_error[:400]}
                payload.update({"group_key": title} if item["kind"] == "publish" else {"id": item["job"]["id"]})
                queue.call("finish", payload)
                queue.notify(f"❌ {title} failed. repair_report.md is attached.")
                send_report(report)
    raise RuntimeError("Queue drain limit reached; scheduled run will continue")


if __name__ == "__main__":
    main()
