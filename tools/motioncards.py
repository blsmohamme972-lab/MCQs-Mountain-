#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from motioncards.lib.core import adapt_exports,resolve_answer
from motioncards.lib.package import scaffold_workspace
from motioncards.lib.multipart import build_package_set,validate_package_part
from motioncards.lib.compiler import compile_scene,validate_scene,preview_host_html
from motioncards.lib.engine_v2 import lint_scene_v2
from motioncards.lib.spec import parse_package_filename

def load(paths):return adapt_exports([json.loads(Path(x).read_text(encoding="utf-8")) for x in paths])

def overrides(values):
    out={}
    for item in values or []:
        qid,ms=item.split("=",1);out[qid]=int(ms)
    return out

def scene_targets(targets,workspace):
    paths=list(targets or [])
    if workspace:paths+=sorted((workspace/"scenes").glob("*.scene.json"))
    if not paths:raise SystemExit("give scene files or --workspace")
    out=[]
    for p in paths:
        try:out.append((p,json.loads(p.read_text(encoding="utf-8"))))
        except json.JSONDecodeError as exc:raise SystemExit(f"{p}: invalid JSON: {exc}")
    return out

def main():
    ap=argparse.ArgumentParser(prog="motioncards")
    sub=ap.add_subparsers(dest="cmd",required=True)
    s=sub.add_parser("scaffold")
    s.add_argument("exports",nargs="+")
    s.add_argument("--out",type=Path,required=True)
    s.add_argument("--package-id",required=True)
    s.add_argument("--revision",type=int,required=True)
    g=s.add_mutually_exclusive_group(required=True)
    g.add_argument("--qids",nargs="+")
    g.add_argument("--count",type=int)
    s.add_argument("--duration-ms",type=int)
    s.add_argument("--duration",action="append",default=[],help="QID=milliseconds")
    s.add_argument("--inspected-image-qid",action="append",default=[])
    s.add_argument("--replace",action="append",default=[],help="Selected QID to mark as an intended replacement; confirmation is still required before activation")
    s.add_argument("--schema",type=int,choices=[1,2],default=2,help="Starter scene schema (2 = current engine; 1 = legacy)")

    p=sub.add_parser("package")
    p.add_argument("exports",nargs="+")
    p.add_argument("--workspace",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)

    v=sub.add_parser("validate");v.add_argument("zip",type=Path)
    f=sub.add_parser("filename");f.add_argument("name")
    pr=sub.add_parser("preview");pr.add_argument("--workspace",type=Path,required=True);pr.add_argument("--port",type=int,default=8767)
    li=sub.add_parser("lint",help="Validate scenes and print layout warnings")
    li.add_argument("targets",nargs="*",type=Path,help="scene .json files");li.add_argument("--workspace",type=Path)
    rn=sub.add_parser("render",help="Render scenes to PNG frames + contact sheet (needs playwright + Chromium)")
    rn.add_argument("targets",nargs="*",type=Path,help="scene .json files");rn.add_argument("--workspace",type=Path)
    rn.add_argument("--out",type=Path,default=Path("render"));rn.add_argument("--frames",type=int,default=6)
    rn.add_argument("--times",help="comma-separated milliseconds, e.g. 0,1500,4000")
    rn.add_argument("--sizes",default="phone,tablet",help="phone,tablet")

    a=ap.parse_args()
    if a.cmd=="scaffold":
        b=load(a.exports)
        result=scaffold_workspace(b,a.out,a.package_id.upper(),a.revision,a.qids,a.count,a.duration_ms,overrides(a.duration),set(a.inspected_image_qid),set(a.replace),a.schema)
        print(json.dumps(result,indent=2));return
    if a.cmd in {"lint","render"}:
        scenes=scene_targets(a.targets,a.workspace)
        problems=0;report=[]
        for path,scene in scenes:
            try:
                validate_scene(scene,str(scene.get("qid")),scene.get("duration_ms"))
                warnings=lint_scene_v2(scene) if scene.get("schema_version")==2 else []
                report.append({"scene":str(path),"status":"PASS","warnings":warnings})
            except ValueError as exc:
                problems+=1;report.append({"scene":str(path),"status":"FAIL","error":str(exc)})
        if a.cmd=="lint" or problems:
            print(json.dumps(report,ensure_ascii=False,indent=2))
            if problems:sys.exit(1)
            return
        from motioncards.lib.render import render_scenes
        times=[int(x) for x in a.times.split(",")] if a.times else None
        out=render_scenes([sc for _,sc in scenes],a.out,times=times,frames=a.frames,sizes=[x.strip() for x in a.sizes.split(",") if x.strip()])
        for row,item in zip(report,out):row.update(item)
        print(json.dumps(report,ensure_ascii=False,indent=2));return
    if a.cmd=="package":
        for path,scene in scene_targets([],a.workspace):
            if scene.get("schema_version")==2:
                for w in lint_scene_v2(scene):print(f"warning: {path.name}: {w}",file=sys.stderr)
        b=load(a.exports);paths=build_package_set(b,a.workspace,a.out)
        total=sum(len(validate_package_part(p)["animations"]) for p in paths)
        print(json.dumps({"zips":[str(p) for p in paths],"animations":total},indent=2));return
    if a.cmd=="validate":
        m=validate_package_part(a.zip)
        print(json.dumps({"status":"PASS","package_id":m["package_id"],"revision":m["package_revision"],"animations":len(m["animations"])},indent=2));return
    if a.cmd=="filename":
        print(json.dumps(parse_package_filename(a.name)));return
    if a.cmd=="preview":
        import http.server,socketserver
        selection=json.loads((a.workspace/"selection.json").read_text())
        raw=sorted((a.workspace/"input").glob("raw-export-*.json"))
        if not raw:raise ValueError("preview_source_export_missing")
        bundle=load(raw);by_id={q["id"]:q for q in bundle.questions}
        out=a.workspace/"preview";out.mkdir(exist_ok=True)
        links=[];origin=f"http://127.0.0.1:{a.port}"
        for row in selection["selected"]:
            qid=row["qid"];scene=json.loads((a.workspace/"scenes"/f"{qid}.scene.json").read_text())
            validate_scene(scene,qid,int(row["duration_ms"]))
            question=by_id.get(qid)
            if not question:raise ValueError("preview_question_missing:"+qid)
            answers=resolve_answer(question)["statements"]
            (out/f"{qid}.html").write_text(compile_scene(scene,[origin],preview=True),encoding="utf-8")
            host_name=f"{qid}-preview.html"
            (out/host_name).write_text(preview_host_html(scene,answers,a.port),encoding="utf-8")
            links.append(f'<li><a href="/{host_name}">{qid}</a> — {row["duration_ms"]} ms</li>')
        (out/"index.html").write_text("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Kafu MotionCards preview</title><h1>Kafu MotionCards preview</h1><p>Each link opens the trusted preview host with the real MessageChannel/timeline contract.</p><ul>"+"".join(links)+"</ul>",encoding="utf-8")
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(out),**kwargs)
            def log_message(self,fmt,*args):pass
        print(f"Preview: {origin}/",flush=True)
        with socketserver.TCPServer(("127.0.0.1",a.port),Handler) as server:server.serve_forever()
        return
if __name__=="__main__":main()
