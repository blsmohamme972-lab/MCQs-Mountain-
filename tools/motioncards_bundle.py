#!/usr/bin/env python3
from __future__ import annotations
import argparse,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[
 "motioncards/README.md","motioncards/PROJECT_BRIEF.md","motioncards/MASTER_PROMPT.md","motioncards/TOOLKIT.md","motioncards/AGENTS.md",
 "motioncards/schema/motioncards-manifest.schema.json","motioncards/schema/scene.schema.json","motioncards/golden/canonical-v1.json",
 "motioncards/lib/__init__.py","motioncards/lib/spec.py","motioncards/lib/core.py","motioncards/lib/compiler.py","motioncards/lib/package.py","motioncards/lib/multipart.py",
 "motioncards/examples/flow.scene.json","motioncards/examples/sequence.scene.json","tools/motioncards.py"
]
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--out",type=Path,required=True);a=ap.parse_args();a.out.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(a.out,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name in FILES:z.write(ROOT/name,name)
 print(a.out)
if __name__=="__main__":main()
