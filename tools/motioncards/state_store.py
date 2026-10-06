#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,os,shutil,subprocess,tarfile,urllib.request
from pathlib import Path

TAG="kafu-motioncards-state"
PROD="https://kafu-motioncards.blsmohamme97.workers.dev"

def run(*args,check=True):
    p=subprocess.run(args,text=True,capture_output=True)
    if check and p.returncode:raise RuntimeError("command_failed:"+args[0]+":"+p.stderr[-400:])
    return p

def release_exists():
    return run("gh","release","view",TAG,check=False).returncode==0

def download(work:Path,*patterns):
    args=["gh","release","download",TAG,"--dir",str(work/"release")]
    for x in patterns:args+=["--pattern",x]
    run(*args)

def live_state():
    try:
        with urllib.request.urlopen(PROD+"/build-info.json?restore=1",timeout=15) as r:
            value=json.load(r).get("state_sha256","")
            return value if isinstance(value,str) and len(value)==64 else ""
    except Exception:return ""

def restore(work:Path,allow_initial:bool):
    shutil.rmtree(work,ignore_errors=True);(work/"site").mkdir(parents=True);(work/"release").mkdir()
    if not release_exists():
        if not allow_initial:raise RuntimeError("motioncards_state_missing_owner_initialization_required")
        print(json.dumps({"has_state":False}));return False
    download(work,"active.json")
    active=json.loads((work/"release/active.json").read_text())["state_sha256"]
    live=live_state()
    if live and live!=active:
        # Only reconcile production to a state whose durable assets were already saved.
        probe=run("gh","release","download",TAG,"--pattern","state-"+live+".json","--pattern","site-"+live+".tar.gz","--dir",str(work/"release"),check=False)
        if probe.returncode:raise RuntimeError("live_motioncards_state_has_no_durable_candidate")
        active=live;(work/"release/active.json").write_text(json.dumps({"state_sha256":active})+"\n")
        run("gh","release","upload",TAG,str(work/"release/active.json"),"--clobber")
    download(work,"state-"+active+".json","site-"+active+".tar.gz")
    shutil.copy2(work/"release"/("state-"+active+".json"),work/"state.json")
    with tarfile.open(work/"release"/("site-"+active+".tar.gz"),"r:gz") as tar:
        for member in tar.getmembers():
            target=(work/"site"/member.name).resolve()
            if not str(target).startswith(str((work/"site").resolve())):raise RuntimeError("state_tar_traversal")
        tar.extractall(work/"site")
    print(json.dumps({"has_state":True,"state_sha256":active}));return True

def persist_candidate(work:Path):
    meta=json.loads((work/"result.json").read_text());state=meta["state_sha256"]
    state_asset=work/("state-"+state+".json");site_asset=work/("site-"+state+".tar.gz")
    shutil.copy2(work/"state.json",state_asset)
    with tarfile.open(site_asset,"w:gz") as tar:
        for p in sorted((work/"site").rglob("*")):
            if p.is_file():tar.add(p,arcname=p.relative_to(work/"site"))
    if not release_exists():run("gh","release","create",TAG,"--title","Kafu MotionCards state","--notes","Independent MotionCards state; not book content.")
    run("gh","release","upload",TAG,str(state_asset),str(site_asset),"--clobber")
    print(state)

def activate(work:Path):
    state=json.loads((work/"result.json").read_text())["state_sha256"]
    active=work/"active.json";active.write_text(json.dumps({"state_sha256":state})+"\n")
    run("gh","release","upload",TAG,str(active),"--clobber")
    print(state)

def main():
    ap=argparse.ArgumentParser();sub=ap.add_subparsers(dest="cmd",required=True)
    r=sub.add_parser("restore");r.add_argument("--work",type=Path,required=True);r.add_argument("--allow-initial",action="store_true")
    p=sub.add_parser("persist-candidate");p.add_argument("--work",type=Path,required=True)
    a=sub.add_parser("activate");a.add_argument("--work",type=Path,required=True)
    x=ap.parse_args()
    if x.cmd=="restore":restore(x.work,x.allow_initial)
    elif x.cmd=="persist-candidate":persist_candidate(x.work)
    else:activate(x.work)
if __name__=="__main__":main()
