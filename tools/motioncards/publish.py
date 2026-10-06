from __future__ import annotations
import argparse,copy,hashlib,json,shutil,sys,zipfile
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

def digest(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def state_digest(state:dict)->str:
    return hashlib.sha256(json.dumps(state,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def empty_state()->dict:
    return {"schema":1,"packages":{},"animations":{},"history":{},"operations":{}}

def load_state(path:Path)->dict:
    if not path.exists():return empty_state()
    data=json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema")!=1 or not isinstance(data.get("packages"),dict) or not isinstance(data.get("animations"),dict):
        raise ValueError("motioncards_state_invalid")
    data.setdefault("history",{});data.setdefault("operations",{})
    if not isinstance(data["history"],dict) or not isinstance(data["operations"],dict):raise ValueError("motioncards_state_history_invalid")
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

def verify_published_records(records:list[dict],fetch_json=live_json)->dict:
    if not records:return {"books":0,"chapters":0,"questions":0}
    catalog=fetch_json(CONTENT_BASE+"/catalog.json","motioncards.catalog")
    if not isinstance(catalog,dict) or not isinstance(catalog.get("books"),list):raise ValueError("published_catalog_invalid")
    grouped={}
    for row in records:
        key=(row["book_id"],int(row["book_version"]),str(row["chapter_id"]))
        grouped.setdefault(key,[]).append(row)
    chapters_checked=0
    for (book_id,version,chapter_id),rows in grouped.items():
        book=next((b for b in catalog["books"] if str(b.get("id"))==str(book_id)),None)
        if not book or int(book.get("version") or 0)!=version:raise ValueError("published_book_version_stale:"+str(book_id))
        chapter=next((c for c in (book.get("chapters") or []) if str(c.get("id"))==chapter_id),None)
        if not chapter:raise ValueError("published_chapter_missing:"+chapter_id)
        pack=fetch_json(approved_url(chapter.get("url")),"motioncards.chapter")
        if not isinstance(pack,dict) or str(pack.get("book_id"))!=str(book_id) or int(pack.get("version") or 0)!=version or str(pack.get("chapter_id"))!=chapter_id:
            raise ValueError("published_chapter_identity_mismatch")
        by_id={str(q.get("id")):q for q in pack.get("questions") or [] if isinstance(q,dict)}
        for row in rows:
            q=by_id.get(str(row["qid"]))
            if not q:raise ValueError("published_qid_missing:"+str(row["qid"]))
            if content_hash(q)!=str(row["content_hash"]).lower():raise ValueError("published_content_hash_mismatch:"+str(row["qid"]))
        chapters_checked+=1
    return {"books":len({(r["book_id"],r["book_version"]) for r in records}),"chapters":chapters_checked,"questions":len(records)}

def verify_published_sources(manifest:dict,fetch_json=live_json)->dict:
    return verify_published_records(manifest["animations"],fetch_json)

def key_for(row:dict)->str:
    return str(row["book_id"])+"|"+str(row["book_version"])+"|"+str(row["qid"])

def _append_history(state:dict,key:str,record:dict):
    rows=state["history"].setdefault(key,[])
    sha=str(record.get("entry_sha256") or "")
    if sha and not any(str(x.get("entry_sha256"))==sha for x in rows):rows.append(copy.deepcopy(record))

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

def _write_build(state:dict,site:Path):
    build_indexes(state,site)
    (site/"build-info.json").write_text(json.dumps({"schema":1,"state_sha256":state_digest(state),"packages":len(state["packages"]),"animations":len(state["animations"])})+"\n")
    
def _package_material(zip_paths:list[Path]):
    if len(zip_paths)==1:
        manifest=validate_package(zip_paths[0]);return manifest,{row["qid"]:zip_paths[0] for row in manifest["animations"]},digest(zip_paths[0])
    return combine_parts(zip_paths)

def plan_packages(zip_paths:list[Path],state_path:Path,fetch_json=live_json):
    manifest,source_by_qid,package_sha=_package_material(zip_paths)
    state=load_state(state_path);identity=manifest["package_id"]+"_r"+str(manifest["package_revision"])
    old=state["packages"].get(identity)
    if old:
        if old.get("sha256")==package_sha:
            return {"duplicate":True,"package_sha256":package_sha,"manifest":manifest,"replacements":[]}
        raise ValueError("package_revision_conflict")
    verified=verify_published_sources(manifest,fetch_json)
    replacements=[]
    for row in manifest["animations"]:
        existing=state["animations"].get(key_for(row))
        if not existing:continue
        if row.get("replace") is not True:raise ValueError("animation_replace_requires_explicit_intent:"+row["qid"])
        replacements.append({"qid":row["qid"],"book_id":row["book_id"],"book_version":row["book_version"],"chapter_id":row["chapter_id"],
                             "candidate_digest":package_sha,"expected_active_digest":existing["entry_sha256"],
                             "expected_active_package_id":existing["package_id"],"expected_active_package_revision":existing["package_revision"]})
    return {"duplicate":False,"package_sha256":package_sha,"manifest":manifest,"source_by_qid":source_by_qid,"verified":verified,"replacements":replacements}

def _replacement_authorized(row:dict,existing:dict,package_sha:str,authorizations:dict|None):
    if not existing:return
    if row.get("replace") is not True:raise ValueError("animation_replace_requires_explicit_intent:"+row["qid"])
    auth=(authorizations or {}).get(row["qid"])
    if not isinstance(auth,dict):raise ValueError("animation_replace_confirmation_required:"+row["qid"])
    checks=[
        str(auth.get("candidate_digest","")).lower()==package_sha.lower(),
        str(auth.get("expected_active_digest","")).lower()==str(existing.get("entry_sha256","")).lower(),
        str(auth.get("expected_active_package_id",""))==str(existing.get("package_id","")),
        int(auth.get("expected_active_package_revision") or 0)==int(existing.get("package_revision") or 0),
    ]
    if not all(checks):raise ValueError("animation_replace_confirmation_stale:"+row["qid"])

def _public_record(row:dict,manifest:dict,target:Path,site:Path):
    public=dict(row)
    public.update(package_id=manifest["package_id"],package_revision=manifest["package_revision"],entry_url=PUBLIC_BASE+"/"+target.relative_to(site).as_posix())
    for drop in ["entry_path","scene_path","scene_sha256","source_record_path","source_record_sha256","replace"]:public.pop(drop,None)
    return public

def apply_packages(zip_paths:list[Path],state_path:Path,site:Path,fetch_json=live_json,replacement_authorizations:dict|None=None):
    plan=plan_packages(zip_paths,state_path,fetch_json);manifest=plan["manifest"];package_sha=plan["package_sha256"]
    state=load_state(state_path);identity=manifest["package_id"]+"_r"+str(manifest["package_revision"])
    if plan["duplicate"]:
        affected=[state["animations"].get(key_for(row)) for row in manifest["animations"]]
        return {"duplicate":True,"changed":False,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"package_sha256":package_sha,"affected":[x for x in affected if x]}
    next_state=copy.deepcopy(state);site.mkdir(parents=True,exist_ok=True)
    assets=site/"assets"/manifest["package_id"]/("r"+str(manifest["package_revision"]))
    if assets.exists():raise ValueError("package_asset_path_conflict")
    pending=[]
    for row in manifest["animations"]:
        key=key_for(row);existing=next_state["animations"].get(key)
        _replacement_authorized(row,existing,package_sha,replacement_authorizations)
        pending.append((key,row,existing))
    assets.mkdir(parents=True,exist_ok=False)
    handles={}
    try:
        for p in set(plan["source_by_qid"].values()):handles[p]=zipfile.ZipFile(p)
        for key,row,existing in pending:
            if existing:_append_history(next_state,key,existing)
            raw=handles[plan["source_by_qid"][row["qid"]]].read(row["entry_path"])
            name=row["qid"]+"."+row["entry_sha256"][:12]+".html";target=assets/name;target.write_bytes(raw)
            public=_public_record(row,manifest,target,site)
            next_state["animations"][key]=public;_append_history(next_state,key,public)
        next_state["packages"][identity]={"sha256":package_sha,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":[r["qid"] for r in manifest["animations"]]}
        _write_build(next_state,site);save_state(state_path,next_state)
    except Exception:
        shutil.rmtree(assets,ignore_errors=True);raise
    finally:
        for z in handles.values():z.close()
    return {"duplicate":False,"changed":True,"package_id":manifest["package_id"],"revision":manifest["package_revision"],"animations":len(manifest["animations"]),"verified":plan["verified"],"package_sha256":package_sha,"affected":[next_state["animations"][key_for(row)] for row in manifest["animations"]]}

def apply_package(zip_path:Path,state_path:Path,site:Path,fetch_json=live_json,replacement_authorizations:dict|None=None):
    return apply_packages([zip_path],state_path,site,fetch_json,replacement_authorizations)

def apply_management(operation:dict,state_path:Path,site:Path,fetch_json=live_json):
    if not isinstance(operation,dict) or operation.get("kind") not in {"remove","restore"}:raise ValueError("motioncards_operation_invalid")
    op_id=str(operation.get("operation_id") or "")
    if not op_id:raise ValueError("motioncards_operation_id_missing")
    state=load_state(state_path)
    if op_id in state["operations"]:
        prior=state["operations"][op_id]
        return {"duplicate":True,"changed":False,"operation_id":op_id,"kind":prior["kind"],"affected":prior.get("affected",[])}
    identity={"book_id":str(operation.get("book_id") or ""),"book_version":int(operation.get("book_version") or 0),
              "chapter_id":str(operation.get("chapter_id") or ""),"qid":str(operation.get("qid") or "")}
    if not identity["book_id"] or identity["book_version"]<1 or not identity["chapter_id"] or not identity["qid"]:raise ValueError("motioncards_operation_identity_invalid")
    key=identity["book_id"]+"|"+str(identity["book_version"])+"|"+identity["qid"]
    active=state["animations"].get(key);expected=str(operation.get("expected_active_digest") or "")
    if not active or str(active.get("entry_sha256"))!=expected:raise ValueError("motioncards_operation_stale_active")
    if str(active.get("chapter_id"))!=identity["chapter_id"]:raise ValueError("motioncards_operation_chapter_mismatch")
    next_state=copy.deepcopy(state);_append_history(next_state,key,active)
    affected=[]
    if operation["kind"]=="remove":
        del next_state["animations"][key]
        affected=[{**active,"active":False}]
    else:
        target_digest=str(operation.get("target_digest") or "")
        target=next((x for x in next_state["history"].get(key,[]) if str(x.get("entry_sha256"))==target_digest),None)
        if not target:raise ValueError("motioncards_restore_target_missing")
        if target_digest==expected:raise ValueError("motioncards_restore_target_already_active")
        verify_published_records([target],fetch_json)
        next_state["animations"][key]=copy.deepcopy(target);affected=[{**target,"active":True}]
    next_state["operations"][op_id]={"kind":operation["kind"],"qid":identity["qid"],"expected_active_digest":expected,"target_digest":operation.get("target_digest"),"affected":affected}
    _write_build(next_state,site);save_state(state_path,next_state)
    return {"duplicate":False,"changed":True,"operation_id":op_id,"kind":operation["kind"],"affected":affected}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("zip",type=Path);ap.add_argument("--state",type=Path,required=True);ap.add_argument("--site",type=Path,required=True)
    a=ap.parse_args();print(json.dumps(apply_packages([a.zip],a.state,a.site),indent=2))
if __name__=="__main__":main()
