#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT))
from motioncards.lib.compiler import compile_scene

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--dist",type=Path,required=True);ap.add_argument("--meta",type=Path,required=True);a=ap.parse_args()
    qid="Q000000001";scene={"schema_version":1,"qid":qid,"duration_ms":4000,"takeaway":"Directional flow reaches the target.",
        "layers":[{"type":"arrow","x1":500,"y1":220,"x2":140,"y2":90,"stroke":"#16606A","stroke_width":7,"start_ms":0,"end_ms":4000,"from":{"opacity":0.2},"to":{"opacity":1}}]}
    raw=compile_scene(scene).encode();sha=hashlib.sha256(raw).hexdigest();rel=f"assets/FIXTURE/r1/{qid}.{sha[:12]}.html"
    target=a.dist/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    idx=a.dist/"indexes/FIXTURE/v1/index.json";idx.parent.mkdir(parents=True,exist_ok=True)
    record={"book_id":"FIXTURE","book_version":1,"chapter_id":1,"qid":qid,"content_hash":"a"*64,"publisher_fingerprint":"b"*64,"duration_ms":4000,
            "entry_url":"https://kafu-motioncards.blsmohamme97.workers.dev/"+rel,"entry_sha256":sha,
            "final_panel":{"takeaway":scene["takeaway"],"correct_answer_statements":["Correct"]},"package_id":"FIXTURE","package_revision":1}
    idx.write_text(json.dumps({"schema":1,"runtime_version":1,"protocol_version":1,"book_id":"FIXTURE","book_version":1,"animations":{qid:record}}))
    (a.dist/"build-info.json").write_text(json.dumps({"schema":1,"state_sha256":"c"*64}))
    a.meta.write_text(json.dumps({"entry_path":"/"+rel,"entry_sha256":sha,"qid":qid,"duration_ms":4000,"index_path":"/indexes/FIXTURE/v1/index.json"}))
    print(a.meta)
if __name__=="__main__":main()
