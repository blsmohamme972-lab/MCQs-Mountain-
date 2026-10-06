from __future__ import annotations
import argparse,copy,hashlib,json,re,shutil,sys,zipfile
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from motioncards.lib.core import content_hash
from motioncards.lib.package import validate_package
from motioncards.lib.multipart import combine_parts
from tools.http_client import request_json

CONTENT_BASE="https://kafu-content-1.blsmohamme97.workers.dev"
PUBLIC_BASE="https://kafu-motioncards.blsmohamme97.workers.dev"
MAX_JSON=12*1024*1024

def digest(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def load_state(path:Path)->dict:
    if not path.exists():return {"schema":1,"packages":{},"animations":{}}
    data=json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema")!=1 or not isinstance(data.get("packages"),dict) or not isinstance(data.get("animations"),dict):
        raise ValueError("motioncards_state_invalid")
    return data

def save_state(path:Path,state:dict):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(state,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")

def approved_url(raw:str,base=CONTENT_BASE)->str:
    u=urlsplit(str(raw or ""));b=urlsplit(base)
    if u.scheme!="https" or u.netloc!=b.netloc or u.username or u.password or u.query or u.fragment:
        raise ValueError("published_source_url_invalid")
    return u.geturl()

def live_json(url:str,step:str):
    approved_url(url)
    return request_json(url,step=step,timeout=20)

def verify_published_sources(manifest:dict,fetch_json=live_json)->dict:
    catalog=fetch_json(CONTENT_BASE+"/catalog.json","motioncards.catalog")
    if not isinstance(catalog,dict) or not isinstance(catalog.get("books"),list):raise ValueError("published_catalog_invalid")
    grouped={}
    for row in manifest["animations"]:
        key=(row["book_id"],int(row["book_version"]),str(row["chapter_id"]))
        grouped.setdefault(key,[]).append(row)
    chapters_checked=0
    for (book_id,version,chapter_id),rows in grouped.items():
        book=next((b for b in catalog["books"] if str(b.get("id"))==str(book_id)),None)
        if not book or int(book.get("version") or 0)!=version:raise ValueError("published_book_version_stale:"+str(book_id))
        chapter=next((c for c in (book.get("chapters") or []) if str(c.get("id"))==chapter_id),None)
        if not chapter:raise ValueError("published_chapter_missing:"+chapter_id)
        url=approved_url(chapter.get("url"))
        pack=fetch_json(url,"motioncards.chapter")
        if not isinstance(pack,dict) or pack.get("book_id")!=book_id or int(pack.get("version") or 0)!=version or str(pack.get("chapter_id"))!=chapter_id:
            raise ValueError("published_chapter_identity_mismatch")
        by_id={str(q.get("id")):q for q in pack.get("questions") or [] if isinstance(q,dict)}
        for row in rows:
            q=by_id.get(row["qid"])
            if not q:raise ValueError("published_qid_missing:"+row["qid"])
            if content_hash(q)!=row["content_hash"]:raise ValueError("published_content_hash_mismatch:"+row["qid"])
        chapters_checked+=1
    return {"books":len({(r["book_id"],r["book_version"]) for r in manifest["animations"]}),"chapters":chapters_checked,"questions":len(manifest["animations"])}

def key_for(row:dict)->str:
    return str(row["book_id"])+"|"+str(row["book_version"])+"|"+str(row["qid"])

def build_indexes(state:dict,site:Path):
    indexes=site/"indexes"
    if indexes.exists():shutil.rmtree(indexes)
    groups={}
    for record in state["animations"].values():
        k=(record["book_id"],int(record["book_version"]))
        groups.setdefault(k,{})[record["qid"]]=record
    for (book_id,version),rows in groups.items():
        target=indexes/book_id/("v"+str(version));target.mkdir(parents=True,exist_ok=True)
        public={}
        for qid,row in sorted(rows.items()):
            public[qid]={k:row[k] for k in [
                "book_id","book_version","chapter_id","qid","content_hash","publisher_fingerprint",
                "duration_ms","entry_url","entry_sha256","final_panel","package_id","package_revision"
            ]}
        payload={"schema":1,"runtime_version":1,"protocol_version":1,"book_id":book_id,"book_version":version,"animations":public}
        (target/"index.json").write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")

def apply_package(zip_path:Path,state_path:Path,site:Path,fetch_json=live_json):
    manifest=validate_package(zip_path);package_sha=digest(zip_path)
    identity=manifest["package_id"]+"_r"+str(manifest["package_revision"])
    state=load_state(state_path)
    old=state["packages"].get(identity)
    if old:
        if old.get("sha256")==package_sha:
            affected=[state["animations"].get(key_for(row)) for row in manifest["animations"]]
            return {"duplicate":True,"changed":False,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"package_sha256":package_sha,"affected":[x for x in affected if x]}
        raise ValueError("package_revision_conflict")
    verified=verify_published_sources(manifest,fetch_json)
    next_state=copy.deepcopy(state);next_site=site
    next_site.mkdir(parents=True,exist_ok=True)
    assets=next_site/"assets"/manifest["package_id"]/("r"+str(manifest["package_revision"]))
    if assets.exists():raise ValueError("package_asset_path_conflict")
    pending=[]
    for row in manifest["animations"]:
        key=key_for(row);existing=next_state["animations"].get(key)
        if existing and not row.get("replace"):raise ValueError("animation_replace_requires_explicit_intent:"+row["qid"])
        pending.append((key,row))
    assets.mkdir(parents=True,exist_ok=False)
    try:
        with zipfile.ZipFile(zip_path) as z:
            for key,row in pending:
                raw=z.read(row["entry_path"])
                short=row["entry_sha256"][:12]
                name=row["qid"]+"."+short+".html"
                target=assets/name;target.write_bytes(raw)
                public=dict(row)
                public.update(package_id=manifest["package_id"],package_revision=manifest["package_revision"],
                              entry_url=PUBLIC_BASE+"/"+target.relative_to(next_site).as_posix())
                for drop in ["entry_path","scene_path","scene_sha256","source_record_path","source_record_sha256","replace"]:
                    public.pop(drop,None)
                next_state["animations"][key]=public
        next_state["packages"][identity]={"sha256":package_sha,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":[r["qid"] for r in manifest["animations"]]}
        build_indexes(next_state,next_site)
        (next_site/"build-info.json").write_text(json.dumps({"schema":1,"state_sha256":hashlib.sha256(json.dumps(next_state,sort_keys=True,separators=(",",":")).encode()).hexdigest(),"packages":len(next_state["packages"]),"animations":len(next_state["animations"])})+"\n")
        save_state(state_path,next_state)
    except Exception:
        shutil.rmtree(assets,ignore_errors=True)
        raise
    return {"duplicate":False,"changed":True,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"verified":verified,"package_sha256":package_sha,"affected":[next_state["animations"][key_for(row)] for row in manifest["animations"]]}


def apply_packages(zip_paths:list[Path],state_path:Path,site:Path,fetch_json=live_json):
    if len(zip_paths)==1:
        return apply_package(zip_paths[0],state_path,site,fetch_json)
    manifest,source_by_qid,package_sha=combine_parts(zip_paths)
    identity=manifest["package_id"]+"_r"+str(manifest["package_revision"])
    state=load_state(state_path)
    old=state["packages"].get(identity)
    if old:
        if old.get("sha256")==package_sha:
            affected=[state["animations"].get(key_for(row)) for row in manifest["animations"]]
            return {"duplicate":True,"changed":False,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"package_sha256":package_sha,"affected":[x for x in affected if x]}
        raise ValueError("package_revision_conflict")
    verified=verify_published_sources(manifest,fetch_json)
    next_state=copy.deepcopy(state);site.mkdir(parents=True,exist_ok=True)
    assets=site/"assets"/manifest["package_id"]/("r"+str(manifest["package_revision"]))
    if assets.exists():raise ValueError("package_asset_path_conflict")
    pending=[]
    for row in manifest["animations"]:
        key=key_for(row);existing=next_state["animations"].get(key)
        if existing and not row.get("replace"):raise ValueError("animation_replace_requires_explicit_intent:"+row["qid"])
        pending.append((key,row))
    assets.mkdir(parents=True,exist_ok=False)
    try:
        handles={}
        try:
            for p in set(source_by_qid.values()):handles[p]=zipfile.ZipFile(p)
            for key,row in pending:
                raw=handles[source_by_qid[row["qid"]]].read(row["entry_path"])
                short=row["entry_sha256"][:12];name=row["qid"]+"."+short+".html";target=assets/name;target.write_bytes(raw)
                public=dict(row);public.update(package_id=manifest["package_id"],package_revision=manifest["package_revision"],entry_url=PUBLIC_BASE+"/"+target.relative_to(site).as_posix())
                for drop in ["entry_path","scene_path","scene_sha256","source_record_path","source_record_sha256","replace"]:public.pop(drop,None)
                next_state["animations"][key]=public
        finally:
            for z in handles.values():z.close()
        next_state["packages"][identity]={"sha256":package_sha,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":[r["qid"] for r in manifest["animations"]]}
        build_indexes(next_state,site)
        (site/"build-info.json").write_text(json.dumps({"schema":1,"state_sha256":hashlib.sha256(json.dumps(next_state,sort_keys=True,separators=(",",":")).encode()).hexdigest(),"packages":len(next_state["packages"]),"animations":len(next_state["animations"])})+"\n")
        save_state(state_path,next_state)
    except Exception:
        shutil.rmtree(assets,ignore_errors=True);raise
    return {"duplicate":False,"changed":True,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"verified":verified,"package_sha256":package_sha,"affected":[next_state["animations"][key_for(row)] for row in manifest["animations"]]}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("zip",type=Path);ap.add_argument("--state",type=Path,required=True);ap.add_argument("--site",type=Path,required=True)
    a=ap.parse_args();print(json.dumps(apply_packages([a.zip],a.state,a.site),indent=2))
if __name__=="__main__":main()
