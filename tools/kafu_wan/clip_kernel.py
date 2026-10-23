# Kaggle kernel (GPU T4 x2): one Wan2.2-TI2V-5B clip from the weights the two kafu-wan-* kernels saved.
# Written by tools/kafu_wan/kafu_wan.py, which fills in CFG; never edit a pushed copy by hand.
# Layout on two T4s (15 GB each):
#   1. umT5-XXL in fp32, split over both GPUs, encodes the prompt and the negative prompt, then is freed.
#   2. One fp16 copy of the 5B transformer per GPU: GPU 0 runs the prompt pass, GPU 1 the negative pass, in
#      parallel (classifier-free guidance), so each step costs one forward instead of two. VAE (fp32) on GPU 0.
import base64, glob, io, json, os, subprocess, sys, threading, time

t_start = time.time()
CFG = json.loads(base64.b64decode("{{CFG_B64}}"))
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "diffusers==0.41.0", "ftfy", "imageio-ffmpeg"],
               check=True)

import torch
from PIL import Image
from diffusers import AutoencoderKLWan, WanImageToVideoPipeline, WanPipeline, WanTransformer3DModel
from diffusers.schedulers import UniPCMultistepScheduler
from diffusers.utils import export_to_video
from transformers import AutoTokenizer, UMT5EncoderModel

OUT = "/kaggle/working"
NEG = ("色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，"
       "残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，"
       "三条腿，背景人很多，倒着走")
log = {"cfg": {k: v for k, v in CFG.items() if k != "image_b64"}, "gpus": [torch.cuda.get_device_name(i)
       for i in range(torch.cuda.device_count())]}
print(json.dumps(log, ensure_ascii=False), flush=True)


def find(marker):
    hits = glob.glob(f"/kaggle/input/**/{marker}", recursive=True)
    if not hits:
        raise SystemExit(f"weights not mounted: {marker} (run `kafu_wan.py weights` first)")
    return os.path.dirname(hits[0])


DIT = find("wan22-ti2v-5b/model_index.json")
TE = find("umt5-xxl/config.json")
two = CFG["gpus"] == 2 and torch.cuda.device_count() >= 2
dev0, dev1 = torch.device("cuda:0"), torch.device("cuda:1" if two else "cuda:0")

# 1. Prompt embeddings (fp32: T5 overflows in fp16, and T4 has no bf16 tensor cores).
t = time.time()
tok = AutoTokenizer.from_pretrained(DIT, subfolder="tokenizer")
te = UMT5EncoderModel.from_pretrained(
    TE, torch_dtype=torch.float32, device_map="auto",
    max_memory={0: "14GiB", 1: "14GiB"} if two else {0: "14GiB", "cpu": "28GiB"})
pipe_te = WanPipeline(tokenizer=tok, text_encoder=te, vae=None, transformer=None, scheduler=None)
with torch.no_grad():
    pos = pipe_te._get_t5_prompt_embeds(CFG["prompt"], max_sequence_length=512, device=dev0, dtype=torch.float16)
    neg = pipe_te._get_t5_prompt_embeds(CFG.get("negative") or NEG, max_sequence_length=512, device=dev1,
                                       dtype=torch.float16)
del pipe_te, te
torch.cuda.empty_cache()
log["t_text_encoder"] = round(time.time() - t, 1)

# 2. Transformer(s) and VAE.
t = time.time()
tr0 = WanTransformer3DModel.from_pretrained(DIT, subfolder="transformer", torch_dtype=torch.float16).to(dev0)
tr1 = WanTransformer3DModel.from_pretrained(DIT, subfolder="transformer", torch_dtype=torch.float16).to(dev1) \
    if two else tr0
vae = AutoencoderKLWan.from_pretrained(DIT, subfolder="vae", torch_dtype=torch.float32).to(dev0)
vae.enable_tiling()
scheduler = UniPCMultistepScheduler.from_pretrained(DIT, subfolder="scheduler")
log["t_load"] = round(time.time() - t, 1)


class ParallelCFG(torch.nn.Module):
    """Stands in for the transformer with guidance_scale=1 in the pipeline: runs the prompt pass on GPU 0 and the
    negative pass on GPU 1 at once and returns the guided prediction, so the pipeline calls it once per step."""

    def __init__(self, cond, uncond, neg_embeds, scale):
        super().__init__()
        self.cond, self.uncond, self.neg, self.scale = cond, uncond, neg_embeds, scale
        self.cache_context = cond.cache_context

    config = property(lambda self: self.cond.config)
    dtype = property(lambda self: self.cond.dtype)
    device = property(lambda self: self.cond.device)

    def forward(self, hidden_states, timestep, encoder_hidden_states, **kw):
        kw["return_dict"] = False
        d1, box = self.uncond.device, {}

        def run_uncond():
            with torch.cuda.device(d1), torch.no_grad():
                box["u"] = self.uncond(hidden_states=hidden_states.to(d1), timestep=timestep.to(d1),
                                       encoder_hidden_states=self.neg, **kw)[0]

        th = threading.Thread(target=run_uncond)
        th.start()
        c = self.cond(hidden_states=hidden_states, timestep=timestep, encoder_hidden_states=encoder_hidden_states,
                      **kw)[0]
        th.join()
        u = box["u"].to(c.device)
        out = u + self.scale * (c - u)
        if not torch.isfinite(out).all():
            raise RuntimeError("non-finite prediction (fp16 overflow)")
        return (out,)


image = None
if CFG.get("image_b64") == "example":
    image = Image.open(os.path.join(DIT, "examples", "i2v_input.JPG")).convert("RGB")
elif CFG.get("image_b64"):
    image = Image.open(io.BytesIO(base64.b64decode(CFG["image_b64"]))).convert("RGB")
if image is not None:
    image = image.resize((CFG["width"], CFG["height"]), Image.LANCZOS)

if two:
    transformer, guidance, extra = ParallelCFG(tr0, tr1, neg, CFG["guidance"]), 1.0, {}
else:
    transformer, guidance, extra = tr0, CFG["guidance"], {"negative_prompt_embeds": neg}
common = dict(tokenizer=None, text_encoder=None, vae=vae, transformer=transformer, scheduler=scheduler,
              expand_timesteps=True)
if image is not None:
    pipe = WanImageToVideoPipeline(image_processor=None, image_encoder=None, **common)
    extra["image"] = image
else:
    pipe = WanPipeline(**common)

# 3. Denoise + decode.
t = time.time()
gen = torch.Generator(device=dev0).manual_seed(CFG["seed"])
with torch.no_grad():
    frames = pipe(prompt_embeds=pos, height=CFG["height"], width=CFG["width"], num_frames=CFG["frames"],
                  num_inference_steps=CFG["steps"], guidance_scale=guidance, generator=gen, **extra).frames[0]
log["t_generate"] = round(time.time() - t, 1)
path = os.path.join(OUT, CFG["name"] + ".mp4")
export_to_video(frames, path, fps=CFG["fps"], quality=9)
log["peak_mem_gb"] = [round(torch.cuda.max_memory_allocated(i) / 1e9, 1) for i in range(torch.cuda.device_count())]
log["t_total"] = round(time.time() - t_start, 1)
log["mp4"] = os.path.basename(path)
json.dump(log, open(os.path.join(OUT, CFG["name"] + ".json"), "w"), ensure_ascii=False, indent=2)
print("KAFU_WAN_DONE", json.dumps(log, ensure_ascii=False), flush=True)
