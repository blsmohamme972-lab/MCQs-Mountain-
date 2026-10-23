# Kafu Wan: video clips on Kaggle

Image-to-video (and text-to-video) with **Wan-AI/Wan2.2-TI2V-5B** (official Diffusers weights, Apache-2.0),
run in private Kaggle kernels on the free T4 x2 GPUs.

## Make a clip (one command)

```sh
python3 tools/kafu_wan/kafu_wan.py clip --image rain_room.png \
  --prompt "the girl gasps in surprise, steps back and covers her mouth, camera slowly pushes in, 3D animated film style"
```

The MP4 and a JSON with the timings land in `work/wan/` (MP4s are git-ignored: send them in chat).
Options: `--seconds 5`, `--res 480p|720p`, `--steps 40`, `--seed 42`, `--image none` for text only,
`--gpus 1` to use one T4 (half the speed).

Needs `pip install kaggle` and `KAGGLE_USERNAME` / `KAGGLE_API_TOKEN` in the environment (never print the token).
Only one GPU job at a time: `clip` first waits until no kernel of the account is running or queued.
`kafu_wan.py status` lists the kernels and their state.

## How it is stored (done once: `kafu_wan.py weights`)

The fp32 repo is 34 GB and a Kaggle kernel output holds 20 GB, so two CPU-only kernels download it once and keep it,
in bf16, as their private output; the clip kernel mounts both with no download:

| Kernel | Output | Size |
|---|---|---|
| `kafu-wan-weights` | `wan22-ti2v-5b/`: transformer (bf16), VAE (fp32), scheduler, tokenizer | ~13 GB |
| `kafu-wan-umt5` | `umt5-xxl/`: the umT5-XXL text encoder (bf16), shared by all Wan 2.1/2.2 models | ~11 GB |

Do not delete or re-run these two kernels (a re-run downloads again). The clip kernel is `kafu-wan-clip`;
each clip is a new version of it.

## What the clip kernel does on two T4s

1. umT5-XXL in fp32 split over both GPUs encodes the prompt and the negative prompt (T5 overflows in fp16 and the
   T4 has no bf16 tensor cores), then it is freed.
2. One fp16 copy of the transformer per GPU: GPU 0 runs the prompt pass and GPU 1 the negative pass at the same time
   (classifier-free guidance), so a step costs one forward instead of two. The VAE (fp32, tiled) decodes on GPU 0.
3. 24 fps, 121 frames = 5 s. 480p means about 480 x 832 pixels with the image's aspect, multiples of 32.

## Fallbacks (not set up unless the 5B model fails)

- `Wan-AI/Wan2.1-VACE-1.3B` (reference image), then `Wan-AI/Wan2.1-T2V-1.3B` (text only). Both Apache-2.0 and both
  use the same umT5-XXL, so only their transformer and VAE would need a new weights kernel.
