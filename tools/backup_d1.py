"""Private, bounded D1 export backup; never prints SQL, rows or credentials.

Uses only the automatic workflow GITHUB_TOKEN for GitHub release operations.
No bot, queue mutation, Worker deploy, schema migration or production restore.
"""
from __future__ import annotations
import gzip
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
try:
    from tools.http_client import HttpStepError, request_bytes, request_json
except ModuleNotFoundError:
    from http_client import HttpStepError, request_bytes, request_json

ROOT=Path(__file__).resolve().parents[1]
TAG="d1-backups"
MAX_SQL=64*1024*1024
KEEP=4
NAME=re.compile(r"^(kafu-d1-\d{8}T\d{6}Z-\d+)(\.sql\.gz|\.json)$")
REQUIRED={"publish_groups","publish_queue","admin_jobs","published_books","flags"}


def validate_sql(raw: bytes) -> None:
    if not raw or len(raw)>MAX_SQL: raise ValueError("D1 export is empty or exceeds the 64 MiB safety limit")
    try: text=raw.decode("utf-8-sig")
    except UnicodeError: raise ValueError("D1 export is not UTF-8 SQL") from None
    db=sqlite3.connect(":memory:")
    try:
        db.set_authorizer(lambda action,*args: sqlite3.SQLITE_DENY if action in {sqlite3.SQLITE_ATTACH,sqlite3.SQLITE_DETACH} else sqlite3.SQLITE_OK)
        db.executescript(text)
        names={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not REQUIRED.issubset(names): raise ValueError("D1 export is missing required Kafu tables")
        if db.execute("PRAGMA integrity_check").fetchone()[0]!="ok": raise ValueError("D1 export failed local integrity verification")
    except sqlite3.Error:
        # SQL error messages may contain data; report only the validation phase.
        raise ValueError("D1 export failed local SQL restore verification") from None
    finally: db.close()


def bundle(raw: bytes, name: str, created: str, commit: str) -> tuple[bytes,bytes]:
    validate_sql(raw)
    compressed=gzip.compress(raw,compresslevel=9,mtime=0)
    metadata={"schema":1,"database":"kafu-db","created_at":created,"commit":commit,
              "archive":name+".sql.gz","sql_bytes":len(raw),"archive_bytes":len(compressed),
              "sql_sha256":hashlib.sha256(raw).hexdigest(),"archive_sha256":hashlib.sha256(compressed).hexdigest()}
    return compressed,(json.dumps(metadata,indent=2)+"\n").encode()


class ReleaseStore:
    def __init__(self, repository: str, token: str):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",repository): raise ValueError("Invalid repository identity")
        if not token.strip(): raise ValueError("Automatic GITHUB_TOKEN is required; do not substitute a dispatch token")
        self.repository=repository
        self.base="https://api.github.com/repos/"+repository
        self.headers={"Authorization":"Bearer "+token.strip(),"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}
        self.release_id=None

    def require_private(self):
        repo=request_json(self.base,step="backup.repository",headers=self.headers)
        if repo.get("private") is not True: raise ValueError("D1 backup is refused unless the target repository is private")

    def ensure_release(self):
        try: release=request_json(self.base+"/releases/tags/"+TAG,step="backup.release.lookup",headers=self.headers)
        except HttpStepError as exc:
            if exc.status!=404: raise
            release=request_json(self.base+"/releases",step="backup.release.create",method="POST",headers=self.headers,
                payload={"tag_name":TAG,"name":"Private Kafu D1 backups","body":"Verified compressed D1 SQL exports. Private operational data; retain the newest four complete snapshots.","draft":False,"prerelease":False,"make_latest":"false"})
        if not isinstance(release.get("id"),int) or release.get("tag_name")!=TAG: raise ValueError("Unexpected backup release identity")
        self.release_id=release["id"]

    def assets(self):
        if self.release_id is None: raise ValueError("Backup release is not selected")
        all_assets=[]
        for page in range(1,11):
            items=request_json(self.base+f"/releases/{self.release_id}/assets?per_page=100&page={page}",step="backup.assets.list",headers=self.headers)
            if not isinstance(items,list): raise ValueError("Invalid release asset response")
            all_assets.extend(items)
            if len(items)<100:return all_assets
        raise ValueError("Backup asset list exceeds the safe pagination limit; no retention deletion performed")

    def upload_verified(self, name: str, raw: bytes):
        if not NAME.fullmatch(name): raise ValueError("Unexpected backup asset name")
        if self.release_id is None: raise ValueError("Backup release is not selected")
        url=f"https://uploads.github.com/repos/{self.repository}/releases/{self.release_id}/assets?name={name}"
        uploaded=request_json(url,step="backup.asset.upload",method="POST",data=raw,
            headers={**self.headers,"Content-Type":"application/gzip" if name.endswith(".gz") else "application/json"},timeout=90)
        asset_id=uploaded.get("id")
        if not isinstance(asset_id,int) or uploaded.get("name")!=name or uploaded.get("size")!=len(raw):
            raise ValueError("Uploaded backup metadata did not match; prior backups are retained")
        downloaded=request_bytes(self.base+f"/releases/assets/{asset_id}",step="backup.asset.verify",headers={**self.headers,"Accept":"application/octet-stream"},timeout=90,max_bytes=MAX_SQL+65536)
        if hashlib.sha256(downloaded).digest()!=hashlib.sha256(raw).digest():
            raise ValueError("Uploaded backup checksum mismatch; prior backups are retained")
        return uploaded

    def delete_asset(self, asset_id: int):
        if not isinstance(asset_id,int): raise ValueError("Invalid backup asset identity")
        request_bytes(self.base+f"/releases/assets/{asset_id}",step="backup.asset.retention",method="DELETE",headers=self.headers)


def retention_candidates(assets: list[dict], newest: str, keep: int=KEEP) -> list[int]:
    if keep<1 or not NAME.fullmatch(newest+".json"): raise ValueError("Invalid retention policy")
    groups={}
    for item in assets:
        match=NAME.fullmatch(str(item.get("name","")))
        if match and isinstance(item.get("id"),int): groups.setdefault(match[1],{})[match[2]]=item["id"]
    complete=sorted([key for key,value in groups.items() if set(value)=={".sql.gz",".json"}],reverse=True)
    # Never prune until the just-uploaded complete pair is visible in the listing.
    if newest not in complete: raise ValueError("New backup pair is not visible; retention skipped")
    retain={newest,*[key for key in complete if key!=newest][:keep-1]}
    return [asset for key in complete if key not in retain for asset in groups[key].values()]


def export_sql(target: Path):
    commands=[
        ["python","tools/configure_d1.py"],
        ["npx","--yes","wrangler@4.142.0","d1","export","kafu-db","--remote","--config","wrangler.app.jsonc","--output",str(target)],
    ]
    for command in commands:
        try:
            result=subprocess.run(command,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=240,check=False)
        except (OSError,subprocess.TimeoutExpired): raise RuntimeError("D1 export tool did not complete; no SQL or credentials were logged") from None
        if result.returncode: raise RuntimeError("D1 export failed; verify existing account/D1 export permission privately (tool output withheld)")
    if not target.is_file() or target.stat().st_size>MAX_SQL: raise ValueError("D1 export is missing or too large")


def backup(store, exporter=export_sql, now=None, run_id=None, commit=None):
    # Check privacy before reading D1 or creating a release.
    store.require_private()
    now=now or datetime.now(timezone.utc)
    run_id=str(run_id or os.environ.get("GITHUB_RUN_ID",""))
    commit=commit or os.environ.get("GITHUB_SHA","")
    if not run_id.isdigit() or not re.fullmatch(r"[a-f0-9]{40}",commit): raise ValueError("A valid workflow run and commit are required")
    name="kafu-d1-"+now.strftime("%Y%m%dT%H%M%SZ")+"-"+run_id
    with tempfile.TemporaryDirectory(prefix="kafu-d1-private-") as td:
        target=Path(td)/"export.sql";exporter(target)
        raw=target.read_bytes();compressed,manifest=bundle(raw,name,now.isoformat(),commit)
        store.ensure_release()
        store.upload_verified(name+".sql.gz",compressed)
        store.upload_verified(name+".json",manifest)
        remove=retention_candidates(store.assets(),name)
        for asset_id in remove:store.delete_asset(asset_id)
        print("D1 backup verified:",name,"SQL bytes",len(raw),"compressed bytes",len(compressed),"old assets pruned",len(remove))
        return json.loads(manifest)


def main():
    store=ReleaseStore(os.environ.get("GITHUB_REPOSITORY",""),os.environ.get("GITHUB_TOKEN",""))
    backup(store)

if __name__=="__main__":main()
