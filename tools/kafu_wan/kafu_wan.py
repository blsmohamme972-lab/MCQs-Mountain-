#!/usr/bin/env python3
"""Wan video clips on Kaggle (private kernels, T4 x2). See tools/kafu_wan/README.md.

  kafu_wan.py weights                    # once: save the Wan2.2-TI2V-5B weights as two private kernel outputs
  kafu_wan.py clip --image rain_room.png --prompt "..."   # one clip -> work/wan/<name>.mp4
  kafu_wan.py status                     # every kernel of the account and its state

Needs the `kaggle` CLI with KAGGLE_USERNAME / KAGGLE_API_TOKEN in the environment (never printed here).
Only one GPU job at a time: `clip` waits until no kernel of the account is running or queued.
"""
import argparse, base64, io, json, math, os, re, subprocess, sys, tempfile, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
USER = os.environ.get("KAGGLE_USERNAME", "")
WEIGHT_KERNELS = {"dit": "kafu-wan-weights", "umt5": "kafu-wan-umt5"}
CLIP_KERNEL = "kafu-wan-clip"
BUSY = ("RUNNING", "QUEUED")


def kaggle(*args, check=True):
    r = subprocess.run(["kaggle", *args], capture_output=True, text=True)
    if check and r.returncode:
        sys.exit(f"kaggle {args[0]} {args[1]} failed:\n{r.stdout}{r.stderr}")
    return r.stdout


def status(slug):
    out = kaggle("kernels", "status", f"{USER}/{slug}", check=False)
    m = re.search(r'status "(?:KernelWorkerStatus\.)?(\w+)"', out)
    return m.group(1) if m else "UNKNOWN"


def my_kernels():
    rows = kaggle("kernels", "list", "--mine", "--page-size", "100", "--csv").strip().splitlines()[1:]
    return [r.split(",")[0].split("/")[-1] for r in rows if r]


def wait_until_free():
    while True:
        busy = [(k, s) for k in my_kernels() if (s := status(k)) in BUSY]
        if not busy:
            return
        print("waiting, already running:", ", ".join(f"{k} ({s})" for k, s in busy), flush=True)
        time.sleep(120)


def push(slug, code, gpu, sources=()):
    d = Path(tempfile.mkdtemp(prefix=slug + "-"))
    (d / f"{slug}.py").write_text(code)
    (d / "kernel-metadata.json").write_text(json.dumps({
        "id": f"{USER}/{slug}", "title": slug, "code_file": f"{slug}.py", "language": "python",
        "kernel_type": "script", "is_private": True, "enable_gpu": gpu, "enable_tpu": False,
        "enable_internet": True, "dataset_sources": [], "competition_sources": [], "model_sources": [],
        "kernel_sources": [f"{USER}/{s}" for s in sources],
        **({"machine_shape": "NvidiaTeslaT4"} if gpu else {}),
    }, indent=2))
    print(kaggle("kernels", "push", "-p", str(d)).strip().splitlines()[-1], flush=True)


def wait_done(slugs):
    t0, last = time.time(), {}
    time.sleep(30)
    while True:
        now = {s: status(s) for s in slugs}
        if now != last:
            print(f"{(time.time() - t0) / 60:5.1f} min  " + "  ".join(f"{s}: {v}" for s, v in now.items()), flush=True)
            last = now
        if all(v not in BUSY for v in now.values()):
            return now, time.time() - t0
        time.sleep(60)


def cmd_weights(a):
    for part, slug in WEIGHT_KERNELS.items():  # CPU-only kernels: no GPU quota used
        push(slug, (HERE / "weights_kernel.py").read_text().replace("{{PART}}", part), gpu=False)
    final, secs = wait_done(list(WEIGHT_KERNELS.values()))
    for slug in WEIGHT_KERNELS.values():
        log = Path(tempfile.mkdtemp())
        kaggle("kernels", "output", f"{USER}/{slug}", "-p", str(log), "--file-pattern", r".*\.log$", check=False)
        for f in log.glob("*.log"):
            text = "".join(x.get("data", "") for x in json.loads(f.read_text() or "[]"))
            print(f"--- {slug}: " + "\n".join(l for l in text.splitlines() if "DONE" in l or "licence" in l
                                                  or "Error" in l)[-1500:])
    if any(v != "COMPLETE" for v in final.values()):
        sys.exit(f"weights failed: {final}")
    print(f"weights saved in {secs / 60:.0f} min")


