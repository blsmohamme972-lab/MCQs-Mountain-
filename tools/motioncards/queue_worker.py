#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,os,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from tools.http_client import request_json,download
from tools.motioncards.publish import apply_packages
from motioncards.lib.multipart import validate_package_part,combine_parts
from motioncards.lib.spec import parse_package_filename

MAX_ZIP=19*1024*1024

class Queue:
    def __init__(self):
        self.base=os.environ["QUEUE_API_URL"].rstrip("/")+"/internal/motioncards/"
        token=os.environ["QUEUE_API_TOKEN"].strip()
        self.headers={"Authorization":"Bearer "+token}
    def call(self,path,payload=None):
        return request_json(self.base+path,step="motioncards.queue."+path,method="POST",payload=payload or {},headers=self.headers)
    def notify(self,text):
        return self.call("notify",{"text":str(text)[:3500]})

def telegram_file(file_id,target):
    token=os.environ["BOT_TOKEN"]
    data=request_json("https://api.telegram.org/bot"+token+"/getFile",step="motioncards.telegram.getFile",method="POST",payload={"file_id":file_id})
    fp=data.get("result",{}).get("file_path") if data.get("ok") else None
    if not fp:raise ValueError("telegram_get_file_failed")
    download("https://api.telegram.org/file/bot"+token+"/"+fp,target,step="motioncards.telegram.download",timeout=90,max_bytes=MAX_ZIP)

def tree_sha(site:Path)->str:
    h=hashlib.sha256()
    for p in sorted(x for x in site.rglob("*") if x.is_file()):
        h.update(p.relative_to(site).as_posix().encode()+b"\0");h.update(hashlib.sha256(p.read_bytes()).digest())
    return h.hexdigest()

def validate_downloaded_identity(group:dict,parts:list[dict],packages:list[Path]):
    total=int(group["part_total"]);package_id=str(group["package_id"]);revision=int(group["revision"])
    if len(parts)!=total or len(packages)!=total:raise ValueError("incomplete_motioncards_group")
    expected=list(range(1,total+1))
    if [int(p["part_index"]) for p in parts]!=expected:raise ValueError("motioncards_part_sequence_invalid")
    manifests=[]
    for row,path in zip(parts,packages):
        if path.stat().st_size!=int(row["file_size"]):raise ValueError("motioncards_download_size_mismatch")
        parsed=parse_package_filename(str(row["filename"]))
        if not parsed:raise ValueError("motioncards_filename_identity_invalid")
        if parsed["group_key"]!=group["group_key"] or parsed["package_id"]!=package_id or parsed["package_revision"]!=revision:
            raise ValueError("motioncards_filename_group_mismatch")
        if parsed["part"]!=int(row["part_index"]) or parsed["total"]!=total or int(row["part_total"])!=total:
            raise ValueError("motioncards_filename_part_mismatch")
        manifest=validate_package_part(path)
        if manifest["package_id"]!=package_id or int(manifest["package_revision"])!=revision:
            raise ValueError("motioncards_manifest_group_mismatch")
        mp=manifest.get("multipart")
        if total==1:
            if mp is not None:raise ValueError("motioncards_single_filename_cannot_publish_multipart")
        else:
            if not isinstance(mp,dict):raise ValueError("motioncards_multipart_manifest_required")
            if int(mp["part_index"])!=parsed["part"] or int(mp["total_parts"])!=total:
                raise ValueError("motioncards_manifest_part_mismatch")
        manifests.append(manifest)
    combined,_,_=combine_parts(packages)
    if combined["package_id"]!=package_id or int(combined["package_revision"])!=revision:
        raise ValueError("motioncards_combined_identity_mismatch")
    queued=sum(int(p["file_size"]) for p in parts);actual=sum(p.stat().st_size for p in packages)
    if queued!=actual:raise ValueError("motioncards_batch_size_mismatch")
    return combined

def _affected_samples(result:dict):
    rows=[]
    for x in result.get("affected") or []:
        if not isinstance(x,dict):continue
        rows.append({"book_id":x.get("book_id"),"book_version":x.get("book_version"),"chapter_id":x.get("chapter_id"),
                     "qid":x.get("qid"),"content_hash":x.get("content_hash"),"entry_url":x.get("entry_url"),"entry_sha256":x.get("entry_sha256")})
    return rows

def prepare(work:Path,allow_initial:bool):
    q=Queue();item=q.call("claim")
    if item.get("kind")=="empty":
        print(json.dumps({"empty":True}));return 0
    if item.get("kind")!="motioncards":raise ValueError("unexpected_motioncards_claim")
    group=item["group"];lease=item["lease_token"]
    try:
        parts=item.get("parts") or []
        work.mkdir(parents=True,exist_ok=True);state=work/"state.json";site=work/"site"
        if not state.exists():
            if not allow_initial:raise ValueError("motioncards_state_missing_owner_initialization_required")
            site.mkdir(parents=True,exist_ok=True)
        packages=[]
        for part in parts:
            package=work/part["filename"];telegram_file(part["telegram_file_id"],package);packages.append(package)
        validate_downloaded_identity(group,parts,packages)
        result=apply_packages(packages,state,site)
        build=json.loads((site/"build-info.json").read_text())
        meta={"empty":False,"group_key":group["group_key"],"lease_token":lease,"package_sha256":result["package_sha256"],
              "animations":result["animations"],"duplicate":bool(result.get("duplicate")),"needs_deploy":bool(result.get("changed",True)),
              "state_sha256":build["state_sha256"],"tree_sha256":tree_sha(site),"samples":_affected_samples(result)}
        (work/"result.json").write_text(json.dumps(meta,indent=2)+"\n");print(json.dumps(meta));return 0
    except Exception as exc:
        safe=(type(exc).__name__+":"+str(exc))[:350]
        q.call("finish",{"group_key":group["group_key"],"lease_token":lease,"ok":False,"error":safe})
        try:q.notify("❌ MotionCards "+group["group_key"]+" failed: "+safe)
        except Exception as notify_exc:print("warning: MotionCards failure notification failed:",type(notify_exc).__name__,file=sys.stderr)
        raise

def finish(work:Path,ok:bool,error=""):
    meta=json.loads((work/"result.json").read_text())
    q=Queue()
    payload={"group_key":meta["group_key"],"lease_token":meta["lease_token"],"ok":ok}
    if ok:payload.update(package_sha256=meta["package_sha256"],animations=meta["animations"])
    else:payload["error"]=error[:400]
    q.call("finish",payload)
    try:q.notify(("✅ " if ok else "❌ ")+"MotionCards "+meta["group_key"]+(" published." if ok else " failed: "+error[:250]))
    except Exception as notify_exc:print("warning: MotionCards notification failed after queue acknowledgement:",type(notify_exc).__name__,file=sys.stderr)

def has_work():
    data=Queue().call("has-ready")
    print(json.dumps(data))
    return 0 if data.get("ready") else 3

def main():
    ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("prepare");p.add_argument("--work",type=Path,required=True);p.add_argument("--allow-initial",action="store_true")
    f=sub.add_parser("finish");f.add_argument("--work",type=Path,required=True);f.add_argument("--ok",action="store_true");f.add_argument("--error",default="")
    sub.add_parser("has-work")
    a=ap.parse_args()
    if a.cmd=="prepare":return prepare(a.work,a.allow_initial)
    if a.cmd=="has-work":return has_work()
    finish(a.work,a.ok,a.error);return 0
if __name__=="__main__":raise SystemExit(main())
