"""Deterministic PDF layout parsers used by package_batch.py."""

from importlib import import_module
import re

_NAME = re.compile(r"^[a-z][a-z0-9_]*$")

def load_parser(name: str):
    if not _NAME.fullmatch(name or ""):
        raise ValueError("Invalid parser name")
    module = import_module(f"tools.parsers.{name}")
    fn = getattr(module, "parse_pdf", None)
    if not callable(fn):
        raise ValueError(f"Parser {name!r} does not export parse_pdf(pdf_path)")
    return fn
