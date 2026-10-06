from __future__ import annotations
import hashlib,json,posixpath,re,stat,unicodedata,zipfile
from pathlib import Path
from .core import AdaptedExport,select_questions,resolve_answer,content_hash
from .compiler import compile_scene,validate_scene
from .spec import *

def sha256_bytes(data:bytes)->str:return hashlib.sha256(data).hexdigest()

def safe_path(name:str)->str:
    raw=str(name).replace("\\","/")
    if not raw or raw.startswith("/") or re.match(r"^[A-Za-z]:",raw):raise ValueError("zip_path_absolute")
    parts=raw.split("/")
    if any(x in {"","..","."} for x in parts):raise ValueError("zip_path_traversal")
    norm=posixpath.normpath(raw)
    if norm.startswith("../") or norm!=raw:raise ValueError("zip_path_noncanonical")
    return norm

def check_archive_structure(path:Path):
    if path.stat().st_size>MAX_ZIP_BYTES:raise ValueError("zip_too_large")
    seen=set();expanded=0
    with zipfile.ZipFile(path) as z:
        infos=z.infolist()
        if len(infos)>MAX_ENTRIES:raise ValueError("zip_too_many_entries")
        for info in infos:
            name=safe_path(info.filename)
            key=unicodedata.normalize("NFC",name).casefold()
            if key in seen:raise ValueError("zip_path_collision")
            seen.add(key)
            mode=(info.external_attr>>16)&0o170000
            if mode==stat.S_IFLNK:raise ValueError("zip_symlink_rejected")
            if info.flag_bits&1:raise ValueError("zip_encrypted_rejected")
            if info.compress_type not in {zipfile.ZIP_STORED,zipfile.ZIP_DEFLATED}:raise ValueError("zip_compression_unsupported")
            expanded+=info.file_size
            if expanded>MAX_EXPANDED_BYTES:raise ValueError("zip_expanded_too_large")
            if info.compress_size and info.file_size/info.compress_size>MAX_RATIO:raise ValueError("zip_member_ratio_exceeded")
            base=posixpath.basename(name).casefold();ext=Path(base).suffix.casefold()
            if base in {x.casefold() for x in FORBIDDEN_BASENAMES} or ext in FORBIDDEN_EXTENSIONS:raise ValueError("zip_executable_or_hosting_file_rejected")
            if "/" not in name and name not in ALLOWED_ROOT_FILES:raise ValueError("zip_root_file_unapproved")
            if "/" in name and not name.startswith(PUBLIC_PREFIXES+SOURCE_PREFIXES):raise ValueError("zip_prefix_unapproved")
        bad=z.testzip()
        if bad:raise ValueError("zip_crc_failed:"+bad)

