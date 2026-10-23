# Kaggle kernel (CPU only): download one part of Wan-AI/Wan2.2-TI2V-5B-Diffusers once, store it as this kernel's
# output so the clip kernel mounts it with no download. The fp32 repo is 34 GB and a kernel output holds 20 GB, so the
# weights are split in two kernels and stored in bf16 (the VAE stays fp32):
#   PART "dit"  -> wan22-ti2v-5b/  transformer (bf16, ~10 GB), vae, scheduler, tokenizer, model_index.json
#   PART "umt5" -> umt5-xxl/       text encoder (bf16, ~11.4 GB); the same umT5-XXL serves the Wan2.1 1.3B models
# Licence: Apache-2.0 (model card, checked when this was set up).
import json, os, shutil, time

import torch
from huggingface_hub import HfApi, hf_hub_download
from safetensors.torch import load_file, save_file

PART = "{{PART}}"
REPO = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
TMP = "/tmp/hf"
OUT = "/kaggle/working/" + {"dit": "wan22-ti2v-5b", "umt5": "umt5-xxl"}[PART]
CAST = {"dit": "transformer/", "umt5": "text_encoder/"}[PART]
KEEP = {
    "dit": ("transformer/", "vae/", "scheduler/", "tokenizer/", "model_index.json", "examples/i2v_input.JPG"),
    "umt5": ("text_encoder/",),
}[PART]

t0 = time.time()
info = HfApi().model_info(REPO, files_metadata=True)
print("licence:", (info.card_data or {}).get("license"), "| sha:", info.sha)
files = [s for s in info.siblings if s.rfilename.startswith(KEEP)]
for s in files:
    src = hf_hub_download(REPO, s.rfilename, revision=info.sha, local_dir=TMP)
    rel = s.rfilename[len(CAST):] if PART == "umt5" else s.rfilename
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if s.rfilename.startswith(CAST) and s.rfilename.endswith(".safetensors"):
        sd = load_file(src)
        sd = {k: v.to(torch.bfloat16) if v.is_floating_point() else v for k, v in sd.items()}
        save_file(sd, dst, metadata={"format": "pt"})
        del sd
        os.remove(src)
    else:
        shutil.move(src, dst)
    print(f"{time.time() - t0:7.0f}s  {s.rfilename}  ->  {os.path.getsize(dst) / 1e9:.2f} GB", flush=True)

# The shard index records fp32 sizes; diffusers/transformers only read its weight map, but keep the total honest.
for idx in [os.path.join(d, f) for d, _, fs in os.walk(OUT) for f in fs if f.endswith(".safetensors.index.json")]:
    meta = json.load(open(idx))
    meta.setdefault("metadata", {})["total_size"] = sum(
        os.path.getsize(os.path.join(os.path.dirname(idx), f)) for f in set(meta["weight_map"].values()))
    json.dump(meta, open(idx, "w"), indent=2)

json.dump({"repo": REPO, "revision": info.sha, "licence": "apache-2.0", "part": PART, "dtype": "bfloat16"},
          open(os.path.join(OUT, "kafu_source.json"), "w"), indent=2)
shutil.rmtree(TMP, ignore_errors=True)
total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
print(f"DONE {PART}: {total / 1e9:.1f} GB in {time.time() - t0:.0f}s")
