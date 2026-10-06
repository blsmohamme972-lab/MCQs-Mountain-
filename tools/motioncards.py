#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from motioncards.lib.core import adapt_exports
from motioncards.lib.package import scaffold_workspace,build_package,validate_package
from motioncards.lib.compiler import compile_scene,validate_scene
from motioncards.lib.spec import parse_package_filename

def load(paths):return adapt_exports([json.loads(Path(x).read_text(encoding="utf-8")) for x in paths])

def overrides(values):
    out={}
    for item in values or []:
        qid,ms=item.split("=",1);out[qid]=int(ms)
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

    p=sub.add_parser("package")
    p.add_argument("exports",nargs="+")
    p.add_argument("--workspace",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)

    v=sub.add_parser("validate");v.add_argument("zip",type=Path)
    f=sub.add_parser("filename");f.add_argument("name")
    pr=sub.add_parser("preview");pr.add_argument("--workspace",type=Path,required=True);pr.add_argument("--port",type=int,default=8767)

    a=ap.parse_args()
    if a.cmd=="scaffold":
        b=load(a.exports)
        result=scaffold_workspace(b,a.out,a.package_id.upper(),a.revision,a.qids,a.count,a.duration_ms,overrides(a.duration),set(a.inspected_image_qid))
        print(json.dumps(result,indent=2));return
    if a.cmd=="package":
        b=load(a.exports);m=build_package(b,a.workspace,a.out)
        print(json.dumps({"zip":str(a.out),"animations":len(m["animations"])},indent=2));return
    if a.cmd=="validate":
        m=validate_package(a.zip)
        print(json.dumps({"status":"PASS","package_id":m["package_id"],"revision":m["package_revision"],"animations":len(m["animations"])},indent=2));return
    if a.cmd=="filename":
        print(json.dumps(parse_package_filename(a.name)));return
    if a.cmd=="preview":
        import http.server,socketserver,threading,webbrowser
        selection=json.loads((a.workspace/"selection.json").read_text())
        out=a.workspace/"preview";out.mkdir(exist_ok=True)
        links=[]
        for row in selection["selected"]:
            qid=row["qid"];scene=json.loads((a.workspace/"scenes"/f"{qid}.scene.json").read_text())
            validate_scene(scene,qid,int(row["duration_ms"]))
            (out/f"{qid}.html").write_text(compile_scene(scene,[f"http://127.0.0.1:{a.port}"]),encoding="utf-8")
            links.append(f'<li><a href="/{qid}.html">{qid}</a> — {row["duration_ms"]} ms</li>')
        (out/"index.html").write_text("<!doctype html><meta charset=utf-8><title>Kafu MotionCards preview</title><h1>Kafu MotionCards preview</h1><ul>"+"".join(links)+"</ul>")
        class Handler(http.server.SimpleHTTPRequestHandler):
            def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(out),**kwargs)
            def log_message(self,fmt,*args):pass
        print(f"Preview: http://127.0.0.1:{a.port}/")
        with socketserver.TCPServer(("127.0.0.1",a.port),Handler) as server:server.serve_forever()
        return
if __name__=="__main__":main()
