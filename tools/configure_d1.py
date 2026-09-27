#!/usr/bin/env python3
"""Add the owner-provisioned D1 binding to the temporary CI Wrangler config."""
import json
import os
import re
from pathlib import Path

path = Path("wrangler.app.jsonc")
raw = path.read_text()
# The project config is JSONC but currently contains no comments outside strings.
config = json.loads(raw)
database_id = os.environ.get("D1_DATABASE_ID", "")
if not re.fullmatch(r"[0-9a-fA-F-]{36}", database_id):
    raise SystemExit("D1_DATABASE_ID GitHub Actions secret must be a D1 UUID")
config["d1_databases"] = [{"binding": "DB", "database_name": "kafu-db",
                           "database_id": database_id, "migrations_dir": "migrations"}]
path.write_text(json.dumps(config, indent=2) + "\n")
