"""Scan tracked source without ever printing matched credentials."""
from __future__ import annotations
import ast
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "credential-format": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|cfut_[A-Za-z0-9_-]{20,}|\b\d{6,12}:[A-Za-z0-9_-]{30,})"),
    "literal-secret": re.compile(r"(?:BOT_TOKEN|QUEUE_API_TOKEN|WEBHOOK_SECRET|DISPATCH_TOKEN|CLOUDFLARE_API_TOKEN)\s*[:=]\s*[\"'][A-Za-z0-9_-]{30,}[\"']"),
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}


def scan_text(path: str, text: str) -> list[tuple[str, int, str]]:
    findings = []
    for kind, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            findings.append((path, text.count("\n", 0, match.start()) + 1, kind))
    if path.endswith(".py"):
        try:
            tree = ast.parse(text)
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or node.func.id != "print":
                    continue
                for arg in node.args:
                    if isinstance(arg, ast.Attribute) and ast.unparse(arg) == "os.environ":
                        findings.append((path, node.lineno, "environment-print"))
                    if isinstance(arg, ast.Subscript) and ast.unparse(arg.value) == "os.environ":
                        key = arg.slice.value if isinstance(arg.slice, ast.Constant) else ""
                        if not key or re.search(r"TOKEN|SECRET|PASSWORD|KEY", str(key), re.I):
                            findings.append((path, node.lineno, "environment-print"))
        except SyntaxError:
            pass  # the regular compile gate reports syntax errors
    if path.endswith((".yml", ".yaml", ".sh")) and ("workflows/" in path or path.endswith(".sh")):
        for number, line in enumerate(text.splitlines(), 1):
            if re.search(r"^\s*(?:run:\s*)?(?:set\s+-[a-z]*x|printenv(?:\s|$)|env\s*$)", line):
                findings.append((path, number, "unsafe-shell-logging"))
            if re.search(r"\becho\s+[\"']?\$(?:\{)?(?:BOT_TOKEN|QUEUE_API_TOKEN|WEBHOOK_SECRET|DISPATCH_TOKEN|CLOUDFLARE_API_TOKEN)", line):
                findings.append((path, number, "secret-echo"))
    return sorted(set(findings))


def scan_repository(root: Path = ROOT):
    paths = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
    findings = []
    for relative in filter(None, paths):
        path = root / relative
        if not path.is_file():
            continue
        raw = path.read_bytes()
        if b"\0" in raw or len(raw) > 2_000_000:
            continue
        findings.extend(scan_text(relative, raw.decode("utf-8", errors="replace")))
    return findings


if __name__ == "__main__":
    found = scan_repository()
    for path, line, kind in found:
        print(f"{path}:{line}: {kind}; value withheld")
    print(f"Tracked-source security check: {len(found)} finding(s)")
    raise SystemExit(bool(found))
