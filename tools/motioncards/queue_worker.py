#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,os,sys,tarfile,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from tools.http_client import request_json,download,HttpStepError
from tools.motioncards.publish import apply_package

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

def prepare(work:Path,allow_initial:bool):
    q=Queue();item=q.call("claim")
    if item.get("kind")=="empty":
        print(json.dumps({"empty":True}));return 0
    if item.get("kind")!="motioncards":raise ValueError("unexpected_motioncards_claim")
    group=item["group"];lease=item["lease_token"]
    try:
        parts=item.get("parts") or []
        if len(parts)!=int(group["part_total"]):raise ValueError("incomplete_motioncards_group")
        if len(parts)!=1:raise ValueError("motioncards_multipart_processing_not_enabled_yet")
        work.mkdir(parents=True,exist_ok=True);state=work/"state.json";site=work/"site"
        if not state.exists():
            if not allow_initial:raise ValueError("motioncards_state_missing_owner_initialization_required")
            site.mkdir(parents=True,exist_ok=True)
        package=work/parts[0]["filename"];telegram_file(parts[0]["telegram_file_id"],package)
        result=apply_package(package,state,site)
        build=json.loads((site/"build-info.json").read_text())
        index_path=next((site/"indexes").rglob("index.json"));index=json.loads(index_path.read_text());sample=next(iter(index["animations"].values()))
        meta={"empty":False,"group_key":group["group_key"],"lease_token":lease,"package_sha256":result["package_sha256"],
              "animations":result["animations"],"state_sha256":build["state_sha256"],"tree_sha256":tree_sha(site),
              "sample":{"book_id":sample["book_id"],"book_version":sample["book_version"],"qid":sample["qid"],"entry_url":sample["entry_url"]}}
        (work/"result.json").write_text(json.dumps(meta,indent=2)+"\n");print(json.dumps(meta));return 0
    except Exception as exc:
        safe=(type(exc).__name__+":"+str(exc))[:350]
        q.call("finish",{"group_key":group["group_key"],"lease_token":lease,"ok":False,"error":safe})
        q.notify("❌ MotionCards "+group["group_key"]+" failed: "+safe)
        raise

def finish(work:Path,ok:bool,error=""):
    meta=json.loads((work/"result.json").read_text())
    q=Queue()
    payload={"group_key":meta["group_key"],"lease_token":meta["lease_token"],"ok":ok}
    if ok:payload.update(package_sha256=meta["package_sha256"],animations=meta["animations"])
    else:payload["error"]=error[:400]
    q.call("finish",payload)
    q.notify(("✅ " if ok else "❌ ")+"MotionCards "+meta["group_key"]+(" published." if ok else " failed: "+error[:250]))

def main():
    ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest="cmd",required=True)
    p=sub.add_parser("prepare");p.add_argument("--work",type=Path,required=True);p.add_argument("--allow-initial",action="store_true")
    f=sub.add_parser("finish");f.add_argument("--work",type=Path,required=True);f.add_argument("--ok",action="store_true");f.add_argument("--error",default="")
    a=ap.parse_args()
    if a.cmd=="prepare":return prepare(a.work,a.allow_initial)
    finish(a.work,a.ok,a.error);return 0
if __name__=="__main__":raise SystemExit(main())