def scaffold_workspace(bundle:AdaptedExport,out:Path,package_id:str,revision:int,qids:list[str]|None,count:int|None,duration_ms:int|None,overrides:dict[str,int]|None=None,inspected_images:set[str]|None=None):
    if not PACKAGE_ID_RE.fullmatch(package_id):raise ValueError("package_id_invalid")
    if not isinstance(revision,int) or revision<1:raise ValueError("package_revision_invalid")
    selected=select_questions(bundle,qids,count,duration_ms,overrides,inspected_images)
    out.mkdir(parents=True,exist_ok=True);(out/"scenes").mkdir(exist_ok=True);(out/"input").mkdir(exist_ok=True)
    for i,e in enumerate(bundle.envelopes,1):
        (out/"input"/f"raw-export-{i:03d}.json").write_text(json.dumps(e,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    selection={"package_id":package_id,"package_revision":revision,"source":bundle.provenance,"scope":bundle.effective_scope,"warnings":bundle.warnings,"selected":[{"qid":x["qid"],"duration_ms":x["duration_ms"],"content_hash":x["integrity"]["content_hash"]} for x in selected]}
    (out/"selection.json").write_text(json.dumps(selection,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    for item in selected:
        q=item["question"];ms=item["duration_ms"]
        scene={"schema_version":1,"qid":item["qid"],"duration_ms":ms,"takeaway":"EDIT: one short teaching takeaway","layers":[
            {"type":"label","text":str(q.get("stem") or "")[:80],"x":320,"y":70,"size":24,"start_ms":0,"end_ms":ms,"from":{"opacity":0.2,"scale":0.96},"to":{"opacity":1,"scale":1}},
            {"type":"arrow","x1":190,"y1":230,"x2":450,"y2":230,"stroke":"#16606A","stroke_width":7,"start_ms":int(ms*.2),"end_ms":int(ms*.8),"from":{"opacity":0},"to":{"opacity":1}}
        ]}
        (out/"scenes"/f"{item['qid']}.scene.json").write_text(json.dumps(scene,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return selection

def build_package(bundle:AdaptedExport,workspace:Path,out_zip:Path):
    selection=json.loads((workspace/"selection.json").read_text(encoding="utf-8"))
    selected_ids=[x["qid"] for x in selection["selected"]];by_id={q["id"]:q for q in bundle.questions}
    records=[];files={}
    for sel in selection["selected"]:
        qid=sel["qid"];q=by_id.get(qid)
        if not q:raise ValueError("selected_question_missing:"+qid)
        integ=bundle.integrity[qid]
        if integ["content_hash"]!=sel["content_hash"]:raise ValueError("selection_hash_changed:"+qid)
        scene=json.loads((workspace/"scenes"/f"{qid}.scene.json").read_text(encoding="utf-8"))
        validate_scene(scene,qid,int(sel["duration_ms"]))
        entry=compile_scene(scene)
        entry_path=f"entries/{qid}.html";scene_path=f"scenes/{qid}.scene.json";source_path=f"source/questions/{qid}.json"
        source_obj={"question":q,"integrity":integ,"provenance":bundle.provenance}
        source_bytes=(json.dumps(source_obj,ensure_ascii=False,indent=2)+"\n").encode()
        scene_bytes=(json.dumps(scene,ensure_ascii=False,indent=2)+"\n").encode();entry_bytes=entry.encode()
        if len(entry_bytes)>MAX_ENTRY_BYTES:raise ValueError("compiled_entry_too_large:"+qid)
        files[entry_path]=entry_bytes;files[scene_path]=scene_bytes;files[source_path]=source_bytes
        answer=resolve_answer(q)
        records.append({
            "book_id":q["book_id"],"book_version":q["version"],"chapter_id":q["chapter_id"],"qid":qid,
            "publisher_fingerprint":integ["publisher_fingerprint"],"publisher_fingerprint_source":integ.get("publisher_fingerprint_source"),
            "content_hash":integ["content_hash"],"content_hash_algorithm":"SHA-256","content_hash_canonicalization":"kafu-question-canonical-json-v1",
            "duration_ms":int(sel["duration_ms"]),"entry_path":entry_path,"entry_sha256":sha256_bytes(entry_bytes),
            "scene_path":scene_path,"scene_sha256":sha256_bytes(scene_bytes),"source_record_path":source_path,"source_record_sha256":sha256_bytes(source_bytes),
            "final_panel":{"takeaway":scene["takeaway"],"correct_answer_kind":answer["kind"],"correct_answer_statements":answer["statements"]},
            "replace":bool(scene.get("replace",False))
        })
    manifest={
        "package_type":PACKAGE_TYPE,"schema_version":SCHEMA_VERSION,"package_id":selection["package_id"],"package_revision":selection["package_revision"],
        "runtime_version":RUNTIME_VERSION,"protocol_version":PROTOCOL_VERSION,"source":bundle.provenance,
        "selection":{"qids":selected_ids,"count":len(selected_ids),"scope":bundle.effective_scope,"warnings":bundle.warnings},
        "animations":records
    }
    files[MANIFEST_NAME]=(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n").encode()
    files["validation-report.json"]=(json.dumps({"status":"PASS","animations":len(records),"blocked":[],"package_type":PACKAGE_TYPE},indent=2)+"\n").encode()
    out_zip.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(out_zip,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in sorted(files.items()):
            zi=zipfile.ZipInfo(name);zi.date_time=(2026,1,1,0,0,0);zi.compress_type=zipfile.ZIP_DEFLATED;zi.external_attr=0o100644<<16
            z.writestr(zi,data)
    check_archive_structure(out_zip)
    return manifest

def validate_package(path:Path):
    check_archive_structure(path)
    with zipfile.ZipFile(path) as z:
        names=set(z.namelist())
        if MANIFEST_NAME not in names:raise ValueError("manifest_missing")
        m=json.loads(z.read(MANIFEST_NAME))
        if m.get("package_type")!=PACKAGE_TYPE or m.get("schema_version")!=SCHEMA_VERSION:raise ValueError("manifest_type_invalid")
        if not PACKAGE_ID_RE.fullmatch(str(m.get("package_id") or "")) or not isinstance(m.get("package_revision"),int) or m["package_revision"]<1:raise ValueError("manifest_identity_invalid")
        if m.get("runtime_version")!=RUNTIME_VERSION or m.get("protocol_version")!=PROTOCOL_VERSION:raise ValueError("runtime_protocol_unsupported")
        rows=m.get("animations")
        if not isinstance(rows,list) or not 1<=len(rows)<=MAX_ANIMATIONS:raise ValueError("animation_count_invalid")
        qids=set();paths=set()
        for row in rows:
            qid=str(row.get("qid") or "")
            if not QID_RE.fullmatch(qid) or qid in qids:raise ValueError("manifest_qid_duplicate_or_invalid")
            qids.add(qid);validate_duration(row.get("duration_ms"))
            for field in ["entry_path","scene_path","source_record_path"]:
                p=safe_path(row.get(field) or "")
                if p in paths:raise ValueError("manifest_path_duplicate")
                paths.add(p)
                if p not in names:raise ValueError("manifest_asset_missing:"+p)
            for field,pathfield in [("entry_sha256","entry_path"),("scene_sha256","scene_path"),("source_record_sha256","source_record_path")]:
                expected=str(row.get(field) or "")
                if not re.fullmatch(r"[a-f0-9]{64}",expected):raise ValueError("manifest_hash_invalid")
                if sha256_bytes(z.read(row[pathfield]))!=expected:raise ValueError("manifest_checksum_mismatch:"+qid)
            source=json.loads(z.read(row["source_record_path"]))
            q=source.get("question");integ=source.get("integrity") or {}
            if not isinstance(q,dict) or q.get("id")!=qid or content_hash(q)!=row.get("content_hash") or integ.get("content_hash")!=row.get("content_hash"):raise ValueError("source_binding_mismatch:"+qid)
            resolved=resolve_answer(q)
            if resolved["statements"]!=row.get("final_panel",{}).get("correct_answer_statements"):raise ValueError("final_answer_not_source_derived:"+qid)
        if set(m.get("selection",{}).get("qids") or [])!=qids or int(m.get("selection",{}).get("count") or -1)!=len(qids):raise ValueError("selection_manifest_mismatch")
        allowed=set(ALLOWED_ROOT_FILES)|paths
        extra=[n for n in names if n not in allowed and not n.startswith("reports/")]
        if extra:raise ValueError("unapproved_package_files:"+",".join(sorted(extra)[:5]))
        return m
