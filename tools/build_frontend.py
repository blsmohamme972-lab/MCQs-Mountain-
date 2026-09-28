"""Deterministic frontend assembly; source modules remain reviewable and tested.

Modules are inlined atomically with the HTML shell so an interrupted script
request cannot strand an upgraded personal-state format behind an old client.
Only a deployment checkout or a temporary test directory is changed.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HEAD_BEGIN="<!-- KAFU-ENHANCEMENTS:BEGIN -->"
HEAD_END="<!-- KAFU-ENHANCEMENTS:END -->"
BOOT="(async function boot() {"
INSTALL="/* KAFU-INSTALL */ if (globalThis.KafuEnhancements) globalThis.KafuEnhancements.install();\n"


def build(source: Path,out: Path,commit: str="development") -> dict:
    manifest=json.loads((source/"modules/manifest.json").read_text(encoding="utf-8"))
    html=(source/"index.html").read_text(encoding="utf-8")
    html=re.sub(re.escape(HEAD_BEGIN)+r"[\s\S]*?"+re.escape(HEAD_END)+r"\n?","",html)
    html=html.replace(INSTALL,"")
    if html.count("</head>")!=1 or html.count(BOOT)!=1:
        raise ValueError("Frontend assembly markers changed; refusing an ambiguous build")
    for field in ["scripts","styles"]:
        names=manifest.get(field,[])
        if not isinstance(names,list) or len(names)!=len(set(names)): raise ValueError("Duplicate or invalid module list")
        for name in names:
            path=Path(name)
            if not re.fullmatch(r"[A-Za-z0-9_./-]+",name) or path.is_absolute() or ".." in path.parts:
                raise ValueError("Unsafe frontend module path")
            if not (source/path).is_file(): raise ValueError("Missing frontend module: "+name)
    version={"version":str(manifest["version"]),"commit":commit if re.fullmatch(r"[a-f0-9]{7,40}",commit) else "development"}
    encoded=json.dumps(version).replace("<","\\u003c")
    tags=[HEAD_BEGIN,"<script>globalThis.KAFU_BUILD="+encoded+";</script>"]
    for name in manifest.get("styles",[]):
        css=(source/name).read_text(encoding="utf-8")
        if "</style" in css.lower(): raise ValueError("Unsafe CSS closing tag")
        tags.append("<style>\n"+css+"\n</style>")
    for name in manifest.get("scripts",[]):
        code=(source/name).read_text(encoding="utf-8")
        code=re.sub(r"</script",r"<\\/script",code,flags=re.I)
        tags.append("<script>\n"+code+"\n</script>")
    tags.append(HEAD_END)
    html=html.replace("</head>","\n".join(tags)+"\n</head>")
    html=html.replace(BOOT,INSTALL+BOOT)
    if source.resolve()!=out.resolve(): shutil.copytree(source,out,dirs_exist_ok=True)
    out.mkdir(parents=True,exist_ok=True)
    (out/"index.html").write_text(html,encoding="utf-8")
    (out/"build-info.json").write_text(json.dumps(version)+"\n",encoding="utf-8")
    return version


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",type=Path,default=ROOT/"app")
    parser.add_argument("--out",type=Path)
    parser.add_argument("--in-place",action="store_true")
    args=parser.parse_args()
    if not args.in_place and args.out is None: parser.error("Use --out or --in-place")
    result=build(args.source,args.source if args.in_place else args.out,os.environ.get("GITHUB_SHA","development"))
    print("Frontend assembled:",result["version"],result["commit"])

if __name__=="__main__":main()
