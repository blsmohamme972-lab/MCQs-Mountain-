"""One HTTP path for Kafu publisher network calls.

All requests use a stable non-default User-Agent and failures expose only
safe request metadata plus a bounded response-body preview.
"""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

USER_AGENT = "kafu-drain/1.0"


def _safe_path(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path or "/"
    path = re.sub(r"/bot[^/]+/", "/bot<redacted>/", path)
    path = re.sub(r"/file/bot[^/]+/", "/file/bot<redacted>/", path)
    return parsed.hostname or "", path


class HttpStepError(RuntimeError):
    def __init__(self, step: str, method: str, url: str, status: str | int, body: str = "") -> None:
        host, path = _safe_path(url)
        summary = f"step={step} method={method} host={host} path={path} status={status}"
        if body:
            summary += f" — body={body[:200]!r}"
        super().__init__(summary)


def request_bytes(
    url: str,
    *,
    step: str,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
) -> bytes:
    method = method.upper()
    merged = dict(headers or {})
    merged["User-Agent"] = USER_AGENT
    req = urllib.request.Request(url, data=data, headers=merged, method=method)
    host, path = _safe_path(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read()
            print(f"[http] step={step} method={method} host={host} path={path} status={response.status}")
            return body
    except urllib.error.HTTPError as exc:
        body = exc.read(200).decode("utf-8", errors="replace")
        print(
            f"[http] step={step} method={method} host={host} path={path} "
            f"status={exc.code} body={body[:200]!r}"
        )
        raise HttpStepError(step, method, url, exc.code, body) from None
    except urllib.error.URLError as exc:
        detail = str(exc.reason)[:200]
        print(
            f"[http] step={step} method={method} host={host} path={path} "
            f"status=network_error body={detail!r}"
        )
        raise HttpStepError(step, method, url, "network_error", detail) from None


def request_json(
    url: str,
    *,
    step: str,
    method: str = "GET",
    payload: Any | None = None,
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
) -> Any:
    merged = dict(headers or {})
    if payload is not None:
        data = json.dumps(payload).encode()
        merged.setdefault("Content-Type", "application/json")
    raw = request_bytes(
        url, step=step, method=method, data=data, headers=merged, timeout=timeout
    )
    return json.loads(raw)


def download(
    url: str,
    target: Path,
    *,
    step: str,
    headers: dict[str, str] | None = None,
    timeout: int = 90,
    max_bytes: int | None = None,
) -> int:
    raw = request_bytes(url, step=step, headers=headers, timeout=timeout)
    if max_bytes is not None and len(raw) > max_bytes:
        raise ValueError(f"download exceeds {max_bytes} bytes")
    target.write_bytes(raw)
    return len(raw)
