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
import urllib.parse
import zipfile
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

try:
    from tools import comments as comments_tool
    from tools.http_client import HttpStepError, download, request_bytes, request_json
except ModuleNotFoundError:
    import comments as comments_tool
    from http_client import HttpStepError, download, request_bytes, request_json

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
        return request_json(
            self.url + "/internal/" + path,
            step=f"queue.{path}",
            method="POST",
            payload=data or {},
            headers=self.headers,
        )

    def notify(self, text: str) -> None:
        self.call("notify", {"text": text[:3500]})


def telegram_file(file_id: str, target: Path, max_bytes: int = MAX_ZIP) -> None:
    token = os.environ["BOT_TOKEN"]
    data = request_json(
        f"https://api.telegram.org/bot{token}/getFile",
        step="telegram.getFile",
        method="POST",
        payload={"file_id": file_id},
    )
    if not data.get("ok") or not data.get("result", {}).get("file_path"):
        raise ValueError("Telegram getFile failed")
    url = f"https://api.telegram.org/file/bot{token}/{data['result']['file_path']}"
    download(url, target, step="telegram.download", timeout=90, max_bytes=max_bytes)


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


def sanitize_audit_mismatches(path: Path) -> list[dict]:
    """Skip only audit-mismatch questions while keeping validate.py unchanged."""
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        if "audit.json" not in names or "questions.jsonl" not in names or "book.json" not in names:
            return []
        audit = json.loads(zf.read("audit.json").decode("utf-8"))
        mismatches = {
            int(row["local_id"]): row
            for row in (audit.get("results") or [])
            if isinstance(row, dict) and isinstance(row.get("local_id"), int) and row.get("level") == "mismatch"
        }
        if not mismatches:
            return []
        rows = [json.loads(line) for line in zf.read("questions.jsonl").decode("utf-8").splitlines() if line.strip()]
        removed = [q for q in rows if int(q.get("local_id", -1)) in mismatches]
        if not removed:
            return []
        kept = [q for q in rows if int(q.get("local_id", -1)) not in mismatches]
        removed_images = set()
        for q in removed:
            for field in ("images", "explanation_images"):
                for name in q.get(field) or []:
                    removed_images.add(name if str(name).startswith("images/") else f"images/{name}")
        book = json.loads(zf.read("book.json").decode("utf-8"))
        skipped = list(book.get("skipped") or [])
        present_skipped = {int(x["local_id"]) for x in skipped if isinstance(x, dict) and isinstance(x.get("local_id"), int)}
        details = []
        for q in removed:
            lid = int(q["local_id"])
            row = mismatches[lid]
            detail = str(row.get("detail") or "audit mismatch")
            if lid not in present_skipped:
                skipped.append({"local_id": lid, "reason": f"server skipped: audit mismatch — {detail}"})
            details.append({
                "local_id": lid,
                "source_number": str(q.get("source_number", "")),
                "source_page": q.get("source_page"),
                "reason": detail,
            })
        skipped.sort(key=lambda x: int(x.get("local_id", 0)))
        book["skipped"] = skipped
        q_raw = "".join(json.dumps(q, ensure_ascii=False, separators=(",", ":")) + "\n" for q in kept).encode("utf-8")
        audit["results"] = [
            row for row in (audit.get("results") or [])
            if not (isinstance(row, dict) and row.get("local_id") in mismatches)
        ]
        audit["questions_sha256"] = hashlib.sha256(q_raw).hexdigest()
        audit["mismatch_count"] = sum(1 for row in audit["results"] if isinstance(row, dict) and row.get("level") == "mismatch")
        report = zf.read("report.md").decode("utf-8") if "report.md" in names else ""
        report += "\n\n## Server mismatch skips\n" + "".join(
            f"- local_id {x['local_id']} (source {x['source_number'] or '?'}, page {x['source_page'] or '?'}): {x['reason']}\n"
            for x in details
        )
        replacements = {
            "book.json": (json.dumps(book, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
            "questions.jsonl": q_raw,
            "audit.json": (json.dumps(audit, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
            "report.md": report.encode("utf-8"),
        }
        copied = {
            info.filename: zf.read(info.filename)
            for info in zf.infolist()
            if not info.is_dir() and info.filename not in replacements and info.filename not in removed_images
        }
    temp = path.with_suffix(path.suffix + ".sanitized")
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED) as out:
        for name, data in {**copied, **replacements}.items():
            out.writestr(name, data)
    temp.replace(path)
    return details


def declared_skipped_count(packages: list[Path]) -> int:
    ids: set[int] = set()
    for path in packages:
        with zipfile.ZipFile(path) as zf:
            book = json.loads(zf.read("book.json").decode("utf-8"))
            ids.update(
                int(item["local_id"])
                for item in (book.get("skipped") or [])
                if isinstance(item, dict) and isinstance(item.get("local_id"), int)
            )
    return len(ids)


def restore(root: Path) -> tuple[Path, Path]:
    state = root / "state"
    build = root / "build"
    state.mkdir(); (build / "content").mkdir(parents=True)
    try:
        run("gh", "release", "download", "kafu-content-state", "--pattern", "content.sqlite",
            "--pattern", "site-bundle.tar.gz", "--dir", str(state),
            failure_context=("state.restore", "GET", "api.github.com", "/repos/<repo>/releases/tags/kafu-content-state/assets"))
    except StepFailure as exc:
        message = str(exc).lower()
        if "release not found" not in message and "http 404" not in message and "status=404" not in message:
            raise
        # First publish: use the repository's starter catalog.
    bundle = state / "site-bundle.tar.gz"
    if bundle.exists():
        # This archive is written by our own GitHub Action, not supplied by Telegram.
        run("tar", "-xzf", str(bundle), "-C", str(build))
    else:
        shutil.copytree(ROOT / "content-worker/dist/content", build / "content", dirs_exist_ok=True)
    return state, build / "content"


def verify_comments(preview: str, content: Path, book_id: str) -> None:
    """The candidate serves exactly the comment index and shards just built (or none after a clear)."""
    path = content / "comments" / f"{book_id}.json"
    url = f"{preview}/comments/{book_id}.json"
    if not path.exists():
        try:
            request_bytes(url, step="candidate.comments")
        except HttpStepError as exc:
            if exc.status == 404:
                return
            raise
        raise RuntimeError(f"Candidate still serves comments for {book_id}")
    local = json.loads(path.read_text(encoding="utf-8"))
    if request_json(url, step="candidate.comments") != local:
        raise RuntimeError("Candidate comments index does not match")
    for entry in local["shards"].values():
        raw = request_bytes(preview + entry["url"], step="candidate.comments")
        if hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise RuntimeError(f"Candidate comments shard mismatch: {entry['url']}")


def candidate(root: Path, content: Path, expected_book: str | None = None, comments_book: str | None = None) -> None:
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
    live = request_json(preview + "/catalog.json", step="candidate.catalog")
    local = json.loads((content / "catalog.json").read_text())
    if live != local:
        raise RuntimeError("Version URL catalog does not match candidate")
    request_json(preview + "/config.json", step="candidate.config")
    for book in local.get("books", []):
        if expected_book and book["id"] != expected_book:
            continue
        for chapter in book.get("chapters", []):
            path = urllib.parse.urlparse(chapter["url"]).path
            pack = request_json(preview + path, step="candidate.chapter")
            if len(pack.get("questions", [])) != chapter["questions"]:
                raise RuntimeError(f"Candidate chapter mismatch: {path}")
            if chapter.get("image_url"):
                path = urllib.parse.urlparse(chapter["image_url"]).path
                raw = request_bytes(preview + path, step="candidate.images")
                with zipfile.ZipFile(BytesIO(raw)) as zf:
                    if zf.testzip():
                        raise RuntimeError(f"Candidate image ZIP corrupt: {path}")
    if comments_book:
        verify_comments(preview, content, comments_book)
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
        message = str(exc).lower()
        if "state.release_view" not in message or (
            "release not found" not in message and "http 404" not in message and "status=404" not in message
        ):
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
        message = str(exc).lower()
        if "book_release.view" not in message or (
            "release not found" not in message and "http 404" not in message and "status=404" not in message
        ):
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
    mismatch_skips = []
    for path in packages:
        mismatch_skips.extend(sanitize_audit_mismatches(path))
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
                "questions": 0, "chapters": 0, "images": images, "skipped": 0, "held": 0,
                "warnings": 0, "mismatch_skips": []}
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
    queue.call("warnings", {"book_id": group["book_id"], "version": group["version"],
                             "warnings": report.get("warnings", [])})
    return {"book_id": group["book_id"], "version": group["version"],
            "questions": summary["visible_questions"], "chapters": len(book["chapters"]),
            "images": images, "skipped": declared_skipped_count(packages), "held": summary["held"],
            "warnings": len(report.get("warnings", [])), "mismatch_skips": mismatch_skips}


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


def comments_title(job: dict) -> str:
    return f"comments-off {job['book_id']}" if job["action"] == "clear" else f"COMMENTS_{job['book_id']}_r{job['revision']}"


def process_comments(item: dict, root: Path, queue: Queue) -> dict:
    """Publish a comment pack (or take a book's comments away), then smoke-test and promote the content."""
    job = item["job"]
    state, content = restore(root)
    db = state / "content.sqlite"
    if job["action"] == "publish":
        target = root / f"COMMENTS_{job['book_id']}_r{job['revision']}.zip"
        telegram_file(job["telegram_file_id"], target, max_bytes=comments_tool.MAX_ZIP)
        if target.stat().st_size != job["file_size"]:
            raise ValueError(f"Telegram file size changed: {job['filename']}")
        result = comments_tool.publish(db, content, target)
    elif job["action"] == "clear":
        result = comments_tool.clear(db, content, job["book_id"])
    else:
        raise ValueError("Unsupported comments operation")
    counts = {key: result.get(key, 0) for key in ("questions", "cleared", "comments", "book_questions", "book_comments")}
    summary = {"action": job["action"], "book_id": job["book_id"], "revision": job["revision"], **counts}
    if result.get("duplicate"):
        return {**summary, "duplicate": True}
    candidate(root, content, job["book_id"], comments_book=job["book_id"])
    save_state(state, content)
    return summary


def comments_notice(job: dict, result: dict) -> str:
    title = comments_title(job)
    if result.get("duplicate"):
        return f"✅ {title} already published (same ZIP)."
    if job["action"] == "clear":
        return f"🧹 Comments are off for {job['book_id']}."
    cleared = f" ({result['cleared']} questions cleared)" if result.get("cleared") else ""
    return (f"✅ {title} published: {result['comments']} comments on {result['questions']} questions{cleared}. "
            f"{job['book_id']} now has {result['book_comments']} comments on {result['book_questions']} questions.")


def send_report(path: Path) -> None:
    token = os.environ["BOT_TOKEN"]
    boundary = "kafu-report-boundary"
    data = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n{os.environ['OWNER_TELEGRAM_ID']}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"repair_report.md\"\r\n"
            "Content-Type: text/markdown\r\n\r\n").encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    answer = request_json(
        f"https://api.telegram.org/bot{token}/sendDocument",
        step="telegram.sendReport",
        method="POST",
        data=data,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    if not answer.get("ok"):
        raise RuntimeError("Could not attach repair report")


def main() -> None:
    queue = Queue()
    processed = 0
    failed = 0
    exhausted = False
    while processed < 100:
        item = queue.call("claim")
        if item["kind"] == "empty":
            exhausted = True
            break
        processed += 1
        with tempfile.TemporaryDirectory(prefix="kafu-queue-") as td:
            root = Path(td)
            try:
                if item["kind"] == "publish":
                    result = process_publish(item, root, queue)
                    queue.call("finish", {"kind": "publish", "group_key": item["group"]["group_key"],
                                          "ok": True, **result})
                    if result.get("duplicate"):
                        queue.notify("✅ " + item["group"]["group_key"] + " already published (same ZIP).")
                    else:
                        skipped_lines = ""
                        if result.get("mismatch_skips"):
                            shown = result["mismatch_skips"][:20]
                            skipped_lines = "\nSkipped audit mismatches: " + ", ".join(
                                f"L{x['local_id']} (page {x['source_page'] or '?'})" for x in shown
                            )
                            if len(result["mismatch_skips"]) > len(shown):
                                skipped_lines += f" +{len(result['mismatch_skips']) - len(shown)} more"
                        queue.notify(
                            "✅ " + item["group"]["group_key"] +
                            f" published: {result['questions']} questions, {result.get('warnings', 0)} with warnings, "
                            f"{result['skipped']} skipped." + skipped_lines
                        )
                elif item["kind"] == "comments":
                    result = process_comments(item, root, queue)
                    queue.call("finish", {"kind": "comments", "id": item["job"]["id"], "ok": True,
                                          **{k: v for k, v in result.items() if k not in {"cleared", "duplicate"}}})
                    queue.notify(comments_notice(item["job"], result))
                else:
                    result = process_admin(item, root, queue)
                    queue.call("finish", {"kind": "admin", "id": item["job"]["id"], "ok": True,
                                          "operation": item["job"]["kind"], **result})
                    queue.notify(f"✅ {item['job']['kind']} {item['job']['book_id']} complete.")
            except Exception as exc:
                failed += 1
                title = (item["group"]["group_key"] if item["kind"] == "publish"
                         else comments_title(item["job"]) if item["kind"] == "comments" else item["job"]["book_id"])
                report = root / "repair_report.md"
                if isinstance(exc, comments_tool.PackError):
                    problems = "".join(f"- {line}\n" for line in exc.problems)
                    report.write_text(f"# Kafu repair report\n\nJob: {title}\n\n❌ The comment pack was not published:\n\n{problems}")
                else:
                    report.write_text(f"# Kafu repair report\n\nJob: {title}\n\n❌ {type(exc).__name__}: {exc}\n")
                safe_error = (str(exc) if isinstance(exc, (StepFailure, HttpStepError, comments_tool.PackError))
                              else f"step=processing method=LOCAL host=- path=- — {type(exc).__name__}: {str(exc)[:240]}")
                payload = {"kind": item["kind"], "ok": False, "error": safe_error[:400]}
                payload.update({"group_key": title} if item["kind"] == "publish" else {"id": item["job"]["id"]})
                queue.call("finish", payload)
                queue.notify(f"❌ {title} failed. repair_report.md is attached.")
                send_report(report)
    if failed:
        raise RuntimeError(f"{failed} queue job(s) failed")
    if not exhausted:
        raise RuntimeError("Queue drain limit reached; scheduled run will continue")


if __name__ == "__main__":
    main()