def size_for(w, h, area):
    """Width and height near `area` pixels with the image's aspect, both multiples of 32 (VAE 16 x patch 2)."""
    s = math.sqrt(area / (w * h))
    return max(32, round(w * s / 32) * 32), max(32, round(h * s / 32) * 32)


def cmd_clip(a):
    from PIL import Image
    name = a.name or (Path(a.image).stem if a.image not in ("example", "none") else "clip") + f"_s{a.seed}"
    area = {"480p": 480 * 832, "720p": 704 * 1280}[a.res]
    cfg = {"name": name, "prompt": a.prompt, "negative": a.negative, "steps": a.steps, "guidance": a.guidance,
           "seed": a.seed, "fps": 24, "frames": round(a.seconds * 24 / 4) * 4 + 1, "gpus": a.gpus}
    if a.image == "none":
        cfg["width"], cfg["height"] = size_for(16, 9, area)
    elif a.image == "example":
        cfg["image_b64"] = "example"
        cfg["width"], cfg["height"] = size_for(16, 9, area)
    else:
        im = Image.open(a.image).convert("RGB")
        cfg["width"], cfg["height"] = size_for(*im.size, area)
        im = im.resize((cfg["width"], cfg["height"]), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=95)
        cfg["image_b64"] = base64.b64encode(buf.getvalue()).decode()
    print(f"{name}: {cfg['width']}x{cfg['height']}, {cfg['frames']} frames, {a.steps} steps, {a.gpus} GPU(s)")
    wait_until_free()
    code = (HERE / "clip_kernel.py").read_text().replace(
        "{{CFG_B64}}", base64.b64encode(json.dumps(cfg, ensure_ascii=False).encode()).decode())
    push(CLIP_KERNEL, code, gpu=True, sources=WEIGHT_KERNELS.values())
    final, secs = wait_done([CLIP_KERNEL])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    kaggle("kernels", "output", f"{USER}/{CLIP_KERNEL}", "-p", str(out), check=False)
    mp4, info = out / f"{name}.mp4", out / f"{name}.json"
    print(f"kernel {final[CLIP_KERNEL]} after {secs / 60:.1f} min (~{secs / 3600:.2f} GPU hours)")
    if not mp4.exists():
        log = out / f"{CLIP_KERNEL}.log"
        text = "".join(x.get("data", "") for x in json.loads(log.read_text())) if log.exists() else ""
        sys.exit(f"no MP4. Last log lines:\n{text[-3000:]}")
    print(info.read_text() if info.exists() else "")
    print("MP4:", mp4)


def cmd_status(a):
    for k in my_kernels():
        print(f"{k:32s} {status(k)}")


def main():
    if not USER:
        sys.exit("KAGGLE_USERNAME is not set")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("weights").set_defaults(fn=cmd_weights)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    c = sub.add_parser("clip")
    c.add_argument("--image", required=True, help="PNG/JPG path, 'example' (the model card image) or 'none' (text only)")
    c.add_argument("--prompt", required=True)
    c.add_argument("--negative", default="", help="negative prompt (default: Wan's official one)")
    c.add_argument("--name", default="")
    c.add_argument("--seconds", type=float, default=5)
    c.add_argument("--res", choices=("480p", "720p"), default="480p")
    c.add_argument("--steps", type=int, default=40)
    c.add_argument("--guidance", type=float, default=5.0)
    c.add_argument("--seed", type=int, default=42)
    c.add_argument("--gpus", type=int, choices=(1, 2), default=2)
    c.add_argument("--out", default=str(ROOT / "work" / "wan"))
    c.set_defaults(fn=cmd_clip)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
